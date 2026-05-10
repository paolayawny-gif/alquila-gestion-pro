import { NextRequest, NextResponse } from 'next/server';
import { getBillingProvider, getTierById } from '@/lib/billing';
import { getOrInitBillingState, updateBillingState, calculateCurrentTier } from '@/lib/billing/state';
import { requireSessionForAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/sync-tier
 * Body: { adminId }
 * Recalcula el tier según contratos vigentes y, si cambió,
 * llama al proveedor para actualizar el monto de la suscripción.
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId } = (await req.json()) as { adminId: string };

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    const state = await getOrInitBillingState(adminId);
    const { tier: newTier, activeUnits } = await calculateCurrentTier(adminId);
    const oldTier = getTierById(state.tierId);

    // No hay suscripción activa todavía → solo actualizar el snapshot
    if (state.status !== 'active' || !state.subscriptionId) {
      await updateBillingState(adminId, { tierId: newTier.id, activeUnits });
      return NextResponse.json({ ok: true, changed: false, reason: 'sin_suscripcion_activa', activeUnits, tierId: newTier.id });
    }

    if (oldTier?.id === newTier.id) {
      await updateBillingState(adminId, { activeUnits });
      return NextResponse.json({ ok: true, changed: false, activeUnits, tierId: newTier.id });
    }

    // Cambió el tier → actualizar en el proveedor
    const provider = getBillingProvider();
    await provider.updateSubscriptionTier({
      subscriptionId: state.subscriptionId,
      newTier,
    });

    await updateBillingState(adminId, { tierId: newTier.id, activeUnits });

    return NextResponse.json({
      ok: true,
      changed: true,
      previousTierId: oldTier?.id,
      newTierId: newTier.id,
      activeUnits,
    });
  } catch (err: any) {
    console.error('[billing/sync-tier]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
