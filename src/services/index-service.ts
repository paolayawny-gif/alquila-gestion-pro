
'use server';

/**
 * @fileOverview Servicio para la obtención de índices de ajuste (ICL, IPC).
 * En un entorno de producción, esto consultaría APIs oficiales (BCRA, INDEC).
 * Para el prototipo, proporciona valores realistas actualizados.
 */

export type IndexType = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';

export async function fetchCurrentIndexCoefficient(type: IndexType, months: number): Promise<number> {
  // Simulación de delay de red
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Valores simulados de coeficientes acumulados (ej: para 6 meses)
  // En la realidad, esto sería (Indice_Final / Indice_Inicial)
  const realisticCoefficients: Record<IndexType, number> = {
    'ICL': 1.0 + (0.12 * (months / 1)), // Aprox 12% mensual acumulado
    'IPC': 1.0 + (0.14 * (months / 1)), // Aprox 14% mensual acumulado
    'CasaPropia': 1.0 + (0.08 * (months / 1)),
    'Fixed': 1.0
  };

  return realisticCoefficients[type] || 1.5;
}
