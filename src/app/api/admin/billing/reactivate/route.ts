import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/firebase-admin';
import { getOrInitBillingState, updateBillingState } from '@/lib/billing/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/billing/reactivate
 * Body: { adminId }
 * Reactiva una cuenta suspendida (vuelve a 'trial' por 14 días para que recargue tarjeta).
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const { adminId } = (await req.json()) as { adminId: string };
    if (!adminId) return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });

    await getOrInitBillingState(adminId);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await updateBillingState(adminId, {
      status: 'trial',
      trialEndsAt,
      cancelledAt: undefined,
      failedChargeAt: undefined,
    });

    return NextResponse.json({ ok: true, trialEndsAt });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}
