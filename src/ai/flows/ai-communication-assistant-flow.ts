'use server';
/**
 * @fileOverview A Genkit flow for drafting personalized communication messages or emails.
 *
 * - aiCommunicationAssistant - A function that handles the AI communication drafting process.
 * - AiCommunicationAssistantInput - The input type for the aiCommunicationAssistant function.
 * - AiCommunicationAssistantOutput - The return type for the aiCommunicationAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiCommunicationAssistantInputSchema = z.object({
  communicationType: z
    .enum([
      'rentReminder',
      'rentOverdue',
      'leaseRenewal',
      'leaseAdjustment',
      'ownerLiquidationReport',
      'portalInvitation',
      'generalMessage',
    ])
    .describe('The type of communication to draft.'),
  tenantName: z.string().optional().describe('Name of the tenant.'),
  propertyName: z.string().optional().describe('Name or reference of the property.'),
  propertyAddress: z.string().optional().describe('Address of the property.'),
  ownerName: z.string().optional().describe('Name of the property owner.'),
  dueDate: z.string().optional().describe('Due date for rent or other payments.'),
  amountDue: z.string().optional().describe('Amount due for rent or other payments.'),
  currentRentAmount: z.string().optional().describe('Current rent amount.'),
  newRentAmount: z.string().optional().describe('New rent amount after adjustment.'),
  adjustmentIndex: z.string().optional().describe('The index used for adjustment (e.g., ICL, IPC).'),
  currentLeaseEndDate: z
    .string()
    .optional()
    .describe('End date of the current lease agreement.'),
  newLeaseTermOptions: z
    .string()
    .optional()
    .describe('Proposed new lease terms or options for renewal.'),
  reportingPeriod: z.string().optional().describe('Reporting period for the liquidation report.'),
  totalIncome: z.string().optional().describe('Total income for the reporting period.'),
  totalExpenses: z.string().optional().describe('Total expenses for the reporting period.'),
  netAmount: z
    .string()
    .optional()
    .describe('Net amount for the owner after deductions.'),
  portalUrl: z.string().optional().describe('The URL of the application portal.'),
  role: z.string().optional().describe('The role of the person being invited (Inquilino/Propietario).'),
  additionalContext: z
    .string()
    .optional()
    .describe('Any additional specific instructions or details for the message.'),
});
export type AiCommunicationAssistantInput = z.infer<
  typeof AiCommunicationAssistantInputSchema
>;

const AiCommunicationAssistantOutputSchema = z.object({
  subjectLine: z.string().describe('The subject line for the email/message.'),
  draftedMessage: z.string().describe('The drafted communication message or email body.'),
});
export type AiCommunicationAssistantOutput = z.infer<
  typeof AiCommunicationAssistantOutputSchema
>;

export async function aiCommunicationAssistant(
  input: AiCommunicationAssistantInput
): Promise<AiCommunicationAssistantOutput> {
  return aiCommunicationAssistantFlow(input);
}

const aiCommunicationAssistantPrompt = ai.definePrompt({
  name: 'aiCommunicationAssistantPrompt',
  input: {schema: AiCommunicationAssistantInputSchema},
  output: {schema: AiCommunicationAssistantOutputSchema},
  prompt: `Eres un asistente de redacción experto para la administradora de propiedades "AlquilaGestión Pro" en Argentina.
Tu misión es redactar mensajes elegantes, modernos, profesionales y, sobre todo, CLAROS.

### REGLAS CRÍTICAS DE FORMATO Y ESTILO:
1. **ESTRUCTURA DE PÁRRAFOS**: Divide el texto en párrafos cortos. Usa "punto y aparte" frecuentemente. NUNCA entregues un solo bloque de texto.
2. **PUNTUACIÓN Y ORTOGRAFÍA**: Debe ser perfecta. Usa los signos de puntuación para dar ritmo y claridad a la lectura.
3. **TONO**: Profesional pero empático y cordial. Elegante pero moderno.
4. **DEBER DE INFORMACIÓN (Ley 24.240)**: La comunicación debe ser completa. No omitas ningún dato relevante (montos, fechas, índices, conceptos). El destinatario debe comprender exactamente qué se le comunica y por qué.

### INSTRUCCIONES POR TIPO:
- **leaseAdjustment (Ajuste de Alquiler)**: Informa el próximo aumento. Explica que se aplica según el contrato y el índice {{{adjustmentIndex}}}. Detalla el monto actual ({{{currentRentAmount}}}) y el nuevo valor ({{{newRentAmount}}}). Sé muy claro con la fecha de vigencia. Agradece la confianza.
- **rentReminder (Recordatorio)**: Recordatorio cordial de pago para la propiedad {{{propertyName}}}. Indica monto ({{{amountDue}}}) y fecha de vencimiento ({{{dueDate}}}).
- **rentOverdue (Mora)**: Notificación firme pero educada sobre la falta de pago de {{{amountDue}}}. Solicita regularizar a la brevedad.
- **portalInvitation**: Invitación al portal. Explica los beneficios de tener todo digitalizado.
- **ownerLiquidationReport**: Resumen de rentabilidad para el propietario {{{ownerName}}}.

### CONTEXTO DE LOS DATOS:
- Destinatario: {{#if tenantName}}{{tenantName}}{{else}}{{#if ownerName}}{{ownerName}}{{else}}Cliente{{/if}}{{/if}}
- Propiedad: {{{propertyName}}}{{#if propertyAddress}} ({{{propertyAddress}}}){{/if}}
- Detalles adicionales: {{{additionalContext}}}

Redacta el correo completo en ESPAÑOL, incluyendo un ASUNTO atractivo y formal. Asegúrate de separar las ideas con saltos de línea dobles para una visualización limpia.`,
});

const aiCommunicationAssistantFlow = ai.defineFlow(
  {
    name: 'aiCommunicationAssistantFlow',
    inputSchema: AiCommunicationAssistantInputSchema,
    outputSchema: AiCommunicationAssistantOutputSchema,
  },
  async input => {
    const {output} = await aiCommunicationAssistantPrompt(input);
    if (!output) {
      throw new Error('Failed to generate communication draft.');
    }
    return output;
  }
);
