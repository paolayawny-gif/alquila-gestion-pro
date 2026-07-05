
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

import { z } from 'zod';
import { generateJSON, type AIOptions } from '@/ai/gemini';

const AiCommunicationAssistantInputSchema = z.object({
  communicationType: z
    .enum([
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
  input: AiCommunicationAssistantInput,
  aiOptions?: AIOptions,
): Promise<AiCommunicationAssistantOutput> {
  const tipoInstruccion = TIPO_INSTRUCCIONES[input.communicationType] ?? TIPO_INSTRUCCIONES.generalMessage;
  return generateJSON<AiCommunicationAssistantOutput>(buildPrompt(input, tipoInstruccion), aiOptions);
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

function buildPrompt(input: AiCommunicationAssistantInput, tipoInstruccion: string): string {
  const recipient = input.tenantName ?? input.ownerName ?? 'Cliente';
  const dataLines: string[] = [];
  dataLines.push(`- Destinatario: ${recipient}`);
  if (input.guarantorName) dataLines.push(`- Garante: ${input.guarantorName}`);
  if (input.propertyName || input.propertyAddress) {
    dataLines.push(`- Propiedad: ${input.propertyName ?? ''}${input.propertyAddress ? ' — ' + input.propertyAddress : ''}`);
  }
  if (input.currentRentAmount) dataLines.push(`- Alquiler actual: ${input.currentRentAmount}`);
  if (input.newRentAmount) dataLines.push(`- Nuevo alquiler: ${input.newRentAmount}`);
  if (input.adjustmentIndex) {
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
  if (input.maintenanceConcept) dataLines.push(`- Concepto de mantenimiento: ${input.maintenanceConcept}`);
  if (input.maintenanceStatus) dataLines.push(`- Estado: ${input.maintenanceStatus}`);
  if (input.maintenanceCost) dataLines.push(`- Costo estimado/real: ${input.maintenanceCost}`);
  if (input.reportingPeriod) dataLines.push(`- Período de liquidación: ${input.reportingPeriod}`);
  if (input.totalIncome) dataLines.push(`- Ingresos: ${input.totalIncome}`);
  if (input.totalExpenses) dataLines.push(`- Deducciones/gastos: ${input.totalExpenses}`);
  if (input.netAmount) dataLines.push(`- Neto al propietario: ${input.netAmount}`);
  if (input.legalStage) dataLines.push(`- Etapa legal: ${input.legalStage}`);
  if (input.role) dataLines.push(`- Rol: ${input.role}`);
  if (input.portalUrl) dataLines.push(`- URL del portal: ${input.portalUrl}`);
  if (input.additionalContext) dataLines.push(`- Contexto adicional: ${input.additionalContext}`);

  return `Sos un asistente experto en redacción de comunicaciones para la administradora "AlquilaGestión Pro" en Argentina.
Tu misión es redactar mensajes precisos, profesionales y con respaldo legal en español rioplatense (voseo).

### REGLAS DE ESCRITURA (OBLIGATORIAS):
1. Dejá SIEMPRE un espacio después de cada punto (.), coma (,), punto y coma (;) o dos puntos (:).
2. Párrafos cortos (máximo 3 líneas). Separalos con DOS saltos de línea.
3. Tono: formal y jurídico para intimaciones/cartas documento; cordial pero claro para recordatorios.
4. Usá SIEMPRE los valores concretos provistos (montos, fechas, índices). Nunca dejes campos vacíos.
5. Español rioplatense: "voseo" (vos tenés, podés, debés, etc.).

### TIPO DE COMUNICACIÓN: ${input.communicationType}

### INSTRUCCIONES ESPECÍFICAS:
${tipoInstruccion}

### DATOS DISPONIBLES:
${dataLines.join('\n')}

Redactá el mensaje completo con asunto y cuerpo. Al final indicá en "toneNote" cualquier consideración legal importante.

Devolvé un JSON con exactamente esta estructura:
{
  "subjectLine": string,
  "draftedMessage": string,
  "toneNote": string (opcional)
}`;
}
