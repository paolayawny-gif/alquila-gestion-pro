/**
 * Stripe provider — STUB preparado para implementación futura.
 *
 * Stripe NO opera para empresas argentinas (necesita entidad en USA, UE, UK, etc.).
 * Este archivo queda listo para activarse el día que se constituya la entidad
 * o se decida usar Stripe vía un partner.
 *
 * Para activarlo:
 *   1. npm install stripe
 *   2. ENV: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_<TIER>=price_xxx
 *   3. Reemplazar los `throw` por la implementación real
 *   4. Cambiar BILLING_PROVIDER=stripe en env
 */

import type { BillingProvider } from '../types';

export const stripeProvider: BillingProvider = {
  name: 'stripe',

  async createSubscription() {
    throw new Error('Stripe provider no implementado todavía. Usar MercadoPago.');
  },

  async updateSubscriptionTier() {
    throw new Error('Stripe provider no implementado todavía.');
  },

  async cancelSubscription() {
    throw new Error('Stripe provider no implementado todavía.');
  },

  async getSubscriptionStatus() {
    throw new Error('Stripe provider no implementado todavía.');
  },

  async parseWebhook() {
    return null;
  },

  async getPortalUrl() {
    return null;
  },
};
