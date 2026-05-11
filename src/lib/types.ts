
export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed' | 'CER';
export type Currency = 'ARS' | 'USD' | 'UVA';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Mercado Pago' | 'Depósito' | 'Cheque';
export type ChargeType = 'Alquiler' | 'Expensa Ordinaria' | 'Expensa Extraordinaria' | 'TGI/ABL' | 'Aguas' | 'Luz/Gas' | 'Reparaciones' | 'Mantenimiento' | 'Impuestos' | 'Otros';
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

export interface Provider {
  id: string;
  name: string;
  specialty: string;          // extensible: Plomería, Electricidad, Pintura, etc.
  phone?: string;
  email?: string;
  notes?: string;
  averageRating?: number;     // promedio calculado de tickets cerrados
  totalRatings?: number;
  ownerId: string;
  createdAt: string;
}

export interface MaintenanceTask {
  id: string;
  contractId?: string;
  propertyId: string;
  propertyName: string;
  concept: string;
  description: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  status: 'Pendiente' | 'Presupuestado' | 'En curso' | 'Completado' | 'Cerrado';
  estimatedCost: number;
  actualCost: number;
  contractorName?: string;
  providerId?: string;        // referencia al Provider del directorio
  contractorRating?: 1 | 2 | 3 | 4 | 5;
  contractorRatingComment?: string;
  chargedTo?: 'Inquilino' | 'Propietario' | 'N/A';
  isApprovedByOwner?: boolean;
  ownerEmail?: string;
  ownerComment?: string;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  hasFile?: boolean;
  createdBy?: string;
  updatedBy?: string;
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

export type LegalStage =
  | 'Intimación'
  | 'Carta Documento'
  | 'Burofax'
  | 'Demanda'
  | 'Reporte Veraz'
  | 'Mediación'
  | 'Cerrado';

export interface PaymentPlan {
  id: string;
  tenantName: string;
  installments: number;
  totalAmount: number;
  note?: string;
  status: 'pendiente' | 'aceptado' | 'rechazado';
  createdAt: string;
}

export type NotificationType =
  | 'maintenance_approved'
  | 'maintenance_rejected'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'contract_expiring'
  | 'contract_expired'
  | 'liquidation_ready'
  | 'tenant_request'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;       // ISO
  read: boolean;
  /** Referencia al recurso que disparó la notif (id de propiedad / contrato / factura). */
  refId?: string;
  /** Vista a navegar al click (ej: 'liquidaciones', 'contratos'). */
  link?: string;
}

export interface LegalCase {
  id: string;
  contractId?: string;
  type: string;
  propertyId: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: 'Iniciado' | 'En proceso' | 'Mediación' | 'Cerrado';
  hasFile?: boolean;
  ownerId: string;
  // Extended fields
  tenantName?: string;
  tenantDni?: string;
  tenantEmail?: string;       // permite que el portal inquilino filtre sus planes de pago
  debtAmount?: number;         // monto adeudado en $
  daysOverdue?: number;        // días de mora
  stage?: LegalStage;          // etapa actual del proceso
  lastActionDate?: string;     // fecha última acción
  lastActionNote?: string;     // descripción última acción
  verazReported?: boolean;     // reportado a Veraz
  paymentPlans?: PaymentPlan[];
  notes?: string;
}

// ── Monetización de Activos ───────────────────────────────────────────────────

export type AssetCategory =
  | 'Pantalla Digital'
  | 'Coworking & Eventos'
  | 'Lockers & Almacén'
  | 'Estacionamiento'
  | 'Área Común'
  | 'Otro';

export type AssetStatus = 'Disponible' | 'Ocupado' | 'En mantenimiento';

export type AssetRentUnit = '/mes' | '/semana' | '/día' | '/bloque 4h' | '/hora';

export interface MonetizableAsset {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;               // "Elevador Principal A", "Rooftop Sky Lounge"
  location: string;           // "Planta 24 - Eventos", "Lobby"
  category: AssetCategory;
  status: AssetStatus;
  baseRate: number;           // precio base
  rentUnit: AssetRentUnit;
  tenantName?: string;        // si está ocupado
  tenantEmail?: string;
  occupiedUntil?: string;     // fecha fin ocupación
  notes?: string;
  ownerId: string;
  createdAt: string;
}

