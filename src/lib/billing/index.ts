/**
 * Factory que devuelve el proveedor de billing activo.
 * Único proveedor implementado: MercadoPago.
 */

import type { BillingProvider } from './types';
import { mercadopagoProvider } from './providers/mercadopago';

export function getBillingProvider(): BillingProvider {
  return mercadopagoProvider;
}

export * from './types';
export * from './tiers';
