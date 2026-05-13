'use server';
/**
 * Flow de comparación de contrato contra estándares de mercado argentino.
 *
 * Compara las condiciones pactadas contra:
 * - Los modelos de contratos incluidos en la plataforma (Ley 27.551 + DNU 70/2023)
 * - Prácticas habituales del mercado inmobiliario argentino
 * - Índices referenciales actuales (ICL, IPC, CER)
 *
 * Ayuda a detectar si una cláusula es muy favorable o muy desfavorable
 * respecto de lo que se pacta habitualmente en el mercado.
 */

import { ai, createProAI } from '@/ai/genkit';
import { z } from 'genkit';
import { MARCO_LEGAL_ALQUILER, AJUSTE } from '@/lib/argentine-law';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const MarketComparisonItemSchema = z.object({
  campo: z.string().describe('Campo o condición analizada (ej: "Depósito", "Frecuencia de ajuste", "Penalidad por mora")'),
  valorContrato: z.string().describe('Valor o condición según el contrato analizado'),
  estandarMercado: z.string().describe('Lo que es habitual en el mercado inmobiliario argentino'),
  evaluacion: z.enum(['favorable', 'neutro', 'desfavorable', 'muy_favorable', 'muy_desfavorable']).describe(
    'Evaluación para la perspectiva solicitada'
  ),
  brecha: z.string().describe('Descripción de qué tan distante está del estándar y por qué importa'),
  negociable: z.boolean().describe('Si esta condición es típicamente negociable en el mercado'),
});

export type MarketComparisonItem = z.infer<typeof MarketComparisonItemSchema>;

const CompareMarketStandardInputSchema = z.object({
  contractText: z.string().describe('Texto completo o transcripción del contrato'),
  contractType: z.enum(['vivienda', 'comercial', 'otro']).default('vivienda'),
  perspective: z.enum(['locador', 'locatario', 'garante']).default('locatario'),
  propertyZone: z.string().optional().describe('Zona o barrio del inmueble (ej: "Palermo, CABA", "Rosario Centro")'),
  currency: z.enum(['ARS', 'USD']).optional(),
  extractedRentAmount: z.number().optional().describe('Monto de alquiler ya extraído del contrato'),
  extractedDurationMonths: z.number().optional().describe('Duración en meses ya extraída'),
});

export type CompareMarketStandardInput = z.infer<typeof CompareMarketStandardInputSchema>;

const CompareMarketStandardOutputSchema = z.object({
  dictamenGeneral: z.string().describe('Evaluación general del contrato respecto al mercado, en español rioplatense'),
  puntajeEquilibrio: z.number().min(0).max(100).describe(
    'Score de equilibrio: 50 = completamente estándar; >50 = favorable para la perspectiva solicitada; <50 = desfavorable'
  ),
  comparaciones: z.array(MarketComparisonItemSchema),
  puntosNegociacion: z.array(z.string()).describe('Condiciones que convenía negociar antes de firmar, en orden de prioridad'),
  alertasEspeciales: z.array(z.string()).describe('Cláusulas inusuales o que no se ven habitualmente en el mercado'),
  resumenPorArea: z.object({
    precio: z.enum(['favorable', 'neutro', 'desfavorable']).describe('Evaluación del canon y ajuste'),
    plazo: z.enum(['favorable', 'neutro', 'desfavorable']).describe('Evaluación de la duración'),
    garantias: z.enum(['favorable', 'neutro', 'desfavorable']).describe('Evaluación del sistema de garantías'),
    obligaciones: z.enum(['favorable', 'neutro', 'desfavorable']).describe('Evaluación del balance de obligaciones'),
    salida: z.enum(['favorable', 'neutro', 'desfavorable']).describe('Evaluación de condiciones de rescisión y salida'),
  }),
});

export type CompareMarketStandardOutput = z.infer<typeof CompareMarketStandardOutputSchema>;

export type CompareMarketStandardResult =
  | { ok: true; data: CompareMarketStandardOutput }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const indicesRef = AJUSTE.indicesComunes.map(i => `${i.codigo} (${i.fuente})`).join(', ');

