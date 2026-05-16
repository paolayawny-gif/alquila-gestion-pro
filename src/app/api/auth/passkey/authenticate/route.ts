import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { signChallenge, verifyChallenge, getRpConfig } from '@/lib/passkey';

/**
 * GET /api/auth/passkey/authenticate?email=...
 * Returns WebAuthn authentication options for a given email.
 * No auth required — this is the login step.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'email requerido' }, { status: 400 });
  }

  const db = getAdminDb();

  // Look up uid from email index
  const indexSnap = await db.collection('passkey_email_index').doc(email).get();
  if (!indexSnap.exists) {
    return NextResponse.json({ error: 'no_passkeys' }, { status: 404 });
  }
  const uid = indexSnap.data()!.uid as string;

  // Fetch all registered passkeys for this user
  const passkeysSnap = await db
    .collection('users').doc(uid)
    .collection('passkeys').get();

  if (passkeysSnap.empty) {
    return NextResponse.json({ error: 'no_passkeys' }, { status: 404 });
  }

  const allowCredentials = passkeysSnap.docs.map((d) => ({
    id: d.id,
  }));

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  const stateToken = await signChallenge(options.challenge, { uid, email });

  return NextResponse.json({ options, stateToken });
}

/**
 * POST /api/auth/passkey/authenticate
 * Verifies the authentication response and returns a Firebase custom token.
 */
export async function POST(req: NextRequest) {
  const { response, stateToken } = await req.json();

  let uid: string;
  let challenge: string;
  try {
    const payload = await verifyChallenge(stateToken);
    uid = payload.uid as string;
    challenge = payload.challenge;
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
  }

  const credentialId = response.id as string;

  const db = getAdminDb();
  const passkeyDoc = await db
    .collection('users').doc(uid)
    .collection('passkeys').doc(credentialId)
    .get();

  if (!passkeyDoc.exists) {
    return NextResponse.json({ error: 'Passkey no encontrada' }, { status: 404 });
  }

  const stored = passkeyDoc.data()!;
  const publicKey = Buffer.from(stored.publicKey as string, 'base64');

  const origin = req.headers.get('origin') ?? req.nextUrl.origin;
  const { rpID } = getRpConfig(origin);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      authenticator: {
        credentialID: credentialId,
        credentialPublicKey: new Uint8Array(publicKey),
        counter: stored.counter as number,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Verificación fallida' }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verificación fallida' }, { status: 400 });
  }

  // Update the counter to prevent replay attacks
  await passkeyDoc.ref.update({ counter: verification.authenticationInfo.newCounter });

  // Issue a Firebase custom token so the client can sign in
  const customToken = await getAdminAuth().createCustomToken(uid);

  return NextResponse.json({ customToken });
}
