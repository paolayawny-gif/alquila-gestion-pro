'use server';

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


export async function fetchDeudaBcra(cuit: string): Promise<FetchDeudaResult> {
  const cleanCuit = cuit.replace(/\D/g, '');
  if (cleanCuit.length !== 11) {
    return { ok: false, error: 'El CUIT/CUIL debe tener exactamente 11 dígitos.' };
  }

  try {
    const [deudaRes, chequesRes] = await Promise.allSettled([
      fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cleanCuit}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'AlquilaGestionPro/1.0' },
        cache: 'no-store',
      }),
      fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/ChequesRechazados/${cleanCuit}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'AlquilaGestionPro/1.0' },
        cache: 'no-store',
      }),
    ]);

    // ── Deudas ──
    let denominacion = '';
    let identificacion = Number(cleanCuit);
    let maxSituation = 1;
    let latestPeriod = '';
    let latestEntidades: BcraDeudaEntidad[] = [];
    let totalEntidades = 0;

    if (deudaRes.status === 'rejected') {
      return {
        ok: false,
        error: 'No se pudo conectar con la API de Central de Deudores del BCRA. ' +
          `Error: ${deudaRes.reason?.message ?? 'Error de red'}`,
      };
    }

    if (deudaRes.value.ok) {
      const j = await deudaRes.value.json();
      const deuda = j.results;
      denominacion = deuda?.denominacion ?? '';
      identificacion = deuda?.identificacion ?? identificacion;
      const periodos: any[] = deuda?.periodos ?? [];
      const sorted = [...periodos].sort((a, b) => (b.periodo ?? '').localeCompare(a.periodo ?? ''));
      if (sorted.length > 0) {
        latestPeriod = sorted[0].periodo ?? '';
        latestEntidades = (sorted[0].entidades ?? []).map((e: any) => ({
          entidad: e.entidad ?? '',
          situacion: e.situacion ?? 1,
          monto: e.monto ?? 0,
          diasAtrasoPago: e.diasAtrasoPago ?? 0,
          refinanciaciones: !!e.refinanciaciones,
          situacionJuridica: !!e.situacionJuridica,
          procesoJud: !!e.procesoJud,
        }));
      }
      for (const p of periodos) {
        for (const e of (p.entidades ?? [])) {
          if ((e.situacion ?? 1) > maxSituation) maxSituation = e.situacion;
          totalEntidades++;
        }
      }
    } else if (deudaRes.value.status === 404) {
      // 404 = no records — person is clean
      denominacion = '';
    } else {
      return {
        ok: false,
        error: `La API del BCRA respondió con error ${deudaRes.value.status} al consultar deudas.`,
      };
    }

    // ── Cheques rechazados ──
    let cheques: BcraChequeDetalle[] = [];
    if (chequesRes.status === 'fulfilled' && chequesRes.value.ok) {
      const j = await chequesRes.value.json();
      for (const causal of (j.results?.causales ?? [])) {
        for (const entidad of (causal.entidades ?? [])) {
          for (const d of (entidad.detalle ?? [])) {
            cheques.push({
              nroCheque: d.nroCheque,
              fechaRechazo: d.fechaRechazo,
              monto: d.monto,
              fechaPago: d.fechaPago ?? null,
              estadoMulta: d.estadoMulta ?? null,
              procesoJud: !!d.procesoJud,
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
