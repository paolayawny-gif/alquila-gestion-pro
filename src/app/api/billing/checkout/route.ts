import { NextRequest, NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/billing';
import { calculateCurrentTier, updateBillingState, setSubscriptionLookup, getOrInitBillingState } from '@/lib/billing/state';
import { requireSessionForAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 * Body: { adminId, adminEmail }
 * Crea (o actualiza) la suscripción al tier que corresponda según contratos vigentes
 * y devuelve la URL para que el admin autorice el cobro recurrente.
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId, adminEmail } = (await req.json()) as { adminId: string; adminEmail: string };

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    if (!adminEmail) {
      return NextResponse.json({ error: 'Falta adminEmail' }, { status: 400 });
    }

    await getOrInitBillingState(adminId);

    const provider = getBillingProvider();
    const { tier, activeUnits } = await calculateCurrentTier(adminId);

    const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
    const returnUrl = `${baseUrl}/?billing=ok`;

    const { initUrl, subscriptionId } = await provider.createSubscription({
      adminId,
      adminEmail,
      tier,
      returnUrl,
    });

    await updateBillingState(adminId, {
      provider: provider.name,
      subscriptionId,
      tierId: tier.id,
      activeUnits,
      status: 'pending',
      pendingSince: new Date().toISOString(),
    });

    await setSubscriptionLookup(subscriptionId, adminId, provider.name);

    return NextResponse.json({ ok: true, initUrl, subscriptionId, tierId: tier.id });
  } catch (err: any) {
    console.error('[billing/checkout]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
