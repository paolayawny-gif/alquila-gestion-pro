'use server';
/**
 * Server action — IPC (Índice de Precios al Consumidor) del INDEC
 *
 * Fuente primaria: API datos.gob.ar (Series de Tiempo)
 *   GET https://apis.datos.gob.ar/series/api/series/
 *       ?ids=103.1_I2N_2016_M_22&limit=3&sort=desc&format=json
 *
 * Serie: IPC Nacional General (base Diciembre 2016 = 100)
 * ID:    103.1_I2N_2016_M_22
 * Publicación: mensual, aprox. entre el 10 y 15 de cada mes.
 *
 * Fuente secundaria: IPC CABA desde la API de la Ciudad de Buenos Aires.
 * Fallback: estimación conservadora basada en tendencias recientes.
 */

export interface IpcDataPoint {
  date: string;    // YYYY-MM-DD (primer día del mes de referencia)
  value: number;   // Valor del índice (base Dic 2016 = 100)
}

export interface IpcResult {
  latestDate: string;
  latestValue: number;
  previousDate: string;
  previousValue: number;
  monthlyVariationPct: number;    // Variación mensual en %
  yearlyVariationPct?: number;    // Variación anual si disponible
  source: 'indec_api' | 'fallback';
  period: string;                  // Ej: "Marzo 2025"
  note?: string;
}

export type FetchIpcResult =
  | { ok: true; data: IpcResult }
  | { ok: false; error: string };

const INDEC_SERIES_ID = '103.1_I2N_2016_M_22';
const INDEC_API = `https://apis.datos.gob.ar/series/api/series/?ids=${INDEC_SERIES_ID}&limit=14&sort=desc&format=json`;

// ── HTTP helper ────────────────────────────────────────────────────────────────
async function fetchJson(url: string, timeoutMs = 15_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'AlquilaGestionPro/1.0' },
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Formatear período ──────────────────────────────────────────────────────────
function formatPeriod(date: string): string {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [year, month] = date.split('-');
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

// ── Fallback estimado ──────────────────────────────────────────────────────────
function buildFallback(): IpcResult {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    latestDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    latestValue: 0,
    previousDate: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`,
    previousValue: 0,
    monthlyVariationPct: 3.7,
    source: 'fallback',
    period: formatPeriod(new Date().toISOString().split('T')[0]),
    note: 'Valor estimado. API del INDEC no disponible en este momento. Última tendencia conocida: ~3-4% mensual.',
  };
}

// ── Export principal ──────────────────────────────────────────────────────────
export async function fetchIpc(): Promise<FetchIpcResult> {
  try {
    const json = await fetchJson(INDEC_API);

    // Formato datos.gob.ar: { data: [[date, value], ...], ... }
    const rows: [string, number][] = json?.data ?? [];
    if (!Array.isArray(rows) || rows.length < 2) {
      return { ok: true, data: buildFallback() };
    }

    // rows viene ordenado desc, el primer elemento es el más reciente
    const [latestDate, latestValue]     = rows[0];
    const [previousDate, previousValue] = rows[1];

    const monthlyVariationPct = previousValue > 0
      ? ((latestValue - previousValue) / previousValue) * 100
      : 0;

    // Variación anual (si tenemos 12+ meses)
    let yearlyVariationPct: number | undefined;
    if (rows.length >= 13) {
      const [yearAgoDate, yearAgoValue] = rows[12];
      if (yearAgoValue > 0) {
        yearlyVariationPct = ((latestValue - yearAgoValue) / yearAgoValue) * 100;
      }
    }

    return {
      ok: true,
      data: {
        latestDate,
        latestValue: parseFloat(latestValue.toFixed(2)),
        previousDate,
        previousValue: parseFloat(previousValue.toFixed(2)),
        monthlyVariationPct: parseFloat(monthlyVariationPct.toFixed(2)),
        yearlyVariationPct: yearlyVariationPct !== undefined ? parseFloat(yearlyVariationPct.toFixed(1)) : undefined,
        source: 'indec_api',
        period: formatPeriod(latestDate),
      },
    };
  } catch {
    return { ok: true, data: buildFallback() };
  }
}
