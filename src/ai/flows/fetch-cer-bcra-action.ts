'use server';

/**
 * @fileOverview Server action — CER Diario del BCRA
 *
 * Endpoint oficial (API Estadísticas v4.0):
 *   GET https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{IdVariable}
 *       ?Desde=YYYY-MM-DD&Hasta=YYYY-MM-DD&Limit=2000
 *
 * Variable ID se descubre automáticamente buscando "CER" en el catálogo.
 * El ID conocido (3540) se intenta primero; si da 404 se busca en el listado.
 *
 * Usa node:https con keepAlive:false y rejectUnauthorized:false para
 * evitar ECONNRESET desde entornos serverless (Vercel).
 * Incluye reintentos automáticos ante errores de conexión.
 */

import https from 'https';

export interface CerDataPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

export type FetchCerResult =
  | { ok: true; data: CerDataPoint[] }
  | { ok: false; error: string };

// Known CER variable IDs to try before falling back to auto-discovery.
// BCRA renumbered variables between API versions; we try these in order.
const CER_CANDIDATE_IDS = [3540, 3541, 400039];

const MIN_DATE = '2002-02-01';

// ── HTTPS helper with keepAlive:false ────────────────────────────────────────
// keepAlive:false is critical: BCRA drops reused connections (ECONNRESET)
// from cloud/serverless IPs. Each call gets a fresh TCP connection.
function httpsGet(url: string, timeoutMs = 25_000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent  = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const options = {
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
    };
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf-8'),
      }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Timeout al conectar con la API del BCRA'));
    });
    req.end();
  });
}

