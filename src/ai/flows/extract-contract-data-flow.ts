'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from rental contracts.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractContractDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A photo or PDF of a rental contract, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractContractDataInput = z.infer<typeof ExtractContractDataInputSchema>;

const ExtractContractDataOutputSchema = z.object({
  baseRentAmount: z.number().describe('The initial monthly rent amount.'),
  currency: z.enum(['ARS', 'USD']).describe('The currency of the rent.'),
  adjustmentFrequencyMonths: z.number().describe('How often the rent is adjusted (in months).'),
  adjustmentMechanism: z.enum(['ICL', 'IPC', 'CasaPropia', 'Fixed']).describe('The index or method used for adjustments.'),
  tenantName: z.string().optional().describe('Full Name of the tenant found in the contract (Locatario).'),
  propertyAddress: z.string().optional().describe('Full Address of the property found in the contract.'),
  startDate: z.string().optional().describe('Start date of the contract in YYYY-MM-DD format.'),
  endDate: z.string().optional().describe('End date of the contract in YYYY-MM-DD format.'),
  confidenceScore: z.number().describe('AI confidence score for the extraction (0 to 1).'),
  summary: z.string().describe('Un breve resumen en ESPAÑOL de las cláusulas económicas y generales encontradas.'),
  fullTranscription: z.string().describe('A complete, verbatim transcription of the text content found in the document in SPANISH.'),
});
export type ExtractContractDataOutput = z.infer<typeof ExtractContractDataOutputSchema>;

export type ExtractContractResult =
  | { ok: true; data: ExtractContractDataOutput }
  | { ok: false; error: string };

const extractContractDataPrompt = ai.definePrompt({
  name: 'extractContractDataPrompt',
  input: {schema: ExtractContractDataInputSchema},
  output: {schema: ExtractContractDataOutputSchema},
  prompt: `You are an expert legal document analyst specializing in Argentinian rental contracts.
Your task is to analyze the provided document and extract the key economic and general clauses accurately.

### IMPORTANT: FIELD MATCHING
- tenantName: Extract the FULL name of the "Locatario".
- propertyAddress: Extract the FULL address of the property.
- startDate / endDate: ALWAYS format as YYYY-MM-DD.
- fullTranscription: Provide a complete, structured, and verbatim transcription of ALL readable text in the document. Do NOT summarize this field; transcribe every clause word for word.

Pay special attention to:
1. The initial rent amount (monto inicial).
2. The currency (usually ARS or USD).
3. The adjustment frequency (frecuencia de ajuste, e.g., "cuatrimestral" = 4, "semestral" = 6).
4. The adjustment index (ICL, IPC, Casa Propia, or Fixed/Escalonado).
5. The full name of the tenant (Locatario).
6. The address of the property (Inmueble).
7. The contract period dates (Fecha de inicio y finalización).

The summary and fullTranscription MUST be in SPANISH.
If the text is in Spanish, parse it carefully.
Document: {{media url=documentDataUri}}`,
});

const extractContractDataFlow = ai.defineFlow(
  {
    name: 'extractContractDataFlow',
    inputSchema: ExtractContractDataInputSchema,
    outputSchema: ExtractContractDataOutputSchema,
  },
  async input => {
    const {output} = await extractContractDataPrompt(input);
    if (!output) throw new Error('La IA no pudo extraer datos del documento.');
    return output;
  }
);

export async function extractContractData(input: ExtractContractDataInput): Promise<ExtractContractResult> {
  try {
    const data = await extractContractDataFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Configurá GEMINI_API_KEY en Vercel.' };
    }
    if (msg.includes('size') || msg.includes('large') || msg.includes('payload')) {
      return { ok: false, error: 'El archivo es demasiado grande para analizar. Intentá con un PDF más liviano o dividilo en páginas.' };
    }
    return { ok: false, error: msg || 'No se pudo analizar el documento.' };
  }
}
