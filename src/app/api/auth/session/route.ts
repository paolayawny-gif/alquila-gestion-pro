import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireFirebaseAuth, createSession, logout, isSuperAdminUid } from '@/lib/auth';
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

  const db = getAdminDb();

  // Gate: new accounts (no prior Firestore doc) must have a verified email before
  // receiving a session cookie. This prevents anonymous spam registrations from
  // accessing the dashboard. Existing accounts are never blocked here.
  // The superadmin is always exempt regardless of email verification state.
  if (!isSuperAdminUid(auth.userId)) {
    const userRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(auth.userId);
    const existingDoc = await userRef.get();

    if (!existingDoc.exists && !auth.emailVerified) {
      return NextResponse.json(
        { error: 'email_not_verified' },
        { status: 403 },
      );
    }
  }

  const sessionId = randomUUID();

  // Store the current sessionId where the client SDK can read it (same path as app data)
  await db
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(auth.userId)
    .set(
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
  await db
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(auth.userId)
    .set(
      { currentSessionId: null, sessionUpdatedAt: new Date().toISOString() },
      { merge: true },
    );

  await logout();
  return NextResponse.json({ ok: true });
}
