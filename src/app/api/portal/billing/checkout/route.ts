import { NextRequest, NextResponse } from 'next/server';
import { requireSessionForAdmin } from '@/lib/auth';
import { getMpAccessToken, portalPlusRequestRef, getPortalPlusPriceARS } from '@/lib/portal-plus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MP_API = 'https://api.mercadopago.com';

/**
 * POST /api/portal/billing/checkout
 * Body: { adminId, adminEmail, adminName? }
 * Crea la suscripción mensual del Portal Plus y devuelve la URL de pago de MercadoPago.
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId, adminEmail, adminName } = (await req.json()) as {
      adminId: string; adminEmail: string; adminName?: string;
    };

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    if (!adminEmail) {
      return NextResponse.json({ error: 'Falta adminEmail' }, { status: 400 });
    }

    const accessToken = await getMpAccessToken();
    const priceARS = await getPortalPlusPriceARS();
    const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;

    const body = {
      reason: 'AlquilaGestión Pro — Portal Plus',
      external_reference: adminId,
      payer_email: adminEmail,
      back_url: `${baseUrl}/?portalPlus=ok`,
      notification_url: `${baseUrl}/api/portal/billing/webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: priceARS,
        currency_id: 'ARS',
      },
      status: 'pending',
    };

    const res = await fetch(`${MP_API}/preapproval`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[portal/billing/checkout] MP error', res.status, errText);
      return NextResponse.json({ error: 'No se pudo crear la suscripción.' }, { status: 502 });
    }

    const data = await res.json();

    await portalPlusRequestRef(adminId).set(
      {
        adminId,
        adminEmail,
        adminName: adminName ?? '',
        status: 'pendiente',
        billingProvider: 'mercadopago',
        billingStatus: 'pending',
        subscriptionId: data.id ?? null,
        priceARS: priceARS,
        requestedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, initUrl: data.init_point as string });
  } catch (err: any) {
    console.error('[portal/billing/checkout]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
