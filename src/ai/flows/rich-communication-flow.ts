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
 *
 * Este archivo solo exporta async functions (requisito de Next.js para
 * archivos con 'use server'). Tipos, schemas y constantes están en
 * ./rich-communication-types.
 */

import { ai } from '@/ai/genkit';
import { fetchIndexResult } from '@/services/index-service';
import type { IndexType } from '@/services/index-service';
import {
  TONE_INSTRUCTIONS,
  CHANNEL_FORMAT_INSTRUCTIONS,
  MORA_SEQUENCE,
  TIPO_INSTRUCCIONES,
} from './rich-communication-types';
import type {
  RichCommunicationInput,
  RichCommunicationOutput,
  IndexDataUsed,
  IndexTicker,
} from './rich-communication-types';

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

const richCommunicationGenkit = ai.defineFlow(
  { name: 'richCommunicationFlow' },
  async (enrichedInput: Record<string, unknown>) => {
    const { output } = await richCommunicationPrompt(enrichedInput);
    return output;
  }
);

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
    const moraConfig = input.moraSequenceStep ? MORA_SEQUENCE[input.moraSequenceStep] : undefined;
    const effectiveTone = moraConfig?.suggestedTone ?? input.tone;

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
