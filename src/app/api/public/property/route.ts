import { APP_ID } from '@/lib/constants';
import { getAdminDb } from '@/lib/firebase-admin';
import { redactPropertyForPublic } from '@/lib/redact-public-property';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lookup público de una propiedad para el formulario de postulación (/apply).
 * Usa Admin SDK server-side y redacta contacto del propietario antes de responder,
 * en vez de dejar que el cliente lea el documento de Firestore directamente
 * (eso expondría `owners`/notas internas sin filtro, ver firestore.rules).
 */
export async function GET(req: NextRequest) {
  const adminId = req.nextUrl.searchParams.get('adminId');
  const propertyId = req.nextUrl.searchParams.get('propertyId');

  if (!adminId || !propertyId) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('propiedades').doc(propertyId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 });
    }

    const property = redactPropertyForPublic({ id: snap.id, ...snap.data() });
    return NextResponse.json({ property });
  } catch (err) {
    console.error('[public/property]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
