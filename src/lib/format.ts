/**
 * Formatters centralizados. Todos los componentes deberían usar estas funciones
 * en lugar de toLocaleString inline para garantizar consistencia y permitir
 * cambios de formato (moneda, separadores) en un solo lugar.
 */

/**
 * Formato moneda argentino con símbolo: 1234567 → "$ 1.234.567"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: { currency?: 'ARS' | 'USD'; withSymbol?: boolean; decimals?: 0 | 2 } = {},
): string {
  const { currency = 'ARS', withSymbol = true, decimals = 0 } = options;
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : (value ?? 0);
  if (isNaN(num)) return withSymbol ? '$ 0' : '0';
  const formatted = num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (!withSymbol) return formatted;
  return currency === 'USD' ? `US$ ${formatted}` : `$ ${formatted}`;
}

/**
 * Formato moneda corto: 1500000 → "$1,5M", 12500 → "$12,5K"
 */
export function formatCurrencyShort(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const symbol = currency === 'USD' ? 'US$' : '$';
  if (Math.abs(value) >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (Math.abs(value) >= 1_000) return `${symbol}${(value / 1_000).toFixed(1).replace('.0', '')}K`;
  return formatCurrency(value, { currency });
}

/**
 * Fecha en formato es-AR. Acepta string ISO, timestamp o Date.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  format: 'short' | 'long' | 'datetime' = 'short',
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  if (format === 'long') {
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (format === 'datetime') {
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }
  return d.toLocaleDateString('es-AR');
}

/** "mayo de 2026" en formato del período de facturación. */
export function formatPeriod(date: Date = new Date()): string {
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/**
 * CUIT/CUIL con guiones: "20123456789" → "20-12345678-9"
 */
export function formatCUIT(cuit: string | null | undefined): string {
  if (!cuit) return '';
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return cuit;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * DNI con puntos: "12345678" → "12.345.678"
 */
export function formatDNI(dni: string | null | undefined): string {
  if (!dni) return '';
  const digits = dni.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Teléfono argentino legible. Pega +54 si no tiene país.
 * "1141234567" → "+54 11 4123-4567"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('54')) p = p.slice(2);
  if (p.length < 10) return phone;
  const area = p.slice(0, 2);
  const first = p.slice(2, 6);
  const last = p.slice(6);
  return `+54 ${area} ${first}-${last}`;
}

/**
 * Limpia un teléfono y lo normaliza a formato wa.me (sin + ni espacios).
 * "+54 11 4123-4567" → "5411412345674"
 * Aplica heurística para AR: si empieza con 0, lo quita; si no tiene 54, lo agrega.
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return '';
  let p = phone.replace(/\D/g, '').replace(/^0/, '');
  if (!p.startsWith('54')) p = '54' + p;
  return p;
}
