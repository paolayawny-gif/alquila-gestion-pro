import { NextResponse } from 'next/server';

// Cache en memoria: válido 1 hora
let cache: { compra: number; venta: number; fecha: string; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache);
  }

  try {
    const res = await fetch(
      'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones',
      { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`BCRA status ${res.status}`);

    const data = await res.json();
    const detalle: { codigoMoneda: string; tipoPase: number; tipoCotizacion: number }[] =
      data?.results?.detalle ?? [];

    const usd = detalle.find(d => d.codigoMoneda === 'USD');
    if (!usd) throw new Error('USD no encontrado en respuesta BCRA');

    cache = {
      compra: usd.tipoPase,
      venta: usd.tipoCotizacion,
      fecha: data?.results?.fecha ?? new Date().toISOString().slice(0, 10),
      cachedAt: Date.now(),
    };
    return NextResponse.json(cache);
  } catch (err) {
    // Devuelve el caché viejo si hay, o error
    if (cache) return NextResponse.json(cache);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
