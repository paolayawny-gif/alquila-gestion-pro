import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { parsePfx } from '@/lib/afip-service';
import { encrypt } from '@/lib/afip-crypto';
import { requireFirebaseAuth, isSuperAdminUid } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

export async function POST(req: NextRequest) {
  try {
    const { adminId, ownerEmail, cuit, puntoVenta, tipoComprobante, pfxBase64, pfxPassword, environment } =
      await req.json() as {
        adminId: string;
        ownerEmail: string;
        cuit: string;
        puntoVenta: number;
        tipoComprobante: number;
        pfxBase64: string;
        pfxPassword: string;
        environment: 'testing' | 'production';
      };

    const auth = await requireFirebaseAuth(req);
    if (auth instanceof NextResponse) return auth;

    // Permitir: el admin del namespace, o el propio owner cuyo email coincide.
    const isAdmin = auth.userId === adminId;
    const isOwner = !!auth.email && !!ownerEmail && auth.email.toLowerCase() === ownerEmail.toLowerCase();
    if (!isAdmin && !isOwner && !isSuperAdminUid(auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!adminId || !ownerEmail || !cuit || !pfxBase64) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Parse .pfx → cert + key PEM
    const { certPem, keyPem } = parsePfx(pfxBase64, pfxPassword ?? '');

    // Encrypt before storing
    const certEncrypted = encrypt(certPem);
    const keyEncrypted  = encrypt(keyPem);

    const db = getAdminDb();
    await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('afip_configs').doc(ownerEmail)
      .set({
        cuit:            cuit.replace(/[^0-9]/g, ''),
        puntoVenta:      Number(puntoVenta),
        tipoComprobante: Number(tipoComprobante),
        environment:     environment ?? 'testing',
        certEncrypted,
        keyEncrypted,
        savedAt: new Date().toISOString(),
      });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error guardando configuración' }, { status: 500 });
  }
}
