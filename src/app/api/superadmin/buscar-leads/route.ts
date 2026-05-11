import { NextRequest, NextResponse } from 'next/server';
import type { GoogleLeadResult } from '@/lib/types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const cache = new Map<string, { results: GoogleLeadResult[]; cachedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 min

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return [...new Set(matches)].filter(
    e => !e.endsWith('.png') && !e.endsWith('.jpg') &&
         !e.includes('google') && !e.includes('gstatic') &&
         !e.includes('w3.org') && !e.includes('brave.com') &&
         !e.includes('example'),
  );
}

async function searchBrave(query: string, apiKey: string): Promise<any[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&country=ar&search_lang=es&freshness=none`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Brave Search error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.web?.results ?? [];
}

function mapBraveResults(items: any[], ciudad: string, provincia: string): GoogleLeadResult[] {
  const seenUrls = new Set<string>();
  const results: GoogleLeadResult[] = [];
  for (const item of items) {
    const url: string = item.url ?? '';
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const fullText = `${item.title ?? ''} ${item.description ?? ''}`;
    const emails = extractEmails(fullText);
    results.push({
      agencia: item.title?.replace(/\s*[-|–|·].*$/, '').trim() ?? 'Inmobiliaria',
      email: emails[0],
      emails,
      website: url,
      snippet: item.description ?? '',
      ciudad,
      provincia,
    });
  }
  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ciudad    = searchParams.get('ciudad')?.trim()    ?? '';
  const provincia = searchParams.get('provincia')?.trim() ?? '';

  if (!ciudad || !provincia) {
    return NextResponse.json({ error: 'Parámetros ciudad y provincia son obligatorios.' }, { status: 400 });
  }

  const braveKey = process.env.BRAVE_SEARCH_KEY;

  if (!braveKey) {
    return NextResponse.json({
      error: 'API de búsqueda no configurada.',
      setup: 'Registrate gratis en brave.com/search/api y agregá BRAVE_SEARCH_KEY en las variables de entorno de Vercel.',
      demo: true,
      results: buildDemoResults(ciudad, provincia),
    });
  }

  const cacheKey = `${ciudad}|${provincia}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ results: cached.results, fromCache: true });
  }

  try {
    // Dos queries para maximizar cobertura de emails visibles en snippets
    const [r1, r2] = await Promise.allSettled([
      searchBrave(`inmobiliaria "${ciudad}" correo electrónico email contacto`, braveKey),
      searchBrave(`inmobiliaria "${ciudad}" "${provincia}" "@gmail.com" OR "@hotmail.com" OR "@yahoo.com.ar"`, braveKey),
    ]);

    const allItems = [
      ...(r1.status === 'fulfilled' ? r1.value : []),
      ...(r2.status === 'fulfilled' ? r2.value : []),
    ];

    const results = mapBraveResults(allItems, ciudad, provincia);
    cache.set(cacheKey, { results, cachedAt: Date.now() });
    return NextResponse.json({ results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al buscar.' }, { status: 500 });
  }
}

function buildDemoResults(ciudad: string, provincia: string): GoogleLeadResult[] {
  return [
    {
      agencia: `Inmobiliaria Ejemplo ${ciudad}`,
      email: `contacto@inmobiliaria-${ciudad.toLowerCase().replace(/\s+/g, '-')}.com.ar`,
      emails: [`contacto@inmobiliaria-${ciudad.toLowerCase().replace(/\s+/g, '-')}.com.ar`],
      website: `https://www.inmobiliaria-ejemplo.com.ar`,
      snippet: `Demo. Registrate en brave.com/search/api (gratis) y agregá BRAVE_SEARCH_KEY en Vercel para ver inmobiliarias reales en ${ciudad}, ${provincia}.`,
      ciudad,
      provincia,
    },
  ];
}
