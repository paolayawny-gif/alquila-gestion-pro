'use server';
/**
 * Flow para generación de contratos de locación argentinos.
 *
 * Redacta contratos completos conforme a:
 * - Código Civil y Comercial de la Nación (CCyCN) – arts. 1187-1226
 * - Ley 27.551 (Ley de Alquileres)
 * - DNU 70/2023 (Bases para la Libertad de los Argentinos – Título VI)
 * - Ley 26.307 (Registro de Contratos de Locación – AFIP)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MARCO_LEGAL_ALQUILER } from '@/lib/argentine-law';

const GenerateContractInputSchema = z.object({
  contractType: z.string().describe('Tipo de contrato: "Locación de Vivienda", "Locación Comercial", etc.'),
  locador: z.string().optional().describe('Nombre completo y DNI/CUIT del Locador'),
  locatario: z.string().optional().describe('Nombre completo y DNI/CUIT del Locatario'),
  fiador: z.string().optional().describe('Nombre completo y DNI/CUIT del Fiador (si aplica)'),
  tipoGarantia: z.enum(['fiador_solidario', 'seguro_caucion', 'aval_bancario', 'garantia_real', 'sin_garantia']).optional()
    .describe('Tipo de garantía según Ley 27.551 art. 13'),
  propertyAddress: z.string().optional().describe('Dirección completa del inmueble'),
  startDate: z.string().optional().describe('Fecha de inicio del contrato'),
  endDate: z.string().optional().describe('Fecha de vencimiento del contrato'),
  duration: z.string().optional().describe('Duración, ej: "24 meses"'),
  rentAmount: z.string().optional().describe('Canon mensual inicial'),
  currency: z.string().optional().describe('Moneda: ARS o USD'),
  depositAmount: z.string().optional().describe('Monto del depósito de garantía (máximo 1 mes – Ley 27.551 art. 14)'),
  adjustmentMechanism: z.string().optional().describe('Mecanismo de ajuste: ICL, IPC, CER, CasaPropia'),
  adjustmentFrequency: z.string().optional().describe('Frecuencia de ajuste: mensual, trimestral, semestral, anual'),
  lateFeePercentage: z.string().optional().describe('Porcentaje de interés por mora mensual (%)'),
  destinoInmueble: z.enum(['vivienda_familiar', 'vivienda_personal', 'uso_comercial', 'uso_profesional']).optional(),
  province: z.string().optional().describe('Provincia donde se ubica el inmueble (para normativa local)'),
  additionalDetails: z.string().optional().describe('Cláusulas especiales, instrucciones adicionales'),
});

export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;

const GenerateContractOutputSchema = z.object({
  title: z.string().describe('Título oficial del contrato generado'),
  html: z.string().describe('Texto completo del contrato en HTML limpio usando <h2>, <h3>, <p>, <strong>, <br>. Sin CSS ni estilos inline.'),
  advertenciasLegales: z.array(z.string()).describe('Advertencias sobre datos faltantes o cláusulas que requieren revisión profesional'),
});

export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;
export type GenerateContractResult =
  | { ok: true; data: GenerateContractOutput }
  | { ok: false; error: string };

const generateContractPrompt = ai.definePrompt({
  name: 'generateContractPrompt',
  input: { schema: GenerateContractInputSchema },
  output: { schema: GenerateContractOutputSchema },
  prompt: `Sos un abogado especialista en derecho inmobiliario argentino con 20 años de experiencia en redacción de contratos de locación. Redactá un contrato legal completo y profesional en español rioplatense.

TIPO DE CONTRATO: {{{contractType}}}
{{#if province}}PROVINCIA: {{{province}}}{{/if}}
{{#if destinoInmueble}}DESTINO: {{{destinoInmueble}}}{{/if}}

DATOS DE LAS PARTES:
{{#if locador}}- Locador: {{{locador}}}{{/if}}
{{#if locatario}}- Locatario: {{{locatario}}}{{/if}}
{{#if fiador}}- Fiador: {{{fiador}}} (Tipo garantía: {{{tipoGarantia}}}){{/if}}
{{#if propertyAddress}}- Inmueble: {{{propertyAddress}}}{{/if}}

CONDICIONES ECONÓMICAS:
{{#if startDate}}- Inicio: {{{startDate}}}{{/if}}
{{#if endDate}}- Vencimiento: {{{endDate}}}{{/if}}
{{#if duration}}- Duración: {{{duration}}}{{/if}}
{{#if rentAmount}}- Canon mensual inicial: {{{currency}}} {{{rentAmount}}}{{/if}}
{{#if depositAmount}}- Depósito de garantía: {{{depositAmount}}}{{/if}}
{{#if adjustmentMechanism}}- Mecanismo de ajuste: {{{adjustmentMechanism}}}{{/if}}
{{#if adjustmentFrequency}}- Frecuencia de ajuste: {{{adjustmentFrequency}}}{{/if}}
{{#if lateFeePercentage}}- Interés por mora: {{{lateFeePercentage}}}% mensual{{/if}}

{{#if additionalDetails}}CLÁUSULAS ESPECIALES E INSTRUCCIONES:
{{{additionalDetails}}}{{/if}}

MARCO NORMATIVO:
${MARCO_LEGAL_ALQUILER}

INSTRUCCIONES DE REDACCIÓN:

1. ESTRUCTURA OBLIGATORIA DEL CONTRATO (incluir TODAS estas secciones):
   - Encabezado: lugar, fecha, identificación completa de las partes (nombre, DNI/CUIT, domicilio)
   - PRIMERA: Objeto del contrato (descripción del inmueble y destino)
   - SEGUNDA: Precio y forma de pago (canon, moneda, medio de pago bancario – art. 9 Ley 27.551)
   - TERCERA: Plazo de duración (con referencia al mínimo legal aplicable)
   - CUARTA: Actualización del canon (índice, frecuencia y fuente oficial)
   - QUINTA: Depósito de garantía (monto, condiciones, devolución actualizada)
   - SEXTA: Garantía (tipo admisible según art. 13 Ley 27.551; solo UNA garantía)
   - SÉPTIMA: Destino del inmueble (uso exclusivo; prohibición de subalquiler)
   - OCTAVA: Obligaciones del Locador (habitabilidad, reparaciones urgentes, expensas extraordinarias)
   - NOVENA: Obligaciones del Locatario (conservación, expensas ordinarias, servicios, seguro de incendio)
   - DÉCIMA: Cargas y contribuciones (quién paga TGI/ABL, impuestos inmobiliarios)
   - UNDÉCIMA: Mora e intereses punitorios (porcentaje, desde cuándo aplica)
   - DUODÉCIMA: Rescisión anticipada (art. 1221 CCyCN – preaviso 3 meses, penalidades)
   - DECIMOTERCERA: Restitución del inmueble (plazo, estado, acta de entrega)
   - DECIMOCUARTA: Domicilios especiales para notificaciones (partes + locador + garante)
   - DECIMOQUINTA: Inscripción en AFIP (obligación Ley 26.307, plazo 15 días hábiles)
   - DECIMOSEXTA: Jurisdicción y fuero competente
   - Espacio para firmas: locador, locatario, fiador (si aplica), escribano/certificante

2. NORMAS IMPERATIVAS A RESPETAR:
   a. Plazo mínimo: vivienda ≥ 24 meses (DNU 70/2023); comercial ≥ 36 meses (CCyCN art. 1198)
   b. Garantía: solo UNA modalidad (art. 13 Ley 27.551). Si no hay fiador, indicarlo explícitamente.
   c. Depósito: máximo 1 mes del alquiler inicial (art. 14 Ley 27.551); devolver actualizado al último mes.
   d. Pago: en moneda de curso legal o cuenta bancaria; prohibido exigir pago únicamente en efectivo.
   e. Expensas ordinarias: a cargo del locatario (art. 10 Ley 27.551).
   f. Expensas extraordinarias: a cargo del locador (art. 10 Ley 27.551).
   g. Rescisión anticipada del locatario: con preaviso ≥ 3 meses, sin penalidad; con < 3 meses, penalidad de 1,5 o 1 mes según año del contrato.
   h. Ajuste: libre pacto de índice y frecuencia (DNU 70/2023); mencionar fuente oficial.

3. FORMATO HTML:
   - Usar SOLO: <h2> para título principal, <h3> para encabezados de cláusulas, <p> para párrafos, <strong> para énfasis, <br> para saltos de línea.
   - Sin CSS, sin estilos inline.
   - Estructura limpia para impresión directa.

4. PLACEHOLDERS: donde falten datos, usar [COMPLETAR: descripción del dato].

5. Si se indicaron cláusulas especiales en "Instrucciones", incorporalas de forma coherente.

6. Tono: formal, jurídico, español rioplatense con voseo en las cláusulas redaccionales.

7. En "advertenciasLegales": listar cualquier dato faltante crítico o aspecto que requiera revisión por abogado antes de firmar.
`,
});

const generateContractFlow = ai.defineFlow(
  {
    name: 'generateContractFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: GenerateContractOutputSchema,
  },
  async (input) => {
    const { output } = await generateContractPrompt(input);
    if (!output) throw new Error('La IA no pudo generar el contrato.');
    return output;
  }
);

export async function generateContract(
  input: GenerateContractInput
): Promise<GenerateContractResult> {
  try {
    const data = await generateContractFlow(input);
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI')) {
      return { ok: false, error: 'La clave API de IA no está configurada (GEMINI_API_KEY).' };
    }
    return { ok: false, error: msg || 'No se pudo generar el contrato.' };
  }
}
