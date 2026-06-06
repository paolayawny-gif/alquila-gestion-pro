'use server';
/**
 * Flow para extraer datos estructurados de contratos de locación argentinos.
 *
 * Extrae datos económicos, de partes, fechas y cláusulas clave,
 * con validación según Ley 27.551, DNU 70/2023 y CCyCN.
 */

import { z } from 'zod';
import { generateJSONWithMedia } from '@/ai/gemini';

const ExtractContractDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "Foto o PDF del contrato de locación, como data URI con MIME type y codificación Base64. Formato: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractContractDataInput = z.infer<typeof ExtractContractDataInputSchema>;

const ExtractContractDataOutputSchema = z.object({
  // Datos económicos
  baseRentAmount: z.number().describe('Monto inicial mensual del alquiler.'),
  currency: z.enum(['ARS', 'USD']).describe('Moneda del contrato.'),
  adjustmentFrequencyMonths: z.number().describe('Frecuencia de ajuste en meses (ej: 1 = mensual, 3 = trimestral, 6 = semestral).'),
  adjustmentMechanism: z.enum(['ICL', 'IPC', 'CasaPropia', 'Fixed', 'CER']).describe('Índice o mecanismo de ajuste pactado.'),
  depositAmount: z.number().optional().describe('Monto del depósito de garantía (Ley 27.551 art. 14: máximo 1 mes).'),
  depositCurrency: z.enum(['ARS', 'USD']).optional().describe('Moneda del depósito.'),
  lateFeePercentage: z.number().optional().describe('Porcentaje de interés por mora mensual (%).'),

  // Partes
  tenantName: z.string().optional().describe('Nombre completo del Locatario (inquilino).'),
  tenantDni: z.string().optional().describe('DNI del Locatario (7-8 dígitos).'),
  tenantCuit: z.string().optional().describe('CUIT/CUIL del Locatario (11 dígitos sin guiones).'),
  ownerName: z.string().optional().describe('Nombre completo del Locador (propietario).'),
  ownerDni: z.string().optional().describe('DNI del Locador.'),
  ownerCuit: z.string().optional().describe('CUIT/CUIL del Locador.'),
  guarantorName: z.string().optional().describe('Nombre completo del Fiador/Garante, si lo hubiere.'),
  guarantorDni: z.string().optional().describe('DNI del Fiador.'),
  guarantorType: z.enum(['fiador_solidario', 'seguro_caucion', 'aval_bancario', 'garantia_real', 'sin_garantia']).optional().describe(
    'Tipo de garantía según Ley 27.551 art. 13.'
  ),

  // Inmueble y plazo
  propertyAddress: z.string().optional().describe('Dirección completa del inmueble (calle, número, piso, depto, localidad, provincia).'),
  propertyType: z.enum(['vivienda', 'comercial', 'cochera', 'oficina', 'deposito', 'otro']).optional(),
  startDate: z.string().optional().describe('Fecha de inicio del contrato en formato YYYY-MM-DD.'),
  endDate: z.string().optional().describe('Fecha de vencimiento del contrato en formato YYYY-MM-DD.'),
  durationMonths: z.number().optional().describe('Duración total en meses.'),

  // Gastos y servicios
  expensasOrdinariasACargo: z.enum(['locatario', 'locador', 'compartido', 'no_especificado']).optional().describe(
    'Quién paga las expensas ordinarias (por ley: locatario – Ley 27.551 art. 10).'
  ),
  expensasExtraordinariasACargo: z.enum(['locatario', 'locador', 'compartido', 'no_especificado']).optional().describe(
    'Quién paga las expensas extraordinarias (por ley: locador).'
  ),
  serviciosACargo: z.string().optional().describe('Descripción de quién paga luz, gas, agua, internet.'),

  // Legalidad
  inscripcionAfip: z.boolean().optional().describe('¿El contrato menciona la inscripción en AFIP (Ley 26.307)?'),
  jurisdiccion: z.string().optional().describe('Fuero y tribunal o jurisdicción pactada.'),

  // Metadatos de la extracción
  confidenceScore: z.number().describe('Confianza de la extracción IA (0 a 1).'),
  alertasLegales: z.array(z.string()).describe(
    'Lista de alertas sobre cláusulas que podrían violar la Ley 27.551, DNU 70/2023 o el CCyCN.'
  ),
  summary: z.string().describe('Resumen breve en español de las cláusulas económicas y generales del contrato.'),
  fullTranscription: z.string().describe('Transcripción verbatim completa del texto del documento en español.'),
});

export type ExtractContractDataOutput = z.infer<typeof ExtractContractDataOutputSchema>;

export type ExtractContractResult =
  | { ok: true; data: ExtractContractDataOutput }
  | { ok: false; error: string };

