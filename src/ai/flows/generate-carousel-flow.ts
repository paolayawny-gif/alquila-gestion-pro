'use server';

import { z } from 'zod';
import { generateJSON } from '@/ai/gemini';

const InputSchema = z.object({
  topic: z.string().describe('Tema o idea del carrusel.'),
  numSlides: z.number().min(2).max(10).describe('Cantidad de slides.'),
  tone: z
    .enum(['profesional', 'cercano', 'urgente', 'inspiracional', 'informativo'])
    .describe('Tono del mensaje.'),
  context: z.string().optional().describe('Contexto adicional (precio, zona, amenities, etc.).'),
  brandContext: z.string().optional().describe('Brief de marca de la inmobiliaria — aplicar siempre para mantener coherencia de voz.'),
});

export type GenerateCarouselInput = z.infer<typeof InputSchema>;

const SlideSchema = z.object({
  title: z.string().describe('Título corto del slide (máx 8 palabras, impactante).'),
  subtitle: z.string().describe('Texto de apoyo (máx 20 palabras, complementa el título).'),
});

const OutputSchema = z.object({
  slides: z.array(SlideSchema).describe('Secuencia de slides del carrusel.'),
  hashtags: z.string().describe('Hashtags recomendados para el post.'),
});

export type GenerateCarouselOutput = z.infer<typeof OutputSchema>;

function buildPrompt(input: GenerateCarouselInput): string {
  return `Sos un experto en marketing inmobiliario argentino.
${input.brandContext ? `BRIEF DE MARCA (aplicar en todo el contenido — voz, tono y estilo de esta inmobiliaria):\n${input.brandContext}\n` : ''}
Creá un carrusel de exactamente ${input.numSlides} slides para Instagram/LinkedIn sobre:
"${input.topic}"

Tono: ${input.tone}
${input.context ? `Contexto adicional: ${input.context}` : ''}

Estructura del carrusel:
- Slide 1: Hook impactante (pregunta, dato o afirmación que enganche)
- Slides 2 a ${input.numSlides - 1}: Puntos clave del contenido (uno por slide)
- Slide ${input.numSlides}: CTA o cierre memorable

Reglas estrictas:
1. Cada título: máx 8 palabras, directo y llamativo
2. Cada subtítulo: máx 20 palabras, amplía el título con un detalle concreto
3. Lenguaje argentino natural (vos, ustedes)
4. Coherencia temática entre todos los slides
5. Orientado al mercado inmobiliario local

Devolvé un JSON con exactamente esta estructura:
{
  "slides": [
    { "title": string, "subtitle": string }
  ],
  "hashtags": string
}`;
}

export async function generateCarousel(
  input: GenerateCarouselInput
): Promise<GenerateCarouselOutput> {
  return generateJSON<GenerateCarouselOutput>(buildPrompt(input));
}
