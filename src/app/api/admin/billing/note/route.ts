import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireSuperAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * GET /api/admin/billing/note?adminId=xxx
 * POST /api/admin/billing/note { adminId, note }
 *
 * Notas internas del super admin sobre cada cliente. Privadas — no las ve el admin.
 * Path: artifacts/{APP_ID}/billingNotes/{adminId}
 */

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const adminId = req.nextUrl.searchParams.get('adminId');
    if (!adminId) return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });

    const snap = await getAdminDb()
      .collection('artifacts').doc(APP_ID)
      .collection('billingNotes').doc(adminId)
      .get();

    return NextResponse.json({ ok: true, note: snap.exists ? snap.data() : null });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));
    const { adminId, note } = (await req.json()) as { adminId: string; note: string };
    if (!adminId) return NextResponse.json({ error: 'Falta adminId' }, { status: 400 });

    await getAdminDb()
      .collection('artifacts').doc(APP_ID)
      .collection('billingNotes').doc(adminId)
      .set({ note: note ?? '', updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}