const compareMarketStandardPrompt = ai.definePrompt({
  name: 'compareMarketStandardPrompt',
  input: { schema: CompareMarketStandardInputSchema },
  output: { schema: CompareMarketStandardOutputSchema },
  prompt: `Sos un asesor inmobiliario y abogado argentino con amplia experiencia en el mercado de alquileres. Analizá el contrato y comparalo contra los estándares habituales del mercado inmobiliario argentino en 2024-2025.

TIPO: {{{contractType}}}
PERSPECTIVA: {{{perspective}}} (evaluá desde el punto de vista de esta parte)
{{#if propertyZone}}ZONA: {{{propertyZone}}}{{/if}}
{{#if currency}}MONEDA: {{{currency}}}{{/if}}

${MARCO_LEGAL_ALQUILER}

ESTÁNDARES DE MERCADO ACTUALES (Argentina, 2024-2025):
- Índices de ajuste habituales: ${indicesRef}
- Frecuencia de ajuste post-DNU 70/2023: libre, pero lo más común es mensual o trimestral para ARS; semestral o anual para USD
- Depósito estándar: 1 mes (máximo legal); algunos propietarios aceptan menos en USD
- Plazo estándar vivienda: 24-36 meses
- Plazo estándar comercial: 36-48 meses
- Penalidad por mora: entre 1% y 3% mensual sobre el saldo adeudado
- Expensas ordinarias: siempre a cargo del locatario por costumbre y ley
- Expensas extraordinarias: siempre a cargo del locador por ley y práctica
- ABL/TGI: habitualmente a cargo del locador en CABA y PBA; puede pactarse a cargo del locatario en locales comerciales
- Subalquiler: casi universalmente prohibido en vivienda; admitido con permiso en comercios
- Seguro de incendio: siempre obligatorio a cargo del locatario por ley
- Preaviso de renovación: 60-90 días antes del vencimiento es estándar
- Rescisión anticipada: art. 1221 CCyCN – penalidad 1 mes y medio (primer año) o 1 mes (años siguientes)

COMPARAR OBLIGATORIAMENTE:
1. Canon mensual y frecuencia de ajuste vs. práctica de mercado
2. Duración vs. estándar del tipo de contrato
3. Sistema de garantías vs. práctica habitual
4. Depósito vs. máximo legal y práctica
5. Distribución de gastos (expensas, servicios, impuestos) vs. práctica
6. Penalidades por mora vs. rangos habituales
7. Condiciones de rescisión vs. art. 1221 CCyCN y práctica
8. Cláusulas especiales inusuales que no se ven habitualmente

TONO: profesional, directo, en español rioplatense. El objetivo es ayudar a la parte a entender si firmó/firmará un contrato equilibrado o si hay condiciones que debería haber negociado.

CONTRATO:
"""
{{{contractText}}}
"""
`,
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW
// ─────────────────────────────────────────────────────────────────────────────

const compareMarketStandardFlow = ai.defineFlow(
  {
    name: 'compareMarketStandardFlow',
    inputSchema: CompareMarketStandardInputSchema,
    outputSchema: CompareMarketStandardOutputSchema,
  },
  async (input) => {
    const { output } = await compareMarketStandardPrompt(input);
    if (!output) throw new Error('La IA no pudo comparar el contrato con el estándar de mercado.');
    return output;
  }
);

export async function compareMarketStandard(
  input: CompareMarketStandardInput,
  userApiKey?: string,
): Promise<CompareMarketStandardResult> {
  try {
    if (userApiKey) {
      const proAI = createProAI(userApiKey);
      const prompt = `Sos un asesor inmobiliario y abogado argentino con amplia experiencia en el mercado de alquileres. Analizá el contrato y comparalo contra los estándares habituales del mercado inmobiliario argentino en 2024-2025.

TIPO: ${input.contractType}
PERSPECTIVA: ${input.perspective} (evaluá desde el punto de vista de esta parte)
${input.propertyZone ? `ZONA: ${input.propertyZone}` : ''}
${input.currency ? `MONEDA: ${input.currency}` : ''}

${MARCO_LEGAL_ALQUILER}

ESTÁNDARES DE MERCADO ACTUALES (Argentina, 2024-2025):
- Índices de ajuste habituales: ${indicesRef}
- Frecuencia de ajuste post-DNU 70/2023: libre, pero lo más común es mensual o trimestral para ARS; semestral o anual para USD
- Depósito estándar: 1 mes (máximo legal); algunos propietarios aceptan menos en USD
- Plazo estándar vivienda: 24-36 meses
- Plazo estándar comercial: 36-48 meses
- Penalidad por mora: entre 1% y 3% mensual sobre el saldo adeudado
- Expensas ordinarias: siempre a cargo del locatario por costumbre y ley
- Expensas extraordinarias: siempre a cargo del locador por ley y práctica
- ABL/TGI: habitualmente a cargo del locador en CABA y PBA
- Subalquiler: casi universalmente prohibido en vivienda
- Seguro de incendio: siempre obligatorio a cargo del locatario por ley
- Preaviso de renovación: 60-90 días antes del vencimiento es estándar
- Rescisión anticipada: art. 1221 CCyCN – penalidad 1 mes y medio (primer año) o 1 mes (años siguientes)

COMPARAR OBLIGATORIAMENTE:
1. Canon mensual y frecuencia de ajuste vs. práctica de mercado
2. Duración vs. estándar del tipo de contrato
3. Sistema de garantías vs. práctica habitual
4. Depósito vs. máximo legal y práctica
5. Distribución de gastos (expensas, servicios, impuestos) vs. práctica
6. Penalidades por mora vs. rangos habituales
7. Condiciones de rescisión vs. art. 1221 CCyCN y práctica
8. Cláusulas especiales inusuales que no se ven habitualmente

TONO: profesional, directo, en español rioplatense.

CONTRATO:
"""
${input.contractText}
"""`;
      const { output } = await proAI.generate({ prompt, output: { schema: CompareMarketStandardOutputSchema } });
      if (!output) throw new Error('La IA Pro no pudo comparar el contrato con el estándar de mercado.');
      return { ok: true, data: output };
    }
    const data = await compareMarketStandardFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Verificá tu API key en Configuración.' };
    }
    return { ok: false, error: msg || 'No se pudo realizar la comparación de mercado.' };
  }
}
