import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionForAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const SYSTEM_PROMPT = `Sos el asistente de datos de "AlquilaGestión Pro".

REGLAS ESTRICTAS:
1. Respondé SIEMPRE en español rioplatense (voseo).
2. Usá EXCLUSIVAMENTE los datos del bloque DATOS DEL ADMIN. No uses conocimiento externo.
3. Si la pregunta no se puede responder con los datos provistos, respondé: "No tengo esa información en tus datos actuales."
4. Si la pregunta no tiene relación con gestión inmobiliaria (recetas, tareas escolares, noticias, etc.), respondé: "Solo puedo ayudarte con información de tus propiedades, inquilinos, contratos y pagos."
5. Sé conciso y directo. Usá listas cuando la respuesta tenga múltiples ítems.
6. Nunca inventes datos, montos, fechas o nombres que no estén en el contexto.
7. Al final de tu respuesta agregá siempre un bloque JSON en esta forma exacta (sin markdown):
FOLLOWUPS:["pregunta 1","pregunta 2","pregunta 3"]`;

/**
 * POST /api/ai/assistant
 * Llama directo a la API REST de Gemini Flash — sin Genkit, sin Vertex, sin SDK.
 * Solo se activa cuando el usuario envía una pregunta. Costo = $0 en reposo.
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId, question } = (await req.json()) as { adminId: string; question: string };

    if (!adminId || !question?.trim()) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en Vercel.' }, { status: 500 });
    }

    // Traer datos del admin desde Firestore
    const db = getAdminDb();
    const base = `artifacts/${APP_ID}/users/${adminId}`;

    const [propsSnap, contSnap, inqSnap, maintSnap] = await Promise.all([
      db.collection(`${base}/propiedades`).get(),
      db.collection(`${base}/contratos`).get(),
      db.collection(`${base}/inquilinos`).get(),
      db.collection(`${base}/mantenimiento`).limit(20).get(),
    ]);

    const properties = propsSnap.docs.map(d => {
      const p = d.data();
      return `- ${p.name ?? p.address} | ${p.type ?? ''} | Estado: ${p.status ?? ''} | Ambientes: ${p.rooms ?? '?'} | Sup: ${p.squareMeters ?? '?'}m²`;
    }).join('\n') || 'Sin propiedades cargadas.';

    const contracts = contSnap.docs.map(d => {
      const c = d.data();
      return `- Inquilino: ${c.tenantName ?? c.tenantId} | Propiedad: ${c.propertyName ?? c.propertyId} | Desde: ${c.startDate} | Hasta: ${c.endDate} | Alquiler: ${c.currency} ${c.currentRentAmount} | Estado: ${c.status}`;
    }).join('\n') || 'Sin contratos cargados.';

    const tenants = inqSnap.docs.map(d => {
      const t = d.data();
      return `- ${t.fullName ?? t.name} | Email: ${t.email ?? '-'} | Tel: ${t.phone ?? '-'} | DNI/CUIL: ${t.taxId ?? '-'}`;
    }).join('\n') || 'Sin inquilinos cargados.';

    const maintenance = maintSnap.docs.map(d => {
      const m = d.data();
      return `- ${m.title ?? m.description ?? 'Tarea'} | Propiedad: ${m.propertyName ?? m.propertyId ?? '-'} | Estado: ${m.status ?? '-'}`;
    }).join('\n') || 'Sin tareas de mantenimiento.';

    const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const userMessage = `FECHA HOY: ${today}

=== DATOS DEL ADMIN ===

PROPIEDADES (${propsSnap.size}):
${properties}

CONTRATOS (${contSnap.size}):
${contracts}

INQUILINOS (${inqSnap.size}):
${tenants}

MANTENIMIENTO (${maintSnap.size} recientes):
${maintenance}

=== PREGUNTA ===
${question}`;

    // Llamada directa a la API REST de Gemini Flash — sin SDK, sin Genkit, sin Vertex
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[ai/assistant] Gemini error:', errText);
      return NextResponse.json({ error: `Error de Gemini: ${geminiRes.status}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extraer followUps del bloque FOLLOWUPS:[...] que pidió el system prompt
    let answer = rawText;
    let followUpQuestions: string[] = [];

    const followupsMatch = rawText.match(/FOLLOWUPS:\[([^\]]*)\]/);
    if (followupsMatch) {
      try {
        followUpQuestions = JSON.parse(`[${followupsMatch[1]}]`);
      } catch {}
      answer = rawText.replace(/FOLLOWUPS:\[([^\]]*)\]/, '').trim();
    }

    return NextResponse.json({ ok: true, answer, followUpQuestions });
  } catch (e: any) {
    console.error('[ai/assistant] error:', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
