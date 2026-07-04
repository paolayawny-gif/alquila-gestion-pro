/**
 * Tipos compartidos para la capa de billing.
 * Único proveedor implementado: MercadoPago. La interfaz queda pensada
 * para agregar otro proveedor el día que haga falta (ver BillingProvider más abajo).
 */

import type { BillingTier } from './tiers';

export type BillingStatus =
  | 'trial'           // Período de prueba, sin tarjeta cargada
  | 'pending'         // Suscripción creada en proveedor, esperando autorización del usuario
  | 'active'          // Activa, cobrando normalmente
  | 'past_due'        // Último cobro falló, en período de gracia
  | 'paused'          // Pausada por el proveedor (varios fallos)
  | 'cancelled';      // Cancelada por usuario o admin

export type ProviderName = 'mercadopago';

/**
 * Estado persistido en Firestore: artifacts/{APP_ID}/users/{adminId}/config/billing
 */
export interface BillingState {
  provider: ProviderName | null;
  customerId: string | null;             // ID del cliente en el proveedor
  subscriptionId: string | null;         // ID de la suscripción en el proveedor
  tierId: string;                         // ID del BillingTier vigente
  activeUnits: number;                    // Snapshot de contratos vigentes al último sync
  status: BillingStatus;
  lastChargedAt?: string;                 // ISO date
  nextChargeAt?: string;                  // ISO date
  trialEndsAt?: string;                   // ISO date (solo si status==='trial')
  lastSyncedAt?: string;                  // ISO date
  failedChargeAt?: string;                // ISO date — primer intento fallido (para gracia)
  pendingSince?: string;                  // ISO date — inicio de suscripción pendiente de pago (gracia 48 hs)
  cancelledAt?: string;                   // ISO date
}

export interface CheckoutResult {
  /** URL a la que redirigir al usuario para autorizar el cobro */
  initUrl: string;
  /** ID del recurso en el proveedor (para guardar en BillingState) */
  subscriptionId: string;
}

export interface ProviderEvent {
  /** ID idempotente del evento en el proveedor (para deduplicar) */
  id: string;
  type: 'subscription.authorized' | 'subscription.cancelled' | 'subscription.updated' | 'payment.approved' | 'payment.rejected' | 'unknown';
  subscriptionId: string | null;
  customerId: string | null;
  raw: Record<string, any>;               // payload completo
}

/**
 * Interfaz que todo proveedor debe implementar.
 * Para agregar un segundo proveedor → crear un archivo nuevo con esta forma,
 * sumarlo a ProviderName y registrarlo en index.ts.
 */
export interface BillingProvider {
  name: ProviderName;

  /**
   * Crea (o actualiza) una suscripción al precio del tier indicado.
   * Devuelve la URL a la que debe ir el usuario para autorizar.
   */
  createSubscription(args: {
    adminId: string;
    adminEmail: string;
    tier: BillingTier;
    returnUrl: string;
  }): Promise<CheckoutResult>;

  /**
   * Actualiza el monto de una suscripción existente al precio del nuevo tier.
   * No requiere acción del usuario (el proveedor cobra el nuevo monto en el siguiente ciclo).
   */
  updateSubscriptionTier(args: {
    subscriptionId: string;
    newTier: BillingTier;
  }): Promise<void>;

  /** Cancela suscripción (no reembolsa pagos previos). */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /** Lee el estado actual desde el proveedor (verificación) */
  getSubscriptionStatus(subscriptionId: string): Promise<{
    status: BillingStatus;
    nextChargeAt?: string;
    lastChargedAt?: string;
  }>;

  /**
   * Parsea un webhook entrante del proveedor.
   * Devuelve null si el evento debe ignorarse (firma inválida, tipo no relevante).
   */
  parseWebhook(req: {
    headers: Record<string, string | undefined>;
    body: any;
    rawBody?: string;
  }): Promise<ProviderEvent | null>;

  /**
   * URL al portal self-service del proveedor (si lo soporta).
   * MP no tiene portal — devolverá null y la UI usará un panel propio.
   */
  getPortalUrl?(customerId: string): Promise<string | null>;
}