// ── Espacios monetizables (ofertas / solicitudes / sugerencias) ──────────────

export type SpaceType =
  | 'Publicidad exterior'
  | 'Cochera / Estacionamiento'
  | 'Baulera / Depósito'
  | 'Local comercial'
  | 'Terraza (antenas / paneles)'
  | 'Vending machines'
  | 'SUM / Salón de eventos'
  | 'Coworking'
  | 'Otro';

export interface MonetizationOffer {
  id: string;
  ownerEmail: string;
  ownerName: string;
  propertyId: string;
  propertyName: string;
  spaceType: SpaceType;
  description: string;
  estimatedPrice?: number;
  currency?: 'ARS' | 'USD';
  area?: string;
  conditions?: string;
  status: 'pendiente' | 'publicada' | 'en_negociacion' | 'confirmada' | 'rechazada';
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
}

export interface MonetizationRequest {
  id: string;
  tenantEmail: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  spaceType: SpaceType;
  description: string;
  budget?: number;
  currency?: 'ARS' | 'USD';
  duration?: string;
  status: 'pendiente' | 'en_proceso' | 'match_encontrado' | 'confirmada' | 'rechazada';
  createdAt: string;
  adminNotes?: string;
}

export interface MonetizationSuggestion {
  id: string;
  ownerEmail: string;
  ownerName: string;
  propertyId?: string;
  propertyName?: string;
  templateId: string;
  templateTitle: string;
  templateDescription: string;
  customMessage?: string;
  sentAt: string;
  seenAt?: string;
  repliedAt?: string;
  status: 'enviada' | 'vista' | 'interesado' | 'no_por_ahora';
  isAutomatic?: boolean;
}

// ── Redes Sociales ────────────────────────────────────────────────────────────

export type SocialNetworkType =
  | 'Instagram'
  | 'Facebook'
  | 'TikTok'
  | 'YouTube'
  | 'LinkedIn'
  | 'X (Twitter)'
  | 'WhatsApp Business'
  | 'Otro';

export type SocialContentType = 'Plantilla' | 'Contenido' | 'Publicación';
export type SocialTone = 'profesional' | 'cercano' | 'urgente' | 'inspiracional' | 'informativo';

