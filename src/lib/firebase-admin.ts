import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

function ensureApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
}

export function getAdminDb() {
  ensureApp();
  return getFirestore();
}

export function getAdminAuth() {
  ensureApp();
  return getAuth();
}

/**
 * Verifica el ID token y devuelve el decoded claims.
 * Lanza si el token es inválido o expiró.
 */
export async function verifyIdToken(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Falta header Authorization: Bearer <idToken>');
  }
  const token = authHeader.slice(7);
  return getAdminAuth().verifyIdToken(token);
}

/**
 * Verifica el ID token Y exige que sea super admin.
 * Devuelve el UID del super admin.
 */
export async function requireSuperAdmin(authHeader: string | null): Promise<string> {
  const decoded = await verifyIdToken(authHeader);
  if (decoded.email !== SUPER_ADMIN_EMAIL) {
    throw new Error('Solo el super admin puede ejecutar esta acción');
  }
  return decoded.uid;
}
