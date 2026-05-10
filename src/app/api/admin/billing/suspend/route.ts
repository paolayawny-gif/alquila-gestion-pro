import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/firebase-admin';
import { getOrInitBillingState, updateBillingState } from '@/lib/billing/state';
import { getBillingProvider } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/billing/suspend
 * Body: { adminId, reason? }
 * Suspende manualmente la cuenta de un admin.
 * Si tiene suscripción activa en MP también la pausa allá para no seguir cobrando.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const { adminId, reason } = (await req.json()) as { adminId: string; reason?: string };
    if (!adminId) return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });

    const state = await getOrInitBillingState(adminId);

    // Cancelar en proveedor si hay suscripción activa
    if (state.subscriptionId && state.status === 'active') {
      try {
        const provider = getBillingProvider();
        await provider.cancelSubscription(state.subscriptionId);
      } catch (e: any) {
        // No bloqueamos la suspensión local si falla la del proveedor
        console.warn('[admin/suspend] no se pudo cancelar en proveedor:', e?.message);
      }
    }

    await updateBillingState(adminId, {
      status: 'paused',
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, suspendedReason: reason ?? null });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}
