import { NextResponse } from 'next/server';

// Map de tipos de propiedad a segmento de URL de Zonaprop
const TYPE_SLUG: Record<string, string> = {
  'Departamento': 'departamentos',
  'Casa':         'casas',
  'Local':        'locales-comerciales',
  'Oficina':      'oficinas',
  'Cochera':      'cocheras',
  'Depósito':     'depositos-galpon',
  'Terreno':      'terrenos',
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type         = searchParams.get('type')         || 'Departamento';
  const rooms        = searchParams.get('rooms')        || '2';
  const city         = searchParams.get('city')         || 'buenos-aires';
  const neighborhood = searchParams.get('neighborhood') || '';

  const typeSlug    = TYPE_SLUG[type] ?? 'propiedades';
  const citySlug    = slugify(city);
  const neighSlug   = neighborhood ? slugify(neighborhood) : '';
  const locationSlug = neighSlug ? `${neighSlug}-${citySlug}` : citySlug;

  // URL de búsqueda en Zonaprop
  const zonapropUrl = `https://www.zonaprop.com.ar/${typeSlug}-alquiler-${locationSlug}.html?ambientes=${rooms}`;
  const jinaUrl     = `https://r.jina.ai/${zonapropUrl}`;

  try {
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      next:    { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Jina ${res.status}`);

    const markdown = await res.text();

    // Extraer precios ARS (evitar valores imposibles)
    const priceRe = /\$\s*([\d.]+(?:,\d+)?)/g;
    const prices: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = priceRe.exec(markdown)) !== null) {
      // Normalizar separadores: "1.200.000" o "1,200,000"
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 50_000 && val <= 10_000_000) {
        prices.push(Math.round(val));
      }
    }

    if (prices.length === 0) {
      return NextResponse.json({
        error: 'Sin datos de precios disponibles para esa búsqueda.',
        zonapropUrl,
        prices: [],
      });
    }

    prices.sort((a, b) => a - b);
    const min    = prices[0];
    const max    = prices[prices.length - 1];
    const avg    = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const median = prices[Math.floor(prices.length / 2)];

    // Extraer fragmentos de listados (líneas con precio y contexto)
    const listings = markdown
      .split('\n')
      .filter(line => /\$\s*[\d.]+/.test(line) && line.length > 20 && line.length < 250)
      .map(line => line.trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`]/g, '').trim())
      .filter(Boolean)
      .slice(0, 6);

    return NextResponse.json({
      source:     'Zonaprop',
      zonapropUrl,
      type,
      rooms: parseInt(rooms),
      city,
      neighborhood: neighborhood || null,
      priceCount: prices.length,
      min, max, avg, median,
      listings,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'No se pudo obtener referencias de mercado.' },
      { status: 500 },
    );
  }
}
