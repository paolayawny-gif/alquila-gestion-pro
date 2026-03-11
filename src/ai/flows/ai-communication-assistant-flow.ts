
'use server';
/**
 * @fileOverview A Genkit flow for drafting personalized communication messages or emails.
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
      'maintenanceUpdate',
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
  currentLeaseStartDate: z.string().optional().describe('Start date of the lease agreement.'),
  currentLeaseEndDate: z
    .string()
    .optional()
    .describe('End date of the current lease agreement.'),
  maintenanceConcept: z.string().optional().describe('Concept of the repair/maintenance task.'),
  maintenanceStatus: z.string().optional().describe('Current status of the repair.'),
  maintenanceCost: z.string().optional().describe('Cost or budget for the repair.'),
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

### REGLA DE ORO DE PUNTUACIÓN (CRÍTICA):
1. **ESPACIOS**: Deja SIEMPRE un espacio ( ) después de cada punto (.), coma (,), punto y coma (;) o dos puntos (:). 
2. **NUNCA** pegues la siguiente palabra al signo de puntuación. Ejemplo: "Hola. Espero" (BIEN), "Hola.Espero" (MAL).
3. **PUNTOS A PARTE**: Divide el texto en párrafos cortos (máximo 3 líneas). Usa el punto y aparte frecuentemente para dar aire al texto.
4. **SALTOS DE LÍNEA**: Separa cada párrafo con DOS (2) saltos de línea (\n\n).

### INSTRUCCIONES POR TIPO:
- **leaseAdjustment**: Informar sobre el nuevo valor del alquiler basado en índices.
- **maintenanceUpdate**: Informar al PROPIETARIO sobre una reparación en su unidad. Detalla el concepto ({{{maintenanceConcept}}}), el estado ({{{maintenanceStatus}}}) y el costo estimado/real ({{{maintenanceCost}}}). Justifica la necesidad del arreglo para mantener el valor del inmueble.
- **rentReminder**: Recordatorio cordial de pago.

### CONTEXTO DE LOS DATOS:
- Destinatario: {{#if tenantName}}{{tenantName}}{{else}}{{#if ownerName}}{{ownerName}}{{else}}Cliente{{/if}}{{/if}}
- Propiedad: {{{propertyName}}}{{#if propertyAddress}} ({{{propertyAddress}}}){{/if}}
- Detalles adicionales: {{{additionalContext}}}

Redacta el correo completo en ESPAÑOL, incluyendo un ASUNTO formal. El texto debe estar pensado para ser visualizado en formato JUSTIFICADO.`,
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
