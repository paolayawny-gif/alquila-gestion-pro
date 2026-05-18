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

    const existing = await getOrInitBillingState(adminId);

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

    // Si el admin YA estaba 'pending', conservamos el inicio original del plazo
    // de gracia. Así no puede reiniciar las 48 hs re-lanzando el checkout una y
    // otra vez sin llegar a pagar. Si venía de cualquier otro estado (trial,
    // active, cancelled, past_due) es un alta genuina → arranca un plazo nuevo.
    const pendingSince =
      existing.status === 'pending'
        ? existing.pendingSince ?? new Date().toISOString()
        : new Date().toISOString();

    await updateBillingState(adminId, {
      provider: provider.name,
      subscriptionId,
      tierId: tier.id,
      activeUnits,
      status: 'pending',
      pendingSince,
    });

    await setSubscriptionLookup(subscriptionId, adminId, provider.name);

    return NextResponse.json({ ok: true, initUrl, subscriptionId, tierId: tier.id });
  } catch (err: any) {
    console.error('[billing/checkout]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
