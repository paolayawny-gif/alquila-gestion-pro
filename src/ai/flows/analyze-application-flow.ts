'use server';
/**
 * Flow para analizar solicitudes de alquiler con contexto argentino.
 *
 * Evalúa la viabilidad financiera y legal del postulante considerando:
 * - Situación laboral argentina (relación de dependencia, monotributo, autónomo, informal)
 * - Ratio ingreso/alquiler adaptado al mercado argentino
 * - Tipos de garantía válidos (Ley 27.551 art. 13)
 * - Situación BCRA del postulante (si está disponible)
 */

import { ai, createProAI, PRO_MODEL } from '@/ai/genkit';
import { logAIUsage } from '@/lib/ai-usage-logger';
import { z } from 'genkit';

const AnalyzeApplicationInputSchema = z.object({
  applicantName: z.string().describe('Nombre completo del postulante.'),
  applicantIncome: z.number().describe('Ingreso mensual neto declarado.'),
  rentAmount: z.number().describe('Canon mensual del alquiler pretendido.'),
  currency: z.string().describe('Moneda del alquiler (ARS o USD).'),
  employmentType: z.enum([
    'relacion_dependencia',
    'monotributo',
    'autonomo',
    'jubilado_pensionado',
    'informal',
    'sin_informar',
  ]).optional().describe('Tipo de situación laboral/fiscal del postulante.'),
  monotributoCategory: z.string().optional().describe('Categoría de monotributo si aplica (A, B, C, D, E, F, G, H, I, J, K).'),
  guarantorName: z.string().optional().describe('Nombre del fiador o garante.'),
  guarantorType: z.enum([
    'fiador_solidario',
    'seguro_caucion',
    'aval_bancario',
    'garantia_real',
    'sin_garantia',
  ]).optional().describe('Tipo de garantía ofrecida (Ley 27.551 art. 13).'),
  guarantorIncome: z.number().optional().describe('Ingreso mensual del garante.'),
  bcraSituation: z.number().min(1).max(6).optional().describe(
    'Situación BCRA del postulante (1=Normal, 2=Riesgo Bajo, 3=Riesgo Medio, 4=Alto Riesgo, 5=Irrecuperable, 6=Irrecuperable con quita).'
  ),
  hasRejectedChecks: z.boolean().optional().describe('¿El postulante tiene cheques rechazados en el BCRA?'),
  references: z.string().optional().describe('Notas adicionales, referencias de anteriores propietarios, etc.'),
  propertyType: z.enum(['vivienda', 'comercial', 'otro']).optional(),
});

export type AnalyzeApplicationInput = z.infer<typeof AnalyzeApplicationInputSchema>;

const AnalyzeApplicationOutputSchema = z.object({
  score: z.number().min(0).max(100).describe('Score 0-100 de viabilidad financiera y legal.'),
  recommendation: z.enum(['APROBADO', 'APROBADO_CON_CONDICIONES', 'REQUIERE_CODEUDOR', 'RECHAZADO']).describe(
    'Recomendación final sobre la solicitud.'
  ),
  reasoning: z.string().describe('Explicación detallada en español rioplatense de la decisión.'),
  riskFactors: z.array(z.string()).describe('Factores de riesgo detectados, ordenados por criticidad.'),
  condicionesAprobacion: z.array(z.string()).describe(
    'Condiciones sugeridas para aprobar si la recomendación es APROBADO_CON_CONDICIONES o REQUIERE_CODEUDOR.'
  ),
  garantiaAdecuada: z.boolean().describe('¿La garantía ofrecida es admisible según Ley 27.551 art. 13?'),
  alertasLegales: z.array(z.string()).describe('Alertas sobre aspectos legales a verificar antes de contratar.'),
});

export type AnalyzeApplicationOutput = z.infer<typeof AnalyzeApplicationOutputSchema>;

