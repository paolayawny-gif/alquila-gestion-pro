export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';
export type Currency = 'ARS' | 'USD';

export interface PropertyOwner {
  name: string;
  percentage: number;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  unit?: string;
  type: PropertyType;
  usage: PropertyUsage;
  status: PropertyStatus;
  squareMeters?: number;
  rooms?: number;
  amenities: string[];
  photos: string[];
  internalNotes?: string;
  owners: PropertyOwner[];
  monthlyRent: number;
  currency: Currency;
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
  tenantName?: string;
  propertyName?: string;
  startDate: string;
  endDate: string;
  baseRentAmount: number;
  currentRentAmount: number;
  currency: Currency;
  adjustmentMechanism: AdjustmentMechanism;
  adjustmentFrequencyMonths: number;
  lastAdjustmentDate?: string;
  nextAdjustmentDate?: string;
  status: 'Active' | 'Overdue' | 'InLegal' | 'Terminated';
}

export interface Invoice {
  id: string;
  concept: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido';
  hasFile: boolean;
}

export interface MaintenanceTask {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: 'Pendiente' | 'En curso' | 'Completado';
  hasFile: boolean;
}

export interface LegalCase {
  id: string;
  type: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: string;
  hasFile: boolean;
}

export interface Liquidation {
  id: string;
  propertyName: string;
  rentAmount: number;
  adminFee: number;
  maintenanceDeductions: number;
  netAmount: number;
  period: string;
}
