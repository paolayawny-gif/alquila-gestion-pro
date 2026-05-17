// Mantenimiento, proveedores, alertas, notificaciones y legales.

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

export type AnuncioType = 'novedad' | 'funcion' | 'tip' | 'negocio';

export interface Anuncio {
  id: string;
  title: string;
  body: string;
  type: AnuncioType;
  createdAt: string;    // ISO
  publishedAt: string;  // ISO
  isPublished: boolean;
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
