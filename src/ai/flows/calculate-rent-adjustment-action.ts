'use server';
/**
 * Calculadora de ajuste de alquiler con datos reales de índices oficiales.
 *
 * Fuentes:
 * - ICL: API BCRA v4.0
 * - IPC: API INDEC datos.gob.ar
 * - CER: fetch-cer-bcra-action (ya existente)
 *
 * Dado el mecanismo de ajuste, el monto actual y la fecha del último ajuste,
 * calcula el nuevo monto, el coeficiente y el porcentaje de variación.
 */

import { fetchIcl }   from './fetch-icl-bcra-action';
import { fetchIpc }   from './fetch-ipc-indec-action';
import { fetchCerFromBcra as fetchCer } from './fetch-cer-bcra-action';

export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CER' | 'CasaPropia' | 'Fixed';

export interface RentAdjustmentInput {
  mechanism: AdjustmentMechanism;
  currentRentAmount: number;
  currency: 'ARS' | 'USD' | 'UVA';
  lastAdjustmentDate?: string;   // YYYY-MM-DD
  adjustmentFrequencyMonths: number;
}

export interface RentAdjustmentResult {
  mechanism: AdjustmentMechanism;
  currentAmount: number;
  newAmount: number;
  coefficient: number;             // Factor multiplicador (ej: 1.037 = 3.7%)
  variationPct: number;            // Porcentaje de variación
  currency: 'ARS' | 'USD' | 'UVA';
  referencePeriod: string;         // Ej: "Abril 2025"
  referenceDate: string;           // Fecha del índice usado
  source: 'api' | 'fallback';
  sourceLabel: string;             // Ej: "ICL – BCRA (Abril 2025)"
  note?: string;
  isEstimated: boolean;
}

