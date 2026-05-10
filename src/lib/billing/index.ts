/**
 * Factory que devuelve el proveedor de billing activo según env.
 *
 * Variable: BILLING_PROVIDER ∈ { 'mercadopago', 'stripe' }
 * Default: 'mercadopago'
 */

import type { BillingProvider, ProviderName } from './types';
import { mercadopagoProvider } from './providers/mercadopago';
import { stripeProvider } from './providers/stripe';

const PROVIDERS: Record<ProviderName, BillingProvider> = {
  mercadopago: mercadopagoProvider,
  stripe: stripeProvider,
  // Para agregar Lemon Squeezy o Paddle: importar arriba y registrar aquí.
  lemonsqueezy: mercadopagoProvider, // placeholder — reemplazar
  paddle: mercadopagoProvider,        // placeholder — reemplazar
};

export function getBillingProvider(): BillingProvider {
  const name = (process.env.BILLING_PROVIDER as ProviderName) || 'mercadopago';
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Billing provider desconocido: ${name}`);
  return provider;
}

export * from './types';
export * from './tiers';
