import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth, isSuperAdminUid } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/superadmin/set-custom-claims
 * Sets { superAdmin: true } as a custom claim on the caller's own account.
 * Only callable by the current SUPERADMIN_UID (UID-based check, pre-claims migration).
 *
 * After calling this endpoint once, the Firestore rule can drop the UID fallback
 * and rely solely on request.auth.token.superAdmin == true.
 *
 * The caller must force-refresh their ID token to pick up the new claim:
 *   await auth.currentUser.getIdToken(true)
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isSuperAdminUid(auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await getAdminAuth().setCustomUserClaims(auth.userId, { superAdmin: true });

  return NextResponse.json({
    ok: true,
    message: 'Custom claim superAdmin:true set. Force-refresh your ID token (getIdToken(true)) for it to take effect.',
  });
}
