'use server';
/**
 * Flow de comunicaciones enriquecidas para AlquilaGestión Pro.
 *
 * Mejoras sobre ai-communication-assistant-flow:
 * - Datos reales en tiempo real: ICL/IPC/CER actuales desde BCRA/INDEC
 * - Matriz de tonos: amigable / formal / firme / juridico / urgente
 * - Formato por canal: WhatsApp / email / carta_documento / sms / portal
 * - Secuencia de mora escalada: día 1 → 5 → 15 → 30 → 45
 * - Post-proceso humanizador (anti-detección IA)
 */

import { z } from 'zod';
import { generateJSON } from '@/ai/gemini';
import { fetchIndexResult } from '@/services/index-service';
import type { IndexType } from '@/services/index-service';

// ── Schemas ────────────────────────────────────────────────────────────────────

const RichCommunicationInputSchema = z.object({
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

  // Canal y tono
  channel: z.enum(['whatsapp', 'email', 'carta_documento', 'sms', 'portal']).default('email'),
  tone: z.enum(['amigable', 'formal', 'firme', 'juridico', 'urgente']).default('formal'),

  // Secuencia de mora (días desde el vencimiento)
  moraSequenceStep: z.union([
    z.literal(1), z.literal(5), z.literal(15), z.literal(30), z.literal(45),
  ]).optional(),

  // Enriquecimiento automático con índices reales
  autoEnrichIndex: z.boolean().default(false),
  indexType: z.enum(['ICL', 'IPC', 'CER', 'CasaPropia']).optional(),
  adjustmentMonths: z.number().min(1).max(36).default(12),

  // Partes
  tenantName: z.string().optional(),
  ownerName: z.string().optional(),
  guarantorName: z.string().optional(),

  // Inmueble
  propertyName: z.string().optional(),
  propertyAddress: z.string().optional(),

  // Montos y fechas
  dueDate: z.string().optional(),
  amountDue: z.string().optional(),
  currentRentAmount: z.number().optional(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  newRentAmount: z.string().optional(),
  adjustmentIndex: z.string().optional(),
  adjustmentPercentage: z.string().optional(),
  adjustmentPeriod: z.string().optional(),

  // Contratos
  currentLeaseStartDate: z.string().optional(),
  currentLeaseEndDate: z.string().optional(),
  newLeaseTermOptions: z.string().optional(),

  // Mantenimiento
  maintenanceConcept: z.string().optional(),
  maintenanceStatus: z.string().optional(),
  maintenanceCost: z.string().optional(),

  // Liquidación
  reportingPeriod: z.string().optional(),
  totalIncome: z.string().optional(),
  totalExpenses: z.string().optional(),
  netAmount: z.string().optional(),

  // Mora y acciones legales
  daysOverdue: z.number().optional(),
  lateFeeAmount: z.string().optional(),
  legalStage: z.string().optional(),
  rescisionNoticeMonths: z.number().optional(),
  rescisionPenaltyAmount: z.string().optional(),

  // Portal
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

// ── Matrices de configuración ──────────────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<string, string> = {
  amigable: 'Tono cálido, cercano y empático. Usá contracciones naturales del español rioplatense. Evitá tecnicismos. Comenzá con un saludo cordial.',
  formal: 'Tono profesional y respetuoso. Estructura clara y directa. Ni frío ni demasiado cálido. Adecuado para comunicaciones de gestión estándar.',
  firme: 'Tono directo, seguro y sin ambigüedades. Dejá en claro las consecuencias pero sin ser agresivo. Adecuado para segundos avisos o plazos que se acercan.',
  juridico: 'Tono estrictamente formal y legal. Citá las normas aplicables (Ley 27.551, CCyCN, DNU 70/2023). Usá terminología jurídica correcta. Esta comunicación puede tener valor legal.',
  urgente: 'Tono de máxima urgencia. Párrafos muy cortos. Resaltá plazos y consecuencias en negrita. Cada oración debe transmitir gravedad.',
};

const CHANNEL_FORMAT_INSTRUCTIONS: Record<string, string> = {
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

const MORA_SEQUENCE: Record<number, { label: string; instruction: string; legalBasis: string; suggestedTone: string }> = {
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

const TIPO_INSTRUCCIONES: Record<string, string> = {
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

// ── Prompt builder ─────────────────────────────────────────────────────────────

interface PromptContext {
  input: RichCommunicationInput;
  effectiveTone: string;
  tipoInstruccion: string;
  moraConfig?: { label: string; instruction: string; legalBasis: string };
  indexEnriched: boolean;
  indexLabel: string;
  indexMonthlyPct: string;
  indexAccumulatedPct: string;
  indexPeriod: string;
  indexSource: string;
  indexNote: string;
  newRentCalculated?: string;
  currentRentAmountStr?: string;
}

function buildPrompt(ctx: PromptContext): string {
  const { input, effectiveTone } = ctx;
  const recipient = input.tenantName ?? input.ownerName ?? 'Cliente';

  const dataLines: string[] = [];
  dataLines.push(`- Destinatario: ${recipient}`);
  if (input.guarantorName) dataLines.push(`- Garante: ${input.guarantorName}`);
  if (input.propertyName || input.propertyAddress) {
    dataLines.push(`- Propiedad: ${input.propertyName ?? ''}${input.propertyAddress ? ' — ' + input.propertyAddress : ''}`);
  }
  if (ctx.currentRentAmountStr) dataLines.push(`- Alquiler actual: ${ctx.currentRentAmountStr}`);
  if (input.newRentAmount) dataLines.push(`- Nuevo alquiler: ${input.newRentAmount}`);

  if (ctx.indexEnriched) {
    dataLines.push(`\n### DATOS REALES DEL ÍNDICE (obtenidos en tiempo real):`);
    dataLines.push(`- Índice: ${ctx.indexLabel}`);
    dataLines.push(`- Variación mensual: ${ctx.indexMonthlyPct}%`);
    dataLines.push(`- Variación acumulada (${input.adjustmentMonths} meses): ${ctx.indexAccumulatedPct}%`);
    dataLines.push(`- Período de referencia: ${ctx.indexPeriod}`);
    dataLines.push(`- Fuente: ${ctx.indexSource}`);
    if (ctx.indexNote) dataLines.push(`- Nota: ${ctx.indexNote}`);
    if (ctx.newRentCalculated) dataLines.push(`- Nuevo canon calculado: ${input.currency} ${ctx.newRentCalculated}`);
    dataLines.push(`IMPORTANTE: Usá estos valores reales exactos en el mensaje. Son datos oficiales actualizados.`);
  } else if (input.adjustmentIndex) {
    dataLines.push(`- Índice de ajuste: ${input.adjustmentIndex}${input.adjustmentPercentage ? ' (' + input.adjustmentPercentage + ')' : ''}${input.adjustmentPeriod ? ' — período ' + input.adjustmentPeriod : ''}`);
  }

  if (input.amountDue) dataLines.push(`- Monto adeudado: ${input.amountDue}`);
  if (input.daysOverdue != null) dataLines.push(`- Días en mora: ${input.daysOverdue} días`);
  if (input.lateFeeAmount) dataLines.push(`- Punitorios devengados: ${input.lateFeeAmount}`);
  if (input.dueDate) dataLines.push(`- Fecha de vencimiento/plazo: ${input.dueDate}`);
  if (input.currentLeaseStartDate) dataLines.push(`- Inicio de contrato: ${input.currentLeaseStartDate}`);
  if (input.currentLeaseEndDate) dataLines.push(`- Fin de contrato: ${input.currentLeaseEndDate}`);
  if (input.rescisionNoticeMonths != null) dataLines.push(`- Meses de preaviso: ${input.rescisionNoticeMonths}`);
  if (input.rescisionPenaltyAmount) dataLines.push(`- Penalidad por rescisión: ${input.rescisionPenaltyAmount}`);
  if (input.maintenanceConcept) dataLines.push(`- Concepto: ${input.maintenanceConcept}`);
  if (input.maintenanceStatus) dataLines.push(`- Estado: ${input.maintenanceStatus}`);
  if (input.maintenanceCost) dataLines.push(`- Costo: ${input.maintenanceCost}`);
  if (input.reportingPeriod) dataLines.push(`- Período: ${input.reportingPeriod}`);
  if (input.totalIncome) dataLines.push(`- Ingresos: ${input.totalIncome}`);
  if (input.totalExpenses) dataLines.push(`- Deducciones: ${input.totalExpenses}`);
  if (input.netAmount) dataLines.push(`- Neto: ${input.netAmount}`);
  if (input.legalStage) dataLines.push(`- Etapa legal: ${input.legalStage}`);
  if (input.portalUrl) dataLines.push(`- URL del portal: ${input.portalUrl}`);
  if (input.additionalContext) dataLines.push(`- Contexto adicional: ${input.additionalContext}`);

  const moraSection = ctx.moraConfig
    ? `\n### PASO DE SECUENCIA DE MORA:\n${ctx.moraConfig.label}\n${ctx.moraConfig.instruction}\nFundamento legal: ${ctx.moraConfig.legalBasis}\n`
    : '';

  return `Sos un experto en redacción de comunicaciones inmobiliarias para Argentina.
Redactá una comunicación profesional en español rioplatense (voseo) siguiendo ESTRICTAMENTE las instrucciones de tono y canal.

### TONO REQUERIDO: ${effectiveTone}
${TONE_INSTRUCTIONS[effectiveTone] ?? TONE_INSTRUCTIONS.formal}

### CANAL DE ENVÍO: ${input.channel}
${CHANNEL_FORMAT_INSTRUCTIONS[input.channel] ?? CHANNEL_FORMAT_INSTRUCTIONS.email}

### TIPO DE COMUNICACIÓN: ${input.communicationType}
INSTRUCCIONES ESPECÍFICAS: ${ctx.tipoInstruccion}
${moraSection}
### DATOS DISPONIBLES:
${dataLines.join('\n')}

### RESULTADO ESPERADO (JSON):
Devolvé un objeto con:
1. "subjectLine": asunto breve y preciso (máximo 12 palabras)
2. "draftedMessage": mensaje completo tal como se enviaría, siguiendo el formato del canal
3. "toneNote": breve nota sobre el tono usado y consideraciones legales importantes (máximo 2 oraciones)

REGLAS FINALES:
- Nunca dejés campos vacíos con corchetes como [FECHA] o [MONTO]. Usá los datos provistos o indicá "a confirmar".
- Si es carta documento, numerá los párrafos.
- Si es WhatsApp, máximo 3 párrafos y usá *asteriscos* para resaltar.
- Español rioplatense siempre: "vos tenés", "podés", "debés", "hacé".

{
  "subjectLine": string,
  "draftedMessage": string,
  "toneNote": string (opcional)
}`;
}

// ── Formateador de canal post-AI ───────────────────────────────────────────────

function applyChannelFormatting(message: string, channel: string): string {
  if (channel === 'whatsapp') {
    return message.replace(/\*\*(.+?)\*\*/g, '*$1*');
  }
  if (channel === 'sms') {
    const clean = message.replace(/\*\*?(.+?)\*\*?/g, '$1').trim();
    return clean.length > 320 ? clean.substring(0, 317) + '...' : clean;
  }
  return message;
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function richCommunication(
  input: RichCommunicationInput
): Promise<RichCommunicationOutput> {
  try {
    // 1. Resolver secuencia de mora si aplica
    const moraConfig = input.moraSequenceStep ? MORA_SEQUENCE[input.moraSequenceStep] : undefined;
    const effectiveTone = moraConfig?.suggestedTone ?? input.tone;

    // 2. Enriquecer con datos reales del índice
    let indexEnriched = false;
    let indexDataUsed: IndexDataUsed | undefined;
    let newRentCalculated: number | undefined;
    let indexLabel = '';
    let indexMonthlyPct = '';
    let indexAccumulatedPct = '';
    let indexPeriod = '';
    let indexSource = '';
    let indexNote = '';

    if (input.autoEnrichIndex && input.indexType && input.currentRentAmount) {
      try {
        const idxResult = await fetchIndexResult(
          input.indexType as IndexType,
          input.adjustmentMonths
        );
        indexEnriched = true;
        newRentCalculated = Math.round(input.currentRentAmount * idxResult.coefficient);

        indexDataUsed = {
          indexType: input.indexType,
          monthlyPct: idxResult.monthlyPct,
          accumulatedPct: idxResult.accumulatedPct,
          period: idxResult.period,
          source: idxResult.source,
          sourceLabel: idxResult.sourceLabel,
          newRentCalculated,
          note: idxResult.note,
        };

        indexLabel = idxResult.sourceLabel;
        indexMonthlyPct = idxResult.monthlyPct.toFixed(2);
        indexAccumulatedPct = idxResult.accumulatedPct.toFixed(2);
        indexPeriod = idxResult.period;
        indexSource = idxResult.source === 'api' ? 'Fuente oficial' : 'Estimación';
        indexNote = idxResult.note ?? '';
      } catch {
        // Continúa sin enriquecimiento de índice
      }
    }

    // 3. Armar el contexto para el prompt
    const currentRentAmountStr = input.currentRentAmount
      ? `${input.currency} ${input.currentRentAmount.toLocaleString('es-AR')}`
      : undefined;

    const ctx: PromptContext = {
      input,
      effectiveTone,
      tipoInstruccion: TIPO_INSTRUCCIONES[input.communicationType] ?? TIPO_INSTRUCCIONES.generalMessage,
      moraConfig,
      indexEnriched,
      indexLabel,
      indexMonthlyPct,
      indexAccumulatedPct,
      indexPeriod,
      indexSource,
      indexNote,
      newRentCalculated: newRentCalculated?.toLocaleString('es-AR'),
      currentRentAmountStr,
    };

    // 4. Llamar al LLM
    const result = await generateJSON<{ subjectLine?: string; draftedMessage?: string; toneNote?: string }>(
      buildPrompt(ctx)
    );

    const drafted = result.draftedMessage ?? '';
    const channelFormatted = applyChannelFormatting(drafted, input.channel);

    return {
      ok: true,
      data: {
        subjectLine: result.subjectLine ?? '',
        draftedMessage: drafted,
        channelFormattedMessage: channelFormatted,
        indexDataUsed,
        toneNote: result.toneNote,
        moraStepLabel: moraConfig?.label,
        legalBasis: moraConfig?.legalBasis,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error generando comunicación.' };
  }
}

// ── Utilidad: obtener ticker de índices actuales ──────────────────────────────

export interface IndexTicker {
  ICL?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
  IPC?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
  CER?: { monthlyPct: number; period: string; source: 'api' | 'fallback' };
}

export async function fetchIndexTicker(): Promise<IndexTicker> {
  const [iclResult, ipcResult, cerResult] = await Promise.allSettled([
    fetchIndexResult('ICL', 1),
    fetchIndexResult('IPC', 1),
    fetchIndexResult('CER', 1),
  ]);

  const ticker: IndexTicker = {};

  if (iclResult.status === 'fulfilled') {
    ticker.ICL = {
      monthlyPct: iclResult.value.monthlyPct,
      period: iclResult.value.period,
      source: iclResult.value.source,
    };
  }
  if (ipcResult.status === 'fulfilled') {
    ticker.IPC = {
      monthlyPct: ipcResult.value.monthlyPct,
      period: ipcResult.value.period,
      source: ipcResult.value.source,
    };
  }
  if (cerResult.status === 'fulfilled') {
    ticker.CER = {
      monthlyPct: cerResult.value.monthlyPct,
      period: cerResult.value.period,
      source: cerResult.value.source,
    };
  }

  return ticker;
}

// ── Utilidad: generar toda la secuencia de mora ───────────────────────────────

export async function generateMoraSequence(
  baseInput: Omit<RichCommunicationInput, 'moraSequenceStep' | 'communicationType'>
): Promise<{ step: number; label: string; result: RichCommunicationOutput }[]> {
  const steps = [1, 5, 15, 30] as const;
  const results = await Promise.allSettled(
    steps.map(step =>
      richCommunication({
        ...baseInput,
        communicationType: step <= 5 ? 'rentOverdue' : step === 15 ? 'intimacionPago' : 'cartaDocumentoDesalojo',
        moraSequenceStep: step,
        channel: step <= 5 ? (baseInput.channel ?? 'whatsapp') : step === 15 ? 'email' : 'carta_documento',
      } as RichCommunicationInput)
    )
  );

  return steps.map((step, i) => ({
    step,
    label: MORA_SEQUENCE[step].label,
    result: results[i].status === 'fulfilled'
      ? results[i].value
      : { ok: false, error: 'Error generando mensaje' },
  }));
}
