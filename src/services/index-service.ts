
'use server';

/**
 * Servicio de índices de ajuste para contratos de locación argentinos.
 *
 * Fuentes reales:
 * - ICL: API BCRA v4.0 (fetch-icl-bcra-action)
 * - IPC: API INDEC datos.gob.ar (fetch-ipc-indec-action)
 * - CER: API BCRA v4.0 (fetch-cer-bcra-action)
 * - CasaPropia: estimación hasta que el Ministerio publique API pública
 *
 * El coeficiente devuelto es el factor multiplicador acumulado para N meses.
 * Ej: 1.037 = 3.7% de aumento.
 */

import { fetchIcl } from '@/ai/flows/fetch-icl-bcra-action';
import { fetchIpc } from '@/ai/flows/fetch-ipc-indec-action';
import { fetchCerFromBcra as fetchCer } from '@/ai/flows/fetch-cer-bcra-action';

export type IndexType = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed' | 'CER';

export interface IndexResult {
  coefficient: number;
  monthlyPct: number;
  accumulatedPct: number;
  period: string;
  source: 'api' | 'fallback';
  sourceLabel: string;
  note?: string;
}

export async function fetchCurrentIndexCoefficient(
  type: IndexType,
  months: number
): Promise<number> {
  const result = await fetchIndexResult(type, months);
  return result.coefficient;
}

export async function fetchIndexResult(
  type: IndexType,
  months: number
): Promise<IndexResult> {
  const fallback = (pct: number, label: string, note?: string): IndexResult => {
    const accumulated = (Math.pow(1 + pct / 100, months) - 1) * 100;
    return {
      coefficient: parseFloat(Math.pow(1 + pct / 100, months).toFixed(4)),
      monthlyPct: pct,
      accumulatedPct: parseFloat(accumulated.toFixed(2)),
      period: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      source: 'fallback',
      sourceLabel: label,
      note,
    };
  };

  if (type === 'Fixed') {
    return { coefficient: 1, monthlyPct: 0, accumulatedPct: 0, period: '-', source: 'api', sourceLabel: 'Escalonado fijo' };
  }

  if (type === 'ICL') {
    try {
      const r = await fetchIcl();
      if (r.ok && r.data.monthlyVariationPct > 0) {
        const monthly = r.data.monthlyVariationPct;
        const accumulated = (Math.pow(1 + monthly / 100, months) - 1) * 100;
        return {
          coefficient: parseFloat(Math.pow(1 + monthly / 100, months).toFixed(4)),
          monthlyPct: monthly,
          accumulatedPct: parseFloat(accumulated.toFixed(2)),
          period: r.data.period,
          source: r.data.source === 'bcra_api' ? 'api' : 'fallback',
          sourceLabel: `ICL – BCRA (${r.data.period})`,
          note: r.data.note,
        };
      }
    } catch { /* fallthrough */ }
    return fallback(3.7, 'ICL – BCRA (estimado)', 'API BCRA no disponible. Valor estimado.');
  }

  if (type === 'IPC') {
    try {
      const r = await fetchIpc();
      if (r.ok && r.data.monthlyVariationPct > 0) {
        const monthly = r.data.monthlyVariationPct;
        const accumulated = (Math.pow(1 + monthly / 100, months) - 1) * 100;
        return {
          coefficient: parseFloat(Math.pow(1 + monthly / 100, months).toFixed(4)),
          monthlyPct: monthly,
          accumulatedPct: parseFloat(accumulated.toFixed(2)),
          period: r.data.period,
          source: r.data.source === 'indec_api' ? 'api' : 'fallback',
          sourceLabel: `IPC – INDEC (${r.data.period})`,
          note: r.data.note,
        };
      }
    } catch { /* fallthrough */ }
    return fallback(3.7, 'IPC – INDEC (estimado)', 'API INDEC no disponible. Valor estimado.');
  }

  if (type === 'CER') {
    try {
      const hasta = new Date().toISOString().split('T')[0];
      const desde = new Date();
      desde.setMonth(desde.getMonth() - months);
      const r = await fetchCer(desde.toISOString().split('T')[0], hasta);
      if (r.ok && r.data.length >= 2) {
        const first = r.data[0].value;
        const last  = r.data[r.data.length - 1].value;
        const accumulated = first > 0 ? ((last - first) / first) * 100 : 3.5 * months;
        const monthly = accumulated / months;
        const period = new Date(r.data[r.data.length - 1].date).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        return {
          coefficient: parseFloat((1 + accumulated / 100).toFixed(4)),
          monthlyPct: parseFloat(monthly.toFixed(2)),
          accumulatedPct: parseFloat(accumulated.toFixed(2)),
          period,
          source: 'api',
          sourceLabel: `CER – BCRA (${period})`,
        };
      }
    } catch { /* fallthrough */ }
    return fallback(3.5, 'CER – BCRA (estimado)', 'API BCRA no disponible. Valor estimado.');
  }

  if (type === 'CasaPropia') {
    return fallback(2.8, 'Índice Casa Propia (estimado)',
      'Sin API pública estable. Verificar en https://www.habitat.gob.ar');
  }

  return fallback(3.5, `${type} (estimado)`);
}
