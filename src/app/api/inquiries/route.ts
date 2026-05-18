import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminId, propertyId, propertyName, propertyAddress, name, email, phone, message } = body;

    if (!name?.trim() || !adminId || !propertyId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json({ error: 'Se requiere email o teléfono' }, { status: 400 });
    }

    const db = getAdminDb();
    await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('inquiries')
      .add({
        propertyId,
        propertyName: propertyName ?? '',
        propertyAddress: propertyAddress ?? '',
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        message: message?.trim() || '',
        status: 'NUEVO',
        createdAt: new Date().toISOString(),
      });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[inquiries]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