const analyzeApplicationPrompt = ai.definePrompt({
  name: 'analyzeApplicationPrompt',
  input: { schema: AnalyzeApplicationInputSchema },
  output: { schema: AnalyzeApplicationOutputSchema },
  prompt: `Sos un analista de riesgo crediticio especializado en el mercado inmobiliario argentino. Analizá la siguiente solicitud de alquiler.

POSTULANTE: {{{applicantName}}}
TIPO DE INMUEBLE: {{#if propertyType}}{{{propertyType}}}{{else}}vivienda{{/if}}
ALQUILER PRETENDIDO: {{{currency}}} {{{rentAmount}}}
INGRESO NETO DECLARADO: {{{currency}}} {{{applicantIncome}}}
{{#if employmentType}}SITUACIÓN LABORAL: {{{employmentType}}}{{/if}}
{{#if monotributoCategory}}CATEGORÍA MONOTRIBUTO: {{{monotributoCategory}}}{{/if}}
{{#if guarantorName}}GARANTE: {{{guarantorName}}} (Tipo: {{{guarantorType}}}{{#if guarantorIncome}}, Ingreso: {{{currency}}} {{{guarantorIncome}}}{{/if}}){{/if}}
{{#if bcraSituation}}SITUACIÓN BCRA: {{{bcraSituation}}} (1=Normal ... 6=Irrecuperable){{/if}}
{{#if hasRejectedChecks}}CHEQUES RECHAZADOS EN BCRA: Sí{{/if}}
{{#if references}}REFERENCIAS/NOTAS: {{{references}}}{{/if}}

CRITERIOS DE EVALUACIÓN PARA ARGENTINA:

1. RATIO INGRESO/ALQUILER (regla principal):
   - Ideal: alquiler ≤ 30% del ingreso neto
   - Aceptable: alquiler entre 30-40% del ingreso neto
   - Riesgoso: alquiler entre 40-50% del ingreso neto → REQUIERE_CODEUDOR
   - Inaceptable: alquiler > 50% del ingreso neto → RECHAZADO salvo garantías excepcionales

2. TIPO DE EMPLEO (confiabilidad del ingreso declarado):
   - relacion_dependencia: Alta confiabilidad. Ingreso verificable por recibo de sueldo.
   - monotributo: Media confiabilidad. Ingreso no garantizado, sujeto a facturación real. Verificar facturación AFIP.
     * Monotributo A-B (hasta ~$800K/mes): ingreso real puede ser bajo
     * Monotributo E-K: mayor ingreso probable
   - autonomo: Media confiabilidad. Verificar declaración jurada AFIP (Formulario 711).
   - jubilado_pensionado: Alta confiabilidad. Ingreso fijo del ANSES.
   - informal: Baja confiabilidad. Sin respaldo documental oficial.
   - sin_informar: Requiere documentación antes de aprobar.

3. GARANTÍAS (Ley 27.551 art. 13 – el locador solo puede exigir UNA):
   - fiador_solidario: Fuerte si el fiador tiene ingreso demostrado en relación de dependencia.
   - seguro_caucion: Muy fuerte. Empresa habilitada por SSN responde automáticamente.
   - aval_bancario: Muy fuerte. Banco responde por el locatario.
   - garantia_real: Fuerte si el bien vale >3x el monto total del contrato.
   - sin_garantia: Riesgo alto para el locador.

4. SITUACIÓN BCRA:
   - Situación 1 (Normal): Sin impacto.
   - Situación 2: Leve alerta, exigir documentación adicional.
   - Situación 3: Riesgo significativo → REQUIERE_CODEUDOR mínimo.
   - Situación 4-5: RECHAZADO a menos que haya garantía excepcional.
   - Situación 6 o cheques rechazados: RECHAZADO.

5. SCORE 0-100:
   - Comenzar en 70.
   - +10 si ratio < 30%.
   - -10 si ratio 40-50%; -25 si ratio > 50%.
   - +10 si seguro_caucion o aval_bancario.
   - +5 si fiador_solidario con ingreso verificado.
   - -15 si sin_garantia.
   - +10 si relacion_dependencia; -5 si informal; -10 si sin_informar.
   - -20 si BCRA ≥ 4; -10 si BCRA = 3; -5 si BCRA = 2.
   - -20 si cheques rechazados.

TONO: profesional, en español rioplatense. Sé específico con los números. Brindá recomendaciones accionables al propietario o inmobiliaria.
`,
});

