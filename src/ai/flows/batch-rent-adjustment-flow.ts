'use server';
/**
 * Ajuste masivo de cánones de alquiler — cálculo per-contrato.
 *
 * Cada contrato tiene su propio inicio, frecuencia y estado. Por eso este flow:
 *  1. Deriva la fecha del último ajuste real a partir de startDate + períodos transcurridos.
 *  2. Calcula los meses reales que pasaron desde ese último ajuste.
 *  3. Determina si el contrato ya está vencido para ajuste o todavía no.
 *  4. Aplica el índice (ICL/IPC/CER) solo por la cantidad de meses real, no por la frecuencia nominal.
 *  5. Procesa todos los contratos en paralelo (Promise.allSettled) con validación individual.
 *
 * No escribe en Firestore — solo calcula y reporta.
 */

import { calculateRentAdjustment, type AdjustmentMechanism } from './calculate-rent-adjustment-action';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchContractInput {
  id: string;
  propertyName: string;
  tenantName: string;
  tenantEmail?: string;
  currentRentAmount: number;
  currency: 'ARS' | 'USD' | 'UVA';
  adjustmentMechanism?: string;
  adjustmentFrequencyMonths: number;
  startDate?: string;             // YYYY-MM-DD — necesario para calcular períodos reales
}

export interface BatchAdjustmentLine {
  contractId: string;
  propertyName: string;
  tenantName: string;
  currentRent: number;
  newRent: number;
  increase: number;
  coefficient: number;
  variationPct: number;
  indexUsed: string;
  referencePeriod: string;
  isEstimated: boolean;
  // Datos de período por contrato
  lastAdjDate: string;            // fecha del último ajuste (calculada)
  nextAdjDate: string;            // fecha del próximo ajuste esperado
  isDue: boolean;                 // true si ya corresponde ajustar
  monthsElapsed: number;          // meses reales desde el último ajuste
  error?: string;
}

export type BatchRentAdjustmentResult =
  | { ok: true; lines: BatchAdjustmentLine[]; generatedAt: string; totalCurrentRent: number; totalNewRent: number }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE PERÍODO
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodInfo {
  lastAdjDate: string;
  nextAdjDate: string;
  isDue: boolean;
  monthsElapsed: number;
}

function calcPeriodInfo(startDate: string, frequencyMonths: number): PeriodInfo {
  const start = new Date(startDate);
  const now   = new Date();

  // Meses completos transcurridos desde el inicio del contrato
  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth()   - start.getMonth());

  // Cuántos períodos completos de ajuste pasaron
  const periodsPassed = Math.max(0, Math.floor(totalMonths / frequencyMonths));

  // Fecha del último ajuste aplicado
  const lastAdj = new Date(start);
  lastAdj.setMonth(lastAdj.getMonth() + periodsPassed * frequencyMonths);

  // Fecha del próximo ajuste esperado
  const nextAdj = new Date(lastAdj);
  nextAdj.setMonth(nextAdj.getMonth() + frequencyMonths);

  const isDue = now >= nextAdj;

  // Meses reales desde el último ajuste (para el acumulado del índice)
  const monthsElapsed = isDue
    ? Math.round(
        (now.getFullYear() - lastAdj.getFullYear()) * 12 +
        (now.getMonth()    - lastAdj.getMonth())
      )
    : frequencyMonths; // todavía no vence → proyectamos con la frecuencia nominal

  return {
    lastAdjDate: lastAdj.toISOString().split('T')[0],
    nextAdjDate: nextAdj.toISOString().split('T')[0],
    isDue,
    monthsElapsed: Math.max(monthsElapsed, 1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const VALID_MECHANISMS = new Set<AdjustmentMechanism>(['ICL', 'IPC', 'CER', 'CasaPropia', 'Fixed']);

export async function batchRentAdjustment(
  contracts: BatchContractInput[]
): Promise<BatchRentAdjustmentResult> {
  if (contracts.length === 0) {
    return { ok: true, lines: [], generatedAt: new Date().toISOString(), totalCurrentRent: 0, totalNewRent: 0 };
  }

  try {
    // Paso 1: enriquecer cada contrato con su período real antes de llamar las APIs
    const enriched = contracts.map(c => {
      const period = c.startDate
        ? calcPeriodInfo(c.startDate, c.adjustmentFrequencyMonths)
        : { lastAdjDate: '-', nextAdjDate: '-', isDue: true, monthsElapsed: c.adjustmentFrequencyMonths };
      return { ...c, period };
    });

    // Paso 2: cálculo en paralelo, cada contrato con sus meses reales
    const settled = await Promise.allSettled(
      enriched.map(async (c): Promise<BatchAdjustmentLine> => {
        const mechanism: AdjustmentMechanism = VALID_MECHANISMS.has(c.adjustmentMechanism as AdjustmentMechanism)
          ? (c.adjustmentMechanism as AdjustmentMechanism)
          : 'ICL';

        const res = await calculateRentAdjustment({
          mechanism,
          currentRentAmount: c.currentRentAmount,
          currency: c.currency,
          lastAdjustmentDate: c.period.lastAdjDate !== '-' ? c.period.lastAdjDate : undefined,
          adjustmentFrequencyMonths: c.period.monthsElapsed, // meses REALES transcurridos
        });

        if (!res.ok) return mkErrorLine(c, c.period, res.error);

        const d = res.data;
        if (d.coefficient < 1.0 || d.coefficient > 4.0) {
          return mkErrorLine(c, c.period, `Coeficiente fuera de rango: ${d.coefficient}x`);
        }

        return {
          contractId:      c.id,
          propertyName:    c.propertyName,
          tenantName:      c.tenantName,
          currentRent:     c.currentRentAmount,
          newRent:         d.newAmount,
          increase:        d.newAmount - c.currentRentAmount,
          coefficient:     d.coefficient,
          variationPct:    d.variationPct,
          indexUsed:       d.sourceLabel,
          referencePeriod: d.referencePeriod,
          isEstimated:     d.isEstimated,
          lastAdjDate:     c.period.lastAdjDate,
          nextAdjDate:     c.period.nextAdjDate,
          isDue:           c.period.isDue,
          monthsElapsed:   c.period.monthsElapsed,
        };
      })
    );

    // Paso 3: unificar resultados
    const lines: BatchAdjustmentLine[] = settled.map((result, i) =>
      result.status === 'fulfilled'
        ? result.value
        : mkErrorLine(enriched[i], enriched[i].period, result.reason?.message ?? 'Error desconocido')
    );

    const totalCurrentRent = lines.reduce((a, l) => a + l.currentRent, 0);
    const totalNewRent      = lines.reduce((a, l) => a + (l.error ? l.currentRent : l.newRent), 0);

    return { ok: true, lines, generatedAt: new Date().toISOString(), totalCurrentRent, totalNewRent };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error en ajuste masivo' };
  }
}

function mkErrorLine(
  c: BatchContractInput,
  period: PeriodInfo,
  error: string,
): BatchAdjustmentLine {
  return {
    contractId:      c.id,
    propertyName:    c.propertyName,
    tenantName:      c.tenantName,
    currentRent:     c.currentRentAmount,
    newRent:         c.currentRentAmount,
    increase:        0,
    coefficient:     1,
    variationPct:    0,
    indexUsed:       c.adjustmentMechanism ?? '-',
    referencePeriod: '-',
    isEstimated:     true,
    lastAdjDate:     period.lastAdjDate,
    nextAdjDate:     period.nextAdjDate,
    isDue:           period.isDue,
    monthsElapsed:   period.monthsElapsed,
    error,
  };
}
