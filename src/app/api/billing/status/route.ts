import { NextRequest, NextResponse } from 'next/server';
import { getOrInitBillingState, calculateCurrentTier } from '@/lib/billing/state';
import { getTierById } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/status?adminId=xxx
 * Devuelve estado actual + tier que correspondería ahora (para detectar upgrades pendientes).
 */
export async function GET(req: NextRequest) {
  try {
    const adminId = req.nextUrl.searchParams.get('adminId');
    if (!adminId) {
      return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });
    }

    const state = await getOrInitBillingState(adminId);
    const { tier: shouldBeTier, activeUnits } = await calculateCurrentTier(adminId);
    const currentTier = getTierById(state.tierId);

    return NextResponse.json({
      ok: true,
      state,
      currentTier,
      shouldBeTier,
      activeUnits,
      needsUpgrade: state.tierId !== shouldBeTier.id && state.status === 'active',
    });
  } catch (err: any) {
    console.error('[billing/status]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
