export interface ProvinceRule {
  provincia: string;
  noticePeriodDays: number;       // Días de preaviso para rescindir
  minContractMonths: number;      // Plazo mínimo del contrato (meses)
  maxDepositMonths: number;       // Depósito máximo permitido (en meses de alquiler)
  defaultAdjustmentMechanism: 'ICL' | 'IPC' | 'CER' | 'CasaPropia' | 'Fixed';
  adjustmentFrequencyMonths: number;
  ingresosBrutosPct: number;      // Alícuota estimada de IIBB sobre alquileres
  note: string;                   // Referencia legal resumida
}

export const PROVINCE_RULES: Record<string, ProvinceRule> = {
  'Ciudad Autónoma de Buenos Aires': {
    provincia: 'Ciudad Autónoma de Buenos Aires',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.5,
    note: 'Ley 27.551 + Cod. Civil. Actualización ICL cuatrimestral. Depósito = 1 mes.',
  },
  'Buenos Aires': {
    provincia: 'Buenos Aires',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.5,
    note: 'Ley 27.551. Mismo régimen que CABA para contratos de vivienda.',
  },
  'Córdoba': {
    provincia: 'Córdoba',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 4.0,
    note: 'Ley 27.551. IIBB alícuota 4% sobre alquileres (Cód. Tributario Prov.).',
  },
  'Santa Fe': {
    provincia: 'Santa Fe',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.5,
    note: 'Ley 27.551. IIBB 3.5% sobre alquileres.',
  },
  'Mendoza': {
    provincia: 'Mendoza',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.5,
    note: 'Ley 27.551. Sin legislación provincial específica adicional.',
  },
  'Tucumán': {
    provincia: 'Tucumán',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 4.5,
    note: 'Ley 27.551. IIBB alícuota 4.5%.',
  },
  'Entre Ríos': {
    provincia: 'Entre Ríos',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.0,
    note: 'Ley 27.551. IIBB 3%.',
  },
  'Salta': {
    provincia: 'Salta',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.5,
    note: 'Ley 27.551. Sin ley provincial específica adicional.',
  },
  'Neuquén': {
    provincia: 'Neuquén',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.0,
    note: 'Ley 27.551. IIBB 3%.',
  },
  'Río Negro': {
    provincia: 'Río Negro',
    noticePeriodDays: 60,
    minContractMonths: 24,
    maxDepositMonths: 1,
    defaultAdjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    ingresosBrutosPct: 3.0,
    note: 'Ley 27.551.',
  },
};

export const DEFAULT_RULE: ProvinceRule = {
  provincia: '',
  noticePeriodDays: 60,
  minContractMonths: 24,
  maxDepositMonths: 1,
  defaultAdjustmentMechanism: 'ICL',
  adjustmentFrequencyMonths: 4,
  ingresosBrutosPct: 3.5,
  note: 'Ley Nacional 27.551 (régimen general).',
};

export function getRulesForProvince(provinciaName?: string): ProvinceRule {
  if (!provinciaName) return DEFAULT_RULE;
  // Normalizar: buscar coincidencia parcial
  const key = Object.keys(PROVINCE_RULES).find(k =>
    provinciaName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(provinciaName.toLowerCase())
  );
  return key ? PROVINCE_RULES[key] : DEFAULT_RULE;
}
