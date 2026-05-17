import { NextRequest, NextResponse } from 'next/server';
import { requireSessionForAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { askDataAssistant } from '@/ai/flows/data-assistant-flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * POST /api/ai/assistant
 * Body: { adminId, question }
 * Returns: { ok, answer, followUpQuestions }
 *
 * Queries only the authenticated admin's Firestore data and passes it as
 * context to Gemini Flash. No external data, no cross-admin data leaks.
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId, question } = (await req.json()) as { adminId: string; question: string };

    if (!adminId || !question?.trim()) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    const db = getAdminDb();
    const base = `artifacts/${APP_ID}/users/${adminId}`;

    // Fetch admin's data in parallel — only what's needed for the context
    const [propsSnap, contSnap, inqSnap, maintSnap] = await Promise.all([
      db.collection(`${base}/propiedades`).get(),
      db.collection(`${base}/contratos`).get(),
      db.collection(`${base}/inquilinos`).get(),
      db.collection(`${base}/mantenimiento`).limit(20).get(),
    ]);

    // Build compact context string — only key fields to minimize tokens
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

    const context = `
FECHA HOY: ${today}

=== PROPIEDADES (${propsSnap.size}) ===
${properties}

=== CONTRATOS (${contSnap.size}) ===
${contracts}

=== INQUILINOS (${inqSnap.size}) ===
${tenants}

=== MANTENIMIENTO (${maintSnap.size} recientes) ===
${maintenance}
`.trim();

    const result = await askDataAssistant({ question, context });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (e: any) {
    console.error('[ai/assistant] error:', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
