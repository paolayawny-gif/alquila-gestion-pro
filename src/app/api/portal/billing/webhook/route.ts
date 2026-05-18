import { NextRequest, NextResponse } from 'next/server';
import { getMpAccessToken, portalPlusRequestRef } from '@/lib/portal-plus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MP_API = 'https://api.mercadopago.com';

/**
 * POST /api/portal/billing/webhook
 * Recibe notificaciones de MercadoPago sobre la suscripción Portal Plus.
 *
 * Seguridad: no confiamos en el body del webhook — siempre re-consultamos el
 * recurso contra la API de MercadoPago con nuestro access token. Un webhook
 * falsificado no puede otorgar acceso porque la suscripción real no estaría
 * autorizada en MercadoPago.
 */
export async function POST(req: NextRequest) {
  try {
    const accessToken = await getMpAccessToken();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let body: any = {};
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      body = {
        topic: req.nextUrl.searchParams.get('topic'),
        id: req.nextUrl.searchParams.get('id'),
      };
    }

    const type: string = body?.type ?? body?.topic ?? '';
    const resourceId: string | undefined = body?.data?.id ?? body?.id;
    if (!resourceId) return NextResponse.json({ ok: true, ignored: true });

    let adminId: string | null = null;
    let grant: 'active' | 'cancelled' | 'past_due' | null = null;

    if (type === 'preapproval' || type === 'subscription_preapproval') {
      const res = await fetch(`${MP_API}/preapproval/${resourceId}`, { headers: authHeader });
      if (!res.ok) return NextResponse.json({ ok: true, ignored: true });
      const data = await res.json();
      adminId = data.external_reference ?? null;
      grant = data.status === 'authorized' ? 'active'
        : data.status === 'cancelled' || data.status === 'finished' ? 'cancelled'
        : null;
    } else if (type === 'payment') {
      const res = await fetch(`${MP_API}/v1/payments/${resourceId}`, { headers: authHeader });
      if (!res.ok) return NextResponse.json({ ok: true, ignored: true });
      const data = await res.json();
      adminId = data.external_reference ?? null;
      // El pago de una suscripción puede no traer external_reference: lo resolvemos vía la preapproval.
      if (!adminId && data.metadata?.preapproval_id) {
        const pre = await fetch(`${MP_API}/preapproval/${data.metadata.preapproval_id}`, { headers: authHeader });
        if (pre.ok) adminId = (await pre.json()).external_reference ?? null;
      }
      grant = data.status === 'approved' ? 'active'
        : data.status === 'rejected' ? 'past_due'
        : null;
    }

    if (!adminId || !grant) {
      return NextResponse.json({ ok: true, unmapped: true });
    }

    const now = new Date().toISOString();
    if (grant === 'active') {
      await portalPlusRequestRef(adminId).set(
        { status: 'aprobada', billingStatus: 'active', processedAt: now },
        { merge: true },
      );
    } else if (grant === 'cancelled') {
      await portalPlusRequestRef(adminId).set(
        { status: 'rechazada', billingStatus: 'cancelled', processedAt: now },
        { merge: true },
      );
    } else {
      // Pago rechazado: registramos el estado pero no revocamos por un fallo puntual.
      await portalPlusRequestRef(adminId).set(
        { billingStatus: 'past_due', failedChargeAt: now },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true, adminId, grant });
  } catch (err: any) {
    console.error('[portal/billing/webhook]', err);
    // 200 igual para que MercadoPago no reintente indefinidamente.
    return NextResponse.json({ ok: false, error: err.message ?? 'Error' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'portal-billing-webhook' });
}
