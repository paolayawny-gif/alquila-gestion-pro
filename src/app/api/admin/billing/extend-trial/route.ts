import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/firebase-admin';
import { updateBillingState, getOrInitBillingState } from '@/lib/billing/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/billing/extend-trial
 * Body: { adminId, days }
 * Extiende (o reactiva) el período de prueba de un admin por N días.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const { adminId, days } = (await req.json()) as { adminId: string; days: number };
    if (!adminId || !days || days < 1) {
      return NextResponse.json({ error: 'Faltan parámetros (adminId, days)' }, { status: 400 });
    }

    const state = await getOrInitBillingState(adminId);
    const baseDate = state.trialEndsAt ? new Date(state.trialEndsAt) : new Date();
    const newEnd = new Date(Math.max(baseDate.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000);

    await updateBillingState(adminId, {
      status: 'trial',
      trialEndsAt: newEnd.toISOString(),
    });

    return NextResponse.json({ ok: true, trialEndsAt: newEnd.toISOString() });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}
