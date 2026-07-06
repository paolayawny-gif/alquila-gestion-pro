'use server';
/**
 * Flow para responder preguntas específicas sobre un contrato de locación,
 * con soporte de perspectiva (locador / locatario / garante / neutral)
 * y referencias al marco legal argentino vigente.
 */

import { z } from 'zod';
import { generateJSON, type AIOptions } from '@/ai/gemini';
import { MARCO_LEGAL_ALQUILER } from '@/lib/argentine-law';

const QueryContractInputSchema = z.object({
  contractTranscription: z.string().describe('Transcripción completa del contrato de locación.'),
  question: z.string().describe('Pregunta del usuario sobre el contrato.'),
  perspective: z.enum(['locador', 'locatario', 'garante', 'neutral']).default('neutral').describe(
    'Perspectiva desde la cual se responde: locador (propietario), locatario (inquilino), garante o neutral.'
  ),
  contractType: z.enum(['vivienda', 'comercial', 'otro']).default('vivienda'),
});

export type QueryContractInput = z.infer<typeof QueryContractInputSchema>;

const QueryContractOutputSchema = z.object({
  answer: z.string().describe('Respuesta basada exclusivamente en el texto del contrato, con contexto legal argentino si corresponde.'),
  sourceQuote: z.string().optional().describe('Cita literal del contrato que sustenta la respuesta.'),
  fundamentoLegal: z.string().optional().describe('Artículo o norma argentina que complementa o corrige lo pactado, si es relevante.'),
  alertaLegal: z.string().optional().describe('Advertencia si lo pactado en el contrato contradice la normativa argentina vigente.'),
});

export type QueryContractOutput = z.infer<typeof QueryContractOutputSchema>;

export type QueryContractResult =
  | { ok: true; data: QueryContractOutput }
  | { ok: false; error: string };

const PERSPECTIVA_TEXTO: Record<string, string> = {
  locador: 'Respondé desde la perspectiva del LOCADOR (propietario del inmueble). Destacá qué derechos y obligaciones tiene el locador según el contrato y la ley.',
  locatario: 'Respondé desde la perspectiva del LOCATARIO (inquilino). Destacá qué derechos y protecciones tiene el inquilino según el contrato y la ley argentina.',
  garante: 'Respondé desde la perspectiva del GARANTE (fiador). Destacá el alcance de su responsabilidad, límites y condiciones según el contrato.',
  neutral: 'Respondé de forma neutral y equilibrada, sin tomar partido por ninguna de las partes.',
};

function buildPrompt(input: QueryContractInput): string {
  const perspectivaTxt = PERSPECTIVA_TEXTO[input.perspective] ?? PERSPECTIVA_TEXTO.neutral;

  return `Sos un abogado especialista en derecho inmobiliario argentino. Respondé la pregunta del usuario sobre el contrato de locación.

PERSPECTIVA: ${input.perspective}
INSTRUCCIÓN DE PERSPECTIVA: ${perspectivaTxt}
TIPO DE CONTRATO: ${input.contractType}

MARCO LEGAL ARGENTINO DE REFERENCIA:
${MARCO_LEGAL_ALQUILER}

INSTRUCCIONES:
1. Respondé SIEMPRE en español rioplatense (voseo).
2. Basate PRINCIPALMENTE en el texto del contrato proporcionado.
3. Si el contrato no contiene la información, decilo claramente: "Esta información no está especificada en el contrato."
4. Si la cláusula relevante contradice la normativa argentina vigente, indicalo en "alertaLegal" con la norma exacta.
5. Si podés agregar contexto legal relevante (un artículo que ampara o limita lo pactado), incluilo en "fundamentoLegal".
6. Siempre que sea posible, citá la cláusula exacta en "sourceQuote".
7. Sé preciso y directo. No des respuestas genéricas.

Devolvé un JSON con exactamente esta estructura:
{
  "answer": string,
  "sourceQuote": string (opcional),
  "fundamentoLegal": string (opcional),
  "alertaLegal": string (opcional)
}

TRANSCRIPCIÓN DEL CONTRATO:
"""
${input.contractTranscription}
"""

PREGUNTA DEL USUARIO:
${input.question}`;
}

export async function queryContract(input: QueryContractInput, aiOptions?: AIOptions): Promise<QueryContractResult> {
  try {
    const data = await generateJSON<QueryContractOutput>(buildPrompt(input), aiOptions);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Contactá al administrador.' };
    }
    return { ok: false, error: msg || 'No se pudo obtener respuesta de la IA.' };
  }
}
