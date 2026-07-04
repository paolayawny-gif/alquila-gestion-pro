import type { AdjustmentMechanism } from './common';

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
  scheduledAt?: string;   // YYYY-MM-DD — fecha programada de publicación
  remindMe?: boolean;     // default true — recordar (alerta + email) el día de la publicación
  reminderSentAt?: string; // ISO — evita reenviar el recordatorio si el cron corre más de una vez
}

export type BrandSpecialty = 'Residencial' | 'Comercial' | 'Vacacional' | 'Mixta' | 'Oficinas';
export type BrandAudience = 'Propietarios' | 'Inquilinos' | 'Ambos' | 'Inversores';

export interface SocialBrandProfile {
  id: string;
  ownerId: string;
  brandName: string;
  zone: string;
  specialty: BrandSpecialty;
  audience: BrandAudience;
  usp: string;
  samplePosts?: string;
  brief?: string;
  contentPillars?: string[];
  powerWords?: string;
  avoidances?: string;
  briefGeneratedAt?: string;
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
