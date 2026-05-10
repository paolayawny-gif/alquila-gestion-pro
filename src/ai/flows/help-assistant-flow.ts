'use server';
/**
 * Asistente de Ayuda contextual para AlquilaGestión Pro.
 *
 * Responde preguntas del usuario sobre cómo usar la aplicación, qué hace cada
 * módulo, dónde encontrar una función o cómo resolver un caso típico de gestión
 * inmobiliaria argentina dentro del sistema.
 *
 * El flow recibe la pregunta y un "manual" del producto (catálogo de
 * funcionalidades) que se inyecta en el prompt como contexto autoritativo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const HelpAssistantInputSchema = z.object({
  question: z.string().describe('Pregunta del usuario sobre la aplicación.'),
  manual: z.string().describe('Manual / catálogo de funciones del producto que sirve de contexto autoritativo.'),
  currentSection: z.string().optional().describe('Sección o módulo en el que se encuentra el usuario al preguntar.'),
});

export type HelpAssistantInput = z.infer<typeof HelpAssistantInputSchema>;

const HelpAssistantOutputSchema = z.object({
  answer: z.string().describe('Respuesta clara y paso a paso para el usuario.'),
  suggestedSections: z.array(z.string()).optional().describe('Nombres de secciones del menú a las que conviene ir para resolver la consulta.'),
  followUpQuestions: z.array(z.string()).optional().describe('2-3 preguntas de seguimiento sugeridas que el usuario podría hacer.'),
});

export type HelpAssistantOutput = z.infer<typeof HelpAssistantOutputSchema>;

export type HelpAssistantResult =
  | { ok: true; data: HelpAssistantOutput }
  | { ok: false; error: string };

const helpAssistantPrompt = ai.definePrompt({
  name: 'helpAssistantPrompt',
  input: { schema: HelpAssistantInputSchema },
  output: { schema: HelpAssistantOutputSchema },
  prompt: `Sos el asistente de ayuda de "AlquilaGestión Pro", un sistema integral de administración de propiedades en alquiler en Argentina.

Tu misión es ayudar al usuario a USAR la aplicación: explicarle qué hace cada módulo, en qué menú lo encuentra, qué pasos seguir para realizar una operación, y aclarar dudas sobre el funcionamiento del producto.

### REGLAS:
1. Respondé SIEMPRE en español rioplatense (voseo: tenés, podés, hacé clic, etc.).
2. Basate EXCLUSIVAMENTE en el "Manual del producto" que te paso abajo. NO inventes funciones.
3. Si la respuesta no está en el manual, decilo con honestidad: "Esa función no está documentada en el manual; te sugiero contactar al soporte."
4. Sé directo y práctico: indicá la ruta del menú (ej: "Sidebar → Cartera → Propiedades"), los pasos numerados y los puntos importantes.
5. Si la consulta es legal/contable, aclaré que la app cuenta con asistentes específicos (Asistente IA de comunicaciones, Análisis IA de contratos, Índices oficiales, etc.) y orientá hacia ellos.
6. Mantené las respuestas concisas: 3 a 8 líneas, salvo que el usuario pida un tutorial completo.
7. En "suggestedSections" devolvé los nombres EXACTOS del menú (ej: "Propiedades", "Generador Contratos", "Libro Mayor").
8. Generá 2-3 "followUpQuestions" que el usuario podría querer hacer a continuación.

{{#if currentSection}}
### CONTEXTO ACTUAL DEL USUARIO:
El usuario está visualizando la sección "{{{currentSection}}}" cuando hace la pregunta.
{{/if}}

### MANUAL DEL PRODUCTO (única fuente de verdad):
"""
{{{manual}}}
"""

### PREGUNTA DEL USUARIO:
{{{question}}}
`,
});

const helpAssistantFlow = ai.defineFlow(
  {
    name: 'helpAssistantFlow',
    inputSchema: HelpAssistantInputSchema,
    outputSchema: HelpAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await helpAssistantPrompt(input);
    if (!output) throw new Error('La IA no devolvió respuesta.');
    return output;
  }
);

export async function askHelpAssistant(input: HelpAssistantInput): Promise<HelpAssistantResult> {
  try {
    const data = await helpAssistantFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Contactá al administrador.' };
    }
    return { ok: false, error: msg || 'No se pudo obtener respuesta de la IA.' };
  }
}
