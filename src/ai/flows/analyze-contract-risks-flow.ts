'use server';
/**
 * Flow de análisis de riesgo legal para contratos de locación argentinos.
 *
 * Evalúa cláusulas contra:
 * - Ley 27.551 (Ley de Alquileres)
 * - DNU 70/2023 (Bases para la Libertad de los Argentinos – Título VI)
 * - CCyCN arts. 1187-1226
 * - Ley 24.240 (Defensa del Consumidor)
 *
 * Devuelve hallazgos con severidad 🔴 crítico / 🟡 importante / 🟢 aceptable
 * y perspectiva adaptable: locador | locatario | garante.
 */

import { ai, createProAI, PRO_MODEL } from '@/ai/genkit';
import { z } from 'genkit';
import { MARCO_LEGAL_ALQUILER } from '@/lib/argentine-law';
import { logAIUsage } from '@/lib/ai-usage-logger';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const RiskFindingSchema = z.object({
  categoria: z.string().describe('Área temática de la cláusula analizada'),
  titulo: z.string().describe('Título breve del hallazgo'),
  descripcion: z.string().describe('Descripción detallada del riesgo o conformidad detectada'),
  severidad: z.enum(['critico', 'importante', 'aceptable']).describe(
    'crítico = viola norma imperativa o expone a nulidad/sanción | importante = cláusula desfavorable o ambigua | aceptable = conforme a derecho'
  ),
  fundamentoLegal: z.string().describe('Artículo o norma concreta que sustenta el hallazgo (ej: "Ley 27.551 art. 13")'),
  recomendacion: z.string().describe('Acción concreta sugerida en español rioplatense'),
  afecta: z.enum(['locador', 'locatario', 'garante', 'todas']).describe('Parte más afectada por este hallazgo'),
});

export type RiskFinding = z.infer<typeof RiskFindingSchema>;

const AnalyzeContractRisksInputSchema = z.object({
  contractText: z.string().describe('Texto completo o transcripción del contrato de locación'),
  contractType: z.enum(['vivienda', 'comercial', 'otro']).default('vivienda').describe('Tipo de contrato'),
  perspective: z.enum(['locador', 'locatario', 'garante', 'neutral']).default('neutral').describe(
    'Perspectiva desde la cual se prioriza el análisis'
  ),
  province: z.string().optional().describe('Provincia donde se ubica el inmueble (para normativa local)'),
});

export type AnalyzeContractRisksInput = z.infer<typeof AnalyzeContractRisksInputSchema>;

const AnalyzeContractRisksOutputSchema = z.object({
  resumenEjecutivo: z.string().describe('Párrafo breve en español rioplatense con la evaluación general del contrato'),
  puntajeLegal: z.number().min(0).max(100).describe('Score 0-100 de conformidad legal (100 = perfectamente ajustado a derecho argentino)'),
  hallazgos: z.array(RiskFindingSchema).describe('Lista de hallazgos ordenados por severidad'),
  clausulasAusentesCriticas: z.array(z.string()).describe('Cláusulas obligatorias que no se encontraron en el contrato'),
  clausulasFavorables: z.array(z.string()).describe('Cláusulas que protegen especialmente a la parte consultante'),
  accionesUrgentes: z.array(z.string()).describe('Acciones que deben tomarse antes de firmar o ejecutar el contrato'),
});

export type AnalyzeContractRisksOutput = z.infer<typeof AnalyzeContractRisksOutputSchema>;

