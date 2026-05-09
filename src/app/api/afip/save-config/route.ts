import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { parsePfx } from '@/lib/afip-service';
import { encrypt } from '@/lib/afip-crypto';

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
