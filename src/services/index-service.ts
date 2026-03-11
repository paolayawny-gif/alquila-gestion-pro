
'use server';

/**
 * @fileOverview Servicio para la obtención de índices de ajuste (ICL, IPC).
 * 
 * EXPLICACIÓN TÉCNICA (BCRA API):
 * El BCRA dispone de un endpoint de "Principales Variables". 
 * Para el ICL (Índice de Contrato de Locación), se requiere:
 * 1. Consultar el valor del índice en la fecha de inicio/último ajuste.
 * 2. Consultar el valor del índice en la fecha actual.
 * 3. Calcular el coeficiente: (Valor_Actual / Valor_Anterior).
 * 
 * En este prototipo, simulamos esa respuesta para asegurar estabilidad 
 * sin requerir un token de API de producción del BCRA.
 */

export type IndexType = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed';

export async function fetchCurrentIndexCoefficient(type: IndexType, months: number): Promise<number> {
  // Simulación de delay de red (como si estuviéramos llamando al servidor del BCRA)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Coeficientes de variación realistas basados en la inflación actual de Argentina (2024-2025)
  // Nota: Un valor de 2.14 significa un 114% de aumento.
  
  const coefficients: Record<IndexType, number> = {
    // El ICL suele ser un promedio entre inflación y salarios
    'ICL': 1.0 + (0.10 * months), // Aprox 10% mensual acumulado
    
    // El IPC suele ser puramente inflación (generalmente más alto)
    'IPC': 1.0 + (0.13 * months), // Aprox 13% mensual acumulado
    
    // Casa Propia suele ser el menor de los indicadores
    'CasaPropia': 1.0 + (0.07 * months),
    
    'Fixed': 1.0
  };

  // En una implementación real con API BCRA, aquí haríamos:
  // const response = await fetch(`https://api.bcra.gob.ar/estadisticas/v1/PrincipalesVariables/30?desde=${fechaInicio}&hasta=${fechaFin}`);
  // const data = await response.json();
  // return data.results[ultimo].valor / data.results[primero].valor;

  return coefficients[type] || 1.0;
}
