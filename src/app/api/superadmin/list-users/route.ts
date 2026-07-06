import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth, isSuperAdmin } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/list-users
 * Returns all Firebase Auth accounts for superadmin audit.
 * Only accessible by the superadmin.
 */
export async function GET(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isSuperAdmin(auth)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminAuth = getAdminAuth();
  const users: object[] = [];
  let pageToken: string | undefined;

  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    for (const user of result.users) {
      users.push({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        lastRefreshAt: user.metadata.lastRefreshTime ?? null,
        providerIds: user.providerData.map((p) => p.providerId),
        customClaims: user.customClaims ?? null,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  users.sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ total: users.length, users });
}
