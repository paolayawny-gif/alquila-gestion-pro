'use server';
/**
 * Flow de verificación de coherencia interna en contratos de locación.
 *
 * Detecta contradicciones entre cláusulas, diferencias entre el cuerpo
 * del contrato y sus anexos, y datos inconsistentes que podrían invalidar
 * cláusulas específicas o el contrato en su totalidad.
 */

import { ai, createProAI } from '@/ai/genkit';
import { z } from 'genkit';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const InconsistencySchema = z.object({
  tipo: z.enum(['contradiccion', 'dato_faltante', 'ambiguedad', 'error_formal']).describe(
    'contradiccion = dos cláusulas dicen cosas distintas | dato_faltante = información obligatoria ausente | ambiguedad = redacción que puede interpretarse de múltiples formas | error_formal = error en formato de fecha, CUIT, número'
  ),
  ubicacion: z.string().describe('Dónde aparece la inconsistencia (ej: "Cláusula 3 vs. Cláusula 7", "Encabezado vs. Cláusula 1")'),
  descripcion: z.string().describe('Descripción precisa de la inconsistencia detectada'),
  impactoLegal: z.string().describe('Consecuencia jurídica posible de esta inconsistencia en Argentina'),
  correccionSugerida: z.string().describe('Texto corregido o forma de resolver la inconsistencia'),
  gravedad: z.enum(['alta', 'media', 'baja']).describe('alta = puede anular la cláusula | media = puede generar conflicto interpretativo | baja = error menor sin impacto sustancial'),
});

export type Inconsistency = z.infer<typeof InconsistencySchema>;

