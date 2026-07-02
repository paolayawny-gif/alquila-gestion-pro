import { NextRequest, NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/billing';
import {
  getAdminIdBySubscription,
  isEventProcessed,
  markEventProcessed,
  updateBillingState,
} from '@/lib/billing/state';
import { WebhookSignatureError } from '@/lib/billing/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/webhook
 * Endpoint público para recibir notificaciones del proveedor (MercadoPago / Stripe / etc).
 * MercadoPago manda webhooks tipo: { type: 'preapproval' | 'payment', data: { id } }
 * Tambien soporta IPN clásico via query params (?topic=&id=).
 */
export async function POST(req: NextRequest) {
  try {
    const provider = getBillingProvider();

    let body: any = {};
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      // IPN clásico: solo query params
      body = {
        topic: req.nextUrl.searchParams.get('topic'),
        id: req.nextUrl.searchParams.get('id'),
      };
    }

    // Headers como objeto plano para que el provider lo use si necesita validar firma
    const headers: Record<string, string | undefined> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });

    const event = await provider.parseWebhook({ headers, body });
    if (!event) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Idempotencia
    if (await isEventProcessed(event.id)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Resolver el adminId a partir de la suscripción
    const adminId = event.subscriptionId
      ? await getAdminIdBySubscription(event.subscriptionId)
      : null;

    if (!adminId) {
      // Evento que no podemos asociar — registrar y salir
      await markEventProcessed(event.id, { unmapped: true, ...event.raw });
      return NextResponse.json({ ok: true, unmapped: true });
    }

    switch (event.type) {
      case 'subscription.authorized':
        await updateBillingState(adminId, {
          status: 'active',
          customerId: event.customerId,
          nextChargeAt: event.raw?.next_payment_date ?? undefined,
        });
        break;

      case 'subscription.cancelled':
        await updateBillingState(adminId, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        });
        break;

      case 'subscription.updated':
        // La suscripción existe pero todavía no está autorizada (pending) o fue
        // pausada. No se activa: 'pending' tiene 48 hs de gracia en usePlan, y
        // pasa a 'active' recién con el evento subscription.authorized.
        await updateBillingState(adminId, {
          status: event.raw?.status === 'paused' ? 'paused' : 'pending',
        });
        break;

      case 'payment.approved':
        await updateBillingState(adminId, {
          status: 'active',
          lastChargedAt: new Date().toISOString(),
          failedChargeAt: undefined,
        });
        break;

      case 'payment.rejected':
        await updateBillingState(adminId, {
          status: 'past_due',
          failedChargeAt: new Date().toISOString(),
        });
        break;
    }

    await markEventProcessed(event.id, event.raw);

    return NextResponse.json({ ok: true, processed: event.type });
  } catch (err: any) {
    // Firma inválida o ausente → 400 inmediato (no reintentar).
    if (err instanceof WebhookSignatureError) {
      console.warn('[billing/webhook] Rechazado por firma:', err.message);
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
    }
    console.error('[billing/webhook]', err);
    // Devolver 200 igual para que MP no reintente infinitamente eventos rotos.
    return NextResponse.json({ ok: false, error: err.message ?? 'Error' }, { status: 200 });
  }
}

/** Algunos proveedores hacen GET de verificación */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'billing-webhook' });
}