// ── Retry wrapper ────────────────────────────────────────────────────────────
async function httpsGetWithRetry(
  url: string,
  retries = 3,
): Promise<{ status: number; body: string }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await httpsGet(url);
    } catch (err: unknown) {
      lastErr = err;
      const msg = (err as Error)?.message ?? '';
      const isRetryable =
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('Timeout');
      if (!isRetryable || attempt === retries) break;
      // Exponential back-off: 700 ms, 1.4 s, 2.8 s …
      await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

// ── CER variable ID discovery ─────────────────────────────────────────────────
// If known IDs all return 404, fetch the full Monetarias catalog and look for
// any entry whose descripcion/detalle contains "CER" or "Coeficiente de Estabilización".
async function discoverCerVariableId(): Promise<number | null> {
  // Try up to 1000 entries; CER is a well-known daily series so it should appear early.
  const url = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias?Periodicidad=D&Limit=500';
  try {
    const { status, body } = await httpsGetWithRetry(url);
    if (status !== 200) return null;
    const json = JSON.parse(body) as {
      results?: { idVariable: number; descripcion?: string | null }[];
    };
    const items = json.results ?? [];
    // Search for CER by description keywords
    const cerKeywords = ['cer', 'coeficiente de estabilización', 'coeficiente estabilizacion'];
    for (const item of items) {
      const desc = (item.descripcion ?? '').toLowerCase();
      if (cerKeywords.some(kw => desc.includes(kw))) {
        return item.idVariable;
      }
    }
    // Second pass: look for anything with "estabiliz" (catches spelling variants)
    for (const item of items) {
      const desc = (item.descripcion ?? '').toLowerCase();
      if (desc.includes('estabiliz')) {
        return item.idVariable;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fetch data for a specific variable ID ────────────────────────────────────
async function fetchCerData(
  variableId: number,
  desde: string,
  hastaFinal: string,
): Promise<{ status: number; data: CerDataPoint[] | null }> {
  const url =
    `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${variableId}` +
    `?Desde=${desde}&Hasta=${hastaFinal}&Limit=2000`;

  const { status, body } = await httpsGetWithRetry(url);

  if (status === 404) return { status: 404, data: null };
  if (status < 200 || status >= 300) {
    let detail = '';
    try {
      const parsed = JSON.parse(body) as { errorMessages?: string[] };
      detail = parsed.errorMessages?.join(', ') ?? body.slice(0, 200);
    } catch { detail = body.slice(0, 200); }
    throw new Error(`BCRA respondió ${status}: ${detail}`);
  }

  const json = JSON.parse(body) as {
    results?: { idVariable: number; detalle?: { fecha: string; valor: number }[] }[];
  };

  // v4.0 shape: results[0].detalle[]
  const detalle: { fecha: string; valor: number }[] =
    Array.isArray(json.results?.[0]?.detalle)
      ? json.results![0].detalle!
      : Array.isArray(json.results)
      ? (json.results as unknown as { fecha: string; valor: number }[])
      : [];

  if (!detalle.length) return { status: 200, data: null };

  return {
    status: 200,
    data: detalle
      .filter(r => r.fecha && r.valor != null)
      .map(r => ({ date: r.fecha, value: r.valor })),
  };
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function fetchCerFromBcra(desde: string, hasta: string): Promise<FetchCerResult> {
  if (!desde || !hasta) {
    return { ok: false, error: 'Debés indicar las fechas "Desde" y "Hasta".' };
  }

  // Clamp "hasta" a hoy para evitar errores por fecha futura
  const today = new Date().toISOString().slice(0, 10);
  const hastaFinal = hasta > today ? today : hasta;

  if (desde < MIN_DATE) {
    return {
      ok: false,
      error: `La serie CER del BCRA comienza el ${MIN_DATE}. Ajustá la fecha de inicio.`,
    };
  }

  if (desde > hastaFinal) {
    return { ok: false, error: '"Desde" no puede ser posterior a "Hasta".' };
  }

  try {
    // ── Step 1: try known candidate IDs ──────────────────────────────────────
    for (const candidateId of CER_CANDIDATE_IDS) {
      const result = await fetchCerData(candidateId, desde, hastaFinal);
      if (result.status === 404) continue; // try next
      if (result.data && result.data.length > 0) {
        return { ok: true, data: result.data };
      }
      // status=200 but empty data — date range might be wrong for this variable
      if (result.status === 200 && result.data !== null) {
        return {
          ok: false,
          error:
            'El BCRA no devolvió datos para ese rango de fechas. ' +
            'La serie CER comienza en febrero de 2002; verificá que las fechas sean correctas. ' +
            'También podés usar "Importar desde Excel" con el archivo descargado de bcra.gob.ar.',
        };
      }
    }

    // ── Step 2: auto-discover via catalog ────────────────────────────────────
    const discoveredId = await discoverCerVariableId();

    if (discoveredId === null) {
      return {
        ok: false,
        error:
          'No se encontró la variable CER en el catálogo del BCRA (v4.0). ' +
          'Es posible que la API haya sido actualizada. ' +
          'Usá "Importar desde Excel" con el archivo .xlsx de bcra.gob.ar.',
      };
    }

    const result = await fetchCerData(discoveredId, desde, hastaFinal);

    if (result.status === 404 || !result.data || result.data.length === 0) {
      return {
        ok: false,
        error:
          `Variable CER encontrada (ID ${discoveredId}) pero sin datos para el rango indicado. ` +
          'Verificá que las fechas sean correctas (la serie comienza en febrero de 2002). ' +
          'También podés usar "Importar desde Excel".',
      };
    }

    return { ok: true, data: result.data };

  } catch (err: unknown) {
    const msg: string = (err as Error)?.message ?? 'Error de red';
    const isConnIssue =
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('Timeout');
    return {
      ok: false,
      error: isConnIssue
        ? 'No se pudo conectar con la API del BCRA (Estadísticas). ' +
          'El servidor puede estar temporalmente inaccesible. ' +
          'Intentá de nuevo o usá "Importar desde Excel" con el .xlsx de bcra.gob.ar. ' +
          `(${msg})`
        : `Error al importar desde el BCRA: ${msg}`,
    };
  }
}
