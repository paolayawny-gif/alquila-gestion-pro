/**
 * Zod schemas para todas las entidades financieras del sistema.
 *
 * Propósito:
 *   1. Bloquear valores inventados / alucinaciones de IA antes de llegar a Firestore
 *   2. Strip de campos desconocidos — si la IA genera campos extra, se descartan
 *   3. Coerciones seguras — "100" (string) → 100 (number) sin romper nada
 *
 * Uso en escrituras:
 *   setDocumentSafe(docRef, Schemas.InvoicePatch, data, { merge: true });
 */

import { z } from 'zod';

// ── Primitivos reutilizables ───────────────────────────────────────────────────

/** Dinero: número finito, no negativo. Acepta coerción desde string. */
export const MoneySchema = z.coerce
  .number()
  .finite('El monto no puede ser Infinity o NaN')
  .nonnegative('El monto no puede ser negativo');

/** Dinero estrictamente positivo (para alquileres / precios base). */
export const PositiveMoneySchema = MoneySchema.positive('El monto debe ser mayor que 0');

/** Porcentaje de variación: entre -99% y +2000% (márgenes amplios para inflación Argentina). */
export const VariationPctSchema = z.coerce
  .number()
  .finite()
  .min(-99, 'Variación no puede ser menor a -99%')
  .max(2000, 'Variación no puede superar 2000%');

export const CurrencySchema = z.enum(['ARS', 'USD', 'UVA']);

// ── Invoice ───────────────────────────────────────────────────────────────────

export const InvoiceStatusSchema = z.enum([
  'Pendiente',
  'Pagado',
  'Vencido',
  'Anulado',
  'Pago Informado',
  'En Verificación con Propietario',
  'Esperando Factura ARCA',
]);

export const ChargeItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'Alquiler', 'Expensa Ordinaria', 'Expensa Extraordinaria',
    'TGI/ABL', 'Aguas', 'Luz/Gas', 'Reparaciones',
    'Mantenimiento', 'Impuestos', 'Otros',
  ]),
  description: z.string().optional(),
  amount: MoneySchema,
  imputedTo: z.enum(['Inquilino', 'Propietario']),
});

/** Schema completo para crear una factura nueva */
export const InvoiceCreateSchema = z.object({
  contractId:   z.string().min(1),
  tenantName:   z.string().min(1),
  tenantEmail:  z.string().email().optional(),
  propertyName: z.string().min(1),
  propertyId:   z.string().optional(),
  ownerEmail:   z.string().email().optional(),
  period:       z.string().min(1),
  charges:      z.array(ChargeItemSchema),
  lateFees:     MoneySchema,
  totalAmount:  PositiveMoneySchema,
  currency:     CurrencySchema,
  dueDate:      z.string().min(1),
  status:       InvoiceStatusSchema,
});

/** Schema para actualizaciones parciales de factura */
export const InvoicePatchSchema = InvoiceCreateSchema.partial();

// ── Contract ──────────────────────────────────────────────────────────────────

export const ContractStatusSchema = z.enum([
  'Borrador', 'Vigente', 'Próximo a Vencer', 'Finalizado', 'Rescindido',
]);

export const AdjustmentMechanismSchema = z.enum([
  'ICL', 'IPC', 'CasaPropia', 'Fixed', 'CER',
]);

export const ContractCreateSchema = z.object({
  tenantId:                  z.string().min(1),
  propertyId:                z.string().min(1),
  startDate:                 z.string().min(1),
  endDate:                   z.string().min(1),
  baseRentAmount:            PositiveMoneySchema,
  currentRentAmount:         PositiveMoneySchema,
  currency:                  CurrencySchema,
  adjustmentFrequencyMonths: z.coerce.number().int().min(1).max(60),
  lateFeePercentage:         z.coerce.number().finite().nonnegative().max(100).optional(),
  depositAmount:             MoneySchema,
  commissionAmount:          MoneySchema,
  status:                    ContractStatusSchema,
});

export const ContractPatchSchema = ContractCreateSchema.partial();

// ── Rent Adjustment ───────────────────────────────────────────────────────────

export const RentAdjustmentStatusSchema = z.enum([
  'pendiente', 'aprobado', 'rechazado',
]);

