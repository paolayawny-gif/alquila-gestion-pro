
export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';
export type Currency = 'ARS' | 'USD';
export type PersonType = 'Inquilino' | 'Propietario' | 'Garante';

export interface DocumentInfo {
  id: string;
  name: string;
  url: string;
  type: string; // 'DNI' | 'Escritura' | 'Recibo' | 'Seguro'
  status: 'Pendiente' | 'Validado' | 'Rechazado';
  date: string;
}

export interface BankDetails {
  bank: string;
  cbu: string;
  alias: string;
}

export interface Person {
  id: string;
  type: PersonType;
  fullName: string;
  taxId: string; // CUIT/CUIL/DNI
  email: string;
  phone: string;
  address?: string;
  bankDetails?: BankDetails;
  documents: DocumentInfo[];
  ownerId: string;
}

export interface PropertyOwner {
  ownerId: string;
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
  ownerId: string;
}

export interface Contract {
  id: string;
  tenantId: string;
  propertyId: string;
  guarantorIds?: string[];
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
  lateFeePercentage?: number; // Punitorios por día o mes
  status: 'Active' | 'Overdue' | 'InLegal' | 'Terminated';
  ownerId: string;
}

export interface MaintenanceTask {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantId?: string;
  tenantName?: string;
  concept: string;
  description: string;
  amount: number;
  dueDate: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  status: 'Pendiente' | 'Presupuestado' | 'En curso' | 'Completado';
  hasFile: boolean;
}

export interface Invoice {
  id: string;
  contractId: string;
  concept: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido';
  hasFile: boolean;
  cae?: string; // Para AFIP futura
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
  dateCreated: string;
}