export interface SocialNetworkLink {
  id: string;
  network: SocialNetworkType;
  displayName: string;      // "Página AlquilaGestion Pro"
  url: string;              // URL del perfil / página
  username?: string;        // @username si aplica
  ownerId: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  contentType: SocialContentType;
  title: string;
  mainText: string;
  hashtags: string;
  callToAction?: string;
  targetNetworks: SocialNetworkType[];
  tone: SocialTone;
  aiGenerated: boolean;
  status: 'Borrador' | 'Listo' | 'Publicado';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Sistema de Servicios y Cobros ─────────────────────────────────────────────

export type ServiceCategory =
  | 'legal'
  | 'administracion'
  | 'documentacion'
  | 'mantenimiento'
  | 'seguros'
  | 'impuestos'
  | 'contratos'
  | 'concierge'
  | 'otro';

export type ServiceClientTarget = 'propietario' | 'inquilino' | 'ambos';
export type ServicePriceType = 'fijo' | 'porcentaje' | 'cotizacion';
export type ServiceDeliverable = 'documento' | 'gestion' | 'informe' | 'ninguno';
export type ServiceRequestStatus =
  | 'solicitado'
  | 'en_proceso'
  | 'entregado'
  | 'pago_pendiente'
  | 'pagado'
  | 'cancelado';

export interface AdminService {
  id: string;
  adminId: string;
  nombre: string;
  descripcion: string;
  categoria: ServiceCategory;
  clienteObjetivo: ServiceClientTarget;
  tipoPrecio: ServicePriceType;
  precio: number;
  porcentaje?: number;
  moneda: 'ARS' | 'USD';
  entregable: ServiceDeliverable;
  requierePago: boolean;
  activo: boolean;
  visible: boolean; // el cliente puede solicitarlo directamente desde su portal
  createdAt: string;
  updatedAt: string;
}

export interface AdminPaymentConfig {
  mercadopago?: {
    accessToken: string;
    publicKey: string;
    active: boolean;
  };
  transferencia?: {
    cbu: string;
    alias: string;
    banco: string;
    titular: string;
    active: boolean;
  };
  linkExterno?: {
    url: string;
    label: string;
    active: boolean;
  };
  estudioJuridico?: {
    tipo: 'propio' | 'app';
    nombre?: string;
    email?: string;
    telefono?: string;
  };
}

export interface ServiceRequest {
  id: string;
  adminId: string;
  clientId: string;
  clientType: 'owner' | 'tenant';
  clientName?: string;
  clientEmail?: string;
  serviceId: string;
  serviceSnapshot: {
    nombre: string;
    precio: number;
    moneda: string;
    entregable: string;
  };
  estado: ServiceRequestStatus;
  descripcion?: string;
  archivos: {
    informeUrl?: string;
    informeName?: string;
    comprobanteUrl?: string;
    comprobanteName?: string;
  };
  pago?: {
    metodo: 'mp' | 'transferencia' | 'externo';
    mpPaymentId?: string;
    comprobanteUrl?: string;
    comprobanteName?: string;
    aprobadoEn?: string;
    aprobadoPor?: string;
  };
  notas?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Pago Anticipado de Rentas ─────────────────────────────────────────────────

export type AdvancePaymentStatus = 'Solicitado' | 'Aprobado' | 'Pagado' | 'Cancelado';

export interface AdvancePayment {
  id: string;
  adminId: string;
  contractId: string;
  propertyId: string;
  propertyName: string;
  tenantEmail: string;
  tenantName: string;
  monthsAdvanced: number;
  monthlyRent: number;
  currency: string;
  grossAmount: number;        // monthlyRent × monthsAdvanced
  discountPct: number;
  discountAmount: number;
  adminCommissionPct: number;
  adminCommissionAmount: number;
  tenantPays: number;         // grossAmount - discountAmount
  netToOwner: number;         // tenantPays - adminCommissionAmount
  status: AdvancePaymentStatus;
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  coveredPeriods: string[];   // ['2025-06', '2025-07', ...]
  notes?: string;
}

// ── Ajuste Automático de Alquiler ─────────────────────────────────────────────

export type AdjustmentStatus = 'pendiente' | 'aprobado' | 'rechazado';

export interface PendingRentAdjustment {
  id: string;
  contractId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  tenantEmail?: string;
  ownerEmail?: string;
  currentAmount: number;
  proposedAmount: number;
  variationPct: number;          // % de variación, ej: 12.5
  mechanism: AdjustmentMechanism | 'Percentage' | 'Scale' | 'Fixed';
  indexUsed?: string;            // ej: 'ICL 2025-04'
  indexValue?: number;           // valor del índice aplicado
  previousIndexValue?: number;   // valor del índice base (período anterior)
  dueDate: string;               // fecha en que debe aplicarse (YYYY-MM-DD)
  status: AdjustmentStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  notifiedOwnerAt?: string;
  notifiedTenantAt?: string;
  ownerId: string;               // admin que gestiona
  createdAt: string;
}

// ── Captación de Clientes (Super Admin) ─────────────────────────────────────

export type LeadStatus = 'Nuevo' | 'Contactado' | 'Interesado' | 'Demo' | 'Suscripto' | 'Descartado';

export interface Lead {
  id: string;
  agencia: string;
  email?: string;
  phone?: string;
  website?: string;
  ciudad: string;
  provincia: string;
  status: LeadStatus;
  notes?: string;
  createdAt: string;
  lastContactAt?: string;
  source: 'google' | 'manual';
  snippet?: string; // fragmento del resultado de búsqueda
}

export interface GoogleLeadResult {
  agencia: string;
  email?: string;
  emails: string[];
  website: string;
  snippet: string;
  ciudad: string;
  provincia: string;
}