export const RentAdjustmentCreateSchema = z.object({
  contractId:     z.string().min(1),
  propertyId:     z.string().min(1),
  propertyName:   z.string().min(1),
  currentAmount:  PositiveMoneySchema,
  proposedAmount: PositiveMoneySchema,
  variationPct:   VariationPctSchema,
  mechanism:      z.string().min(1),
  status:         RentAdjustmentStatusSchema,
  dueDate:        z.string().min(1),
  ownerId:        z.string().min(1),
  createdAt:      z.string().min(1),
  // Validación cruzada: el nuevo monto no puede ser 0 si el actual era >0
}).refine(
  d => d.proposedAmount > 0,
  { message: 'El monto propuesto debe ser mayor a 0', path: ['proposedAmount'] },
);

export const RentAdjustmentPatchSchema = z.object({
  currentAmount:  PositiveMoneySchema.optional(),
  proposedAmount: PositiveMoneySchema.optional(),
  variationPct:   VariationPctSchema.optional(),
  status:         RentAdjustmentStatusSchema.optional(),
  approvedAt:     z.string().optional(),
  approvedBy:     z.string().optional(),
  rejectedAt:     z.string().optional(),
  rejectionReason: z.string().optional(),
  notifiedOwnerAt: z.string().optional(),
  notifiedTenantAt: z.string().optional(),
});

// ── Liquidation ───────────────────────────────────────────────────────────────

export const LiquidationStatusSchema = z.enum(['Pendiente', 'Pagada']);

export const LiquidationCreateSchema = z.object({
  propertyId:             z.string().min(1),
  propertyName:           z.string().min(1),
  ownerId:                z.string().min(1),
  ownerName:              z.string().min(1),
  period:                 z.string().min(1),
  ingresoAlquiler:        MoneySchema,
  adminFeeDeduction:      MoneySchema,
  maintenanceDeductions:  MoneySchema,
  expenseDeductions:      MoneySchema,
  interestAmount:         MoneySchema.optional(),
  netAmount:              z.coerce.number().finite(), // puede ser negativo (si deducciones > ingreso)
  status:                 LiquidationStatusSchema,
  dateCreated:            z.string().min(1),
});

export const LiquidationPatchSchema = LiquidationCreateSchema.partial();

// ── Maintenance Task ──────────────────────────────────────────────────────────

export const MaintenanceStatusSchema = z.enum([
  'Pendiente', 'Presupuestado', 'En curso', 'Completado', 'Cerrado',
]);

export const MaintenancePrioritySchema = z.enum([
  'Baja', 'Media', 'Alta', 'Urgente',
]);

export const MaintenancePatchSchema = z.object({
  status:           MaintenanceStatusSchema.optional(),
  priority:         MaintenancePrioritySchema.optional(),
  estimatedCost:    MoneySchema.optional(),
  actualCost:       MoneySchema.optional(),
  chargedTo:        z.enum(['Inquilino', 'Propietario', 'N/A']).optional(),
  isApprovedByOwner: z.boolean().optional(),
  contractorRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
});

// ── Property ──────────────────────────────────────────────────────────────────

export const PropertyStatusSchema = z.enum([
  'Disponible', 'Reservada', 'Alquilada', 'En Mantenimiento',
]);

export const PropertyPatchSchema = z.object({
  status:         PropertyStatusSchema.optional(),
  currentValue:   MoneySchema.optional(),
  purchasePrice:  MoneySchema.optional(),
  purchaseYear:   z.coerce.number().int().min(1900).max(2100).optional(),
  marketPricePerSqm: MoneySchema.optional(),
  financialNotes: z.string().optional(),
});

// ── Legal ─────────────────────────────────────────────────────────────────────

export const LegalStatusSchema = z.enum([
  'Iniciado', 'En proceso', 'Mediación', 'Cerrado',
]);

export const LegalStageSchema = z.enum([
  'Intimación', 'Carta Documento', 'Burofax', 'Demanda',
  'Reporte Veraz', 'Mediación', 'Cerrado',
]);

export const PaymentPlanSchema = z.object({
  id:           z.string().min(1),
  tenantName:   z.string().min(1),
  installments: z.coerce.number().int().min(1),
  totalAmount:  PositiveMoneySchema,
  note:         z.string().optional(),
  status:       z.enum(['pendiente', 'aceptado', 'rechazado']),
  createdAt:    z.string().min(1),
});

export const LegalCaseCreateSchema = z.object({
  propertyId:    z.string().min(1),
  propertyName:  z.string().min(1),
  type:          z.string().min(1),
  startDate:     z.string().min(1),
  attorney:      z.string().min(1),
  status:        LegalStatusSchema,
  ownerId:       z.string().min(1),
  debtAmount:    MoneySchema.optional(),
  daysOverdue:   z.coerce.number().int().nonnegative().optional(),
  stage:         LegalStageSchema.optional(),
  verazReported: z.boolean().optional(),
  paymentPlans:  z.array(PaymentPlanSchema).optional(),
});

