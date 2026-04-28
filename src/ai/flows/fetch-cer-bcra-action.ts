'use server';

export interface CerDataPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

export async function fetchCerFromBcra(desde: string, hasta: string): Promise<CerDataPoint[]> {
  const url = `https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/3540?desde=${desde}&hasta=${hasta}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`BCRA API respondió con estado ${res.status}`);
  }

  const json = await res.json();
  const results: { fecha: string; valor: number }[] = json.results ?? json.data ?? [];

  return results.map(r => ({
    date: r.fecha,    // already YYYY-MM-DD from BCRA
    value: r.valor,
  }));
}
