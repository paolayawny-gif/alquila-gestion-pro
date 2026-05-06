'use server';

import https from 'https';

// ── BCRA HTTPS helper ─────────────────────────────────────────────────────────
// api.bcra.gob.ar has two known issues from serverless/cloud environments:
//   1. Its TLS certificate chain is not trusted by Node's default CA store.
//   2. It resets keep-alive connections (ECONNRESET) from cloud provider IPs.
// Solution: fresh Agent per request (keepAlive: false) + rejectUnauthorized: false
// + automatic retries on connection reset.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchBcraURL(url: string, timeoutMs = 20_000): Promise<{ ok: boolean; status: number; json(): Promise<any> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent  = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      agent,
      headers: {
        Accept: 'application/json',
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
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          json: async () => JSON.parse(body),
        });
      });
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
// ECONNRESET and ETIMEDOUT often succeed on retry from serverless.
async function fetchBcraWithRetry(
  url: string,
  retries = 3,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ ok: boolean; status: number; json(): Promise<any> }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchBcraURL(url);
    } catch (err: unknown) {
      lastErr = err;
      const msg = (err as Error)?.message ?? '';
      const isRetryable =
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('Timeout');
      if (!isRetryable || attempt === retries) break;
      // Exponential back-off: 600 ms, 1.2 s, 2.4 s …
      await new Promise(r => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BcraDeudaEntidad {
  entidad: string;
  situacion: number;
  monto: number;
  diasAtrasoPago: number;
  refinanciaciones: boolean;
  situacionJuridica: boolean;
  procesoJud: boolean;
}

export interface BcraChequeDetalle {
  nroCheque: number;
  fechaRechazo: string;
  monto: number;
  fechaPago: string | null;
  estadoMulta: string | null;
  procesoJud: boolean;
}

export interface BcraDeudaReport {
  identificacion: number;
  denominacion: string;
  maxSituation: number;
  latestPeriod: string;
  latestEntidades: BcraDeudaEntidad[];
  totalEntidades: number;
  hasRejectedChecks: boolean;
  cheques: BcraChequeDetalle[];
  consultedAt: string;
}

export type FetchDeudaResult =
  | { ok: true; data: BcraDeudaReport }
  | { ok: false; error: string };

// ── Main action ───────────────────────────────────────────────────────────────

export async function fetchDeudaBcra(cuit: string): Promise<FetchDeudaResult> {
  const cleanCuit = cuit.replace(/\D/g, '');
  if (cleanCuit.length !== 11) {
    return { ok: false, error: 'El CUIT/CUIL debe tener exactamente 11 dígitos.' };
  }

  try {
    const [deudaRes, chequesRes] = await Promise.allSettled([
      fetchBcraWithRetry(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cleanCuit}`),
      fetchBcraWithRetry(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/ChequesRechazados/${cleanCuit}`),
    ]);

    // ── Deudas ──────────────────────────────────────────────────────────────
    let denominacion    = '';
    let identificacion  = Number(cleanCuit);
    let maxSituation    = 1;
    let latestPeriod    = '';
    let latestEntidades: BcraDeudaEntidad[] = [];
    let totalEntidades  = 0;

    if (deudaRes.status === 'rejected') {
      const msg: string = (deudaRes.reason as Error)?.message ?? 'Error de red';
      const isConn =
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('Timeout');
      return {
        ok: false,
        error: isConn
          ? 'No se pudo conectar con la API del BCRA (Central de Deudores). ' +
            'El servidor del BCRA puede estar temporalmente inaccesible desde la nube. ' +
            'Intentá de nuevo en unos segundos. ' +
            `(${msg})`
          : `Error al consultar el BCRA: ${msg}`,
      };
    }

    if (deudaRes.value.ok) {
      const j    = await deudaRes.value.json();
      const deuda = j.results;
      denominacion   = deuda?.denominacion ?? '';
      identificacion = deuda?.identificacion ?? identificacion;
      const periodos: any[] = deuda?.periodos ?? [];
      const sorted = [...periodos].sort((a, b) => (b.periodo ?? '').localeCompare(a.periodo ?? ''));
      if (sorted.length > 0) {
        latestPeriod    = sorted[0].periodo ?? '';
        latestEntidades = (sorted[0].entidades ?? []).map((e: any) => ({
          entidad:          e.entidad          ?? '',
          situacion:        e.situacion        ?? 1,
          monto:            e.monto            ?? 0,
          diasAtrasoPago:   e.diasAtrasoPago   ?? 0,
          refinanciaciones: !!e.refinanciaciones,
          situacionJuridica: !!e.situacionJuridica,
          procesoJud:       !!e.procesoJud,
        }));
      }
      for (const p of periodos) {
        for (const e of (p.entidades ?? [])) {
          if ((e.situacion ?? 1) > maxSituation) maxSituation = e.situacion;
          totalEntidades++;
        }
      }
    } else if (deudaRes.value.status === 404) {
      // 404 = sin deudas registradas — persona sin antecedentes
      denominacion = '';
    } else {
      return {
        ok: false,
        error: `La API del BCRA respondió con código ${deudaRes.value.status} al consultar deudas.`,
      };
    }

    // ── Cheques rechazados ───────────────────────────────────────────────────
    let cheques: BcraChequeDetalle[] = [];
    if (chequesRes.status === 'fulfilled' && chequesRes.value.ok) {
      const j = await chequesRes.value.json();
      for (const causal of (j.results?.causales ?? [])) {
        for (const entidad of (causal.entidades ?? [])) {
          for (const d of (entidad.detalle ?? [])) {
            cheques.push({
              nroCheque:   d.nroCheque,
              fechaRechazo: d.fechaRechazo,
              monto:        d.monto,
              fechaPago:    d.fechaPago    ?? null,
              estadoMulta:  d.estadoMulta  ?? null,
              procesoJud:   !!d.procesoJud,
            });
          }
        }
      }
    }

    return {
      ok: true,
      data: {
        identificacion,
        denominacion,
        maxSituation,
        latestPeriod,
        latestEntidades,
        totalEntidades,
        hasRejectedChecks: cheques.length > 0,
        cheques,
        consultedAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      error: 'Error inesperado al consultar el BCRA: ' + (err?.message ?? 'desconocido'),
    };
  }
}
