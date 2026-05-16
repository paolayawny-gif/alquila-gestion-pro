import type { Currency, AdjustmentMechanism, DocumentInfo } from './common';

// ── Firma electrónica (Ley 25.506 — firma electrónica simple) ─────────────────

export type SignerRole = 'Inquilino' | 'Propietario' | 'Administrador';

export interface ContractSignature {
  signerEmail: string;
  signerName: string;
  signerRole: SignerRole;
  signedAt: string;          // ISO timestamp
  signatureImage: string;    // base64 PNG del trazado
  documentHash: string;      // SHA-256 hex de los campos clave del contrato
  ipAddress?: string;        // capturado server-side
  userAgent?: string;
}

export type ContractFileCategory =
  | 'comprobante_inquilino'
  | 'factura_propietario'
  | 'otro';

export interface ContractFile {
  id: string;
  category: ContractFileCategory;
  name: string;
  dataUri: string;           // base64 — mantener bajo 400 KB por archivo
  uploadedAt: string;
  notes?: string;
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
  status: 'Borrador' | 'Vigente' | 'Próximo a Vencer' | 'Finalizado' | 'Rescindido';
  createdBy?: string;   // UID del admin que lo creó
  updatedBy?: string;   // UID del admin que hizo el último cambio
  fullTranscription?: string;
  generatedDocumentHtml?: string;  // HTML del contrato redactado en el editor
  documents: {
    mainContractUrl: string;
    mainContractName?: string;
    versions: DocumentInfo[];
    annexes: DocumentInfo[];
  };
  ownerId: string;
  signatures?: ContractSignature[];   // firmas electrónicas registradas
  blockchainTxHash?: string;          // TX hash en Polygon (notarización)
  notarizedAt?: string;               // ISO timestamp de la notarización
  // ── Pago Anticipado de Rentas ─────────────────────────────────────────────
  advancePaymentDiscountPct?: number;      // % descuento al inquilino
  advancePaymentCommissionPct?: number;    // % comisión admin
  advancePaymentMaxMonths?: number;        // máximo meses (1-12)
  advancePaymentActive?: boolean;          // si la oferta está activa
  // ── Ajuste automático ────────────────────────────────────────────────────────
  adjustmentRate?: number;        // % para tipo Percentage (ej: 10 = 10%)
  lastAdjustmentDate?: string;    // ISO date del último ajuste aprobado
  // ── Archivos adjuntos al contrato (comprobantes, facturas, etc.) ─────────────
  contractFiles?: ContractFile[];
}
