import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth, isSuperAdminUid } from '@/lib/auth';
import type { GoogleLeadResult } from '@/lib/types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const GOOGLE_CX = 'e622f629b8fcb4cd6';

const cache = new Map<string, { results: GoogleLeadResult[]; cachedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30;

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return [...new Set(matches)].filter(
    e => !e.endsWith('.png') && !e.endsWith('.jpg') &&
         !e.includes('google') && !e.includes('gstatic') &&
         !e.includes('w3.org') && !e.includes('schema') && !e.includes('example'),
  );
}

async function googleSearch(query: string, apiKey: string): Promise<any[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10&gl=ar&lr=lang_es`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Google CSE error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.items ?? [];
}

export async function GET(req: NextRequest) {
  // Solo superadmin puede usar este endpoint — bloquea abuse de la API key de Google
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isSuperAdminUid(auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const ciudad    = searchParams.get('ciudad')?.trim()    ?? '';
  const provincia = searchParams.get('provincia')?.trim() ?? '';

  if (!ciudad || !provincia) {
    return NextResponse.json({ error: 'Parámetros ciudad y provincia son obligatorios.' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_CSE_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: 'API key no configurada.',
      setup: 'Creá una API key en console.cloud.google.com → APIs y servicios → Credenciales → Crear clave de API. Habilitá "Custom Search API". Agregá GOOGLE_CSE_KEY en Vercel.',
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
    const [r1, r2] = await Promise.allSettled([
      googleSearch(`inmobiliaria "${ciudad}" correo electrónico email contacto`, apiKey),
      googleSearch(`inmobiliaria "${ciudad}" "@gmail.com" OR "@hotmail.com" OR "@yahoo.com.ar"`, apiKey),
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

      const fullText = `${item.title ?? ''} ${item.snippet ?? ''} ${item.pagemap?.metatags?.[0]?.['og:description'] ?? ''}`;
      const emails = extractEmails(fullText);

      results.push({
        agencia: item.title?.replace(/\s*[-|–·].*$/, '').trim() ?? 'Inmobiliaria',
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
  return [{
    agencia: `Inmobiliaria Demo — ${ciudad}`,
    email: 'contacto@inmobiliaria-demo.com.ar',
    emails: ['contacto@inmobiliaria-demo.com.ar'],
    website: 'https://www.inmobiliaria-demo.com.ar',
    snippet: `Demo. Agregá GOOGLE_CSE_KEY en Vercel para ver inmobiliarias reales de ${ciudad}, ${provincia}.`,
    ciudad,
    provincia,
  }];
}
