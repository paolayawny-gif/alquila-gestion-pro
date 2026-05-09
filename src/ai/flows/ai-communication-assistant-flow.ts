
'use server';
/**
 * Asistente de redacción de comunicaciones para AlquilaGestión Pro.
 *
 * Genera mensajes profesionales en español rioplatense para distintos
 * escenarios legales y de gestión inmobiliaria argentina, incluyendo:
 * - Comunicaciones de mora e intimaciones (CCyCN art. 1222)
 * - Carta Documento de desalojo
 * - Notificación de rescisión anticipada (CCyCN art. 1221)
 * - Ajuste de alquiler con fundamento en índice (ICL/IPC/CER)
 * - Liquidaciones, recordatorios, actualizaciones de mantenimiento
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiCommunicationAssistantInputSchema = z.object({
  communicationType: z
    .enum([
      'rentReminder',
      'rentOverdue',
      'intimacionPago',          // Intimación fehaciente de pago (CCyCN art. 1222)
      'cartaDocumentoDesalojo',  // Carta Documento previa a acción de desalojo
      'rescisionAnticipadaLocatario', // Notificación art. 1221 CCyCN
      'rescisionAnticipadaLocador',   // Notificación del locador al locatario
      'leaseRenewal',
      'leaseAdjustment',
      'ownerLiquidationReport',
      'portalInvitation',
      'maintenanceUpdate',
      'informeMoraGarante',      // Notificación al garante de mora del locatario
      'notificacionVencimientoProximo', // Aviso 90 días antes del vencimiento
      'generalMessage',
    ])
    .describe('Tipo de comunicación a redactar.'),

  // Partes
  tenantName: z.string().optional(),
  ownerName: z.string().optional(),
  guarantorName: z.string().optional(),

  // Inmueble
  propertyName: z.string().optional(),
  propertyAddress: z.string().optional(),

  // Montos y fechas
  dueDate: z.string().optional().describe('Fecha de vencimiento de pago o contrato (formato DD/MM/YYYY).'),
  amountDue: z.string().optional().describe('Monto adeudado total (incluir moneda).'),
  currentRentAmount: z.string().optional(),
  newRentAmount: z.string().optional(),
  adjustmentIndex: z.string().optional().describe('Índice aplicado (ICL, IPC, CER, etc.).'),
  adjustmentPercentage: z.string().optional().describe('Porcentaje exacto de ajuste aplicado.'),
  adjustmentPeriod: z.string().optional().describe('Período de referencia del índice (ej: "Octubre 2024").'),

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
  daysOverdue: z.number().optional().describe('Días de mora acumulados.'),
  lateFeeAmount: z.string().optional().describe('Monto de punitorios/intereses generados.'),
  legalStage: z.string().optional().describe('Etapa legal actual (ej: "Intimación", "Mediación", "Demanda").'),
  rescisionNoticeMonths: z.number().optional().describe('Meses de preaviso de rescisión (mínimo 3 para evitar penalidad).'),
  rescisionPenaltyAmount: z.string().optional().describe('Monto de penalidad por rescisión anticipada (art. 1221 CCyCN).'),

  // Portal
  portalUrl: z.string().optional(),
  role: z.string().optional(),

  additionalContext: z.string().optional(),
});

export type AiCommunicationAssistantInput = z.infer<typeof AiCommunicationAssistantInputSchema>;

const AiCommunicationAssistantOutputSchema = z.object({
  subjectLine: z.string().describe('Asunto del correo/mensaje.'),
  draftedMessage: z.string().describe('Cuerpo del mensaje redactado.'),
  toneNote: z.string().optional().describe('Nota sobre el tono utilizado y consideraciones legales relevantes.'),
});

export type AiCommunicationAssistantOutput = z.infer<typeof AiCommunicationAssistantOutputSchema>;

export async function aiCommunicationAssistant(
  input: AiCommunicationAssistantInput
): Promise<AiCommunicationAssistantOutput> {
  return aiCommunicationAssistantFlow(input);
}

const TIPO_INSTRUCCIONES: Record<string, string> = {
  rentReminder: 'Recordatorio cordial de pago. Incluir monto y fecha de vencimiento. Tono amigable pero claro.',
  rentOverdue: 'Aviso de mora. Mencionar monto adeudado, días de mora y urgencia de regularización. Tono formal pero no agresivo.',
  intimacionPago: `INTIMACIÓN FEHACIENTE DE PAGO según CCyCN art. 1222.
    Indicar que ante la falta de pago en 10 días hábiles, se procederá a la resolución del contrato.
    Debe mencionar: monto adeudado, período al que corresponde, punitorios devengados, plazo para regularizar.
    Tono formal y jurídico. Esta comunicación tiene valor legal.`,
  cartaDocumentoDesalojo: `CARTA DOCUMENTO previa a acción judicial de desalojo.
    Intimar al locatario a restituir el inmueble en el plazo legal.
    Mencionar el incumplimiento específico (falta de pago, vencimiento, etc.).
    Indicar que de no cumplir, se iniciará acción judicial de desalojo.
    Tono estrictamente jurídico. Esta comunicación tiene valor legal fehaciente.`,
  rescisionAnticipadaLocatario: `NOTIFICACIÓN DE RESCISIÓN ANTICIPADA por parte del LOCATARIO.
    Según CCyCN art. 1221, el locatario puede rescindir anticipadamente con preaviso de 3 meses y abonar indemnización.
    Indicar: fecha en que se hace efectiva la rescisión, fecha de restitución del inmueble, cálculo de penalidad si corresponde.
    Si el preaviso es de 3 meses o más, aclarar que no corresponde penalidad adicional.`,
  rescisionAnticipadaLocador: `NOTIFICACIÓN DE RESCISIÓN por parte del LOCADOR.
    Solo válida cuando el contrato esté vencido o exista causa legal.
    Indicar la causa, plazo para desocupar y condiciones de restitución del inmueble.`,
  leaseRenewal: 'Informar vencimiento próximo. Incluir fecha de fin de contrato y propuesta de renovación.',
  leaseAdjustment: `Informar sobre el NUEVO valor del alquiler con base en índice oficial.
    Mencionar: monto actual, índice aplicado (ICL/IPC/CER), porcentaje de ajuste, período de referencia, nuevo monto.
    El nuevo valor debe quedar resaltado y perfectamente claro.
    Mencionar que el ajuste se realiza conforme a lo pactado en el contrato y en cumplimiento del DNU 70/2023.`,
  ownerLiquidationReport: 'Liquidación mensual al propietario. Incluir período, ingresos, deducciones y monto neto transferido.',
  portalInvitation: 'Invitación al portal de inquilino/propietario. Incluir el rol y el enlace de acceso.',
  maintenanceUpdate: 'Informar al propietario sobre una reparación. Detallá concepto, estado y costo.',
  informeMoraGarante: `NOTIFICACIÓN AL GARANTE de mora del locatario.
    Informar al garante que el locatario está en mora y que, como fiador solidario, puede ser intimado por el total adeudado.
    Indicar monto adeudado, días de mora y plazo para que el garante intervenga o regularice la situación.`,
  notificacionVencimientoProximo: `Aviso al locatario del próximo vencimiento del contrato (90 días antes o según preaviso pactado).
    Indicar fecha de vencimiento, opciones de renovación y plazo para notificar intención.`,
  generalMessage: 'Mensaje general con el contexto provisto.',
};

const aiCommunicationAssistantPrompt = ai.definePrompt({
  name: 'aiCommunicationAssistantPrompt',
  input: {schema: AiCommunicationAssistantInputSchema},
  output: {schema: AiCommunicationAssistantOutputSchema},
  prompt: `Sos un asistente experto en redacción de comunicaciones para la administradora "AlquilaGestión Pro" en Argentina.
Tu misión es redactar mensajes precisos, profesionales y con respaldo legal en español rioplatense (voseo).

### REGLAS DE ESCRITURA (OBLIGATORIAS):
1. Dejá SIEMPRE un espacio después de cada punto (.), coma (,), punto y coma (;) o dos puntos (:).
2. Párrafos cortos (máximo 3 líneas). Separalos con DOS saltos de línea.
3. Tono: formal y jurídico para intimaciones/cartas documento; cordial pero claro para recordatorios.
4. Usá SIEMPRE los valores concretos provistos (montos, fechas, índices). Nunca dejes campos vacíos.
5. Español rioplatense: "voseo" (vos tenés, podés, debés, etc.).

### TIPO DE COMUNICACIÓN: {{{communicationType}}}

### INSTRUCCIONES ESPECÍFICAS:
{{tipoInstruccion}}

### DATOS DISPONIBLES:
- Destinatario: {{#if tenantName}}{{{tenantName}}}{{else}}{{#if ownerName}}{{{ownerName}}}{{else}}Cliente{{/if}}{{/if}}
{{#if guarantorName}}- Garante: {{{guarantorName}}}{{/if}}
- Propiedad: {{{propertyName}}}{{#if propertyAddress}} — {{{propertyAddress}}}{{/if}}
{{#if currentRentAmount}}- Alquiler actual: **{{{currentRentAmount}}}**{{/if}}
{{#if newRentAmount}}- Nuevo alquiler: **{{{newRentAmount}}}**{{/if}}
{{#if adjustmentIndex}}- Índice de ajuste: {{{adjustmentIndex}}}{{#if adjustmentPercentage}} ({{{adjustmentPercentage}}}){{/if}}{{#if adjustmentPeriod}} — período {{{adjustmentPeriod}}}{{/if}}{{/if}}
{{#if amountDue}}- Monto adeudado: **{{{amountDue}}}**{{/if}}
{{#if daysOverdue}}- Días en mora: **{{{daysOverdue}}} días**{{/if}}
{{#if lateFeeAmount}}- Punitorios devengados: {{{lateFeeAmount}}}{{/if}}
{{#if dueDate}}- Fecha de vencimiento/plazo: {{{dueDate}}}{{/if}}
{{#if currentLeaseStartDate}}- Inicio de contrato: {{{currentLeaseStartDate}}}{{/if}}
{{#if currentLeaseEndDate}}- Fin de contrato: {{{currentLeaseEndDate}}}{{/if}}
{{#if rescisionNoticeMonths}}- Meses de preaviso: {{{rescisionNoticeMonths}}}{{/if}}
{{#if rescisionPenaltyAmount}}- Penalidad por rescisión: {{{rescisionPenaltyAmount}}}{{/if}}
{{#if maintenanceConcept}}- Concepto de mantenimiento: {{{maintenanceConcept}}}{{/if}}
{{#if maintenanceStatus}}- Estado: {{{maintenanceStatus}}}{{/if}}
{{#if maintenanceCost}}- Costo estimado/real: {{{maintenanceCost}}}{{/if}}
{{#if reportingPeriod}}- Período de liquidación: {{{reportingPeriod}}}{{/if}}
{{#if totalIncome}}- Ingresos: {{{totalIncome}}}{{/if}}
{{#if totalExpenses}}- Deducciones/gastos: {{{totalExpenses}}}{{/if}}
{{#if netAmount}}- Neto al propietario: **{{{netAmount}}}**{{/if}}
{{#if legalStage}}- Etapa legal: {{{legalStage}}}{{/if}}
{{#if role}}- Rol: {{{role}}}{{/if}}
{{#if portalUrl}}- URL del portal: {{{portalUrl}}}{{/if}}
{{#if additionalContext}}- Contexto adicional: {{{additionalContext}}}{{/if}}

Redactá el mensaje completo con asunto y cuerpo. Al final indicá en "toneNote" cualquier consideración legal importante.
`,
});

const aiCommunicationAssistantFlow = ai.defineFlow(
  {
    name: 'aiCommunicationAssistantFlow',
    inputSchema: AiCommunicationAssistantInputSchema,
    outputSchema: AiCommunicationAssistantOutputSchema,
  },
  async input => {
    const tipoInstruccion = TIPO_INSTRUCCIONES[input.communicationType] ?? TIPO_INSTRUCCIONES.generalMessage;
    const {output} = await aiCommunicationAssistantPrompt({...input, tipoInstruccion} as any);
    if (!output) {
      throw new Error('No se pudo generar el borrador de comunicación.');
    }
    return output;
  }
);