export const LegalCasePatchSchema = z.object({
  status:          LegalStatusSchema.optional(),
  stage:           LegalStageSchema.optional(),
  debtAmount:      MoneySchema.optional(),
  daysOverdue:     z.coerce.number().int().nonnegative().optional(),
  verazReported:   z.boolean().optional(),
  lastActionDate:  z.string().optional(),
  lastActionNote:  z.string().optional(),
  paymentPlans:    z.array(PaymentPlanSchema).optional(),
});

// ── Maintenance (create) ──────────────────────────────────────────────────────

export const MaintenanceCreateSchema = z.object({
  propertyId:        z.string().min(1),
  propertyName:      z.string().min(1),
  concept:           z.string().min(1),
  description:       z.string().min(1),
  priority:          MaintenancePrioritySchema,
  status:            MaintenanceStatusSchema,
  estimatedCost:     MoneySchema,
  actualCost:        MoneySchema,
  chargedTo:         z.enum(['Inquilino', 'Propietario', 'N/A']).optional(),
  isApprovedByOwner: z.boolean().optional(),
  createdAt:         z.string().min(1),
  updatedAt:         z.string().min(1),
});

// ── Index Record (ICL / IPC / CER) ────────────────────────────────────────────

export const IndexTypeSchema = z.enum(['ICL', 'IPC', 'CER', 'CasaPropia']);

/** Índices financieros mensuales (ICL, IPC) o diarios (CER). */
export const IndexRecordSchema = z.object({
  id:    z.string().min(1),
  month: z.string().min(1), // YYYY-MM o YYYY-MM-DD para CER diario
  type:  IndexTypeSchema,
  value: z.coerce.number().finite().positive('El valor del índice debe ser mayor a 0'),
});
export const IndexRecordPatchSchema = IndexRecordSchema.partial();

// ── Deposit Movement ──────────────────────────────────────────────────────────

export const DepositMovementTypeSchema = z.enum(['Recibido', 'Devuelto', 'Ajuste']);

export const DepositMovementSchema = z.object({
  id:            z.string().min(1),
  contractId:    z.string().min(1),
  tenantName:    z.string().min(1),
  propertyName:  z.string().min(1),
  type:          DepositMovementTypeSchema,
  amount:        MoneySchema,
  currency:      CurrencySchema,
  exchangeRate:  z.coerce.number().finite().positive(),
  usdEquivalent: z.coerce.number().finite().nonnegative(),
  date:          z.string().min(1),
  notes:         z.string().optional(),
  ownerId:       z.string().min(1),
});

// ── Insurance ─────────────────────────────────────────────────────────────────

export const PolicyTypeSchema = z.enum([
  'Incendio', 'Responsabilidad Civil', 'Integral Hogar',
  'Caución', 'Granizo', 'Robo y Hurto', 'Otro',
]);
export const PolicyStatusSchema = z.enum(['Vigente', 'Por vencer', 'Vencida', 'Cancelada']);
export const InsurancePayStatusSchema = z.enum(['Pagado', 'Pendiente', 'Vencido']);

export const InsurancePolicyCreateSchema = z.object({
  id:                z.string().min(1),
  propertyId:        z.string().min(1),
  propertyName:      z.string().min(1),
  type:              PolicyTypeSchema,
  insurer:           z.string().min(1),
  policyNumber:      z.string().min(1),
  coverageAmount:    MoneySchema,
  annualPremium:     MoneySchema,
  startDate:         z.string().min(1),
  endDate:           z.string().min(1),
  totalInstallments: z.coerce.number().int().min(1),
  paidInstallments:  z.coerce.number().int().nonnegative(),
  status:            PolicyStatusSchema,
  ownerId:           z.string().min(1),
  createdAt:         z.string().min(1),
});
export const InsurancePolicyPatchSchema = InsurancePolicyCreateSchema.partial();

export const InsurancePaymentRecordSchema = z.object({
  id:                z.string().min(1),
  policyId:          z.string().min(1),
  policyName:        z.string().min(1),
  propertyName:      z.string().min(1),
  installmentNumber: z.coerce.number().int().min(1),
  amount:            MoneySchema,
  dueDate:           z.string().min(1),
  paidDate:          z.string().optional(),
  status:            InsurancePayStatusSchema,
  ownerId:           z.string().min(1),
});

