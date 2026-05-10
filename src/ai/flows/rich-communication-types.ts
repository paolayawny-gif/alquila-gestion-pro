/**
 * Tipos, schemas y constantes del flow de comunicaciones enriquecidas.
 *
 * Este archivo NO lleva 'use server' porque exporta no-funciones
 * (Zod schemas, interfaces, constantes). Los flows en Next.js solo
 * pueden exportar async functions, así que separamos el contenido
 * estructural acá.
 */

import { z } from 'genkit';

// ── Schemas ────────────────────────────────────────────────────────────────────

export const RichCommunicationInputSchema = z.object({
  communicationType: z.enum([
    'rentReminder',
    'rentOverdue',
    'intimacionPago',
    'cartaDocumentoDesalojo',
    'rescisionAnticipadaLocatario',
    'rescisionAnticipadaLocador',
    'leaseRenewal',
    'leaseAdjustment',
    'ownerLiquidationReport',
    'portalInvitation',
    'maintenanceUpdate',
    'informeMoraGarante',
    'notificacionVencimientoProximo',
    'generalMessage',
  ]),

  channel: z.enum(['whatsapp', 'email', 'carta_documento', 'sms', 'portal']).default('email'),
  tone: z.enum(['amigable', 'formal', 'firme', 'juridico', 'urgente']).default('formal'),

  moraSequenceStep: z.union([
    z.literal(1), z.literal(5), z.literal(15), z.literal(30), z.literal(45),
  ]).optional(),

  autoEnrichIndex: z.boolean().default(false),
  indexType: z.enum(['ICL', 'IPC', 'CER', 'CasaPropia']).optional(),
  adjustmentMonths: z.number().min(1).max(36).default(12),

  tenantName: z.string().optional(),
  ownerName: z.string().optional(),
  guarantorName: z.string().optional(),

  propertyName: z.string().optional(),
  propertyAddress: z.string().optional(),

  dueDate: z.string().optional(),
  amountDue: z.string().optional(),
  currentRentAmount: z.number().optional(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  newRentAmount: z.string().optional(),
  adjustmentIndex: z.string().optional(),
  adjustmentPercentage: z.string().optional(),
  adjustmentPeriod: z.string().optional(),

  currentLeaseStartDate: z.string().optional(),
  currentLeaseEndDate: z.string().optional(),
  newLeaseTermOptions: z.string().optional(),

  maintenanceConcept: z.string().optional(),
  maintenanceStatus: z.string().optional(),
  maintenanceCost: z.string().optional(),

  reportingPeriod: z.string().optional(),
  totalIncome: z.string().optional(),
  totalExpenses: z.string().optional(),
  netAmount: z.string().optional(),

  daysOverdue: z.number().optional(),
  lateFeeAmount: z.string().optional(),
  legalStage: z.string().optional(),
  rescisionNoticeMonths: z.number().optional(),
  rescisionPenaltyAmount: z.string().optional(),

  portalUrl: z.string().optional(),
  role: z.string().optional(),

  additionalContext: z.string().optional(),
});

export type RichCommunicationInput = z.infer<typeof RichCommunicationInputSchema>;

export interface IndexDataUsed {
  indexType: string;
  monthlyPct: number;
  accumulatedPct: number;
  period: string;
  source: 'api' | 'fallback';
  sourceLabel: string;
  newRentCalculated?: number;
  note?: string;
}

export interface RichCommunicationResult {
  subjectLine: string;
  draftedMessage: string;
  channelFormattedMessage: string;
  indexDataUsed?: IndexDataUsed;
  toneNote?: string;
  moraStepLabel?: string;
  legalBasis?: string;
}

export type RichCommunicationOutput =
  | { ok: true; data: RichCommunicationResult }
  | { ok: false; error: string };

export interface IndexTicker {
  ICL?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
  IPC?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
  CER?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
}

// ── Matrices de configuración ──────────────────────────────────────────────────

export const TONE_INSTRUCTIONS: Record<string, string> = {
  amigable: 'Tono cálido, cercano y empático. Usá contracciones naturales del español rioplatense. Evitá tecnicismos. Comenzá con un saludo cordial.',
  formal: 'Tono profesional y respetuoso. Estructura clara y directa. Ni frío ni demasiado cálido. Adecuado para comunicaciones de gestión estándar.',
  firme: 'Tono directo, seguro y sin ambigüedades. Dejá en claro las consecuencias pero sin ser agresivo. Adecuado para segundos avisos o plazos que se acercan.',
  juridico: 'Tono estrictamente formal y legal. Citá las normas aplicables (Ley 27.551, CCyCN, DNU 70/2023). Usá terminología jurídica correcta. Esta comunicación puede tener valor legal.',
  urgente: 'Tono de máxima urgencia. Párrafos muy cortos. Resaltá plazos y consecuencias en negrita. Cada oración debe transmitir gravedad.',
};

export const CHANNEL_FORMAT_INSTRUCTIONS: Record<string, string> = {
  whatsapp: `Formato WhatsApp:
- Máximo 3 párrafos cortos.
- Usá *negrita* con asteriscos para datos importantes (montos, fechas, plazos).
- Usá saltos de línea dobles entre párrafos.
- Sin HTML ni markdown complejo.
- Podés usar emojis con moderación si el tono lo permite (🏠💰📋).
- NO uses tablas ni listas con guiones; usá puntos medios o saltos de línea.`,

  email: `Formato email:
- Estructura: Saludo / Cuerpo (2-3 párrafos) / Cierre / Firma.
- Párrafos separados por línea en blanco.
- Podés usar negritas con **doble asterisco** para montos/fechas clave.
- Firma siempre: "AlquilaGestión Pro | Administración".
- Tono según la instrucción de tono recibida.`,

  carta_documento: `Formato Carta Documento (valor legal):
- Encabezado formal: "CARTA DOCUMENTO Nº [número] – Ciudad, fecha"
- Identificación completa de remitente y destinatario.
- Cuerpo en párrafos numerados (PRIMERO, SEGUNDO, TERCERO...).
- Citar exactamente las normas legales aplicables.
- Cierre: "Queda Ud. debidamente intimado/notificado."
- Sin emojis ni lenguaje coloquial.
- Formato estrictamente jurídico.`,

  sms: `Formato SMS:
- Máximo 160 caracteres si es posible; no superar 320.
- Extremadamente conciso: monto, fecha, acción requerida.
- Sin saludos elaborados. Sin emojis.
- Terminá con "AlquilaGestión" como firma corta.`,

  portal: `Formato notificación de portal:
- Título breve (máximo 8 palabras) que irá como encabezado.
- Cuerpo: 2-3 oraciones directas.
- Incluir un "call to action" claro al final (ej: "Ingresá al portal para regularizar").
- Sin formato markdown ni emojis.`,
};

export const MORA_SEQUENCE: Record<number, { label: string; instruction: string; legalBasis: string; suggestedTone: string }> = {
  1: {
    label: 'Día 1 – Recordatorio Amigable',
    instruction: 'Primer contacto post-vencimiento. Tono amigable, asumiendo que pudo ser un olvido. No mencionar consecuencias legales. Solo recordar el monto y facilitar el pago.',
    legalBasis: 'Período de gracia habitual en el mercado argentino.',
    suggestedTone: 'amigable',
  },
  5: {
    label: 'Día 5 – Aviso Formal',
    instruction: 'Segundo aviso. Tono formal. Mencionar que el pago está demorado y que pueden aplicar punitorios. Pedir regularización urgente. No intimar aún.',
    legalBasis: 'CCyCN art. 768 – Intereses moratorios a partir del vencimiento.',
    suggestedTone: 'firme',
  },
  15: {
    label: 'Día 15 – Intimación Legal',
    instruction: 'INTIMACIÓN FEHACIENTE según CCyCN art. 1222. Indicar que ante la falta de pago en 10 días hábiles se procederá a la resolución del contrato y acción de desalojo. Citar monto total adeudado incluyendo punitorios. Tono estrictamente jurídico.',
    legalBasis: 'CCyCN art. 1222 – Resolución del contrato por falta de pago. Ley 27.551 art. 10.',
    suggestedTone: 'juridico',
  },
  30: {
    label: 'Día 30 – Carta Documento',
    instruction: 'CARTA DOCUMENTO previa a acción judicial. Intimar a la restitución del inmueble. Informar que se iniciará demanda de desalojo ante el Juzgado competente si no se regulariza en 48 horas. Citar deuda total actualizada.',
    legalBasis: 'Ley 27.551 art. 10 – Resolución anticipada. CCyCN arts. 1219-1221. CPC y C aplicable por provincia.',
    suggestedTone: 'urgente',
  },
  45: {
    label: 'Día 45 – Último Aviso Pre-Judicial',
    instruction: 'Último aviso antes de la presentación de la demanda. Informar que el expediente judicial ya fue iniciado o está a punto de serlo. Dar 24 horas para regularización. Incluir el total adeudado actualizado con intereses.',
    legalBasis: 'CCyCN arts. 1219-1222. Ley 27.551. Proceso de desalojo por falta de pago.',
    suggestedTone: 'urgente',
  },
};

export const TIPO_INSTRUCCIONES: Record<string, string> = {
  rentReminder: 'Recordatorio de pago con el monto y la fecha de vencimiento. Informar medios de pago disponibles.',
  rentOverdue: 'Aviso de mora: monto adeudado, días de mora, urgencia de regularización.',
  intimacionPago: 'INTIMACIÓN FEHACIENTE. Plazo 10 días hábiles para pagar o se resuelve el contrato (CCyCN art. 1222).',
  cartaDocumentoDesalojo: 'CARTA DOCUMENTO previa a desalojo judicial. Citar incumplimiento y plazo para restituir inmueble.',
  rescisionAnticipadaLocatario: 'Notificación de rescisión por el locatario (CCyCN art. 1221). Indicar fecha de restitución y penalidad si aplica.',
  rescisionAnticipadaLocador: 'Notificación de rescisión por el locador. Solo válida si hay causa legal. Indicar plazo de desocupación.',
  leaseRenewal: 'Aviso de vencimiento próximo y propuesta de renovación. Incluir fecha fin y opciones.',
  leaseAdjustment: 'Informar nuevo valor del alquiler con base en índice oficial. Monto actual → índice → porcentaje → nuevo monto. Citar DNU 70/2023.',
  ownerLiquidationReport: 'Liquidación mensual al propietario: período, ingresos, deducciones y neto transferido.',
  portalInvitation: 'Invitación al portal con rol y enlace de acceso.',
  maintenanceUpdate: 'Actualización de mantenimiento al propietario: concepto, estado y costo.',
  informeMoraGarante: 'Notificación al garante de mora del locatario. El garante como fiador solidario puede ser intimado.',
  notificacionVencimientoProximo: 'Aviso 90 días antes del vencimiento. Opciones de renovación y plazo para notificar intención.',
  generalMessage: 'Mensaje general según el contexto provisto.',
};
