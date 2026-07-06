import { APP_ID } from '@/lib/constants';
/**
 * MercadoPago Subscriptions provider.
 * Usa la API REST directamente (sin SDK) para minimizar dependencias.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/subscriptions
 *
 * Credenciales (en orden de prioridad):
 *   1. Firestore: artifacts/alquilagestion-pro/superadmin/platformConfig
 *      → configurable desde el Panel Super Admin → Configuración
 *   2. Variables de entorno: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (fallback)
 */

import type {
  BillingProvider,
  BillingStatus,
  CheckoutResult,
  ProviderEvent,
} from '../types';
import { WebhookSignatureError } from '../types';
import type { BillingTier } from '../tiers';
import { getTierPriceARS } from '../tiers';

const MP_API = 'https://api.mercadopago.com';

// ─── Platform config con caché (TTL 5 min) ────────────────────────────────────

let _cfgCache: { accessToken: string; webhookSecret?: string; cachedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getPlatformConfig(): Promise<{ accessToken: string; webhookSecret?: string }> {
  const now = Date.now();
  if (_cfgCache && now - _cfgCache.cachedAt < CACHE_TTL) return _cfgCache;

  let accessToken = '';
  let webhookSecret: string | undefined;

  // 1. Firestore (configurado desde el panel superadmin)
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const snap = await getAdminDb()
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('platformConfig')
      .get();
    const d = snap.data();
    if (d?.mpAccessToken) {
      accessToken = d.mpAccessToken;
      webhookSecret = d.mpWebhookSecret || undefined;
    }
  } catch { /* Firestore no disponible — caer a env vars */ }

  // 2. Variables de entorno (fallback)
  if (!accessToken) {
    accessToken = process.env.MP_ACCESS_TOKEN ?? '';
    if (!webhookSecret) webhookSecret = process.env.MP_WEBHOOK_SECRET;
  }

  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN no configurado. Configuralo en el Panel Super Admin → Configuración.');
  }

  _cfgCache = { accessToken, webhookSecret, cachedAt: now };
  return _cfgCache;
}

