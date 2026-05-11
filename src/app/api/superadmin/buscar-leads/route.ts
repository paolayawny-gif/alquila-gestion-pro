import { NextRequest, NextResponse } from 'next/server';
import type { GoogleLeadResult } from '@/lib/types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const cache = new Map<string, { results: GoogleLeadResult[]; cachedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30;

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return [...new Set(matches)].filter(
    e => !e.endsWith('.png') && !e.endsWith('.jpg') &&
         !e.includes('google') && !e.includes('gstatic') &&
         !e.includes('w3.org') && !e.includes('schema') &&
         !e.includes('example') && !e.includes('serper'),
  );
}

async function serperSearch(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'ar', hl: 'es', num: 10 }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Serper error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.organic ?? [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ciudad    = searchParams.get('ciudad')?.trim()    ?? '';
  const provincia = searchParams.get('provincia')?.trim() ?? '';

  if (!ciudad || !provincia) {
    return NextResponse.json({ error: 'Parámetros ciudad y provincia son obligatorios.' }, { status: 400 });
  }

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: 'API key no configurada.',
      setup: 'Registrate gratis en serper.dev (2500 búsquedas sin tarjeta) y agregá SERPER_API_KEY en Vercel.',
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
    // Dos queries: una para emails visibles, otra para encontrar más agencias
    const [r1, r2] = await Promise.allSettled([
      serperSearch(`inmobiliaria "${ciudad}" correo electrónico email contacto`, apiKey),
      serperSearch(`inmobiliaria "${ciudad}" "@gmail.com" OR "@hotmail.com" OR "@yahoo.com.ar"`, apiKey),
    ]);

    const allItems = [
      ...(r1.status === 'fulfilled' ? r1.value : []),
      ...(r2.status === 'fulfilled' ? r2.value : []),
    ];

    const seenUrls = new Set<string>();
    const results: GoogleLeadResult[] = [];

    for (const item of allItems) {
      const url: string = item.link ?? '';
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const fullText = `${item.title ?? ''} ${item.snippet ?? ''}`;
      const emails = extractEmails(fullText);

      results.push({
        agencia: item.title?.replace(/\s*[-|–·|].*$/, '').trim() ?? 'Inmobiliaria',
        email:   emails[0],
        emails,
        website: url,
        snippet: item.snippet ?? '',
        ciudad,
        provincia,
      });
    }

    cache.set(cacheKey, { results, cachedAt: Date.now() });
    return NextResponse.json({ results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al buscar.' }, { status: 500 });
  }
}

function buildDemoResults(ciudad: string, provincia: string): GoogleLeadResult[] {
  return [
    {
      agencia: `Inmobiliaria Demo — ${ciudad}`,
      email: `contacto@inmobiliaria-demo.com.ar`,
      emails: [`contacto@inmobiliaria-demo.com.ar`],
      website: `https://www.inmobiliaria-demo.com.ar`,
      snippet: `Resultado de demostración. Registrate en serper.dev (gratis, sin tarjeta) y agregá SERPER_API_KEY en Vercel para ver inmobiliarias reales de ${ciudad}, ${provincia}.`,
      ciudad,
      provincia,
    },
  ];
}
