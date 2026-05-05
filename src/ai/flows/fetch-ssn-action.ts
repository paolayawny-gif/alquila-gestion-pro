'use server';

/**
 * fetch-ssn-action.ts
 *
 * Verifica si una aseguradora está habilitada por la
 * Superintendencia de Seguros de la Nación (SSN).
 *
 * Intenta consultar el endpoint público de la SSN.
 * Si falla (SSL, timeout, estructura inesperada), cae a una lista
 * local de aseguradoras conocidas — todas autorizadas por SSN.
 */

import https from 'https';

// ── Fallback: aseguradoras conocidas habilitadas por SSN ─────────────────────
const SSN_KNOWN: Record<string, boolean> = {
  'Allianz':              true,
  'Mapfre':               true,
  'Zurich':               true,
  'San Cristóbal':        true,
  'Sancor Seguros':       true,
  'Federación Patronal':  true,
  'La Segunda':           true,
  'Rivadavia':            true,
  'HSBC':                 true,
  'BBVA Seguros':         true,
  'Provincia Seguros':    true,
  'Galeno':               true,
  'SMG Seguros':          true,
  'Chubb':                true,
  'AXA':                  true,
  'Integrity Seguros':    true,
};

// ── HTTP helper (Node.js nativo, bypassa SSL de gov.ar) ──────────────────────
function fetchSSNURL(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AlquilaGestionPro/1.0',
        },
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
          } catch {
            reject(new Error('SSN: respuesta no es JSON'));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () =>
      req.destroy(new Error('SSN: timeout de conexión (10 s)')),
    );
  });
}

// ── Tipos exportados ─────────────────────────────────────────────────────────
export interface SSNResult {
  insurer: string;
  authorized: boolean;
  /** 'api' = dato live de SSN · 'local' = lista interna conocida */
  source: 'api' | 'local';
  registrationNumber?: string;
}

// ── Server action principal ──────────────────────────────────────────────────
export async function checkSSNAuthorization(
  insurers: string[],
): Promise<SSNResult[]> {
  // Intentar API pública de SSN
  try {
    const data = await fetchSSNURL(
      'https://api.ssn.gob.ar/entidades/habilitadas',
    );
    if (Array.isArray(data)) {
      return insurers.map((name) => {
        const found = (data as any[]).find(
          (e) =>
            (e.nombre ?? '').toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes((e.nombre ?? '').toLowerCase()),
        );
        return {
          insurer: name,
          authorized: !!found,
          source: 'api' as const,
          registrationNumber: found?.nroInscripcion ?? undefined,
        };
      });
    }
  } catch {
    // Silencioso: cae a la lista local
  }

  // Fallback: lista interna
  return insurers.map((name) => ({
    insurer: name,
    authorized:
      SSN_KNOWN[name] ??
      Object.keys(SSN_KNOWN).some(
        (k) =>
          k.toLowerCase() === name.toLowerCase() ||
          name.toLowerCase().includes(k.toLowerCase()),
      ),
    source: 'local' as const,
  }));
}
