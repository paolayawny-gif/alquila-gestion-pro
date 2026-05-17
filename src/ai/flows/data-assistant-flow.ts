'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DataAssistantInputSchema = z.object({
  question: z.string().describe('Pregunta del admin sobre sus datos.'),
  context: z.string().describe('Resumen estructurado de los datos del admin (propiedades, contratos, pagos, personas).'),
});

export type DataAssistantInput = z.infer<typeof DataAssistantInputSchema>;

const DataAssistantOutputSchema = z.object({
  answer: z.string().describe('Respuesta en lenguaje natural basada exclusivamente en los datos provistos.'),
  followUpQuestions: z.array(z.string()).optional().describe('2-3 preguntas de seguimiento que el admin podría querer hacer.'),
  navigateTo: z.string().optional().describe('Ruta a la que navegar si el usuario lo pide. Solo una de: /dashboard, /propiedades, /contratos, /pagos, /personas'),
});

export type DataAssistantOutput = z.infer<typeof DataAssistantOutputSchema>;

export type DataAssistantResult =
  | { ok: true; data: DataAssistantOutput }
  | { ok: false; error: string };

const dataAssistantPrompt = ai.definePrompt({
  name: 'dataAssistantPrompt',
  input: { schema: DataAssistantInputSchema },
  output: { schema: DataAssistantOutputSchema },
  prompt: `Sos el asistente de datos de "AlquilaGestión Pro". Tu única función es responder preguntas sobre los datos de gestión inmobiliaria que se te proveen a continuación.

### REGLAS ESTRICTAS:
1. Respondé SIEMPRE en español rioplatense (voseo).
2. Usá EXCLUSIVAMENTE los datos del bloque "DATOS DEL ADMIN". NO uses conocimiento externo.
3. Si la pregunta no se puede responder con los datos provistos, respondé: "No tengo esa información en tus datos actuales."
4. Si la pregunta no tiene relación con gestión inmobiliaria o los datos (ej: recetas, tareas, noticias, programación), respondé: "Solo puedo ayudarte con información de tus propiedades, inquilinos, contratos y pagos."
5. Sé conciso y directo. Usá listas cuando la respuesta tenga múltiples ítems.
6. Nunca inventes datos, montos, fechas o nombres que no estén en el contexto.
7. Generá 2-3 "followUpQuestions" relevantes para el contexto del admin.
8. Si el usuario pide ir, abrir, navegar o ver una sección, completá "navigateTo" con la ruta correspondiente:
   - Panel / inicio / dashboard → /dashboard
   - Propiedades / inmuebles → /propiedades
   - Contratos → /contratos
   - Pagos / alquileres / cobros → /pagos
   - Personas / inquilinos / propietarios → /personas
   Si no pide navegar, omití "navigateTo".

### DATOS DEL ADMIN:
{{{context}}}

### PREGUNTA:
{{{question}}}
`,
});

const dataAssistantFlow = ai.defineFlow(
  {
    name: 'dataAssistantFlow',
    inputSchema: DataAssistantInputSchema,
    outputSchema: DataAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await dataAssistantPrompt(input);
    if (!output) throw new Error('La IA no devolvió respuesta.');
    return output;
  }
);

export async function askDataAssistant(input: DataAssistantInput): Promise<DataAssistantResult> {
  try {
    const data = await dataAssistantFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Contactá al administrador.' };
    }
    return { ok: false, error: msg || 'No se pudo obtener respuesta de la IA.' };
  }
}