export const InsuranceCommissionSchema = z.object({
  id:              z.string().min(1),
  policyId:        z.string().min(1),
  policyType:      z.string().min(1),
  insurer:         z.string().min(1),
  propertyName:    z.string().min(1),
  annualPremium:   MoneySchema,
  adminCommission: MoneySchema,
  superCommission: MoneySchema,
  adminEmail:      z.string().email(),
  adminUserId:     z.string().min(1),
  createdAt:       z.string().min(1),
});

export const InsuranceQuoteStatusSchema = z.enum(['Enviada', 'Respondida', 'Convertida']);
export const InsuranceQuotePatchSchema = z.object({
  status:       InsuranceQuoteStatusSchema.optional(),
  responseDate: z.string().optional(),
});

// ── Person (Inquilino / Propietario / Garante) ────────────────────────────────

export const PersonTypeSchema = z.enum(['Inquilino', 'Propietario', 'Garante']);

export const PersonCreateSchema = z.object({
  id:       z.string().min(1),
  fullName: z.string().min(1),
  email:    z.union([z.string().email(), z.literal('')]).optional(),
  phone:    z.string().optional(),
  type:     PersonTypeSchema,
  ownerId:  z.string().min(1),
});
export const PersonPatchSchema = PersonCreateSchema.partial();

// ── Maintenance Ticket (tenant-side) ─────────────────────────────────────────

export const MaintenanceTicketCreateSchema = z.object({
  id:           z.string().min(1),
  adminId:      z.string().min(1),
  tenantEmail:  z.string().email(),
  tenantName:   z.string().min(1),
  propertyId:   z.string().min(1),
  propertyName: z.string().min(1),
  title:        z.string().min(1),
  description:  z.string().min(1),
  category:     z.string().min(1),
  priority:     z.enum(['Normal', 'Urgente']),
  status:       z.literal('Abierto'),
  photoUrl:     z.string().optional(),
  createdAt:    z.string().min(1),
  updatedAt:    z.string().min(1),
});

// ── Barril de todos los schemas ───────────────────────────────────────────────

export const Schemas = {
  // Facturas
  InvoiceCreate:          InvoiceCreateSchema,
  InvoicePatch:           InvoicePatchSchema,
  // Contratos
  ContractCreate:         ContractCreateSchema,
  ContractPatch:          ContractPatchSchema,
  // Ajustes de alquiler
  RentAdjustmentCreate:   RentAdjustmentCreateSchema,
  RentAdjustmentPatch:    RentAdjustmentPatchSchema,
  // Liquidaciones
  LiquidationCreate:      LiquidationCreateSchema,
  LiquidationPatch:       LiquidationPatchSchema,
  // Mantenimiento
  MaintenanceCreate:      MaintenanceCreateSchema,
  MaintenancePatch:       MaintenancePatchSchema,
  // Legales
  LegalCaseCreate:        LegalCaseCreateSchema,
  LegalCasePatch:         LegalCasePatchSchema,
  // Propiedades
  PropertyPatch:          PropertyPatchSchema,
  // Índices financieros
  IndexRecord:              IndexRecordSchema,
  IndexRecordPatch:         IndexRecordPatchSchema,
  // Depósitos
  DepositMovement:          DepositMovementSchema,
  // Seguros
  InsurancePolicyCreate:    InsurancePolicyCreateSchema,
  InsurancePolicyPatch:     InsurancePolicyPatchSchema,
  InsurancePaymentRecord:   InsurancePaymentRecordSchema,
  InsuranceCommission:      InsuranceCommissionSchema,
  InsuranceQuotePatch:      InsuranceQuotePatchSchema,
  // Personas
  PersonCreate:             PersonCreateSchema,
  PersonPatch:              PersonPatchSchema,
  // Tickets de mantenimiento (portal inquilino)
  MaintenanceTicketCreate:  MaintenanceTicketCreateSchema,
  // Primitivos útiles para validaciones inline
  Currency:               CurrencySchema,
  InvoiceStatus:          InvoiceStatusSchema,
  ContractStatus:         ContractStatusSchema,
  RentAdjustmentStatus:   RentAdjustmentStatusSchema,
  Money:                  MoneySchema,
  PositiveMoney:          PositiveMoneySchema,
  VariationPct:           VariationPctSchema,
} as const;

export type ZodAny = z.ZodTypeAny;