const VerifyContractConsistencyInputSchema = z.object({
  contractText: z.string().describe('Texto completo del contrato de locación (puede incluir cuerpo + anexos)'),
  contractType: z.enum(['vivienda', 'comercial', 'otro']).default('vivienda'),
  extractedData: z.object({
    baseRentAmount: z.number().optional(),
    currency: z.string().optional(),
    adjustmentFrequencyMonths: z.number().optional(),
    adjustmentMechanism: z.string().optional(),
    tenantName: z.string().optional(),
    propertyAddress: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional().describe('Datos ya extraídos del contrato para verificación cruzada'),
});

export type VerifyContractConsistencyInput = z.infer<typeof VerifyContractConsistencyInputSchema>;

const VerifyContractConsistencyOutputSchema = z.object({
  esCoherente: z.boolean().describe('true si no se detectaron inconsistencias graves'),
  resumen: z.string().describe('Resumen breve de la verificación en español rioplatense'),
  inconsistencias: z.array(InconsistencySchema),
  datosVerificados: z.object({
    montosConsistentes: z.boolean().describe('Los montos mencionados en distintas cláusulas son consistentes entre sí'),
    fechasConsistentes: z.boolean().describe('Las fechas de inicio, fin y duración son coherentes'),
    partesConsistentes: z.boolean().describe('Los nombres y documentos de las partes son consistentes en todo el texto'),
    indiceConsistente: z.boolean().describe('El mecanismo de ajuste es consistente en todas las menciones'),
  }),
  recomendacionFirma: z.enum(['apta_para_firma', 'revisar_antes_de_firmar', 'no_firmar']).describe(
    'Recomendación final sobre si el contrato puede firmarse tal como está'
  ),
});

export type VerifyContractConsistencyOutput = z.infer<typeof VerifyContractConsistencyOutputSchema>;

export type VerifyContractConsistencyResult =
  | { ok: true; data: VerifyContractConsistencyOutput }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const verifyContractConsistencyPrompt = ai.definePrompt({
  name: 'verifyContractConsistencyPrompt',
  input: { schema: VerifyContractConsistencyInputSchema },
  output: { schema: VerifyContractConsistencyOutputSchema },
  prompt: `Sos un escribano público argentino especialista en revisión de contratos de locación. Tu tarea es verificar la coherencia interna del siguiente contrato, detectando contradicciones, datos faltantes, ambigüedades y errores formales.

TIPO: {{{contractType}}}

{{#if extractedData}}
DATOS PREVIAMENTE EXTRAÍDOS (verificar coherencia contra el texto):
{{#if extractedData.baseRentAmount}}- Monto base: {{extractedData.currency}} {{extractedData.baseRentAmount}}{{/if}}
{{#if extractedData.tenantName}}- Locatario: {{extractedData.tenantName}}{{/if}}
{{#if extractedData.propertyAddress}}- Inmueble: {{extractedData.propertyAddress}}{{/if}}
{{#if extractedData.startDate}}- Inicio: {{extractedData.startDate}}{{/if}}
{{#if extractedData.endDate}}- Fin: {{extractedData.endDate}}{{/if}}
{{#if extractedData.adjustmentMechanism}}- Índice: {{extractedData.adjustmentMechanism}} cada {{extractedData.adjustmentFrequencyMonths}} meses{{/if}}
{{/if}}

ASPECTOS A VERIFICAR OBLIGATORIAMENTE:
1. ¿El monto en letras coincide con el monto en números?
2. ¿La fecha de inicio + duración = fecha de fin?
3. ¿El nombre del locatario en el encabezado coincide con el mencionado en el resto del contrato?
4. ¿El nombre del locador es consistente en todas las menciones?
5. ¿El domicilio del inmueble es idéntico en todas las cláusulas que lo mencionan?
6. ¿El mecanismo de ajuste (ICL/IPC/CER) mencionado en una cláusula coincide con el mencionado en otras?
7. ¿La frecuencia de ajuste es consistente?
8. ¿Los CUITs/DNIs mencionados tienen formato válido (CUIT: 11 dígitos; DNI: 7-8 dígitos)?
9. ¿El monto del depósito en cláusula de garantía coincide con el mencionado en el acta de recibo?
10. ¿Las penalidades por mora son consistentes en todo el documento?
11. ¿Si hay anexos, sus datos son coherentes con el cuerpo principal?
12. ¿Hay contradicciones entre cláusulas sobre quién paga expensas ordinarias/extraordinarias?
13. ¿Hay cláusulas que se contradigan en materia de subalquiler o cesión?
14. ¿La jurisdicción mencionada corresponde a la ubicación del inmueble?

TONO: técnico-jurídico, español rioplatense. Sé específico y citá las cláusulas exactas donde encontrés inconsistencias.

CONTRATO:
"""
{{{contractText}}}
"""
`,
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW
// ─────────────────────────────────────────────────────────────────────────────

const verifyContractConsistencyFlow = ai.defineFlow(
  {
    name: 'verifyContractConsistencyFlow',
    inputSchema: VerifyContractConsistencyInputSchema,
    outputSchema: VerifyContractConsistencyOutputSchema,
  },
  async (input) => {
    const { output } = await verifyContractConsistencyPrompt(input);
    if (!output) throw new Error('La IA no pudo verificar la coherencia del contrato.');
    return output;
  }
);

export async function verifyContractConsistency(
  input: VerifyContractConsistencyInput,
  userApiKey?: string,
): Promise<VerifyContractConsistencyResult> {
  try {
    if (userApiKey) {
      const proAI = createProAI(userApiKey);
      const ed = input.extractedData;
      const prompt = `Sos un escribano público argentino especialista en revisión de contratos de locación. Tu tarea es verificar la coherencia interna del siguiente contrato, detectando contradicciones, datos faltantes, ambigüedades y errores formales.

TIPO: ${input.contractType}

${ed ? `DATOS PREVIAMENTE EXTRAÍDOS (verificar coherencia contra el texto):
${ed.baseRentAmount ? `- Monto base: ${ed.currency} ${ed.baseRentAmount}` : ''}
${ed.tenantName ? `- Locatario: ${ed.tenantName}` : ''}
${ed.propertyAddress ? `- Inmueble: ${ed.propertyAddress}` : ''}
${ed.startDate ? `- Inicio: ${ed.startDate}` : ''}
${ed.endDate ? `- Fin: ${ed.endDate}` : ''}
${ed.adjustmentMechanism ? `- Índice: ${ed.adjustmentMechanism} cada ${ed.adjustmentFrequencyMonths} meses` : ''}` : ''}

ASPECTOS A VERIFICAR OBLIGATORIAMENTE:
1. ¿El monto en letras coincide con el monto en números?
2. ¿La fecha de inicio + duración = fecha de fin?
3. ¿El nombre del locatario en el encabezado coincide con el mencionado en el resto del contrato?
4. ¿El nombre del locador es consistente en todas las menciones?
5. ¿El domicilio del inmueble es idéntico en todas las cláusulas que lo mencionan?
6. ¿El mecanismo de ajuste (ICL/IPC/CER) mencionado en una cláusula coincide con el mencionado en otras?
7. ¿La frecuencia de ajuste es consistente?
8. ¿Los CUITs/DNIs mencionados tienen formato válido (CUIT: 11 dígitos; DNI: 7-8 dígitos)?
9. ¿El monto del depósito en cláusula de garantía coincide con el mencionado en el acta de recibo?
10. ¿Las penalidades por mora son consistentes en todo el documento?
11. ¿Si hay anexos, sus datos son coherentes con el cuerpo principal?
12. ¿Hay contradicciones entre cláusulas sobre quién paga expensas ordinarias/extraordinarias?
13. ¿Hay cláusulas que se contradigan en materia de subalquiler o cesión?
14. ¿La jurisdicción mencionada corresponde a la ubicación del inmueble?

TONO: técnico-jurídico, español rioplatense. Sé específico y citá las cláusulas exactas donde encontrés inconsistencias.

CONTRATO:
"""
${input.contractText}
"""`;
      const { output } = await proAI.generate({ prompt, output: { schema: VerifyContractConsistencyOutputSchema } });
      if (!output) throw new Error('La IA Pro no pudo verificar la coherencia del contrato.');
      return { ok: true, data: output };
    }
    const data = await verifyContractConsistencyFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Verificá tu API key en Configuración.' };
    }
    return { ok: false, error: msg || 'No se pudo verificar el contrato.' };
  }
}
