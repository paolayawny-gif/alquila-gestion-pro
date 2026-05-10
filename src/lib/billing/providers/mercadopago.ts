/**
 * MercadoPago Subscriptions provider.
 * Usa la API REST directamente (sin SDK) para minimizar dependencias.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/subscriptions
 *
 * ENV requeridas:
 *   MP_ACCESS_TOKEN — Access token de producción (o test)
 *   MP_WEBHOOK_SECRET — opcional, para validar firma de webhooks
 *   APP_BASE_URL — base URL pública de la app (ej. https://alquilagestion.pro)
 */

import type {
  BillingProvider,
  BillingStatus,
  CheckoutResult,
  ProviderEvent,
} from '../types';
import type { BillingTier } from '../tiers';
import { getTierPriceARS } from '../tiers';

const MP_API = 'https://api.mercadopago.com';

function authHeaders() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado en variables de entorno');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Mapea el status de MP a nuestro BillingStatus */
function mapStatus(mpStatus: string): BillingStatus {
  switch (mpStatus) {
    case 'authorized':       return 'active';
    case 'pending':          return 'pending';
    case 'paused':           return 'paused';
    case 'cancelled':        return 'cancelled';
    case 'finished':         return 'cancelled';
    default:                 return 'pending';
  }
}

export const mercadopagoProvider: BillingProvider = {
  name: 'mercadopago',

  async createSubscription({ adminId, adminEmail, tier, returnUrl }): Promise<CheckoutResult> {
    const amount = getTierPriceARS(tier);
    const body = {
      reason: `AlquilaGestion Pro — ${tier.label}`,
      external_reference: adminId,
      payer_email: adminEmail,
      back_url: returnUrl,
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
      headers: authHeaders(),
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
      headers: authHeaders(),
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
      headers: authHeaders(),
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
      headers: authHeaders(),
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

  async parseWebhook({ body }): Promise<ProviderEvent | null> {
    // MP envía dos formatos: IPN clásico (?topic=...&id=...) y webhooks v2 (JSON body con type/data.id).
    // Esta función espera el body ya parseado; el endpoint resolverá ambos.
    const type: string = body?.type ?? body?.topic ?? '';
    const resourceId: string | undefined = body?.data?.id ?? body?.id;
    if (!resourceId) return null;

    // Para `preapproval`: leemos detalle del recurso
    if (type === 'preapproval' || type === 'subscription_preapproval') {
      const res = await fetch(`${MP_API}/preapproval/${resourceId}`, {
        method: 'GET',
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const eventType: ProviderEvent['type'] =
        data.status === 'authorized' ? 'subscription.authorized'
      : data.status === 'cancelled'  ? 'subscription.cancelled'
      :                                 'subscription.updated';
      return {
        id: `${eventType}:${resourceId}:${data.last_modified ?? Date.now()}`,
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
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const eventType: ProviderEvent['type'] =
        data.status === 'approved' ? 'payment.approved' : 'payment.rejected';
      return {
        id: `${eventType}:${resourceId}`,
        type: eventType,
        subscriptionId: data.metadata?.preapproval_id ?? null,
        customerId: data.payer?.id ? String(data.payer.id) : null,
        raw: data,
      };
    }

    return { id: String(resourceId), type: 'unknown', subscriptionId: null, customerId: null, raw: body };
  },

  // MercadoPago no expone portal self-service como Stripe.
  // La UI de la app maneja cancelar / cambiar tarjeta enviando al usuario al panel de MP.
  async getPortalUrl() {
    return null;
  },
};
