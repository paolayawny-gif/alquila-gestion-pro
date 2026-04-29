'use server';

export interface CerDataPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

export type FetchCerResult =
  | { ok: true; data: CerDataPoint[] }
  | { ok: false; error: string };

// BCRA API v4.0 - Serie 3540 (CER)
// Response: { results: [{ idVariable: 3540, detalle: [{ fecha, valor }] }] }
export async function fetchCerFromBcra(desde: string, hasta: string): Promise<FetchCerResult> {
  try {
    const params = new URLSearchParams({ Desde: desde, Hasta: hasta, Limit: '1000' });
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/3540?${params}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'AlquilaGestionPro/1.0' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        error: `El BCRA respondió con error ${res.status}. ` +
          `Verificá el rango de fechas (la serie comienza en 2002). ` +
          (body ? `Detalle: ${body.slice(0, 150)}` : ''),
      };
    }

    const json = await res.json();

    // v4.0: results[0].detalle[]  |  v3.0 fallback: results[]
    const detalle: { fecha: string; valor: number }[] =
      Array.isArray(json.results?.[0]?.detalle)
        ? json.results[0].detalle
        : Array.isArray(json.results)
        ? json.results
        : [];

    if (detalle.length === 0) {
      return {
        ok: false,
        error: 'El BCRA no devolvió datos para ese rango. ' +
          'Es posible que la API esté temporalmente fuera de servicio. ' +
          'Usá "Importar desde Excel" como alternativa.',
      };
    }

    return {
      ok: true,
      data: detalle
        .filter(r => r.fecha && r.valor != null)
        .map(r => ({ date: r.fecha, value: r.valor })),
    };
  } catch (err: any) {
    return {
      ok: false,
      error: 'No se pudo conectar con el BCRA. ' +
        'Probablemente el servidor esté temporalmente inaccesible desde Vercel. ' +
        'Usá "Importar desde Excel" con el archivo descargado de bcra.gob.ar. ' +
        `(${err?.message ?? 'Error de red'})`,
    };
  }
}
