'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateContractInputSchema = z.object({
  contractType: z.string().describe('Type of contract, e.g. "Locación de Vivienda", "Locación Comercial"'),
  locador: z.string().optional().describe('Full name of the Locador (landlord)'),
  locatario: z.string().optional().describe('Full name of the Locatario (tenant)'),
  fiador: z.string().optional().describe('Full name of the Fiador (guarantor)'),
  propertyAddress: z.string().optional().describe('Full address of the property'),
  startDate: z.string().optional().describe('Contract start date'),
  endDate: z.string().optional().describe('Contract end date'),
  duration: z.string().optional().describe('Duration of contract, e.g. "24 meses"'),
  rentAmount: z.string().optional().describe('Monthly rent amount'),
  currency: z.string().optional().describe('Currency, e.g. "ARS", "USD"'),
  depositAmount: z.string().optional().describe('Security deposit amount'),
  adjustmentMechanism: z.string().optional().describe('Rent adjustment mechanism, e.g. IPC, ICL'),
  additionalDetails: z.string().optional().describe('Special clauses or additional instructions from the user'),
});

const GenerateContractOutputSchema = z.object({
  title: z.string().describe('Official title of the generated contract'),
  html: z.string().describe('Full contract text formatted as clean HTML using <h2>, <h3>, <p>, <strong>, <br> tags only. No CSS, no inline styles.'),
});

export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;
export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;
export type GenerateContractResult =
  | { ok: true; data: GenerateContractOutput }
  | { ok: false; error: string };

const generateContractPrompt = ai.definePrompt({
  name: 'generateContractPrompt',
  input: { schema: GenerateContractInputSchema },
  output: { schema: GenerateContractOutputSchema },
  prompt: `Sos un abogado especialista en derecho inmobiliario argentino. Redactá un contrato legal completo y profesional en español rioplatense basado en la siguiente información.

TIPO DE CONTRATO: {{{contractType}}}

DATOS DE LAS PARTES:
{{#if locador}}- Locador: {{{locador}}}{{/if}}
{{#if locatario}}- Locatario: {{{locatario}}}{{/if}}
{{#if fiador}}- Fiador: {{{fiador}}}{{/if}}
{{#if propertyAddress}}- Inmueble: {{{propertyAddress}}}{{/if}}

CONDICIONES:
{{#if startDate}}- Inicio: {{{startDate}}}{{/if}}
{{#if endDate}}- Vencimiento: {{{endDate}}}{{/if}}
{{#if duration}}- Duración: {{{duration}}}{{/if}}
{{#if rentAmount}}- Canon mensual: {{{currency}}} {{{rentAmount}}}{{/if}}
{{#if depositAmount}}- Depósito: {{{depositAmount}}}{{/if}}
{{#if adjustmentMechanism}}- Ajuste: {{{adjustmentMechanism}}}{{/if}}

{{#if additionalDetails}}INSTRUCCIONES Y CLÁUSULAS ESPECIALES:
{{{additionalDetails}}}{{/if}}

INSTRUCCIONES DE REDACCIÓN:
1. Basate en el Código Civil y Comercial de la Nación (CCyCN), Ley 27.551 y DNU 70/2023.
2. Incluí TODAS las cláusulas estándar: objeto, precio y forma de pago, duración, destino, obligaciones del locador y locatario, depósito, rescisión, jurisdicción.
3. Si se indicaron cláusulas especiales en "Instrucciones", incorporalas de forma coherente con el resto del contrato.
4. Donde no se proveyeron datos, usá el formato [COMPLETAR] como placeholder.
5. El tono debe ser formal y jurídico, usando "voseo" argentino en las cláusulas redaccionales.
6. Devolvé el contrato completo en HTML usando SOLO estas etiquetas: <h2> para el título principal, <h3> para encabezados de cláusulas, <p> para párrafos, <strong> para énfasis. Sin CSS ni estilos inline.
7. El HTML debe estar bien estructurado para poder imprimirse directamente.`,
});

const generateContractFlow = ai.defineFlow(
  {
    name: 'generateContractFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: GenerateContractOutputSchema,
  },
  async (input) => {
    const { output } = await generateContractPrompt(input);
    if (!output) throw new Error('La IA no pudo generar el contrato.');
    return output;
  }
);

export async function generateContract(
  input: GenerateContractInput
): Promise<GenerateContractResult> {
  try {
    const data = await generateContractFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI')) {
      return { ok: false, error: 'La clave API de IA no está configurada (GEMINI_API_KEY en Vercel).' };
    }
    return { ok: false, error: msg || 'No se pudo generar el contrato.' };
  }
}
