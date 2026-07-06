'use server';
/**
 * @fileOverview Flow for extracting structured data from service invoices (utilities).
 *
 * - extractInvoiceData - A function that handles the AI extraction process from utility bills.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import { z } from 'zod';
import { generateJSONWithMedia, type AIOptions } from '@/ai/gemini';

const ExtractInvoiceDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A photo or PDF of a service invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  serviceType: z.enum(['Luz', 'Gas', 'Aguas', 'TGI/ABL', 'Expensas', 'Internet', 'Otros']).describe('The type of service or utility.'),
  amount: z.number().describe('The total amount to be paid.'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format.'),
  period: z.string().optional().describe('The billing period (e.g., "Marzo 2024").'),
  propertyReference: z.string().optional().describe('Any address or property ID found in the bill.'),
  confidenceScore: z.number().describe('AI confidence score (0 to 1).'),
  summary: z.string().describe('Un breve resumen en ESPAÑOL de los cargos detectados.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

function buildPrompt(): string {
  return `You are an expert administrative assistant for property management in Argentina.
Your task is to analyze the provided service invoice (utility bill) and extract the key payment details.

### IMPORTANT: FIELD MATCHING
- serviceType: Identify if it is Edenor/Edesur (Luz), Metrogas/Naturgy (Gas), AySA (Aguas), ABL/TGI, Expensas, Internet, or Otros.
- amount: The TOTAL amount to pay (as a number, no currency symbols).
- dueDate: ALWAYS format as YYYY-MM-DD.
- propertyReference: Look for the address or account number to identify the property.
- confidenceScore: Your confidence in the extraction (0 to 1).

The summary MUST be in SPANISH.

Return a JSON object with exactly this structure:
{
  "serviceType": "Luz" | "Gas" | "Aguas" | "TGI/ABL" | "Expensas" | "Internet" | "Otros",
  "amount": number,
  "dueDate": string (optional, YYYY-MM-DD),
  "period": string (optional),
  "propertyReference": string (optional),
  "confidenceScore": number,
  "summary": string
}`;
}

export async function extractInvoiceData(
  input: ExtractInvoiceDataInput,
  aiOptions?: AIOptions,
): Promise<ExtractInvoiceDataOutput> {
  return generateJSONWithMedia<ExtractInvoiceDataOutput>(
    buildPrompt(),
    input.documentDataUri,
    aiOptions,
  );
}
