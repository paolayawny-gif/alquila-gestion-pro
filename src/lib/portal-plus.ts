/**
 * Helpers del add-on "Portal Plus" — la vidriera pública de propiedades.
 * Se cobra como suscripción mensual aparte (no afecta el plan principal del admin).
 */
import { getAdminDb } from '@/lib/firebase-admin';

const APP_ID = 'alquilagestion-pro';

/** Precio mensual del Portal Plus en USD. */
export const PORTAL_PLUS_PRICE_USD = Number(process.env.PORTAL_PLUS_PRICE_USD) || 5;

/** Precio ARS de respaldo si el BCRA no responde. */
const PORTAL_PLUS_FALLBACK_ARS = Number(process.env.PORTAL_PLUS_FALLBACK_ARS) || 6500;

/** Cotización USD/ARS (venta) del BCRA, cacheada 1 hora. */
let _rateCache: { venta: number; cachedAt: number } | null = null;
const RATE_TTL_MS = 60 * 60 * 1000;

async function getUsdSellRate(): Promise<number | null> {
  if (_rateCache && Date.now() - _rateCache.cachedAt < RATE_TTL_MS) {
    return _rateCache.venta;
  }
  try {
    const res = await fetch(
      'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones',
      { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`BCRA status ${res.status}`);
    const data = await res.json();
    const detalle: { codigoMoneda: string; tipoCotizacion: number }[] =
      data?.results?.detalle ?? [];
    const usd = detalle.find(d => d.codigoMoneda === 'USD');
    if (!usd?.tipoCotizacion) throw new Error('USD no encontrado');
    _rateCache = { venta: usd.tipoCotizacion, cachedAt: Date.now() };
    return usd.tipoCotizacion;
  } catch {
    return _rateCache?.venta ?? null;
  }
}

/**
 * Precio mensual del Portal Plus en ARS, calculado a la cotización del día.
 * Si el BCRA no responde, usa el valor de respaldo.
 */
export async function getPortalPlusPriceARS(): Promise<number> {
  const rate = await getUsdSellRate();
  if (!rate) return PORTAL_PLUS_FALLBACK_ARS;
  return Math.round(PORTAL_PLUS_PRICE_USD * rate);
}

/** Lee el access token de MercadoPago: Firestore (panel super-admin) o env var. */
export async function getMpAccessToken(): Promise<string> {
  try {
    const snap = await getAdminDb()
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('platformConfig')
      .get();
    const token = snap.data()?.mpAccessToken;
    if (token) return token as string;
  } catch { /* Firestore no disponible — caer a env */ }

  const envToken = process.env.MP_ACCESS_TOKEN;
  if (envToken) return envToken;

  throw new Error('MercadoPago no configurado: falta mpAccessToken.');
}

/** Doc de la solicitud/suscripción Portal Plus de un admin. */
export function portalPlusRequestRef(adminId: string) {
  return getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('superadmin').doc('data')
    .collection('portalPlusRequests').doc(adminId);
}
