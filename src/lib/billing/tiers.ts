/**
 * Billing tiers — todas las funciones disponibles en todos los planes.
 * Solo varía el límite de unidades (contratos vigentes).
 *
 * Precio "neto" = lo que querés cobrar.
 * Precio "público" = neto + ~6% para absorber comisión MercadoPago (4.99% + IVA).
 *
 * Los precios en ARS son referenciales y pueden ajustarse vía
 * env BILLING_TIER_<id>_ARS si se necesita override en producción.
 */

export interface BillingTier {
  id: string;
  label: string;
  maxUnits: number;          // tope de contratos vigentes que cubre este tramo
  priceARS: number;          // precio público mensual en ARS (incluye absorción de comisión)
  priceUSD: number;          // referencia USD (no se cobra, solo display)
}

export const BILLING_TIERS: BillingTier[] = [
  { id: 'tier-1', label: 'Hasta 25 unidades',  maxUnits: 25,  priceARS: 19_000, priceUSD: 20 },
  { id: 'tier-2', label: 'Hasta 50 unidades',  maxUnits: 50,  priceARS: 27_500, priceUSD: 29 },
  { id: 'tier-3', label: 'Hasta 75 unidades',  maxUnits: 75,  priceARS: 35_000, priceUSD: 37 },
  { id: 'tier-4', label: 'Hasta 125 unidades', maxUnits: 125, priceARS: 55_000, priceUSD: 58 },
  { id: 'tier-5', label: 'Hasta 200 unidades', maxUnits: 200, priceARS: 80_000, priceUSD: 84 },
];

/** Free trial: nuevos admins arrancan en este tier hasta cargar tarjeta */
export const TRIAL_TIER: BillingTier = {
  id: 'trial',
  label: 'Período de prueba',
  maxUnits: 5,
  priceARS: 0,
  priceUSD: 0,
};

/** Devuelve el tier que corresponde a la cantidad de unidades activas */
export function tierForUnits(activeUnits: number): BillingTier {
  if (activeUnits <= 0) return BILLING_TIERS[0];
  for (const tier of BILLING_TIERS) {
    if (activeUnits <= tier.maxUnits) return tier;
  }
  // Excedió el último tramo → enterprise (forzar al último, panel debería pedir contacto)
  return BILLING_TIERS[BILLING_TIERS.length - 1];
}

export function getTierById(id: string): BillingTier | null {
  if (id === TRIAL_TIER.id) return TRIAL_TIER;
  return BILLING_TIERS.find(t => t.id === id) ?? null;
}

/** Lee precio de env si existe, si no usa el default del tier */
export function getTierPriceARS(tier: BillingTier): number {
  const envKey = `BILLING_${tier.id.toUpperCase().replace(/-/g, '_')}_ARS`;
  const override = process.env[envKey];
  if (override && !isNaN(Number(override))) return Number(override);
  return tier.priceARS;
}
