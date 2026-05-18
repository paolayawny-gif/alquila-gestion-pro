import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { requireFirebaseAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { signChallenge, verifyChallenge, getRpConfig } from '@/lib/passkey';

/**
 * GET /api/auth/passkey/register
 * Returns WebAuthn registration options + a signed state token containing the challenge.
 * Requires Firebase auth.
 */
export async function GET(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const { rpName, rpID } = getRpConfig(origin);

  // Fetch existing passkeys so we can exclude them (avoid duplicate registrations)
  const db = getAdminDb();
  const existingSnap = await db
    .collection('users').doc(auth.userId)
    .collection('passkeys').get();

  const excludeCredentials = existingSnap.docs.map((d) => ({
    id: d.id,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(auth.userId),
    userName: auth.email ?? auth.userId,
    userDisplayName: auth.email ?? auth.userId,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform', // only built-in biometrics (Touch ID, Windows Hello, Face ID)
    },
  });

  const stateToken = await signChallenge(options.challenge, { uid: auth.userId });

  return NextResponse.json({ options, stateToken });
}

/**
 * POST /api/auth/passkey/register
 * Verifies the registration response and stores the credential in Firestore.
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { response, stateToken, name } = await req.json();

  let challenge: string;
  try {
    const payload = await verifyChallenge(stateToken);
    if (payload.uid !== auth.userId) {
      return NextResponse.json({ error: 'Token mismatch' }, { status: 401 });
    }
    challenge = payload.challenge;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired state token' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter, credentialDeviceType } = verification.registrationInfo;

  const db = getAdminDb();
  await db
    .collection('users').doc(auth.userId)
    .collection('passkeys').doc(credentialID)
    .set({
      publicKey: Buffer.from(credentialPublicKey).toString('base64'),
      counter,
      deviceType: credentialDeviceType,
      name: name ?? 'Este dispositivo',
      createdAt: new Date().toISOString(),
      userEmail: auth.email ?? null,
    });

  // Also store email→uid mapping for lookup during authentication
  if (auth.email) {
    await db.collection('passkey_email_index').doc(auth.email.toLowerCase()).set(
      { uid: auth.userId },
      { merge: true },
    );
  }

  return NextResponse.json({ ok: true });
}
