import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionForAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { apiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Rate limiting — máx 30 llamadas por admin por hora ────────────────────────
// Usa Firestore como store distribuido (funciona en serverless/multi-instancia).
const AI_RATE_LIMIT = 30; // requests por ventana
const AI_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora

async function checkRateLimit(adminId: string): Promise<boolean> {
  try {
    const db = getAdminDb();
    const ref = db
      .collection('artifacts').doc(APP_ID)
      .collection('_rateLimits').doc(`ai:${adminId}`);

    const now = Date.now();
    const windowStart = now - AI_RATE_WINDOW_MS;

    const allowed = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data()! : { count: 0, windowStart: now };

      // Resetear la ventana si expiró
      if (data.windowStart < windowStart) {
        tx.set(ref, { count: 1, windowStart: now });
        return true;
      }

      if (data.count >= AI_RATE_LIMIT) return false;

      tx.update(ref, { count: data.count + 1 });
      return true;
    });

    return allowed;
  } catch {
    // Si Firestore falla, dejar pasar para no bloquear el servicio
    return true;
  }
}


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

    // Rate limit — 30 req/hora por admin
    const allowed = await checkRateLimit(adminId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Límite de consultas alcanzado. Intentá de nuevo en una hora.' },
        { status: 429 },
      );
    }

    const sharedApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    // Traer datos del admin desde Firestore
    const db = getAdminDb();
    const base = `artifacts/${APP_ID}/users/${adminId}`;

    const [propsSnap, contSnap, inqSnap, maintSnap, aiConfigSnap] = await Promise.all([
      db.collection(`${base}/propiedades`).get(),
      db.collection(`${base}/contratos`).get(),
      db.collection(`${base}/inquilinos`).get(),
      db.collection(`${base}/mantenimiento`).limit(20).get(),
      db.doc(`${base}/config/aiConfig`).get(),
    ]);

    // Si el admin cargó su propia key de Gemini (misma que desbloquea el modo
    // Pro en Análisis Legal), se usa acá también — antes el asistente de chat
    // siempre corría con la key compartida sin que nada lo indicara.
    const ownApiKey: string | undefined = aiConfigSnap.exists ? aiConfigSnap.data()?.geminiApiKey : undefined;
    const apiKey = ownApiKey?.trim() || sharedApiKey;
    const usingOwnKey = !!ownApiKey?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en Vercel.' }, { status: 500 });
    }

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

    return NextResponse.json({ ok: true, answer, followUpQuestions, usingOwnKey });
  } catch (e: any) {
    console.error('[ai/assistant] error:', e);
    return NextResponse.json({ error: apiError(e) }, { status: 500 });
  }
}
