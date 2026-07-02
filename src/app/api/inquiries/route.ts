import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── IP-based rate limiting (in-memory, per-process) ──────────────────────────
// Allows at most RATE_LIMIT requests per IP within RATE_WINDOW_MS.
// Suitable for a low-traffic public form; for high-scale use Upstash/Redis.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000; // 1 minute
const ipWindowMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindowMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipWindowMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count += 1;
  return false;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate-limit by IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { adminId, propertyId, propertyName, propertyAddress, name, email, phone, message } = body;

    if (!name?.trim() || !adminId || !propertyId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json({ error: 'Se requiere email o teléfono' }, { status: 400 });
    }

    const db = getAdminDb();

    // Validate that the property exists, belongs to the claimed adminId,
    // and is actually published on the portal (not blocked).
    // This prevents arbitrary data injection into any admin's inquiries subcollection.
    const propertyRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('propiedades').doc(propertyId);

    const propertySnap = await propertyRef.get();

    if (!propertySnap.exists) {
      return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 });
    }

    const propertyData = propertySnap.data() as {
      publicarEnPortal?: boolean;
      portalBlocked?: boolean;
    };

    if (!propertyData.publicarEnPortal) {
      return NextResponse.json({ error: 'Propiedad no disponible en el portal' }, { status: 403 });
    }

    if (propertyData.portalBlocked) {
      return NextResponse.json({ error: 'Propiedad no disponible en el portal' }, { status: 403 });
    }

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