const analyzeApplicationFlow = ai.defineFlow(
  {
    name: 'analyzeApplicationFlow',
    inputSchema: AnalyzeApplicationInputSchema,
    outputSchema: AnalyzeApplicationOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeApplicationPrompt(input);
    if (!output) throw new Error('El análisis falló.');
    return output;
  }
);

export async function analyzeApplication(
  input: AnalyzeApplicationInput,
  userApiKey?: string,
  userId?: string,
): Promise<AnalyzeApplicationOutput> {
  const model = userApiKey ? PRO_MODEL : 'gemini-2.0-flash';
  if (userApiKey) {
    const proAI = createProAI(userApiKey);
    const prompt = `Sos un analista de riesgo crediticio especializado en el mercado inmobiliario argentino. Analizá la siguiente solicitud de alquiler.

POSTULANTE: ${input.applicantName}
TIPO DE INMUEBLE: ${input.propertyType ?? 'vivienda'}
ALQUILER PRETENDIDO: ${input.currency} ${input.rentAmount}
INGRESO NETO DECLARADO: ${input.currency} ${input.applicantIncome}
${input.employmentType ? `SITUACIÓN LABORAL: ${input.employmentType}` : ''}
${input.monotributoCategory ? `CATEGORÍA MONOTRIBUTO: ${input.monotributoCategory}` : ''}
${input.guarantorName ? `GARANTE: ${input.guarantorName} (Tipo: ${input.guarantorType}${input.guarantorIncome ? `, Ingreso: ${input.currency} ${input.guarantorIncome}` : ''})` : ''}
${input.bcraSituation ? `SITUACIÓN BCRA: ${input.bcraSituation} (1=Normal ... 6=Irrecuperable)` : ''}
${input.hasRejectedChecks ? 'CHEQUES RECHAZADOS EN BCRA: Sí' : ''}
${input.references ? `REFERENCIAS/NOTAS: ${input.references}` : ''}

CRITERIOS DE EVALUACIÓN PARA ARGENTINA:

1. RATIO INGRESO/ALQUILER:
   - Ideal: alquiler ≤ 30% del ingreso neto
   - Aceptable: 30-40%
   - Riesgoso: 40-50% → REQUIERE_CODEUDOR
   - Inaceptable: > 50% → RECHAZADO salvo garantías excepcionales

2. TIPO DE EMPLEO:
   - relacion_dependencia: Alta confiabilidad
   - monotributo: Media confiabilidad. Verificar facturación AFIP
   - autonomo: Media confiabilidad. Verificar DDJJ AFIP
   - jubilado_pensionado: Alta confiabilidad
   - informal: Baja confiabilidad
   - sin_informar: Requiere documentación

3. GARANTÍAS (Ley 27.551 art. 13 – el locador solo puede exigir UNA):
   - fiador_solidario: Fuerte si tiene ingreso en relación de dependencia
   - seguro_caucion: Muy fuerte
   - aval_bancario: Muy fuerte
   - garantia_real: Fuerte si el bien vale >3x el monto total
   - sin_garantia: Riesgo alto

4. SITUACIÓN BCRA:
   - 1=Normal: Sin impacto
   - 2: Leve alerta
   - 3: Riesgo significativo → REQUIERE_CODEUDOR mínimo
   - 4-5: RECHAZADO salvo garantía excepcional
   - 6 o cheques rechazados: RECHAZADO

5. SCORE 0-100: Comenzar en 70. +10 si ratio<30%; -10 si 40-50%; -25 si >50%. +10 si seguro_caucion/aval_bancario. +5 si fiador_solidario. -15 si sin_garantia. +10 si relacion_dependencia; -5 si informal; -10 si sin_informar. -20 si BCRA≥4; -10 si BCRA=3; -5 si BCRA=2. -20 si cheques rechazados.

TONO: profesional, español rioplatense. Sé específico con los números.`;
    const { output } = await proAI.generate({ prompt, output: { schema: AnalyzeApplicationOutputSchema } });
    if (!output) throw new Error('El análisis Pro falló.');
    if (userId) void logAIUsage(userId, 'analyze-application', model, true, true);
    return output;
  }
  const result = await analyzeApplicationFlow(input);
  if (userId) void logAIUsage(userId, 'analyze-application', model, false, true);
  return result;
}
