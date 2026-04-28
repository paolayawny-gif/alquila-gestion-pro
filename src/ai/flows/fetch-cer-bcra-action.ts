'use server';

export interface CerDataPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

// BCRA API v4.0 - Serie 3540 (CER)
// Response: { results: [{ idVariable: 3540, detalle: [{ fecha, valor }] }] }
export async function fetchCerFromBcra(desde: string, hasta: string): Promise<CerDataPoint[]> {
  const params = new URLSearchParams({ Desde: desde, Hasta: hasta });
  const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/3540?${params}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`BCRA respondió ${res.status}. Verificá el rango de fechas.`);
  }

  const json = await res.json();
  // v4.0 wraps data inside results[0].detalle
  const detalle: { fecha: string; valor: number }[] =
    json.results?.[0]?.detalle ?? json.results ?? [];

  return detalle.map(r => ({
    date: r.fecha,   // YYYY-MM-DD
    value: r.valor,
  }));
}
