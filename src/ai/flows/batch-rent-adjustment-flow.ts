'use server';
/**
 * Ajuste masivo de cánones de alquiler.
 *
 * Patrón inspirado en Dexter (multi-agent decomposition):
 *  1. Descompone "ajustar todos los contratos" en subtareas independientes por contrato.
 *  2. Ejecuta cada cálculo en paralelo (Promise.all) para minimizar latencia.
 *  3. Valida el coeficiente resultante antes de aceptarlo (sanity check).
 *  4. Devuelve un informe completo con nuevos montos, índices usados y errores por contrato.
 *
 * No escribe en Firestore — sólo calcula y reporta.
 * El admin decide qué contratos actualizar desde la UI.
 */

import { calculateRentAdjustment, type AdjustmentMechanism } from './calculate-rent-adjustment-action';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchContractInput {
  id: string;
  propertyName: string;
  tenantName: string;
  tenantEmail?: string;
  currentRentAmount: number;
  currency: 'ARS' | 'USD';
  adjustmentMechanism?: string;
  adjustmentFrequencyMonths: number;
}

export interface BatchAdjustmentLine {
  contractId: string;
  propertyName: string;
  tenantName: string;
  currentRent: number;
  newRent: number;
  increase: number;           // diferencia absoluta
  coefficient: number;        // factor multiplicador (ej: 1.037)
  variationPct: number;       // porcentaje de variación
  indexUsed: string;          // etiqueta del índice (ej: "ICL – BCRA (Abril 2025)")
  referencePeriod: string;
  isEstimated: boolean;       // true si el índice es fallback
  error?: string;
}

export type BatchRentAdjustmentResult =
  | { ok: true; lines: BatchAdjustmentLine[]; generatedAt: string; totalCurrentRent: number; totalNewRent: number }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// FLOW
// ─────────────────────────────────────────────────────────────────────────────

const VALID_MECHANISMS = new Set<AdjustmentMechanism>(['ICL', 'IPC', 'CER', 'CasaPropia', 'Fixed']);

export async function batchRentAdjustment(
  contracts: BatchContractInput[]
): Promise<BatchRentAdjustmentResult> {
  if (contracts.length === 0) {
    return { ok: true, lines: [], generatedAt: new Date().toISOString(), totalCurrentRent: 0, totalNewRent: 0 };
  }

  try {
    // Stage 1: dispatch all calculations in parallel (Dexter decomposition pattern)
    const settled = await Promise.allSettled(
      contracts.map(async (c): Promise<BatchAdjustmentLine> => {
        const mechanism: AdjustmentMechanism = VALID_MECHANISMS.has(c.adjustmentMechanism as AdjustmentMechanism)
          ? (c.adjustmentMechanism as AdjustmentMechanism)
          : 'ICL';

        const res = await calculateRentAdjustment({
          mechanism,
          currentRentAmount: c.currentRentAmount,
          currency: c.currency,
          adjustmentFrequencyMonths: c.adjustmentFrequencyMonths,
        });

        if (!res.ok) {
          return {
            contractId: c.id,
            propertyName: c.propertyName,
            tenantName: c.tenantName,
            currentRent: c.currentRentAmount,
            newRent: c.currentRentAmount,
            increase: 0,
            coefficient: 1,
            variationPct: 0,
            indexUsed: mechanism,
            referencePeriod: '-',
            isEstimated: true,
            error: res.error,
          };
        }

        const d = res.data;

        // Stage 2: sanity validation — coefficient must be in [1.0, 4.0]
        // Extreme values likely indicate a data issue rather than a real index spike
        const isReasonable = d.coefficient >= 1.0 && d.coefficient <= 4.0;

        return {
          contractId: c.id,
          propertyName: c.propertyName,
          tenantName: c.tenantName,
          currentRent: c.currentRentAmount,
          newRent: d.newAmount,
          increase: d.newAmount - c.currentRentAmount,
          coefficient: d.coefficient,
          variationPct: d.variationPct,
          indexUsed: d.sourceLabel,
          referencePeriod: d.referencePeriod,
          isEstimated: d.isEstimated,
          error: !isReasonable ? `Coeficiente fuera de rango: ${d.coefficient}x` : undefined,
        };
      })
    );

    // Stage 3: collect results, surfacing rejection reasons as error lines
    const lines: BatchAdjustmentLine[] = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        contractId: contracts[i].id,
        propertyName: contracts[i].propertyName,
        tenantName: contracts[i].tenantName,
        currentRent: contracts[i].currentRentAmount,
        newRent: contracts[i].currentRentAmount,
        increase: 0,
        coefficient: 1,
        variationPct: 0,
        indexUsed: '-',
        referencePeriod: '-',
        isEstimated: true,
        error: result.reason?.message ?? 'Error desconocido',
      };
    });

    const totalCurrentRent = lines.reduce((a, l) => a + l.currentRent, 0);
    const totalNewRent      = lines.reduce((a, l) => a + l.newRent, 0);

    return {
      ok: true,
      lines,
      generatedAt: new Date().toISOString(),
      totalCurrentRent,
      totalNewRent,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error en ajuste masivo' };
  }
}
