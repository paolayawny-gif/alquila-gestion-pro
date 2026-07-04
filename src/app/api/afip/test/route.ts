import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getWSAAToken } from '@/lib/afip-service';
import { decrypt } from '@/lib/afip-crypto';
import { requireFirebaseAuth, isSuperAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    const { adminId, ownerEmail } = await req.json() as { adminId: string; ownerEmail: string };

    const auth = await requireFirebaseAuth(req);
    if (auth instanceof NextResponse) return auth;
    const isAdmin = auth.userId === adminId;
    const isOwner = !!auth.email && !!ownerEmail && auth.email.toLowerCase() === ownerEmail.toLowerCase();
    if (!isAdmin && !isOwner && !isSuperAdmin(auth)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db  = getAdminDb();
    const doc = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('afip_configs').doc(ownerEmail)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Configuración AFIP no encontrada' }, { status: 404 });
    }

    const cfg = doc.data()!;
    const certPem = decrypt(cfg.certEncrypted);
    const keyPem  = decrypt(cfg.keyEncrypted);

    await getWSAAToken(certPem, keyPem, cfg.environment);

    // Persist last test result
    await doc.ref.update({ lastTestAt: new Date().toISOString(), lastTestStatus: 'ok' });

    return NextResponse.json({ ok: true, environment: cfg.environment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error de conexión AFIP' }, { status: 500 });
  }
}
