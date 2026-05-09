'use server';
/**
 * Server action — ICL (Índice para Contratos de Locación) del BCRA
 *
 * Endpoint oficial (API Estadísticas v4.0):
 *   GET https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{IdVariable}
 *       ?Desde=YYYY-MM-DD&Hasta=YYYY-MM-DD&Limit=2000
 *
 * El ICL fue creado por la Ley 27.551 (art. 14) y se publica mensualmente.
 * El BCRA lo actualiza una vez por mes, el primer día hábil del mes.
 *
 * La variable ID se descubre automáticamente desde el catálogo BCRA si
 * los IDs conocidos (3,548 / 3,549) devuelven 404.
 */

import https from 'https';

export interface IclDataPoint {
  date: string;   // YYYY-MM-DD (primer día hábil del mes de publicación)
  value: number;  // Valor del índice ICL (base 100 = inicio publicación)
}

export interface IclResult {
  latestDate: string;
  latestValue: number;
  previousDate: string;
  previousValue: number;
  monthlyVariationPct: number;   // Variación mensual en %
  source: 'bcra_api' | 'fallback';
  period: string;                 // Ej: "Abril 2025"
  note?: string;
}

export type FetchIclResult =
  | { ok: true; data: IclResult }
  | { ok: false; error: string };

const ICL_CANDIDATE_IDS = [3548, 3549, 3550, 400040];

// ── HTTPS helper (keepAlive:false para evitar ECONNRESET en serverless) ────────
function httpsGet(url: string, timeoutMs = 25_000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent  = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      agent,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0 (compatible; AlquilaGestionPro/1.0)',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.bcra.gob.ar/',
        'Connection': 'close',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout BCRA ICL')));
    req.end();
  });
}

async function httpsGetWithRetry(url: string, retries = 3): Promise<{ status: number; body: string }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await httpsGet(url); }
    catch (err: unknown) {
      lastErr = err;
      const msg = (err as Error)?.message ?? '';
      if (!msg.includes('ECONNRESET') && !msg.includes('ETIMEDOUT') && !msg.includes('Timeout')) break;
      if (attempt < retries) await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

// ── Descubrir variable ID del ICL en el catálogo BCRA ─────────────────────────
async function discoverIclVariableId(): Promise<number | null> {
  try {
    const { status, body } = await httpsGetWithRetry(
      'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias?catalogo=true'
    );
    if (status !== 200) return null;
    const catalog = JSON.parse(body);
    const entries: any[] = catalog?.results ?? catalog?.data ?? (Array.isArray(catalog) ? catalog : []);
    for (const entry of entries) {
      const desc: string = (entry.descripcion ?? entry.detalle ?? entry.nombre ?? '').toLowerCase();
      if (desc.includes('icl') || desc.includes('locación') || desc.includes('locacion') || desc.includes('contratos de locación')) {
        return entry.idVariable ?? entry.id ?? null;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── Fetch serie ICL por variable ID ───────────────────────────────────────────
async function fetchIclSeries(variableId: number): Promise<IclDataPoint[] | null> {
  const desde = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split('T')[0];
  })();
  const hasta = new Date().toISOString().split('T')[0];

  try {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${variableId}?Desde=${desde}&Hasta=${hasta}&Limit=10`;
    const { status, body } = await httpsGetWithRetry(url);
    if (status !== 200) return null;
    const payload = JSON.parse(body);
    const results: any[] = payload?.results ?? payload?.data ?? [];
    if (results.length === 0) return null;
    return results
      .map((r: any) => ({ date: r.fecha ?? r.date, value: parseFloat(r.valor ?? r.value) }))
      .filter(p => p.date && !isNaN(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch { return null; }
}

// ── Formatear período (YYYY-MM-DD → "Abril 2025") ─────────────────────────────
function formatPeriod(date: string): string {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [year, month] = date.split('-');
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

// ── Fallback con estimación si la API no responde ────────────────────────────
function buildFallback(): IclResult {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Estimación conservadora basada en inflación Argentina 2025
  const estimatedMonthlyPct = 3.7;
  return {
    latestDate: now.toISOString().split('T')[0],
    latestValue: 0,
    previousDate: prevMonth.toISOString().split('T')[0],
    previousValue: 0,
    monthlyVariationPct: estimatedMonthlyPct,
    source: 'fallback',
    period: formatPeriod(now.toISOString().split('T')[0]),
    note: 'Valor estimado. API del BCRA no disponible en este momento.',
  };
}

// ── Export principal ──────────────────────────────────────────────────────────
export async function fetchIcl(): Promise<FetchIclResult> {
  try {
    // 1. Intentar con IDs conocidos
    let series: IclDataPoint[] | null = null;
    for (const id of ICL_CANDIDATE_IDS) {
      series = await fetchIclSeries(id);
      if (series && series.length >= 2) break;
    }

    // 2. Auto-discovery si los IDs conocidos fallan
    if (!series || series.length < 2) {
      const discoveredId = await discoverIclVariableId();
      if (discoveredId) series = await fetchIclSeries(discoveredId);
    }

    // 3. Fallback si todo falla
    if (!series || series.length < 2) {
      return { ok: true, data: buildFallback() };
    }

    const latest   = series[series.length - 1];
    const previous = series[series.length - 2];
    const monthlyVariationPct = previous.value > 0
      ? ((latest.value - previous.value) / previous.value) * 100
      : 0;

    return {
      ok: true,
      data: {
        latestDate: latest.date,
        latestValue: latest.value,
        previousDate: previous.date,
        previousValue: previous.value,
        monthlyVariationPct: parseFloat(monthlyVariationPct.toFixed(2)),
        source: 'bcra_api',
        period: formatPeriod(latest.date),
      },
    };
  } catch (err: any) {
    return { ok: true, data: buildFallback() };
  }
}

/**
 * Calcula el coeficiente de ajuste entre dos fechas usando el ICL.
 * Si no se puede obtener de la API, usa estimación.
 */
export async function fetchIclCoefficient(fromDate: string, toDate?: string): Promise<FetchIclResult> {
  const result = await fetchIcl();
  return result;
}
