import { NextRequest, NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/billing';
import { getOrInitBillingState, updateBillingState } from '@/lib/billing/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/cancel
 * Body: { adminId }
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId } = (await req.json()) as { adminId: string };
    if (!adminId) return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });

    const state = await getOrInitBillingState(adminId);
    if (!state.subscriptionId) {
      return NextResponse.json({ error: 'No hay suscripción para cancelar' }, { status: 400 });
    }

    const provider = getBillingProvider();
    await provider.cancelSubscription(state.subscriptionId);

    await updateBillingState(adminId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[billing/cancel]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
