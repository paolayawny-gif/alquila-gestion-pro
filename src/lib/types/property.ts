import type {
  PropertyType, PropertyUsage, PropertyStatus, Currency,
  DocumentInfo, BankDetails, ApplicationStatus,
} from './common';

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

export interface PropertyManual {
  name: string;
  sizeLabel: string; // ej: "PDF · 2.4 MB"
  url?: string;
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
  /** URL de tour virtual 360° (ej: Matterport, YouTube embed, etc.) */
  virtualTourUrl?: string;
  /** Manuales de electrodomésticos u otros documentos de la unidad */
  manuals?: PropertyManual[];
  // ── Análisis de valor (Panel Analítico) ──────────────────────────────────
  purchasePrice?: number;        // precio de compra en $
  currentValue?: number;         // valuación actual en $
  purchaseYear?: number;         // año de compra
  marketPricePerSqm?: number;    // precio de mercado referencia $/m²
  annualGrowthRate?: number;     // tasa de crecimiento anual esperada (%, ej: 8)
  // ── Seguros ──────────────────────────────────────────────────────────────
  insurance?: {
    company?: string;            // ej: "Sancor", "Federación Patronal"
    policyNumber?: string;       // número de póliza
    type?: string;               // "Integral de hogar", "Caución", etc.
    coverageAmount?: number;     // suma asegurada
    currency?: Currency;         // ARS | USD
    monthlyPremium?: number;     // costo mensual
    paidBy?: 'Propietario' | 'Inquilino';
    startDate?: string;          // YYYY-MM-DD
    endDate?: string;            // YYYY-MM-DD (vencimiento)
    fileUrl?: string;            // PDF de la póliza
    fileName?: string;
    notes?: string;
  };
}

// ── Fondos de Reserva ─────────────────────────────────────────────────────────
export interface ReserveFund {
  id: string;
  propertyId: string;
  propertyName: string;
  category: string;        // 'Estructural' | 'Ascensores' | 'Impermeabilización' | 'Otro'
  targetAmount: number;
  currentAmount: number;
  targetYear?: number;
  notes?: string;
  ownerId: string;
  createdAt: string;
}

export interface RentalApplication {
  id: string;
  propertyId: string;
  propertyName?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantTaxId?: string;  // CUIT/CUIL 11 dígitos
  ingreso: number;
  currency?: string;        // ARS | USD
  rentAmount?: number;      // alquiler solicitado (si se conoce)
  guarantorName?: string;   // nombre del garante
  guarantorType?: string;   // Propietario | Recibo Sueldo | Seguro de Caución | Sin garante
  guarantorIncome?: number; // ingreso del garante (si aplica)
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
  bcraReport?: {
    denominacion: string;
    maxSituation: number;
    latestPeriod: string;
    totalEntidades: number;
    hasRejectedChecks: boolean;
    chequesCount: number;
    consultedAt: string;
  };
}
