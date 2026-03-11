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
  prompt: `You are an AI assistant for a property management company named "AlquilaGestión Pro".
Your task is to draft clear, professional, and personalized communication messages or emails in SPANISH.

Instructions based on type:
- portalInvitation: Invitation to the client portal. Mention the Role: {{{role}}} and Portal URL: {{{portalUrl}}}.
- rentReminder: Friendly reminder. Rent for {{{propertyName}}} is available. Amount: {{{amountDue}}}, Pay by: {{{dueDate}}}.
- rentOverdue: Firm but polite notification. Rent for {{{propertyName}}} is OVERDUE. Amount: {{{amountDue}}}. Original due date was: {{{dueDate}}}. Ask for payment confirmation.
- leaseAdjustment: Notification of rent increase. Mention that starting next month, the rent for {{{propertyName}}} will be adjusted based on the {{{adjustmentIndex}}} index. Current: {{{currentRentAmount}}}, NEW: {{{newRentAmount}}}.
- leaseRenewal: Notice for {{{propertyName}}}. Current end: {{{currentLeaseEndDate}}}.
- ownerLiquidationReport: Summary for {{{ownerName}}} for period {{{reportingPeriod}}}. Net: {{{netAmount}}}.
- generalMessage: Use additional context.

Context:
Type: {{{communicationType}}}
Recipient: {{#if tenantName}}{{tenantName}}{{else}}{{ownerName}}{{if ownerName}}{{else}}Cliente{{/if}}{{/if}}
Property: {{propertyName}}{{#if propertyAddress}} ({{propertyAddress}}){{/if}}
Additional Details: {{{additionalContext}}}

Draft a professional message in Spanish. Provide a subject line.`,
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
