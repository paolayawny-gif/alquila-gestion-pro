'use server';
/**
 * @fileOverview A Genkit flow for answering specific questions about a contract based on its transcription.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QueryContractInputSchema = z.object({
  contractTranscription: z.string().describe('The full transcription of the rental contract.'),
  question: z.string().describe('The user question about the contract clauses.'),
});
export type QueryContractInput = z.infer<typeof QueryContractInputSchema>;

const QueryContractOutputSchema = z.object({
  answer: z.string().describe('The AI answer based ONLY on the provided contract text.'),
  sourceQuote: z.string().optional().describe('A literal quote from the contract that supports the answer.'),
});
export type QueryContractOutput = z.infer<typeof QueryContractOutputSchema>;

export type QueryContractResult =
  | { ok: true; data: QueryContractOutput }
  | { ok: false; error: string };

const queryContractPrompt = ai.definePrompt({
  name: 'queryContractPrompt',
  input: {schema: QueryContractInputSchema},
  output: {schema: QueryContractOutputSchema},
  prompt: `You are a specialized legal assistant for Argentinian rental contracts.
Your task is to answer the user's question accurately and ONLY using the information contained in the provided contract transcription.

INSTRUCTIONS:
1. Answer in SPANISH.
2. If the answer is not explicitly in the text, state: "Esta información no se encuentra detallada en el contrato proporcionado."
3. Be precise and professional.
4. If possible, provide a literal quote (sourceQuote) from the text that justifies your answer.

CONTRACT TRANSCRIPTION:
"""
{{{contractTranscription}}}
"""

USER QUESTION:
{{{question}}}`,
});

const queryContractFlow = ai.defineFlow(
  {
    name: 'queryContractFlow',
    inputSchema: QueryContractInputSchema,
    outputSchema: QueryContractOutputSchema,
  },
  async input => {
    const {output} = await queryContractPrompt(input);
    if (!output) throw new Error('La IA no devolvió respuesta.');
    return output;
  }
);

export async function queryContract(input: QueryContractInput): Promise<QueryContractResult> {
  try {
    const data = await queryContractFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Contactá al administrador.' };
    }
    return { ok: false, error: msg || 'No se pudo obtener respuesta de la IA.' };
  }
}
