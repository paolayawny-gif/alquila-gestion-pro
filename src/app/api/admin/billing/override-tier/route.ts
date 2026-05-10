import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/firebase-admin';
import { getBillingProvider, getTierById } from '@/lib/billing';
import { getOrInitBillingState, updateBillingState } from '@/lib/billing/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/billing/override-tier
 * Body: { adminId, tierId }
 * Forzar un tier específico (override). Si hay suscripción activa, también
 * actualiza el monto en el proveedor.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const { adminId, tierId } = (await req.json()) as { adminId: string; tierId: string };
    if (!adminId || !tierId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

    const newTier = getTierById(tierId);
    if (!newTier) return NextResponse.json({ error: 'tierId desconocido' }, { status: 400 });

    const state = await getOrInitBillingState(adminId);

    if (state.status === 'active' && state.subscriptionId) {
      const provider = getBillingProvider();
      await provider.updateSubscriptionTier({ subscriptionId: state.subscriptionId, newTier });
    }

    await updateBillingState(adminId, { tierId: newTier.id });
    return NextResponse.json({ ok: true, tierId: newTier.id });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}
