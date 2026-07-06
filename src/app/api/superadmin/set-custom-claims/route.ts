import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth, isSuperAdmin } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/superadmin/set-custom-claims
 * (Re)sets { superAdmin: true } as a custom claim on the caller's own account.
 * Only callable by an account that already holds the `superAdmin` claim — useful
 * for re-issuing the claim after a Firebase Auth export/import or account migration.
 *
 * The caller must force-refresh their ID token to pick up the new claim:
 *   await auth.currentUser.getIdToken(true)
 */
export async function POST(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await getAdminAuth().setCustomUserClaims(auth.userId, { superAdmin: true });

  return NextResponse.json({
    ok: true,
    message: 'Custom claim superAdmin:true set. Force-refresh your ID token (getIdToken(true)) for it to take effect.',
  });
}
