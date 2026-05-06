'use server';

/**
 * @fileOverview Server action — CER Diario del BCRA
 *
 * Endpoint oficial (API Estadísticas v4.0):
 *   GET https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{IdVariable}
 *       ?Desde=YYYY-MM-DD&Hasta=YYYY-MM-DD&Limit=2000
 *
 * Variable 3540 = Coeficiente de Estabilización de Referencia (CER) — diario.
 * La serie comienza el 01/02/2002.
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

const CER_VARIABLE_ID = 3540;
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

  const url =
    `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${CER_VARIABLE_ID}` +
    `?Desde=${desde}&Hasta=${hastaFinal}&Limit=2000`;

  try {
    const { status, body } = await httpsGetWithRetry(url);

    if (status < 200 || status >= 300) {
      let detail = '';
      try {
        const parsed = JSON.parse(body) as { errorMessages?: string[] };
        detail = parsed.errorMessages?.join(', ') ?? body.slice(0, 200);
      } catch { detail = body.slice(0, 200); }

      return {
        ok: false,
        error:
          `El BCRA respondió con error ${status}. ` +
          `Verificá el rango de fechas (la serie comienza en ${MIN_DATE}). ` +
          (detail ? `Detalle: ${detail}` : ''),
      };
    }

    const json = JSON.parse(body) as {
      results?: { idVariable: number; detalle?: { fecha: string; valor: number }[] }[];
    };

    // v4.0: results[0].detalle[]  |  fallback: results[] flat
    const detalle: { fecha: string; valor: number }[] =
      Array.isArray(json.results?.[0]?.detalle)
        ? json.results![0].detalle!
        : Array.isArray(json.results)
        ? (json.results as unknown as { fecha: string; valor: number }[])
        : [];

    if (!detalle.length) {
      return {
        ok: false,
        error:
          'El BCRA no devolvió datos para ese rango de fechas. ' +
          'La serie CER comienza en febrero de 2002; verificá que las fechas sean correctas. ' +
          'También podés usar "Importar desde Excel" con el archivo descargado de bcra.gob.ar.',
      };
    }

    return {
      ok: true,
      data: detalle
        .filter(r => r.fecha && r.valor != null)
        .map(r => ({ date: r.fecha, value: r.valor })),
    };
  } catch (err: any) {
    const msg: string = err?.message ?? 'Error de red';
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
          'Intentá de nuevo o usá "Importar desde Excel" con el .xlsx de bcra.gob.ar → Serie 3540. ' +
          `(${msg})`
        : `Error al importar desde el BCRA: ${msg}`,
    };
  }
}
