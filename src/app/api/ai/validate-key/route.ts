import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth } from '@/lib/auth';
import { generateText } from '@/ai/gemini';
import { AI_PROVIDERS, type AIProvider } from '@/ai/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/validate-key
 * Body: { apiKey, provider }
 * Hace una llamada mínima al proveedor elegido con la key del admin para
 * confirmar que es válida antes de guardarla — evita mostrar "guardado" con
 * una key rota.
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { apiKey, provider } = (await req.json()) as { apiKey?: string; provider?: AIProvider };
  if (!apiKey?.trim()) {
    return NextResponse.json({ valid: false, error: 'Falta la API key.' }, { status: 400 });
  }
  if (!provider || !AI_PROVIDERS.some(p => p.value === provider)) {
    return NextResponse.json({ valid: false, error: 'Elegí un proveedor de IA.' }, { status: 400 });
  }

  try {
    await generateText(
      'Respondé solo con la palabra: ok',
      'Confirmá que estás funcionando.',
      { apiKey: apiKey.trim(), provider },
    );
    return NextResponse.json({ valid: true });
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    const looksInvalid = /API_KEY_INVALID|api key not valid|invalid.*api.?key|401|unauthorized|authentication/i.test(msg);
    return NextResponse.json({
      valid: false,
      error: looksInvalid
        ? 'La API key no es válida.'
        : 'No se pudo validar la key. Revisá que esté activa y con cuota disponible.',
    }, { status: 200 });
  }
}
