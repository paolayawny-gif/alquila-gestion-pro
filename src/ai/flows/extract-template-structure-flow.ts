'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractTemplateInputSchema = z.object({
  templateText: z.string().describe('The full text of the contract template to analyze.'),
  templateName: z.string().describe('The name given to this template by the user.'),
});

const TemplateVariableSchema = z.object({
  key: z.string().describe('The placeholder text as found in the template (e.g. "NOMBRE COMPLETO DEL LOCADOR")'),
  label: z.string().describe('Human-readable label in Spanish for the form field'),
  type: z.enum(['text', 'date', 'number', 'select']),
  options: z.array(z.string()).optional().describe('Options for select type'),
  hint: z.string().optional().describe('Short example or hint for the field'),
});

const ExtractTemplateOutputSchema = z.object({
  title: z.string().describe('Official title of the contract/document as found in the text'),
  description: z.string().describe('One-sentence description of what this document is for, in Spanish'),
  variables: z.array(TemplateVariableSchema).describe('All unique variable placeholders found between [ ] brackets'),
  cleanedText: z.string().describe('The full template text with placeholders standardized to use [VARIABLE_KEY] format'),
});

export type ExtractTemplateOutput = z.infer<typeof ExtractTemplateOutputSchema>;
export type ExtractTemplateResult =
  | { ok: true; data: ExtractTemplateOutput }
  | { ok: false; error: string };

const extractTemplatePrompt = ai.definePrompt({
  name: 'extractTemplateStructurePrompt',
  input: { schema: ExtractTemplateInputSchema },
  output: { schema: ExtractTemplateOutputSchema },
  prompt: `You are an expert in Argentinian legal document templates.
Analyze the following contract template text and:

1. Extract ALL unique variable placeholders — they appear between square brackets like [VARIABLE] or [ ... ] or [Descripción del campo].
   - Ignore placeholders that are just blanks with no meaning (like "[ ... ]") — group them under a generic key.
   - For each placeholder, determine if it's text, a date, a number, or a select (if it says "ELEGIR:" or "Indicar:").
   - Give each a clear Spanish label for a form field.

2. Return the FULL template text in cleanedText, keeping all original text but ensuring each placeholder uses a consistent [KEY] format. Use SCREAMING_SNAKE_CASE for keys (e.g. [LOCADOR_NOMBRE], [FECHA_INICIO]).

3. Keep the document structure, clauses, and legal text exactly as-is.

TEMPLATE NAME: {{{templateName}}}

TEMPLATE TEXT:
"""
{{{templateText}}}
"""`,
});

const extractTemplateFlow = ai.defineFlow(
  {
    name: 'extractTemplateStructureFlow',
    inputSchema: ExtractTemplateInputSchema,
    outputSchema: ExtractTemplateOutputSchema,
  },
  async (input) => {
    const { output } = await extractTemplatePrompt(input);
    if (!output) throw new Error('La IA no pudo analizar la estructura del modelo.');
    return output;
  }
);

export async function extractTemplateStructure(
  templateText: string,
  templateName: string
): Promise<ExtractTemplateResult> {
  try {
    const data = await extractTemplateFlow({ templateText, templateName });
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI')) {
      return { ok: false, error: 'La clave API de IA no está configurada (GEMINI_API_KEY en Vercel).' };
    }
    return { ok: false, error: msg || 'No se pudo analizar el modelo.' };
  }
}