export type CalculateRentAdjustmentResult =
  | { ok: true; data: RentAdjustmentResult }
  | { ok: false; error: string };

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatPeriod(date: string): string {
  const [year, month] = date.split('-');
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

function roundToTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Casa Propia: estimación basada en promedio salarios/inflación ─────────────
// No tiene API pública estable; usamos estimación actualizada
function getCasaPropiaEstimation(): { pct: number; note: string } {
  return {
    pct: 2.8,
    note: 'Índice Casa Propia: estimación. Verificar en https://www.habitat.gob.ar',
  };
}

// ── Calculadora principal ──────────────────────────────────────────────────────
export async function calculateRentAdjustment(
  input: RentAdjustmentInput
): Promise<CalculateRentAdjustmentResult> {
  const { mechanism, currentRentAmount, currency, adjustmentFrequencyMonths } = input;

  try {
    let variationPct = 0;
    let referencePeriod = '';
    let referenceDate = '';
    let source: 'api' | 'fallback' = 'api';
    let note: string | undefined;

    if (mechanism === 'ICL') {
      const result = await fetchIcl();
      if (!result.ok) return { ok: false, error: result.error };
      const { data } = result;

      // Si el ajuste es plurimensual, acumulamos aproximadamente
      // (en producción ideal: traer la serie y calcular entre fechas exactas)
      const monthlyFactor = 1 + (data.monthlyVariationPct / 100);
      const accumulatedFactor = Math.pow(monthlyFactor, adjustmentFrequencyMonths);
      variationPct = (accumulatedFactor - 1) * 100;
      referencePeriod = data.period;
      referenceDate   = data.latestDate;
      source = data.source === 'bcra_api' ? 'api' : 'fallback';
      note = data.note;
    }

    else if (mechanism === 'IPC') {
      const result = await fetchIpc();
      if (!result.ok) return { ok: false, error: result.error };
      const { data } = result;

      const monthlyFactor = 1 + (data.monthlyVariationPct / 100);
      const accumulatedFactor = Math.pow(monthlyFactor, adjustmentFrequencyMonths);
      variationPct = (accumulatedFactor - 1) * 100;
      referencePeriod = data.period;
      referenceDate   = data.latestDate;
      source = data.source === 'indec_api' ? 'api' : 'fallback';
      note = data.note;
    }

    else if (mechanism === 'CER') {
      // Usar los últimos adjustmentFrequencyMonths de CER
      const hasta = new Date().toISOString().split('T')[0];
      const desdeDate = new Date();
      desdeDate.setMonth(desdeDate.getMonth() - adjustmentFrequencyMonths);
      const desde = desdeDate.toISOString().split('T')[0];

      const result = await fetchCer(desde, hasta);
      if (!result.ok) {
        // Fallback CER
        variationPct = 3.5 * adjustmentFrequencyMonths;
        referencePeriod = formatPeriod(hasta);
        referenceDate = hasta;
        source = 'fallback';
        note = 'Estimación. API del BCRA no disponible.';
      } else {
        const series = result.data;
        if (series.length >= 2) {
          const first = series[0].value;
          const last  = series[series.length - 1].value;
          variationPct = first > 0 ? ((last - first) / first) * 100 : 3.5 * adjustmentFrequencyMonths;
          referenceDate   = series[series.length - 1].date;
          referencePeriod = formatPeriod(referenceDate);
        } else {
          variationPct = 3.5 * adjustmentFrequencyMonths;
          referenceDate = hasta;
          referencePeriod = formatPeriod(hasta);
          source = 'fallback';
        }
      }
    }

    else if (mechanism === 'CasaPropia') {
      const est = getCasaPropiaEstimation();
      const monthlyFactor = 1 + (est.pct / 100);
      const accumulatedFactor = Math.pow(monthlyFactor, adjustmentFrequencyMonths);
      variationPct = (accumulatedFactor - 1) * 100;
      referencePeriod = formatPeriod(new Date().toISOString().split('T')[0]);
      referenceDate = new Date().toISOString().split('T')[0];
      source = 'fallback';
      note = est.note;
    }

    else {
      // Fixed — sin ajuste por índice
      return {
        ok: true,
        data: {
          mechanism,
          currentAmount: currentRentAmount,
          newAmount: currentRentAmount,
          coefficient: 1,
          variationPct: 0,
          currency,
          referencePeriod: '-',
          referenceDate: new Date().toISOString().split('T')[0],
          source: 'api',
          sourceLabel: 'Escalonado fijo (sin índice)',
          isEstimated: false,
        },
      };
    }

    const coefficient   = 1 + variationPct / 100;
    const newAmount     = Math.round(currentRentAmount * coefficient);
    const sourceLabels: Record<AdjustmentMechanism, string> = {
      ICL: `ICL – BCRA (${referencePeriod})`,
      IPC: `IPC – INDEC (${referencePeriod})`,
      CER: `CER – BCRA (${referencePeriod})`,
      CasaPropia: `Índice Casa Propia (${referencePeriod})`,
      Fixed: 'Escalonado fijo',
    };

    return {
      ok: true,
      data: {
        mechanism,
        currentAmount: currentRentAmount,
        newAmount,
        coefficient: roundToTwo(coefficient),
        variationPct: roundToTwo(variationPct),
        currency,
        referencePeriod,
        referenceDate,
        source,
        sourceLabel: sourceLabels[mechanism],
        note,
        isEstimated: source === 'fallback',
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error calculando ajuste' };
  }
}

/**
 * Obtiene el valor actual de un índice (sin calcular ajuste).
 * Útil para mostrar en dashboards y notificaciones.
 */
export async function fetchCurrentIndexValue(
  mechanism: AdjustmentMechanism
): Promise<{ ok: boolean; pct?: number; period?: string; source?: string; note?: string }> {
  try {
    if (mechanism === 'ICL') {
      const r = await fetchIcl();
      if (!r.ok) return { ok: false };
      return { ok: true, pct: r.data.monthlyVariationPct, period: r.data.period, source: r.data.source, note: r.data.note };
    }
    if (mechanism === 'IPC') {
      const r = await fetchIpc();
      if (!r.ok) return { ok: false };
      return { ok: true, pct: r.data.monthlyVariationPct, period: r.data.period, source: r.data.source, note: r.data.note };
    }
    if (mechanism === 'CER') {
      const hasta = new Date().toISOString().split('T')[0];
      const desde30 = new Date(); desde30.setDate(desde30.getDate() - 30);
      const r = await fetchCer(desde30.toISOString().split('T')[0], hasta);
      if (!r.ok || r.data.length < 2) return { ok: false };
      const first = r.data[0].value; const last = r.data[r.data.length-1].value;
      const pct = first > 0 ? ((last - first) / first) * 100 : 0;
      return { ok: true, pct: roundToTwo(pct), period: formatPeriod(hasta), source: 'bcra_api' };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
