/**
 * Constantes y referencias legales del marco normativo argentino
 * aplicable a contratos de locación.
 *
 * Marco principal:
 * - Ley 27.551 (Ley de Alquileres, vigente desde jul/2020)
 * - DNU 70/2023 (modifica varios artículos de la Ley 27.551)
 * - Código Civil y Comercial de la Nación (CCyCN) – arts. 1187 a 1226
 * - Ley 26.994 (aprobación del CCyCN)
 * - Ley 24.240 (Defensa del Consumidor, aplica en relaciones locativas)
 */

// ─────────────────────────────────────────────────────────────────────────────
// DURACIONES MÍNIMAS LEGALES
// ─────────────────────────────────────────────────────────────────────────────
export const DURACION_MINIMA = {
  vivienda: {
    meses: 24,
    fundamento: 'DNU 70/2023 art. 4 (modifica Ley 27.551 art. 6 que era 36 meses)',
  },
  comercial: {
    meses: 36,
    fundamento: 'CCyCN art. 1198 – contratos comerciales plazo mínimo 3 años',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GARANTÍAS ADMISIBLES (Ley 27.551 art. 13)
// El locador SOLO puede pedir UNA de las siguientes:
// ─────────────────────────────────────────────────────────────────────────────
export const GARANTIAS_ADMISIBLES = [
  { tipo: 'Fiador solidario', descripcion: 'Persona física con recibo de sueldo en relación de dependencia' },
  { tipo: 'Seguro de caución', descripcion: 'Póliza emitida por aseguradora habilitada por la SSN' },
  { tipo: 'Aval bancario', descripcion: 'Garantía emitida por entidad bancaria habilitada por el BCRA' },
  { tipo: 'Garantía real', descripcion: 'Prenda o hipoteca sobre bien del locatario o garante' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DEPÓSITO DE GARANTÍA (Ley 27.551 art. 14)
// ─────────────────────────────────────────────────────────────────────────────
export const DEPOSITO = {
  maximoMeses: 1,
  fundamento: 'Ley 27.551 art. 14: el depósito no puede exceder 1 (un) mes de alquiler inicial',
  devolucionDias: 30,
  devolucionNota: 'Debe devolverse actualizado al valor del último mes al finalizar el contrato',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RESCISIÓN ANTICIPADA (CCyCN art. 1221 – Ley 27.551)
// ─────────────────────────────────────────────────────────────────────────────
export const RESCISION = {
  plazoPrevioMeses: 3,
  penalidad: {
    primerAno: '1 mes y medio de alquiler vigente al momento de la rescisión',
    posteriores: '1 mes de alquiler vigente al momento de la rescisión',
  },
  fundamento: 'CCyCN art. 1221 – el locatario puede rescindir anticipadamente sin causa tras 6 meses de contrato',
  sinPenalidad: 'Si el locatario notifica con 3 meses de antelación, no aplica penalidad adicional (Ley 27.551)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MECANISMOS DE AJUSTE (DNU 70/2023)
// ─────────────────────────────────────────────────────────────────────────────
export const AJUSTE = {
  nota: 'DNU 70/2023 derogó la indexación obligatoria ICL-BCRA y permite libre acuerdo entre partes',
  indicesComunes: [
    { codigo: 'ICL', nombre: 'Índice para Contratos de Locación', fuente: 'BCRA', periodicidad: 'mensual' },
    { codigo: 'IPC', nombre: 'Índice de Precios al Consumidor', fuente: 'INDEC', periodicidad: 'mensual' },
    { codigo: 'CER', nombre: 'Coeficiente de Estabilización de Referencia', fuente: 'BCRA', periodicidad: 'diario' },
    { codigo: 'CasaPropia', nombre: 'Índice Casa Propia', fuente: 'Ministerio Desarrollo Territorial', periodicidad: 'mensual' },
  ],
  frecuenciaMinima: 'Las partes acuerdan libremente la frecuencia de ajuste (antes era cuatrimestral por Ley 27.551)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORÍAS DE RIESGO (adaptación 41 cláusulas CUAD a alquiler argentino)
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORIAS_RIESGO = [
  { id: 'duracion_minima', label: 'Duración mínima legal', area: 'Plazo' },
  { id: 'garantias', label: 'Tipo y cantidad de garantías', area: 'Garantías' },
  { id: 'deposito_monto', label: 'Monto de depósito de garantía', area: 'Garantías' },
  { id: 'deposito_devolucion', label: 'Actualización y devolución del depósito', area: 'Garantías' },
  { id: 'mecanismo_ajuste', label: 'Mecanismo de ajuste del canon', area: 'Precio' },
  { id: 'frecuencia_ajuste', label: 'Frecuencia de ajuste del canon', area: 'Precio' },
  { id: 'mora', label: 'Cláusula de mora e intereses', area: 'Pago' },
  { id: 'rescision_locatario', label: 'Rescisión anticipada del locatario', area: 'Rescisión' },
  { id: 'rescision_locador', label: 'Preaviso del locador al vencimiento', area: 'Rescisión' },
  { id: 'expensas', label: 'Distribución de expensas (ordinarias/extraordinarias)', area: 'Gastos' },
  { id: 'servicios_impuestos', label: 'Servicios e impuestos a cargo de cada parte', area: 'Gastos' },
  { id: 'tgi_abl', label: 'TGI/ABL y contribuciones inmobiliarias', area: 'Gastos' },
  { id: 'subalquiler', label: 'Prohibición de subalquiler y cesión', area: 'Uso' },
  { id: 'destino', label: 'Destino exclusivo del inmueble', area: 'Uso' },
  { id: 'mascotas', label: 'Cláusula de mascotas', area: 'Uso' },
  { id: 'mejoras', label: 'Mejoras e innovaciones en el inmueble', area: 'Conservación' },
  { id: 'reparaciones_urgentes', label: 'Reparaciones urgentes y habitabilidad', area: 'Conservación' },
  { id: 'restitucion', label: 'Estado de restitución del inmueble', area: 'Conservación' },
  { id: 'inventario', label: 'Inventario y acta de entrega', area: 'Conservación' },
  { id: 'seguro', label: 'Seguro del inmueble y responsabilidad civil', area: 'Seguros' },
  { id: 'habilitacion_comercial', label: 'Habilitación municipal (solo locales comerciales)', area: 'Comercial' },
  { id: 'jurisdiccion', label: 'Jurisdicción y fuero competente', area: 'Legal' },
  { id: 'mediacion', label: 'Cláusula de mediación previa', area: 'Legal' },
  { id: 'notificaciones', label: 'Domicilio especial para notificaciones', area: 'Legal' },
  { id: 'indemnizacion', label: 'Indemnización por daños y perjuicios', area: 'Legal' },
  { id: 'veraz_bcra', label: 'Reporte a centrales de riesgo (Veraz/BCRA)', area: 'Crédito' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TEXTOS DE REFERENCIA LEGAL (para prompts de IA)
// ─────────────────────────────────────────────────────────────────────────────
export const MARCO_LEGAL_ALQUILER = `
MARCO NORMATIVO APLICABLE A LOCACIONES EN ARGENTINA:

1. CÓDIGO CIVIL Y COMERCIAL DE LA NACIÓN (CCyCN) – Ley 26.994
   - Arts. 1187-1226: Contrato de locación
   - Art. 1198: Plazo máximo 20 años vivienda, 50 años otros destinos
   - Art. 1209: Obligaciones del locador (garantizar uso y goce)
   - Art. 1210: Mejoras necesarias a cargo del locador
   - Art. 1216: Incendio: presunción de culpa del locatario
   - Art. 1221: Rescisión anticipada del locatario
   - Art. 1222: Intimación de pago (mora)
   - Art. 1224-1226: Extinción de la locación

2. LEY 27.551 (Ley de Alquileres – vigente desde 01/07/2020, modificada por DNU 70/2023)
   - Art. 6: Plazo mínimo (modificado por DNU 70/2023 a 2 años para vivienda)
   - Art. 9: Obligación de recibir pagos bancarios o por plataformas habilitadas
   - Art. 10: Cargas y gastos – expensas ordinarias a cargo del locatario
   - Art. 11: Índice de actualización (libre pacto según DNU 70/2023)
   - Art. 13: Garantías admisibles (UNA sola): fiador solidario, seguro de caución, aval bancario, garantía real
   - Art. 14: Depósito de garantía máximo 1 mes de alquiler inicial
   - Art. 15: Renovación del contrato – el locatario tiene preferencia
   - Art. 16: Obligación de emitir recibo de pago
   - Art. 17: Medidas cautelares (inscripción en registro)

3. DNU 70/2023 (Bases para la Libertad de los Argentinos – Título VI Alquileres)
   - Deroga indexación obligatoria ICL-BCRA para nuevos contratos
   - Permite libre acuerdo de índice y frecuencia de actualización
   - Reduce plazo mínimo de vivienda de 3 a 2 años
   - Permite depósito en moneda extranjera si el contrato es en USD

4. LEY 26.307 – Registro de Contratos de Locación (AFIP/ARCA)
   - Obligación de inscribir contratos ante AFIP dentro de los 15 días hábiles

5. LEY 24.240 – Defensa del Consumidor
   - Aplica cuando el locatario es persona física que alquila para uso personal/familiar
   - Cláusulas abusivas son nulas

6. NORMATIVAS LOCALES
   - CABA: Ley 3.301 (registro de alquileres temporarios), Ley 6.356 (actualizaciones)
   - PBA: Ley 15.191 y Decreto 2.098/22
`.trim();

export const SITUACIONES_BCRA: Record<number, { label: string; color: string; riesgo: string }> = {
  1: { label: 'Normal', color: 'green', riesgo: 'Bajo' },
  2: { label: 'Riesgo Bajo', color: 'lime', riesgo: 'Bajo-Medio' },
  3: { label: 'Riesgo Medio', color: 'amber', riesgo: 'Medio' },
  4: { label: 'Alto Riesgo', color: 'orange', riesgo: 'Alto' },
  5: { label: 'Irrecuperable', color: 'red', riesgo: 'Muy Alto' },
  6: { label: 'Irrecuperable con quita o subsidio', color: 'red', riesgo: 'Muy Alto' },
};
