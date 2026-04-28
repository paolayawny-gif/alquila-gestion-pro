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
  maxSituation: number;          // 1=Normal … 6=Irrecuperable técnico
  latestPeriod: string;
  latestEntidades: BcraDeudaEntidad[];
  totalEntidades: number;
  hasRejectedChecks: boolean;
  cheques: BcraChequeDetalle[];
  consultedAt: string;
}

const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Riesgo medio',
  4: 'Riesgo alto',
  5: 'Irrecuperable',
  6: 'Irrecuperable (disp. técnica)',
};

export function situacionLabel(s: number) {
  return SIT_LABEL[s] ?? `Situación ${s}`;
}

export function situacionColor(s: number): string {
  if (s <= 1) return 'green';
  if (s === 2) return 'lime';
  if (s === 3) return 'orange';
  return 'red';
}

export async function fetchDeudaBcra(cuit: string): Promise<BcraDeudaReport> {
  const cleanCuit = cuit.replace(/\D/g, '');
  if (cleanCuit.length !== 11) throw new Error('El CUIT/CUIL debe tener 11 dígitos.');

  const [deudaRes, chequesRes] = await Promise.allSettled([
    fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cleanCuit}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }),
    fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/ChequesRechazados/${cleanCuit}`, {
      headers: { Accept: 'application/json' },
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

  if (deudaRes.status === 'fulfilled' && deudaRes.value.ok) {
    const j = await deudaRes.value.json();
    const deuda = j.results;
    denominacion = deuda?.denominacion ?? '';
    identificacion = deuda?.identificacion ?? identificacion;
    const periodos: any[] = deuda?.periodos ?? [];
    // Most recent period first
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
    // Max situation across all periods
    for (const p of periodos) {
      for (const e of (p.entidades ?? [])) {
        if ((e.situacion ?? 1) > maxSituation) maxSituation = e.situacion;
        totalEntidades++;
      }
    }
  } else if (deudaRes.status === 'fulfilled' && deudaRes.value.status === 404) {
    // 404 = no records → person is clean
    maxSituation = 1;
  } else if (deudaRes.status === 'rejected') {
    throw new Error('No se pudo conectar con la API del BCRA. Intentá nuevamente.');
  }

  // ── Cheques rechazados ──
  let cheques: BcraChequeDetalle[] = [];
  if (chequesRes.status === 'fulfilled' && chequesRes.value.ok) {
    const j = await chequesRes.value.json();
    const causales: any[] = j.results?.causales ?? [];
    for (const causal of causales) {
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
    identificacion,
    denominacion,
    maxSituation,
    latestPeriod,
    latestEntidades,
    totalEntidades,
    hasRejectedChecks: cheques.length > 0,
    cheques,
    consultedAt: new Date().toISOString(),
  };
}
