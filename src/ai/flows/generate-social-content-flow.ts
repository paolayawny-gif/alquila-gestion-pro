'use server';
/**
 * @fileOverview Generador de contenido para Redes Sociales.
 * Usa Gemini 2.5 Flash para crear posts, plantillas y stories adaptados
 * a cada red social del rubro inmobiliario.
 */

import { z } from 'zod';
import { generateJSON, type AIOptions } from '@/ai/gemini';

const InputSchema = z.object({
  topic: z.string().describe('Tema o idea principal del contenido. Ej: "Departamento en alquiler en Palermo 2 ambientes".'),
  network: z.string().describe('Red social destino: Instagram, Facebook, TikTok, YouTube, LinkedIn, X, WhatsApp Business.'),
  contentType: z.enum(['post', 'story', 'reel', 'video_desc', 'plantilla', 'contenido']).describe('Tipo de contenido a generar.'),
  tone: z.enum(['profesional', 'cercano', 'urgente', 'inspiracional', 'informativo']).describe('Tono del mensaje.'),
  propertyName: z.string().optional().describe('Nombre o dirección de la propiedad, si aplica.'),
  extraContext: z.string().optional().describe('Contexto adicional: precio, superficie, amenities, etc.'),
  brandContext: z.string().optional().describe('Brief de marca de la inmobiliaria — aplicar siempre para mantener coherencia de voz.'),
});

export type GenerateSocialContentInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  mainText: z.string().describe('Texto principal del post, optimizado para la red social indicada.'),
  hashtags: z.string().describe('Hashtags recomendados separados por espacio. Ej: #alquiler #propiedades #buenosaires'),
  callToAction: z.string().describe('Call to action corto. Ej: "Consultanos por DM", "Link en bio".'),
  emojiSuggestion: z.string().describe('2-4 emojis que refuercen el mensaje.'),
  tip: z.string().describe('Consejo rápido de 1 oración para mejorar el rendimiento de este post en esa red.'),
});

export type GenerateSocialContentOutput = z.infer<typeof OutputSchema>;

const CHAR_LIMITS: Record<string, number> = {
  'X': 280,
  'Instagram': 2200,
  'TikTok': 2200,
  'Facebook': 1000,
  'LinkedIn': 1500,
  'YouTube': 300,
  'WhatsApp Business': 500,
};

function buildPrompt(input: GenerateSocialContentInput): string {
  const charLimit = CHAR_LIMITS[input.network] ?? 1000;

  return `Sos un experto en marketing inmobiliario argentino y gestión de redes sociales.
${input.brandContext ? `BRIEF DE MARCA (aplicar en todo el contenido — voz, tono y estilo de esta inmobiliaria):\n${input.brandContext}\n\n` : ''}Generá contenido para ${input.network} con estas características:

- Tema: ${input.topic}
- Tipo: ${input.contentType}
- Tono: ${input.tone}
${input.propertyName ? `- Propiedad: ${input.propertyName}` : ''}
${input.extraContext ? `- Contexto adicional: ${input.extraContext}` : ''}

Reglas:
1. El texto principal NO debe superar ${charLimit} caracteres (límite de ${input.network}).
2. Usá lenguaje argentino natural (vos, ustedes).
3. Adaptá el formato al tipo de contenido (${input.contentType}).
4. Para Instagram/TikTok: usá saltos de línea y emojis estratégicos.
5. Para LinkedIn: tono más formal, foco en datos y valor profesional.
6. Para X: máximo impacto en mínimas palabras.
7. Para WhatsApp Business: mensaje cálido y directo.
8. Los hashtags deben ser relevantes para el mercado inmobiliario argentino.

Devolvé un JSON con exactamente esta estructura:
{
  "mainText": string,
  "hashtags": string,
  "callToAction": string,
  "emojiSuggestion": string,
  "tip": string
}`;
}

export async function generateSocialContent(
  input: GenerateSocialContentInput,
  aiOptions?: AIOptions,
): Promise<GenerateSocialContentOutput> {
  return generateJSON<GenerateSocialContentOutput>(buildPrompt(input), aiOptions);
}
