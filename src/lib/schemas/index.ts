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
  MaintenancePatch:       MaintenancePatchSchema,
  // Propiedades
  PropertyPatch:          PropertyPatchSchema,
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
