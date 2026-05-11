import { NextRequest, NextResponse } from 'next/server';
import type { GoogleLeadResult } from '@/lib/types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Cache simple en memoria para no repetir queries idénticas en el mismo proceso
const cache = new Map<string, { results: GoogleLeadResult[]; cachedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  // Filtrar emails genéricos de Google / imágenes / tracking
  return [...new Set(matches)].filter(
    e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('google') &&
         !e.includes('gstatic') && !e.includes('w3.org'),
  );
}

async function searchGoogle(query: string, apiKey: string, cx: string): Promise<any[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&gl=ar&lr=lang_es`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Google CSE error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.items ?? [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ciudad    = searchParams.get('ciudad')?.trim()    ?? '';
  const provincia = searchParams.get('provincia')?.trim() ?? '';

  if (!ciudad || !provincia) {
    return NextResponse.json({ error: 'Parámetros ciudad y provincia son obligatorios.' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cx     = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cx) {
    return NextResponse.json({
      error: 'API de Google no configurada.',
      setup: 'Agregá GOOGLE_CSE_KEY y GOOGLE_CSE_ID en las variables de entorno de Vercel. Creá un Custom Search Engine en https://programmablesearchengine.google.com/',
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
    // Dos queries complementarias para maximizar emails en snippets
    const [items1, items2] = await Promise.allSettled([
      searchGoogle(`inmobiliaria "${ciudad}" correo electrónico email contacto`, apiKey, cx),
      searchGoogle(`inmobiliaria "${ciudad}" "@gmail.com" OR "@hotmail.com" OR "@yahoo.com.ar"`, apiKey, cx),
    ]);

    const allItems: any[] = [
      ...(items1.status === 'fulfilled' ? items1.value : []),
      ...(items2.status === 'fulfilled' ? items2.value : []),
    ];

    // Deduplicar por URL
    const seenUrls = new Set<string>();
    const results: GoogleLeadResult[] = [];

    for (const item of allItems) {
      const url: string = item.link ?? '';
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const fullText = `${item.title ?? ''} ${item.snippet ?? ''} ${item.pagemap?.metatags?.[0]?.['og:description'] ?? ''}`;
      const emails = extractEmails(fullText);

      results.push({
        agencia:   item.title?.replace(/\s*[-|–].*$/, '').trim() ?? 'Inmobiliaria sin nombre',
        email:     emails[0],
        emails,
        website:   url,
        snippet:   item.snippet ?? '',
        ciudad,
        provincia,
      });
    }

    cache.set(cacheKey, { results, cachedAt: Date.now() });
    return NextResponse.json({ results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al buscar en Google.' }, { status: 500 });
  }
}

// Resultados de demo cuando no hay API key configurada
function buildDemoResults(ciudad: string, provincia: string): GoogleLeadResult[] {
  return [
    {
      agencia: `Inmobiliaria Ejemplo ${ciudad}`,
      email: `contacto@inmobiliaria-${ciudad.toLowerCase().replace(/\s/g,'-')}.com.ar`,
      emails: [`contacto@inmobiliaria-${ciudad.toLowerCase().replace(/\s/g,'-')}.com.ar`],
      website: `https://www.inmobiliaria-ejemplo.com.ar`,
      snippet: `Resultado de demostración. Configurá GOOGLE_CSE_KEY y GOOGLE_CSE_ID para ver resultados reales de inmobiliarias en ${ciudad}, ${provincia}.`,
      ciudad,
      provincia,
    },
  ];
}
