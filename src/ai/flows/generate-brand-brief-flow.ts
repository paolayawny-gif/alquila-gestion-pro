'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  brandName: z.string().describe('Nombre de la inmobiliaria.'),
  zone: z.string().describe('Zona o ciudad donde opera.'),
  specialty: z.enum(['Residencial', 'Comercial', 'Vacacional', 'Mixta', 'Oficinas']).describe('Especialidad principal.'),
  audience: z.enum(['Propietarios', 'Inquilinos', 'Ambos', 'Inversores']).describe('Audiencia principal.'),
  usp: z.string().describe('Propuesta de valor única — qué diferencia a esta inmobiliaria.'),
  samplePosts: z.string().optional().describe('2-3 publicaciones existentes para análisis de estilo.'),
});

export type GenerateBrandBriefInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  brief: z.string().describe('Brief de marca completo (≤350 palabras) listo para inyectar como contexto en cada generación de IA.'),
  contentPillars: z.array(z.string()).describe('3-4 pilares de contenido temáticos para esta inmobiliaria.'),
  powerWords: z.string().describe('10-15 palabras o frases de poder que reflejan la voz de la marca, separadas por coma.'),
  avoidances: z.string().describe('Frases, estilos o temas que esta marca debe evitar siempre (3-5 puntos).'),
});

export type GenerateBrandBriefOutput = z.infer<typeof OutputSchema>;

const generateBrandBriefFlow = ai.defineFlow(
  { name: 'generateBrandBriefFlow', inputSchema: InputSchema, outputSchema: OutputSchema },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Sos un Estratega de Conversión Senior especializado en branding para el mercado inmobiliario argentino.

Tu tarea: crear un brief de marca conciso y accionable para "${input.brandName}", una inmobiliaria con las siguientes características:

- Zona: ${input.zone}
- Especialidad: ${input.specialty}
- Audiencia principal: ${input.audience}
- Propuesta de valor única: ${input.usp}
${input.samplePosts ? `\nEjemplos de publicaciones existentes (analizar el estilo, vocabulario y tono para replicarlo):\n${input.samplePosts}` : ''}

Creá un brief de marca que:
1. Capture la voz y personalidad única de esta inmobiliaria
2. Sea accionable: cualquier IA puede leerlo y generar contenido coherente con la marca
3. Incluya instrucciones de tono, vocabulario y estructura de mensajes
4. Se adapte al mercado inmobiliario argentino y a sus códigos culturales
5. Sea conciso (máx 350 palabras) pero completo

El brief debe estar escrito como instrucciones directas para una IA, no como descripción de la empresa.
Ejemplo de inicio: "Escribí como si fueras ${input.brandName}. Tu tono es..."

También identificá:
- 3-4 pilares de contenido temáticos (ej: "Propiedades destacadas", "Tips de alquiler", "Noticias del mercado")
- Las palabras y frases que representan la voz de la marca
- Lo que esta marca debe EVITAR siempre (frases genéricas, temas inapropiados, etc.)`,
      output: { schema: OutputSchema },
    });

    if (!output) throw new Error('El modelo no devolvió una respuesta válida.');
    return output;
  }
);

export async function generateBrandBrief(
  input: GenerateBrandBriefInput
): Promise<GenerateBrandBriefOutput> {
  return generateBrandBriefFlow(input);
}