export type AnalyzeContractRisksResult =
  | { ok: true; data: AnalyzeContractRisksOutput }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const analyzeContractRisksPrompt = ai.definePrompt({
  name: 'analyzeContractRisksPrompt',
  input: { schema: AnalyzeContractRisksInputSchema },
  output: { schema: AnalyzeContractRisksOutputSchema },
  prompt: `Sos un abogado especialista en derecho inmobiliario argentino. Analizá el contrato de locación provisto y evaluá su conformidad con el marco legal argentino vigente.

TIPO DE CONTRATO: {{{contractType}}}
PERSPECTIVA DEL ANÁLISIS: {{{perspective}}}
{{#if province}}PROVINCIA: {{{province}}}{{/if}}

${MARCO_LEGAL_ALQUILER}

---

INSTRUCCIONES DE ANÁLISIS:

1. VERIFICÁ OBLIGATORIAMENTE estas cláusulas críticas de la Ley 27.551 y el DNU 70/2023:
   a) DURACIÓN: ¿Cumple el mínimo legal? (vivienda ≥ 24 meses – DNU 70/2023; comercial ≥ 36 meses – CCyCN art. 1198)
   b) GARANTÍAS: ¿El locador pide más de UNA garantía? (ilegal – Ley 27.551 art. 13)
   c) DEPÓSITO: ¿Supera 1 mes de alquiler inicial? (ilegal – Ley 27.551 art. 14)
   d) AJUSTE: ¿El mecanismo es claro? ¿Tiene índice y frecuencia definidos?
   e) RESCISIÓN: ¿Respeta art. 1221 CCyCN? ¿Se penaliza incorrectamente la rescisión anticipada?
   f) EXPENSAS: ¿Se especifica qué paga cada parte? (ordinarias = locatario; extraordinarias = locador)
   g) REPARACIONES: ¿Se especifica quién responde por conservación y reparaciones urgentes?
   h) DOMICILIOS: ¿Están fijados domicilios especiales para notificaciones?
   i) JURISDICCIÓN: ¿Se especifica el fuero y tribunal competente?
   j) INSCRIPCIÓN AFIP: ¿Se menciona la obligación de registrar ante AFIP (Ley 26.307)?

2. SEVERIDADES:
   - 🔴 CRÍTICO: viola norma imperativa → la cláusula es NULA de pleno derecho o expone a sanción. Debe corregirse antes de firmar.
   - 🟡 IMPORTANTE: cláusula desfavorable, ambigua o ausente que puede generar conflicto. Conviene negociarla.
   - 🟢 ACEPTABLE: cláusula conforme a derecho y equilibrada.

3. PERSPECTIVA: Si la perspectiva es "locatario", priorizá riesgos para el inquilino. Si es "locador", priorizá riesgos para el propietario. Si es "garante", prestá especial atención a la extensión de la garantía y límites de responsabilidad. Si es "neutral", analizá equilibradamente.

4. PUNTAJE LEGAL:
   - Restá 20 puntos por cada hallazgo CRÍTICO
   - Restá 5 puntos por cada hallazgo IMPORTANTE
   - Sumá 5 puntos por cada cláusula favorable detectada
   - Máximo 100, mínimo 0

5. TONO: formal, jurídico, español rioplatense. Usá "voseo". Sé específico (citá artículos exactos).

CONTRATO A ANALIZAR:
"""
{{{contractText}}}
"""
`,
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW
// ─────────────────────────────────────────────────────────────────────────────

const analyzeContractRisksFlow = ai.defineFlow(
  {
    name: 'analyzeContractRisksFlow',
    inputSchema: AnalyzeContractRisksInputSchema,
    outputSchema: AnalyzeContractRisksOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeContractRisksPrompt(input);
    if (!output) throw new Error('La IA no pudo analizar el contrato.');
    return output;
  }
);

export async function analyzeContractRisks(
  input: AnalyzeContractRisksInput,
  userApiKey?: string,
  userId?: string,
): Promise<AnalyzeContractRisksResult> {
  const model = userApiKey ? PRO_MODEL : 'gemini-2.0-flash';
  try {
    if (userApiKey) {
      const proAI = createProAI(userApiKey);
      const prompt = `Sos un abogado especialista en derecho inmobiliario argentino. Analizá el contrato de locación provisto y evaluá su conformidad con el marco legal argentino vigente.

TIPO DE CONTRATO: ${input.contractType}
PERSPECTIVA DEL ANÁLISIS: ${input.perspective}
${input.province ? `PROVINCIA: ${input.province}` : ''}

${MARCO_LEGAL_ALQUILER}

---

INSTRUCCIONES DE ANÁLISIS:

1. VERIFICÁ OBLIGATORIAMENTE estas cláusulas críticas de la Ley 27.551 y el DNU 70/2023:
   a) DURACIÓN: ¿Cumple el mínimo legal? (vivienda ≥ 24 meses – DNU 70/2023; comercial ≥ 36 meses – CCyCN art. 1198)
   b) GARANTÍAS: ¿El locador pide más de UNA garantía? (ilegal – Ley 27.551 art. 13)
   c) DEPÓSITO: ¿Supera 1 mes de alquiler inicial? (ilegal – Ley 27.551 art. 14)
   d) AJUSTE: ¿El mecanismo es claro? ¿Tiene índice y frecuencia definidos?
   e) RESCISIÓN: ¿Respeta art. 1221 CCyCN? ¿Se penaliza incorrectamente la rescisión anticipada?
   f) EXPENSAS: ¿Se especifica qué paga cada parte? (ordinarias = locatario; extraordinarias = locador)
   g) REPARACIONES: ¿Se especifica quién responde por conservación y reparaciones urgentes?
   h) DOMICILIOS: ¿Están fijados domicilios especiales para notificaciones?
   i) JURISDICCIÓN: ¿Se especifica el fuero y tribunal competente?
   j) INSCRIPCIÓN AFIP: ¿Se menciona la obligación de registrar ante AFIP (Ley 26.307)?

2. SEVERIDADES:
   - 🔴 CRÍTICO: viola norma imperativa → la cláusula es NULA de pleno derecho o expone a sanción.
   - 🟡 IMPORTANTE: cláusula desfavorable, ambigua o ausente que puede generar conflicto.
   - 🟢 ACEPTABLE: cláusula conforme a derecho y equilibrada.

3. PERSPECTIVA: Si es "locatario", priorizá riesgos para el inquilino. Si es "locador", para el propietario. Si es "garante", la extensión de la garantía. Si es "neutral", analizá equilibradamente.

4. PUNTAJE LEGAL:
   - Restá 20 puntos por cada hallazgo CRÍTICO
   - Restá 5 puntos por cada hallazgo IMPORTANTE
   - Sumá 5 puntos por cada cláusula favorable detectada
   - Máximo 100, mínimo 0

5. TONO: formal, jurídico, español rioplatense. Usá "voseo". Sé específico (citá artículos exactos).

CONTRATO A ANALIZAR:
"""
${input.contractText}
"""`;
      const { output } = await proAI.generate({ prompt, output: { schema: AnalyzeContractRisksOutputSchema } });
      if (!output) throw new Error('La IA Pro no pudo analizar el contrato.');
      if (userId) void logAIUsage(userId, 'analyze-contract-risks', model, true, true);
      return { ok: true, data: output };
    }
    const data = await analyzeContractRisksFlow(input);
    if (userId) void logAIUsage(userId, 'analyze-contract-risks', model, false, true);
    return { ok: true, data };
  } catch (err: any) {
    if (userId) void logAIUsage(userId, 'analyze-contract-risks', model, !!userApiKey, false);
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Verificá tu API key en Configuración.' };
    }
    return { ok: false, error: msg || 'No se pudo analizar el contrato.' };
  }
}
