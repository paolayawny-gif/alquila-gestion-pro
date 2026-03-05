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
      'leaseRenewal',
      'ownerLiquidationReport',
      'generalMessage',
    ])
    .describe('The type of communication to draft.'),
  tenantName: z.string().optional().describe('Name of the tenant.'),
  propertyName: z.string().optional().describe('Name or reference of the property.'),
  propertyAddress: z.string().optional().describe('Address of the property.'),
  ownerName: z.string().optional().describe('Name of the property owner.'),
  dueDate: z.string().optional().describe('Due date for rent or other payments.'),
  amountDue: z.string().optional().describe('Amount due for rent or other payments.'),
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
Your task is to draft clear, professional, and personalized communication messages or emails based on the provided details.

### Communication Type: {{{communicationType}}}

{{#if (eq communicationType "rentReminder")}}
  Draft a rent reminder email/message.
  Recipient: {{tenantName}}
  Property: {{propertyName}}{{#if propertyAddress}} ({{propertyAddress}}){{/if}}
  Amount Due: {{{amountDue}}}
  Due Date: {{{dueDate}}}
  Tone: Polite but firm.
{{/if}}

{{#if (eq communicationType "leaseRenewal")}}
  Draft a lease renewal notice.
  Recipient: {{tenantName}}
  Property: {{propertyName}}{{#if propertyAddress}} ({{propertyAddress}}){{/if}}
  Current Lease End Date: {{{currentLeaseEndDate}}}
  New Lease Term Options: {{{newLeaseTermOptions}}}
  Tone: Professional and informative, encouraging renewal.
{{/if}}

{{#if (eq communicationType "ownerLiquidationReport")}}
  Draft an owner liquidation report summary email/message.
  Recipient: {{ownerName}}
  Property: {{propertyName}}{{#if propertyAddress}} ({{propertyAddress}}){{/if}}
  Reporting Period: {{{reportingPeriod}}}
  Total Income: {{{totalIncome}}}
  Total Expenses: {{{totalExpenses}}}
  Net Amount: {{{netAmount}}}
  Tone: Professional, transparent, and concise.
{{/if}}

{{#if (eq communicationType "generalMessage")}}
  Draft a general message. The topic and tone will be guided by the additional context provided.
{{/if}}

Additional Context: {{{additionalContext}}}

Ensure the message is well-structured and includes all necessary information. If writing an email, provide a suitable subject line.
`,
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
