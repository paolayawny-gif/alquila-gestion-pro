import { Liquidation, Invoice, MaintenanceTask } from '@/lib/types';

export interface LiquidationInputs {
  ingresoAlquiler: number;
  adminFeeDeduction: number;
  expenseDeductions: number;
  maintenanceDeductions: number;
  interestAmount?: number;
}

/**
 * Cálculo único del neto a transferir al propietario.
 * Centraliza la fórmula para que UI, modal de intereses y emails
 * compartan la misma fuente de verdad.
 */
export function calculateLiquidationNet(input: LiquidationInputs | Liquidation): number {
  const interest = input.interestAmount ?? 0;
  return (
    input.ingresoAlquiler -
    input.adminFeeDeduction -
    input.expenseDeductions -
    input.maintenanceDeductions +
    interest
  );
}

/**
 * Recalcula el neto sumando un nuevo monto de intereses al estado actual de la liquidación.
 */
export function recalculateNetWithInterest(liq: Liquidation, newInterest: number): number {
  return calculateLiquidationNet({ ...liq, interestAmount: newInterest });
}

/**
 * Devuelve los componentes de la liquidación a partir de las facturas y tareas de
 * mantenimiento del período. Lógica única usada en `handleCreateLiq`.
 */
export interface LiquidationComputeOptions {
  property: { id: string; name: string };
  period: string;
  invoices: Invoice[];
  tasks: MaintenanceTask[];
  adminFeePct?: number; // default 0.1 (10%)
}

export function computeLiquidationFromSources(opts: LiquidationComputeOptions): {
  rentIncome: number;
  serviceDeductions: number;
  maintenanceDeductions: number;
  adminFee: number;
  netAmount: number;
  hasData: boolean;
} {
  const { property, period, invoices, tasks, adminFeePct = 0.1 } = opts;
  const propInvoices = invoices.filter(i => i.propertyName === property.name && i.period === period);

  let rentIncome = 0;
  let serviceDeductions = 0;
  propInvoices.forEach(inv => {
    inv.charges.forEach(charge => {
      if (charge.type === 'Alquiler') rentIncome += charge.amount;
      if (charge.imputedTo === 'Propietario') serviceDeductions += charge.amount;
    });
  });

  const approvedRepairs = tasks.filter(t =>
    t.propertyId === property.id &&
    t.chargedTo === 'Propietario' &&
    t.isApprovedByOwner === true &&
    t.status === 'Cerrado',
  );
  const maintenanceDeductions = approvedRepairs.reduce((acc, t) => acc + (t.actualCost || 0), 0);

  const adminFee = rentIncome * adminFeePct;
  const netAmount = calculateLiquidationNet({
    ingresoAlquiler: rentIncome,
    adminFeeDeduction: adminFee,
    expenseDeductions: serviceDeductions,
    maintenanceDeductions,
  });

  return {
    rentIncome,
    serviceDeductions,
    maintenanceDeductions,
    adminFee,
    netAmount,
    hasData: rentIncome > 0 || serviceDeductions > 0 || maintenanceDeductions > 0,
  };
}
