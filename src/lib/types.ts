
export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';
export type Currency = 'ARS' | 'USD';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Mercado Pago' | 'Depósito' | 'Cheque';
export type ChargeType = 'Alquiler' | 'Expensa Ordinaria' | 'Expensa Extraordinaria' | 'TGI/ABL' | 'Aguas' | 'Luz/Gas' | 'Otros';
export type ChargePayer = 'Inquilino' | 'Propietario';
export type ApplicationStatus = 'Nueva' | 'En análisis' | 'Aprobada' | 'Rechazada' | 'Pendiente de documentación';

export interface DocumentInfo {
  id: string;
  name: string;
  url: string;
  type: string;
  status: 'Pendiente' | 'Validado' | 'Rechazado';
  date: string;
  version?: number;
}

export interface BankDetails {
  bank: string;
  cbu: string;
  alias: string;
}

export type PersonType = 'Inquilino' | 'Propietario' | 'Garante' | 'Proveedor';

export interface Person {
  id: string;
  type: PersonType;
  fullName: string;
  taxId: string;
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

export interface RentalApplication {
  id: string;
  propertyId: string;
  propertyName?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  ingreso: number;
  references: string;
  documents: DocumentInfo[];
  status: ApplicationStatus;
  submittedAt: string;
  ownerId: string;
}

export interface AdjustmentScale {
  month: number;
  amount: number;
}

export interface Contract {
  id: string;
  tenantId: string;
  tenantName?: string;
  propertyId: string;
  propertyName?: string;
  guarantorIds: string[];
  ownerIds: string[];
  startDate: string;
  endDate: string;
  paymentPeriodDays: number;
  
  // Cláusulas Económicas
  baseRentAmount: number;
  currentRentAmount: number;
  currency: Currency;
  
  adjustmentType: 'Index' | 'Percentage' | 'Scale' | 'Fixed';
  adjustmentMechanism?: AdjustmentMechanism;
  adjustmentFrequencyMonths: number;
  adjustmentPercentage?: number;
  adjustmentScales?: AdjustmentScale[];
  
  depositAmount: number;
  depositCurrency: Currency;
  commissionAmount: number; 
  
  lateFeeType: 'DailyPercentage' | 'MonthlyPercentage' | 'Fixed';
  lateFeeValue: number;
  lateFeeCapPercentage?: number;
  
  status: 'Vigente' | 'Próximo a Vencer' | 'Finalizado' | 'Rescindido';
  
  documents: {
    mainContractUrl: string;
    versions: DocumentInfo[];
    annexes: DocumentInfo[];
  };
  
  ownerId: string;
}

export interface ChargeItem {
  id: string;
  type: ChargeType;
  description: string;
  amount: number;
  imputedTo: ChargePayer;
  isPaid: boolean;
}

export interface Invoice {
  id: string;
  contractId: string;
  tenantName: string;
  propertyName: string;
  period: string; // Ej: "04/2024"
  charges: ChargeItem[];
  lateFees: number;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  reference?: string; 
  status: 'Pendiente' | 'Pagado' | 'Vencido' | 'Anulado';
  hasFile: boolean;
  isAutomated?: boolean;
}

export interface Liquidation {
  id: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  period: string; 
  rentIncome: number;
  adminFeeDeduction: number;
  maintenanceDeductions: number;
  expenseDeductions: number; 
  netAmount: number;
  status: 'Pendiente' | 'Pagada';
  dateCreated: string;
  paymentReference?: string;
}

export interface MaintenanceTask {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantId?: string;
  tenantName?: string;
  contractId?: string;
  concept: string;
  description: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  status: 'Pendiente' | 'Presupuestado' | 'En curso' | 'Completado' | 'Cerrado';
  providerId?: string;
  providerName?: string;
  estimatedCost: number;
  actualCost?: number;
  photos: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  hasFile: boolean;
}

export interface AppAlert {
  id: string;
  type: 'contract_expiry' | 'overdue_debt' | 'maintenance_delay' | 'rent_adjustment';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
  linkTab?: string;
}

export interface LegalCase {
  id: string;
  type: string;
  propertyId: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: 'En proceso' | 'Acuerdo firmado' | 'Cerrado' | 'Resuelto';
  hasFile: boolean;
  ownerId: string;
}
