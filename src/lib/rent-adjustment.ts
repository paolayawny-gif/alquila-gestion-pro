import { Contract, IndexRecord, PendingRentAdjustment, AdjustmentMechanism } from './types';

/** Returns YYYY-MM-DD of the next adjustment date given the last adjustment date and frequency. */
export function getNextAdjustmentDate(contract: Contract): Date {
  const base = contract.lastAdjustmentDate
    ? new Date(contract.lastAdjustmentDate)
    : new Date(contract.startDate);
  const next = new Date(base);
  next.setMonth(next.getMonth() + (contract.adjustmentFrequencyMonths || 12));
  return next;
}

/** True when today is on or past the next adjustment date. */
export function isAdjustmentDue(contract: Contract): boolean {
  if (contract.status !== 'Vigente' && contract.status !== 'Próximo a Vencer') return false;
  if (contract.adjustmentType === 'Fixed') return false;
  const next = getNextAdjustmentDate(contract);
  return new Date() >= next;
}

/** Finds the most recent IndexRecord of a given type, optionally on or before a given date. */
function latestIndex(records: IndexRecord[], type: AdjustmentMechanism, before?: Date): IndexRecord | undefined {
  return records
    .filter(r => r.type === type && (!before || r.month <= formatMonth(before)))
    .sort((a, b) => b.month.localeCompare(a.month))[0];
}

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface AdjustmentCalculation {
  proposedAmount: number;
  variationPct: number;
  indexUsed?: string;
  indexValue?: number;
  previousIndexValue?: number;
}

/**
 * Calculates the proposed new rent amount for a contract.
 * Returns null if there is not enough index data to calculate.
 */
export function calculateProposedAmount(
  contract: Contract,
  indexRecords: IndexRecord[],
): AdjustmentCalculation | null {
  const current = contract.currentRentAmount;
  const nextDate = getNextAdjustmentDate(contract);

  if (contract.adjustmentType === 'Percentage') {
    const rate = contract.adjustmentRate ?? 0;
    const proposed = Math.round(current * (1 + rate / 100));
    return { proposedAmount: proposed, variationPct: rate };
  }

  if (contract.adjustmentType === 'Fixed') {
    return { proposedAmount: current, variationPct: 0 };
  }

  if (contract.adjustmentType === 'Index' && contract.adjustmentMechanism) {
    const mechanism = contract.adjustmentMechanism as AdjustmentMechanism;
    const current_ = latestIndex(indexRecords, mechanism, nextDate);
    if (!current_) return null;

    // base = the index value from one frequency period before
    const baseDate = new Date(nextDate);
    baseDate.setMonth(baseDate.getMonth() - (contract.adjustmentFrequencyMonths || 12));
    const base = latestIndex(indexRecords, mechanism, baseDate);
    if (!base || base.value === 0) return null;

    const variationPct = ((current_.value - base.value) / base.value) * 100;
    const proposed = Math.round(current * (1 + variationPct / 100));

    return {
      proposedAmount: proposed,
      variationPct: Math.round(variationPct * 100) / 100,
      indexUsed: `${mechanism} ${current_.month}`,
      indexValue: current_.value,
      previousIndexValue: base.value,
    };
  }

  return null;
}

/** Builds a PendingRentAdjustment object (without id/createdAt — caller sets those). */
export function buildPendingAdjustment(
  contract: Contract,
  calc: AdjustmentCalculation,
  ownerId: string,
): Omit<PendingRentAdjustment, 'id' | 'createdAt'> {
  return {
    contractId: contract.id,
    propertyId: contract.propertyId,
    propertyName: contract.propertyName ?? '',
    tenantName: contract.tenantName ?? '',
    tenantEmail: contract.tenantEmail,
    currentAmount: contract.currentRentAmount,
    proposedAmount: calc.proposedAmount,
    variationPct: calc.variationPct,
    mechanism: contract.adjustmentType === 'Index'
      ? (contract.adjustmentMechanism ?? 'ICL')
      : contract.adjustmentType,
    indexUsed: calc.indexUsed,
    indexValue: calc.indexValue,
    previousIndexValue: calc.previousIndexValue,
    dueDate: getNextAdjustmentDate(contract).toISOString().split('T')[0],
    status: 'pendiente',
    ownerId,
  };
}
