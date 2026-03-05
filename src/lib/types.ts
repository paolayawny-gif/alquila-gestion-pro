export interface Property {
  id: string;
  name: string;
  address: string;
  unit?: string;
  ownerName: string;
  monthlyRent: number;
  currency: 'ARS' | 'USD';
}

export interface Tenant {
  id: string;
  name: string;
  propertyId: string;
  propertyName?: string;
  phone: string;
  email: string;
  leaseEndDate: string;
  status: 'Al día' | 'Atrasado' | 'En legales';
  hasContractFile: boolean;
  scoring?: number;
}

export interface Contract {
  id: string;
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  baseRentAmount: number;
  currentRentAmount: number;
  currency: 'ARS' | 'USD';
  adjustmentMechanism: 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';
  adjustmentFrequencyMonths: number;
  lastAdjustmentDate?: string;
  nextAdjustmentDate?: string;
  status: 'Active' | 'Overdue' | 'InLegal' | 'Terminated';
}

export interface Invoice {
  id: string;
  concept: string;
  amount: number;
  currency: 'ARS' | 'USD';
  exchangeRate?: number; // Para cobros USD en ARS
  dueDate: string;
  paymentDate?: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido';
  hasFile: boolean;
  fiscalType?: 'Factura B' | 'Factura C';
  cae?: string; // Código de Autorización Electrónico (AFIP)
  category: 'Alquiler' | 'Expensas' | 'Servicio' | 'Mantenimiento';
}

export interface MaintenanceTask {
  id: string;
  concept: string;
  amount: number;
  currency: 'ARS' | 'USD';
  dueDate: string;
  status: 'Pendiente' | 'En curso' | 'Completado';
  hasFile: boolean;
  providerName?: string;
}

export interface LegalCase {
  id: string;
  type: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: 'Pendiente' | 'En proceso' | 'Acuerdo firmado' | 'Finalizado';
  hasFile: boolean;
}

export interface Liquidation {
  id: string;
  propertyId: string;
  propertyName: string;
  rentAmount: number;
  adminFee: number;
  maintenanceDeductions: number;
  netAmount: number;
  period: string;
  status: 'Procesada' | 'Pagada';
}
