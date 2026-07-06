'use server';

import https from 'https';
import tls from 'tls';

// api.bcra.gob.ar sirve su certificado (Sectigo) encadenado a "Sectigo Public
// Server Authentication Root R46" (creado en 2021), un root que todavía no está
// incluido en el bundle de CAs que trae Node en algunos runtimes serverless —
// de ahí el ECONNRESET/UNABLE_TO_VERIFY_LEAF_SIGNATURE que se veía antes. En vez
// de desactivar la verificación (rejectUnauthorized: false), se agrega este root
// público a la lista de confianza para validar la cadena completa igual que un
// browser. Descargado de http://crt.sectigo.com/SectigoPublicServerAuthenticationRootR46.p7c
// (fingerprint SHA-256: 7B:B6:47:A6:2A:EE:AC:88:BF:25:7A:A5:22:D0:1F:FE:A3:95:E0:AB:45:C7:3F:93:F6:56:54:EC:38:F2:5A:06).
const SECTIGO_SERVER_AUTH_ROOT_R46 = `-----BEGIN CERTIFICATE-----
MIIFijCCA3KgAwIBAgIQdY39i658BwD6qSWn4cetFDANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNNDYwMzIxMjM1OTU5WjBfMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQDEy1TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCTvtU2UnXYASOgHEdCSe5jtrch/cSV1UgrJnwUUxDa
ef0rty2k1Cz66jLdScK5vQ9IPXtamFSvnl0xdE8H/FAh3aTPaE8bEmNtJZlMKpnz
SDBh+oF8HqcIStw+KxwfGExxqjWMrfhu6DtK2eWUAtaJhBOqbchPM8xQljeSM9xf
iOefVNlI8JhD1mb9nxc4Q8UBUQvX4yMPFF1bFOdLvt30yNoDN9HWOaEhUTCDsG3X
ME6WW5HwcCSrv0WBZEMNvSE6Lzzpng3LILVCJ8zab5vuZDCQOc2TZYEhMbUjUDM3
IuM47fgxMMxF/mL50V0yeUKH32rMVhlATc6qu/m1dkmU8Sf4kaWD5QazYw6A3OAS
VYCmO2a0OYctyPDQ0RTp5A1NDvZdV3LFOxxHVp3i1fuBYYzMTYCQNFu31xR13NgE
SJ/AwSiItOkcyqex8Va3e0lMWeUgFaiEAin6OJRpmkkGj80feRQXEgyDet4fsZfu
+Zd4KKTIRJLpfSYFplhym3kT2BFfrsU4YjRosoYwjviQYZ4ybPUHNs2iTG7sijbt
8uaZFURww3y8nDnAtOFr94MlI1fZEoDlSfB1D++N6xybVCi0ITz8fAr/73trdf+L
HaAZBav6+CuBQug4urv7qv094PPK306Xlynt8xhW6aWWrL3DkJiy4Pmi1KZHQ3xt
zwIDAQABo0IwQDAdBgNVHQ4EFgQUVnNYZJX5khqwEioEYnmhQBWIIUkwDgYDVR0P
AQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAC9c
mTz8Bl6MlC5w6tIyMY208FHVvArzZJ8HXtXBc2hkeqK5Duj5XYUtqDdFqij0lgVQ
YKlJfp/imTYpE0RHap1VIDzYm/EDMrraQKFz6oOht0SmDpkBm+S8f74TlH7Kph52
gDY9hAaLMyZlbcp+nv4fjFg4exqDsQ+8FxG75gbMY/qB8oFM2gsQa6H61SilzwZA
Fv97fRheORKkU55+MkIQpiGRqRxOF3yEvJ+M0ejf5lG5Nkc/kLnHvALcWxxPDkjB
JYOcCj+esQMzEhonrPcibCTRAUH4WAP+JWgiH5paPHxsnnVI84HxZmduTILA7rpX
DhjvLpr3Etiga+kFpaHpaPi8TD8SHkXoUsCjvxInebnMMTzD9joiFgOgyY9mpFui
TdaBJQbpdqQACj7LzTWb4OE4y2BThihCQRxEV+ioratF4yUQvNs+ZUH7G6aXD+u5
dHn5HrwdVw1Hr8Mvn4dGp+smWg9WY7ViYG4A++MnESLn/pmPNPW56MORcr3Ywx65
LvKRRFHQV80MNNVIIb/bE/FmJUNS0nAiNs2fxBx1IK1jcmMGDw4nztJqDby1ORrp
0XZ60Vzk50lJLVU3aPAaOpg+VBeHVOmmJ1CJeyAvP/+/oYtKR5j/K3tJPsMpRmAY
QqszKbrAKbkTidOIijlBO8n9pu0f9GBj39ItVQGL
-----END CERTIFICATE-----`;

// ── BCRA HTTPS helper ─────────────────────────────────────────────────────────
// api.bcra.gob.ar tiene un problema conocido desde entornos serverless/cloud:
// resetea conexiones keep-alive (ECONNRESET) desde IPs de proveedores cloud.
// Solución: fresh Agent por request (keepAlive: false) + reintentos automáticos
// ante reset de conexión. La verificación TLS queda activa (rejectUnauthorized
// por defecto), sumando el root de Sectigo al bundle de CAs de Node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchBcraURL(url: string, timeoutMs = 20_000): Promise<{ ok: boolean; status: number; json(): Promise<any> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent  = new https.Agent({
      keepAlive: false,
      ca: [...tls.rootCertificates, SECTIGO_SERVER_AUTH_ROOT_R46],
    });
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
