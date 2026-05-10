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

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
  channelFormattedMessage: string;  // Mensaje ya formateado para el canal
  indexDataUsed?: IndexDataUsed;
  toneNote?: string;
  moraStepLabel?: string;           // Ej: "Día 15 – Intimación Legal"
  legalBasis?: string;              // Fundamento legal aplicable
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

// ── Genkit prompt ──────────────────────────────────────────────────────────────

const richCommunicationPrompt = ai.definePrompt({
  name: 'richCommunicationPrompt',
  prompt: `Sos un experto en redacción de comunicaciones inmobiliarias para Argentina.
Redactá una comunicación profesional en español rioplatense (voseo) siguiendo ESTRICTAMENTE las instrucciones de tono y canal.

### TONO REQUERIDO: {{{tone}}}
{{{toneInstruction}}}

### CANAL DE ENVÍO: {{{channel}}}
{{{channelInstruction}}}

### TIPO DE COMUNICACIÓN: {{{communicationType}}}
INSTRUCCIONES ESPECÍFICAS: {{{tipoInstruccion}}}

{{#if moraStepInstruction}}
### PASO DE SECUENCIA DE MORA:
{{{moraStepInstruction}}}
{{/if}}

### DATOS DISPONIBLES:
- Destinatario: {{#if tenantName}}{{{tenantName}}}{{else}}{{#if ownerName}}{{{ownerName}}}{{else}}Cliente{{/if}}{{/if}}
{{#if guarantorName}}- Garante: {{{guarantorName}}}{{/if}}
- Propiedad: {{#if propertyName}}{{{propertyName}}}{{/if}}{{#if propertyAddress}} — {{{propertyAddress}}}{{/if}}
{{#if currentRentAmountStr}}- Alquiler actual: **{{{currentRentAmountStr}}}**{{/if}}
{{#if newRentAmount}}- Nuevo alquiler: **{{{newRentAmount}}}**{{/if}}
{{#if indexEnriched}}
### DATOS REALES DEL ÍNDICE (obtenidos en tiempo real):
- Índice: {{{indexLabel}}}
- Variación mensual: {{{indexMonthlyPct}}}%
- Variación acumulada ({{{adjustmentMonths}}} meses): {{{indexAccumulatedPct}}}%
- Período de referencia: {{{indexPeriod}}}
- Fuente: {{{indexSource}}}
{{#if indexNote}}- Nota: {{{indexNote}}}{{/if}}
{{#if newRentCalculated}}- Nuevo canon calculado: **{{{currency}}} {{{newRentCalculated}}}**{{/if}}
IMPORTANTE: Usá estos valores reales exactos en el mensaje. Son datos oficiales actualizados.
{{/if}}
{{#if adjustmentIndex}}- Índice de ajuste: {{{adjustmentIndex}}}{{#if adjustmentPercentage}} ({{{adjustmentPercentage}}}){{/if}}{{#if adjustmentPeriod}} — período {{{adjustmentPeriod}}}{{/if}}{{/if}}
{{#if amountDue}}- Monto adeudado: **{{{amountDue}}}**{{/if}}
{{#if daysOverdue}}- Días en mora: **{{{daysOverdue}}} días**{{/if}}
{{#if lateFeeAmount}}- Punitorios devengados: {{{lateFeeAmount}}}{{/if}}
{{#if dueDate}}- Fecha de vencimiento/plazo: {{{dueDate}}}{{/if}}
{{#if currentLeaseStartDate}}- Inicio de contrato: {{{currentLeaseStartDate}}}{{/if}}
{{#if currentLeaseEndDate}}- Fin de contrato: {{{currentLeaseEndDate}}}{{/if}}
{{#if rescisionNoticeMonths}}- Meses de preaviso: {{{rescisionNoticeMonths}}}{{/if}}
{{#if rescisionPenaltyAmount}}- Penalidad por rescisión: {{{rescisionPenaltyAmount}}}{{/if}}
{{#if maintenanceConcept}}- Concepto: {{{maintenanceConcept}}}{{/if}}
{{#if maintenanceStatus}}- Estado: {{{maintenanceStatus}}}{{/if}}
{{#if maintenanceCost}}- Costo: {{{maintenanceCost}}}{{/if}}
{{#if reportingPeriod}}- Período: {{{reportingPeriod}}}{{/if}}
{{#if totalIncome}}- Ingresos: {{{totalIncome}}}{{/if}}
{{#if totalExpenses}}- Deducciones: {{{totalExpenses}}}{{/if}}
{{#if netAmount}}- Neto: **{{{netAmount}}}**{{/if}}
{{#if legalStage}}- Etapa legal: {{{legalStage}}}{{/if}}
{{#if portalUrl}}- URL del portal: {{{portalUrl}}}{{/if}}
{{#if additionalContext}}- Contexto adicional: {{{additionalContext}}}{{/if}}

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
`,
});

// ── Genkit flow ────────────────────────────────────────────────────────────────

const richCommunicationGenkit = ai.defineFlow(
  { name: 'richCommunicationFlow' },
  async (enrichedInput: Record<string, unknown>) => {
    const { output } = await richCommunicationPrompt(enrichedInput);
    return output;
  }
);

// ── Formateador de canal post-AI ───────────────────────────────────────────────

function applyChannelFormatting(message: string, channel: string): string {
  if (channel === 'whatsapp') {
    // Convertir **texto** a *texto* (WhatsApp usa un solo asterisco)
    return message.replace(/\*\*(.+?)\*\*/g, '*$1*');
  }
  if (channel === 'sms') {
    // Quitar negritas y recortar a 320 chars
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

    const promptInput = {
      ...input,
      currentRentAmountStr,
      toneInstruction: TONE_INSTRUCTIONS[effectiveTone] ?? TONE_INSTRUCTIONS.formal,
      channelInstruction: CHANNEL_FORMAT_INSTRUCTIONS[input.channel] ?? CHANNEL_FORMAT_INSTRUCTIONS.email,
      tipoInstruccion: TIPO_INSTRUCCIONES[input.communicationType] ?? TIPO_INSTRUCCIONES.generalMessage,
      moraStepInstruction: moraConfig
        ? `${moraConfig.label}\n${moraConfig.instruction}\nFundamento legal: ${moraConfig.legalBasis}`
        : undefined,
      indexEnriched,
      indexLabel,
      indexMonthlyPct,
      indexAccumulatedPct,
      indexPeriod,
      indexSource,
      indexNote,
      newRentCalculated: newRentCalculated?.toLocaleString('es-AR'),
    };

    // 4. Llamar al LLM
    const output = await richCommunicationGenkit(promptInput as any);

    if (!output || typeof output !== 'object') {
      throw new Error('El modelo no devolvió una respuesta válida.');
    }

    const result = output as { subjectLine?: string; draftedMessage?: string; toneNote?: string };
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
