import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireFirebaseAuth, createSession, logout } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/auth/session
 * Called after Firebase client-side login.
 * Verifies the Firebase ID token, sets a JWT session cookie, and registers
 * the session in Firestore for cross-device detection.
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const sessionId = randomUUID();

  // Store the current sessionId in Firestore so other devices can detect they were displaced
  const db = getAdminDb();
  await db.collection('users').doc(auth.userId).set(
    { currentSessionId: sessionId, sessionUpdatedAt: new Date().toISOString() },
    { merge: true },
  );

  // Set the JWT session cookie (used by middleware for server-side route protection)
  await createSession(auth.userId, 'user');

  return NextResponse.json({ sessionId });
}

/**
 * DELETE /api/auth/session
 * Called on logout. Clears the session cookie and removes the sessionId from Firestore.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) {
    // Even if token is invalid/expired, clear the cookie
    await logout();
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  await db.collection('users').doc(auth.userId).set(
    { currentSessionId: null, sessionUpdatedAt: new Date().toISOString() },
    { merge: true },
  );

  await logout();
  return NextResponse.json({ ok: true });
}
