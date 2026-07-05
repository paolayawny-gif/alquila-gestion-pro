import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth } from '@/lib/auth';
import { getModel } from '@/ai/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/validate-key
 * Body: { apiKey }
 * Hace una llamada mínima a Gemini con la key del admin para confirmar que es
 * válida antes de guardarla — evita mostrar "guardado" con una key rota.
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { apiKey } = (await req.json()) as { apiKey?: string };
  if (!apiKey?.trim()) {
    return NextResponse.json({ valid: false, error: 'Falta la API key.' }, { status: 400 });
  }

  try {
    const model = getModel({ apiKey: apiKey.trim(), modelName: 'gemini-2.5-flash' });
    await model.generateContent('Respondé únicamente: {"ok": true}');
    return NextResponse.json({ valid: true });
  } catch (e: any) {
    const message = e?.message?.includes('API_KEY_INVALID') || e?.message?.includes('API key not valid')
      ? 'La API key no es válida.'
      : 'No se pudo validar la key con Google. Revisá que esté activa y con cuota disponible.';
    return NextResponse.json({ valid: false, error: message }, { status: 200 });
  }
}