function buildPrompt(): string {
  return `Sos un escribano público argentino especialista en locaciones. Analizá el documento y extraé todos los datos del contrato de locación con precisión.

INSTRUCCIONES GENERALES:
- Todos los campos opcionales: si no encontrás el dato, omitilo (no inventes valores).
- Fechas: SIEMPRE en formato YYYY-MM-DD.
- Montos: SIEMPRE como número, sin símbolos ni separadores.
- CUIT/CUIL: 11 dígitos sin guiones ni puntos.
- DNI: solo dígitos, sin puntos.
- fullTranscription: COMPLETA y VERBATIM. No resumas. Transcribí cada palabra, número y cláusula tal cual aparece en el documento.

CAMPOS CRÍTICOS A EXTRAER:
1. baseRentAmount: Canon mensual inicial (número exacto).
2. currency: ARS o USD.
3. adjustmentFrequencyMonths: 1=mensual, 2=bimestral, 3=trimestral, 4=cuatrimestral, 6=semestral, 12=anual.
4. adjustmentMechanism: ICL (BCRA), IPC (INDEC), CER, CasaPropia, o Fixed si es escalonado fijo.
5. depositAmount: Monto del depósito. Alerta si supera 1 mes de alquiler inicial (viola Ley 27.551 art. 14).
6. tenantName: Nombre completo del Locatario (buscar "Locatario", "Inquilino", "Segunda parte").
7. ownerName: Nombre completo del Locador (buscar "Locador", "Propietario", "Primera parte").
8. guarantorName: Fiador o garante si existe.
9. guarantorType: fiador_solidario (fiador solidario liso y llano), seguro_caucion, aval_bancario, garantia_real, sin_garantia.
10. propertyAddress: Dirección COMPLETA del inmueble (calle + número + piso/depto + localidad + provincia).
11. startDate / endDate: Fechas en YYYY-MM-DD.
12. durationMonths: Calcular si no está explícito.
13. expensasOrdinariasACargo: Por ley deben ser del locatario; alertar si el contrato dice lo contrario.
14. lateFeePercentage: % mensual por mora.
15. jurisdiccion: Fuero, juzgado o ciudad de jurisdicción.

ALERTAS LEGALES A GENERAR:
- Si depositAmount > baseRentAmount: "El depósito supera el máximo legal de 1 mes (Ley 27.551 art. 14)"
- Si durationMonths < 24 (vivienda): "La duración es inferior al mínimo legal de 24 meses (DNU 70/2023)"
- Si durationMonths < 36 (comercial): "La duración es inferior al mínimo legal de 36 meses (CCyCN art. 1198)"
- Si se detectan más de una garantía: "Se requieren múltiples garantías, lo que viola la Ley 27.551 art. 13"
- Si expensasExtraordinariasACargo = locatario: "Las expensas extraordinarias deben ser a cargo del locador (Ley 27.551 art. 10)"
- Si no hay domicilios especiales de notificación: "Faltan domicilios especiales para notificaciones judiciales"

Devolvé un JSON con exactamente esta estructura:
{
  "baseRentAmount": number,
  "currency": "ARS" | "USD",
  "adjustmentFrequencyMonths": number,
  "adjustmentMechanism": "ICL" | "IPC" | "CasaPropia" | "Fixed" | "CER",
  "depositAmount": number (opcional),
  "depositCurrency": "ARS" | "USD" (opcional),
  "lateFeePercentage": number (opcional),
  "tenantName": string (opcional),
  "tenantDni": string (opcional),
  "tenantCuit": string (opcional),
  "ownerName": string (opcional),
  "ownerDni": string (opcional),
  "ownerCuit": string (opcional),
  "guarantorName": string (opcional),
  "guarantorDni": string (opcional),
  "guarantorType": "fiador_solidario" | "seguro_caucion" | "aval_bancario" | "garantia_real" | "sin_garantia" (opcional),
  "propertyAddress": string (opcional),
  "propertyType": "vivienda" | "comercial" | "cochera" | "oficina" | "deposito" | "otro" (opcional),
  "startDate": string (opcional, YYYY-MM-DD),
  "endDate": string (opcional, YYYY-MM-DD),
  "durationMonths": number (opcional),
  "expensasOrdinariasACargo": "locatario" | "locador" | "compartido" | "no_especificado" (opcional),
  "expensasExtraordinariasACargo": "locatario" | "locador" | "compartido" | "no_especificado" (opcional),
  "serviciosACargo": string (opcional),
  "inscripcionAfip": boolean (opcional),
  "jurisdiccion": string (opcional),
  "confidenceScore": number (0 a 1),
  "alertasLegales": string[],
  "summary": string,
  "fullTranscription": string
}`;
}

export async function extractContractData(input: ExtractContractDataInput): Promise<ExtractContractResult> {
  try {
    const data = await generateJSONWithMedia<ExtractContractDataOutput>(
      buildPrompt(),
      input.documentDataUri,
    );
    return { ok: true, data };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (msg.includes('API key') || msg.includes('GEMINI') || msg.includes('credentials')) {
      return { ok: false, error: 'La clave API de IA no está configurada. Contactá al administrador.' };
    }
    return { ok: false, error: msg || 'No se pudo extraer información del documento.' };
  }
}
