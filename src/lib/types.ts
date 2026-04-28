
export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed' | 'CER';
export type Currency = 'ARS' | 'USD';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Mercado Pago' | 'Depósito' | 'Cheque';
export type ChargeType = 'Alquiler' | 'Expensa Ordinaria' | 'Expensa Extraordinaria' | 'TGI/ABL' | 'Aguas' | 'Luz/Gas' | 'Otros';
export type ChargePayer = 'Inquilino' | 'Propietario';
export type ApplicationStatus = 'Nueva' | 'En análisis' | 'Aprobada' | 'Rechazada' | 'Pendiente de documentación';

export interface IndexRecord {
  id: string;
  month: string; // YYYY-MM for monthly indices, YYYY-MM-DD for CER daily
  type: AdjustmentMechanism;
  value: number;
}

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
  ownerId?: string;
  name: string;
  email: string;
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
  adminNotes?: string;
  aiAnalysis?: {
    score: number;
    recommendation: string;
    reasoning: string;
    riskFactors: string[];
  };
}

export interface Contract {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantEmail?: string;
  propertyId: string;
  propertyName?: string;
  guarantorIds: string[];
  ownerIds: string[];
  startDate: string;
  endDate: string;
  paymentPeriodDays: number;
  baseRentAmount: number;
  currentRentAmount: number;
  currency: Currency;
  adjustmentType: 'Index' | 'Percentage' | 'Scale' | 'Fixed';
  adjustmentMechanism?: AdjustmentMechanism;
  adjustmentFrequencyMonths: number;
  lateFeePercentage?: number; // Tasa diaria por mora
  depositAmount: number;
  depositCurrency: Currency;
  commissionAmount: number; 
  status: 'Vigente' | 'Próximo a Vencer' | 'Finalizado' | 'Rescindido';
  fullTranscription?: string;
  documents: {
    mainContractUrl: string;
    mainContractName?: string;
    versions: DocumentInfo[];
    annexes: DocumentInfo[];
  };
  ownerId: string;
}

export interface Invoice {
  id: string;
  contractId: string;
  tenantName: string;
  propertyName: string;
  period: string; 
  charges: { id: string; type: ChargeType; amount: number; imputedTo: ChargePayer }[];
  lateFees: number;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido' | 'Anulado' | 'Pago Informado' | 'Esperando Factura ARCA';
  arcaInvoiceUrl?: string;
  arcaInvoiceName?: string;
  lastReminderSent?: string;
  reminderType?: string;
  hasFile?: boolean;
  paymentReceiptUrl?: string;
  paymentReceiptName?: string;
  paymentDate?: string;
  isFromOwner?: boolean; 
  ownerId?: string;
  internalNotes?: string;
}

export interface Liquidation {
  id: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  period: string; 
  ingresoAlquiler: number;
  adminFeeDeduction: number;
  maintenanceDeductions: number;
  expenseDeductions: number;
  netAmount: number;
  status: 'Pendiente' | 'Pagada';
  dateCreated: string;
}

export interface MaintenanceTask {
  id: string;
  propertyId: string;
  propertyName: string;
  concept: string;
  description: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  status: 'Pendiente' | 'Presupuestado' | 'En curso' | 'Completado' | 'Cerrado';
  estimatedCost: number;
  actualCost: number;
  contractorName?: string;
  chargedTo?: 'Inquilino' | 'Propietario' | 'N/A';
  isApprovedByOwner?: boolean;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  hasFile?: boolean;
}

export interface AppAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  linkTab?: string;
  date?: string;
}

export interface LegalCase {
  id: string;
  type: string;
  propertyId: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: 'Iniciado' | 'En proceso' | 'Mediación' | 'Cerrado';
  hasFile?: boolean;
  ownerId: string;
}
