export type RentalActivity = 'Vivienda' | 'Comercial' | 'Temporal' | 'Profesional';

export interface ProvinceRule {
  provincia: string;
  noticePeriodDays: number;
  minContractMonths: number;
  maxDepositMonths: number;
  defaultAdjustmentMechanism: 'ICL' | 'IPC' | 'CER' | 'CasaPropia' | 'Fixed';
  adjustmentFrequencyMonths: number;
  iibb: Record<RentalActivity, number>; // alícuotas por actividad
  note: string;
}

export const PROVINCE_RULES: Record<string, ProvinceRule> = {
  'Ciudad Autónoma de Buenos Aires': {
    provincia: 'Ciudad Autónoma de Buenos Aires',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.5, Temporal: 4.5, Profesional: 3.5 },
    note: 'Ley 27.551 + Cód. Civil. IIBB: vivienda exenta en CABA (Cód. Fiscal art. 182). Depósito = 1 mes.',
  },
  'Buenos Aires': {
    provincia: 'Buenos Aires',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.5, Temporal: 4.5, Profesional: 3.5 },
    note: 'Ley 27.551. Alquileres para vivienda exentos de IIBB (Cód. Fiscal PBA). Comercial: 3.5%.',
  },
  'Córdoba': {
    provincia: 'Córdoba',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 1.5, Comercial: 4.0, Temporal: 5.0, Profesional: 4.0 },
    note: 'Ley 27.551. Cód. Tributario Provincial: vivienda 1.5%, comercial 4%.',
  },
  'Santa Fe': {
    provincia: 'Santa Fe',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.5, Temporal: 4.0, Profesional: 3.5 },
    note: 'Ley 27.551. Santa Fe: vivienda exenta. Comercial 3.5%.',
  },
  'Mendoza': {
    provincia: 'Mendoza',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.5, Temporal: 4.0, Profesional: 3.5 },
    note: 'Ley 27.551. Mendoza: vivienda exenta bajo ciertos límites. Comercial 3.5%.',
  },
  'Tucumán': {
    provincia: 'Tucumán',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 2.0, Comercial: 4.5, Temporal: 5.0, Profesional: 4.5 },
    note: 'Ley 27.551. Tucumán: vivienda 2%, comercial 4.5%.',
  },
  'Entre Ríos': {
    provincia: 'Entre Ríos',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.0, Temporal: 3.5, Profesional: 3.0 },
    note: 'Ley 27.551. Entre Ríos: vivienda exenta. Comercial 3%.',
  },
  'Salta': {
    provincia: 'Salta',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 1.0, Comercial: 3.5, Temporal: 4.0, Profesional: 3.5 },
    note: 'Ley 27.551. Salta: vivienda 1%, comercial 3.5%.',
  },
  'Neuquén': {
    provincia: 'Neuquén',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.0, Temporal: 3.5, Profesional: 3.0 },
    note: 'Ley 27.551. Neuquén: vivienda exenta. Comercial 3%.',
  },
  'Río Negro': {
    provincia: 'Río Negro',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    iibb: { Vivienda: 0, Comercial: 3.0, Temporal: 3.5, Profesional: 3.0 },
    note: 'Ley 27.551. Río Negro: vivienda exenta. Comercial 3%.',
  },
};

export const DEFAULT_RULE: ProvinceRule = {
  provincia: '',
  noticePeriodDays: 60,
  minContractMonths: 24,
  maxDepositMonths: 1,
  defaultAdjustmentMechanism: 'ICL',
  adjustmentFrequencyMonths: 4,
  iibb: { Vivienda: 0, Comercial: 3.5, Temporal: 4.0, Profesional: 3.5 },
  note: 'Ley Nacional 27.551 (régimen general).',
};

export function getRulesForProvince(provinciaName?: string): ProvinceRule {
  if (!provinciaName) return DEFAULT_RULE;
  const key = Object.keys(PROVINCE_RULES).find(k =>
    provinciaName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(provinciaName.toLowerCase()),
  );
  return key ? PROVINCE_RULES[key] : DEFAULT_RULE;
}

// Escalas de Ganancias 4ª categoría 2024 (DGI — simplificado)
// Base: ingreso neto luego de deducción presunta del 40% (locación de inmuebles)
export const GANANCIAS_BRACKETS = [
  { hasta: 419_364,     alicuota: 0.05, fijo: 0 },
  { hasta: 838_729,     alicuota: 0.09, fijo: 20_968 },
  { hasta: 1_258_093,   alicuota: 0.12, fijo: 58_752 },
  { hasta: 1_677_457,   alicuota: 0.15, fijo: 109_003 },
  { hasta: 2_516_186,   alicuota: 0.19, fijo: 171_895 },
  { hasta: 3_354_914,   alicuota: 0.23, fijo: 331_519 },
  { hasta: 5_032_372,   alicuota: 0.27, fijo: 524_543 },
  { hasta: 6_709_829,   alicuota: 0.31, fijo: 977_631 },
  { hasta: Infinity,    alicuota: 0.35, fijo: 1_497_812 },
];

export const MNI_ANUAL = 3_091_035; // Mínimo No Imponible anual 2024 (soltero)
export const DEDUCCION_PRESUNTA_INMUEBLES = 0.40; // Art. 85 LIG

// Categorías Monotributo 2024 (ingresos anuales máximos)
export const MONOTRIBUTO_CATEGORIAS = [
  { categoria: 'A', ingresoMaximo: 2_109_885,  cuotaMensual: 8_490 },
  { categoria: 'B', ingresoMaximo: 3_131_067,  cuotaMensual: 9_880 },
  { categoria: 'C', ingresoMaximo: 4_383_930,  cuotaMensual: 11_640 },
  { categoria: 'D', ingresoMaximo: 5_437_550,  cuotaMensual: 15_290 },
  { categoria: 'E', ingresoMaximo: 6_426_601,  cuotaMensual: 20_700 },
  { categoria: 'F', ingresoMaximo: 7_677_870,  cuotaMensual: 28_820 },
  { categoria: 'G', ingresoMaximo: 9_000_000,  cuotaMensual: 40_750 },
  { categoria: 'H', ingresoMaximo: 10_800_000, cuotaMensual: 78_360 },
];

export function calcularGanancias(ingresoBrutoAnual: number): number {
  // Deducción presunta 40% para inmuebles (Art. 85 inc. a LIG)
  const netoLuegoDed = ingresoBrutoAnual * (1 - DEDUCCION_PRESUNTA_INMUEBLES);
  const baseImponible = Math.max(0, netoLuegoDed - MNI_ANUAL);
  if (baseImponible <= 0) return 0;
  const bracket = GANANCIAS_BRACKETS.find(b => baseImponible <= b.hasta)!;
  const prevBracketMax = GANANCIAS_BRACKETS[GANANCIAS_BRACKETS.indexOf(bracket) - 1]?.hasta ?? 0;
  return bracket.fijo + (baseImponible - prevBracketMax) * bracket.alicuota;
}

export function categoriaMontotributo(ingresoBrutoAnual: number) {
  return MONOTRIBUTO_CATEGORIAS.find(c => ingresoBrutoAnual <= c.ingresoMaximo) ?? null;
}
