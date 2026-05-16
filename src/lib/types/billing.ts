import type { ChargeType, ChargePayer, Currency } from './common';

export interface ChargeItem {
  id: string;
  type: ChargeType;
  description?: string;
  amount: number;
  imputedTo: ChargePayer;
}

export interface Invoice {
  id: string;
  contractId: string;
  tenantName: string;
  tenantEmail?: string;       // email del inquilino; permite que el portal inquilino vea sus recibos
  propertyName: string;
  propertyId?: string;        // para vincular al propietario
  ownerEmail?: string;        // email del propietario; permite que el portal propietario vea las facturas
  period: string;
  charges: ChargeItem[];
  lateFees: number;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido' | 'Anulado' | 'Pago Informado' | 'En Verificación con Propietario' | 'Esperando Factura ARCA';
  arcaInvoiceUrl?: string;
  arcaInvoiceName?: string;
  lastReminderSent?: string;
  reminderType?: string;
  hasFile?: boolean;
  paymentReceiptUrl?: string;
  paymentReceiptName?: string;
  tenantReceiptUrl?: string;   // comprobante subido por el inquilino desde su portal
  tenantReceiptNote?: string;  // nota del inquilino al informar pago
  paymentDate?: string;
  adminVerifiedAt?: string;     // cuando el admin verificó el comprobante
  ownerNotifiedAt?: string;     // cuando el admin notificó al propietario
  ownerConfirmedAt?: string;    // cuando el propietario confirmó recepción en banco
  isFromOwner?: boolean;
  ownerId?: string;
  internalNotes?: string;
  pendingApproval?: boolean;
  liquidacionEnviadaAt?: string;
  sendLog?: Array<{ ts: string; to: string; type: string }>;
  ownerCbu?: string;
  ownerAlias?: string;
  ownerBank?: string;
  // ── AFIP / ARCA electrónica ───────────────────────────────────────────────
  afipCae?:             string;
  afipCaeVto?:          string;   // YYYYMMDD
  afipNroComprobante?:  number;
  afipPtoVenta?:        number;
  afipTipoComprobante?: number;   // 6=B, 11=C
  afipEmittedAt?:       string;   // ISO timestamp
}

/** Asiento de cobro efectivo — se crea cuando el propietario confirma recepción en banco. */
export interface Cobro {
  id: string;
  invoiceId: string;
  contractId: string;
  propertyId?: string;
  propertyName: string;
  tenantName: string;
  tenantEmail?: string;
  ownerEmail?: string;
  period: string;
  amount: number;
  currency: Currency;
  confirmedAt: string;          // fecha/hora en que el propietario confirmó
  receiptUrl?: string;          // URL del comprobante en Firebase Storage
  tenantNote?: string;          // nota del inquilino al informar
  adminVerifiedAt?: string;
  source: 'owner_confirmed' | 'admin_manual';
}

export interface Liquidation {
  id: string;
  contractId?: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  period: string;
  ingresoAlquiler: number;
  adminFeeDeduction: number;
  maintenanceDeductions: number;
  expenseDeductions: number;
  interestAmount?: number;
  netAmount: number;
  status: 'Pendiente' | 'Pagada';
  dateCreated: string;
}