async function authHeaders() {
  const { accessToken } = await getPlatformConfig();
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/** True si hay credenciales de MercadoPago (Firestore o env var) — para que la UI no muestre botones "activos" que van a fallar. */
export async function isMercadoPagoConfigured(): Promise<boolean> {
  try {
    await getPlatformConfig();
    return true;
  } catch {
    return false;
  }
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapStatus(mpStatus: string): BillingStatus {
  switch (mpStatus) {
    case 'authorized':  return 'active';
    case 'pending':     return 'pending';
    case 'paused':      return 'paused';
    case 'cancelled':   return 'cancelled';
    case 'finished':    return 'cancelled';
    default:            return 'pending';
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const mercadopagoProvider: BillingProvider = {
  name: 'mercadopago',

  async createSubscription({ adminId, adminEmail, tier, returnUrl }): Promise<CheckoutResult> {
    const amount = getTierPriceARS(tier);
    const webhookUrl = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL}/api/billing/webhook`
      : undefined;

    const body = {
      reason: `AlquilaGestion Pro — ${tier.label}`,
      external_reference: adminId,
      payer_email: adminEmail,
      back_url: returnUrl,
      ...(webhookUrl ? { notification_url: webhookUrl } : {}),
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'ARS',
      },
      status: 'pending',
    };

    const res = await fetch(`${MP_API}/preapproval`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`MercadoPago createSubscription failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      initUrl: data.init_point as string,
      subscriptionId: data.id as string,
    };
  },

  async updateSubscriptionTier({ subscriptionId, newTier }) {
    const amount = getTierPriceARS(newTier);
    const body = {
      reason: `AlquilaGestion Pro — ${newTier.label}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'ARS',
      },
    };

    const res = await fetch(`${MP_API}/preapproval/${subscriptionId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`MercadoPago updateSubscriptionTier failed (${res.status}): ${errText}`);
    }
  },

  async cancelSubscription(subscriptionId) {
    const res = await fetch(`${MP_API}/preapproval/${subscriptionId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ status: 'cancelled' }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`MercadoPago cancelSubscription failed (${res.status}): ${errText}`);
    }
  },

  async getSubscriptionStatus(subscriptionId) {
    const res = await fetch(`${MP_API}/preapproval/${subscriptionId}`, {
      method: 'GET',
      headers: await authHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`MercadoPago getSubscriptionStatus failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      status: mapStatus(data.status),
      nextChargeAt: data.next_payment_date ?? undefined,
      lastChargedAt: data.last_modified ?? undefined,
    };
  },

  async parseWebhook({ headers, body }): Promise<ProviderEvent | null> {
    // Validación HMAC-SHA256 cuando hay webhook secret configurado.
    // Formato MP: x-signature: ts=<ts>,v1=<hex>
    // Manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};"
    const cfg = await getPlatformConfig().catch(() => null);
    const secret = cfg?.webhookSecret;
    if (secret) {
      const sig = headers?.['x-signature'] ?? '';
      const requestId = headers?.['x-request-id'] ?? '';
      const tsMatch = sig.match(/ts=([^,]+)/);
      const v1Match = sig.match(/v1=([^,]+)/);
      // Si el secret está configurado, la firma es obligatoria.
      // Rechazar cualquier request que no traiga x-signature con ts y v1.
      if (!tsMatch || !v1Match) {
        throw new WebhookSignatureError('[mercadopago] Webhook sin firma válida — rechazado');
      }
      const ts = tsMatch[1];
      const received = v1Match[1];
      const dataId = body?.data?.id ?? body?.id ?? '';
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const { createHmac, timingSafeEqual } = await import('crypto');
      const expected = createHmac('sha256', secret).update(manifest).digest('hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(received, 'hex');
      const valid = expectedBuf.length === receivedBuf.length &&
        timingSafeEqual(expectedBuf, receivedBuf);
      if (!valid) {
        throw new WebhookSignatureError('[mercadopago] Firma de webhook inválida — rechazado');
      }
    }

    // MP envía dos formatos: IPN clásico (?topic=...&id=...) y webhooks v2 (JSON body con type/data.id).
    const type: string = body?.type ?? body?.topic ?? '';
    const resourceId: string | undefined = body?.data?.id ?? body?.id;
    if (!resourceId) return null;

    // Clave de idempotencia: los webhooks v2 de MP traen un id de notificación
    // único por entrega (`body.id`). Usarlo evita que dos eventos distintos del
    // mismo recurso (ej: la suscripción pasa a pending y luego a paused)
    // colisionen bajo `${tipo}:${recurso}` y el segundo se descarte como
    // "duplicado". En IPN clásico no existe ese id → se cae al compuesto.
    const notifId: string | null =
      body?.data?.id != null && body?.id != null ? `mp:${body.id}` : null;

    // Para `preapproval`: leemos detalle del recurso
    if (type === 'preapproval' || type === 'subscription_preapproval') {
      const res = await fetch(`${MP_API}/preapproval/${resourceId}`, {
        method: 'GET',
        headers: await authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const eventType: ProviderEvent['type'] =
        data.status === 'authorized' ? 'subscription.authorized'
      : data.status === 'cancelled'  ? 'subscription.cancelled'
      :                                 'subscription.updated';
      return {
        id: notifId ?? `${eventType}:${resourceId}`,
        type: eventType,
        subscriptionId: resourceId,
        customerId: data.payer_id ? String(data.payer_id) : null,
        raw: data,
      };
    }

    // Para `payment` (cobros recurrentes): leemos detalle del pago
    if (type === 'payment') {
      const res = await fetch(`${MP_API}/v1/payments/${resourceId}`, {
        method: 'GET',
        headers: await authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const eventType: ProviderEvent['type'] =
        data.status === 'approved' ? 'payment.approved' : 'payment.rejected';
      return {
        id: notifId ?? `${eventType}:${resourceId}`,
        type: eventType,
        subscriptionId: data.metadata?.preapproval_id ?? null,
        customerId: data.payer?.id ? String(data.payer.id) : null,
        raw: data,
      };
    }

    return { id: notifId ?? String(resourceId), type: 'unknown', subscriptionId: null, customerId: null, raw: body };
  },

  // MercadoPago no expone portal self-service como Stripe.
  // La UI de la app maneja cancelar / cambiar tarjeta enviando al usuario al panel de MP.
  async getPortalUrl() {
    return null;
  },
};
