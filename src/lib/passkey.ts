import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

const CHALLENGE_SECRET = process.env.JWT_SECRET
  ? process.env.JWT_SECRET + '_passkey'
  : randomBytes(32).toString('hex');

const encoded = new TextEncoder().encode(CHALLENGE_SECRET);

/** Signs a WebAuthn challenge into a short-lived JWT (5 min) */
export async function signChallenge(challenge: string, extra?: Record<string, unknown>) {
  return new SignJWT({ challenge, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .setIssuedAt()
    .sign(encoded);
}

/** Verifies the state token and returns the original challenge */
export async function verifyChallenge(stateToken: string): Promise<{ challenge: string } & Record<string, unknown>> {
  const { payload } = await jwtVerify(stateToken, encoded, { algorithms: ['HS256'] });
  if (!payload.challenge || typeof payload.challenge !== 'string') {
    throw new Error('Invalid state token');
  }
  return payload as { challenge: string } & Record<string, unknown>;
}

/** RP config for WebAuthn — derived from request origin */
export function getRpConfig(origin: string) {
  const url = new URL(origin);
  return {
    rpName: 'AlquilaGestión Pro',
    rpID: url.hostname,
    origin,
  };
}
