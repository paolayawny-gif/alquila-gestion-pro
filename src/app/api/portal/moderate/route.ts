import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireFirebaseAuth, isSuperAdmin } from '@/lib/auth';
import { APP_ID } from '@/lib/constants';

async function requireSuperAdmin(req: NextRequest): Promise<string | null> {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return null;
  return isSuperAdmin(auth) ? auth.userId : null;
}

export interface PortalListing {
  adminId: string;
  adminName: string;
  propertyId: string;
  name: string;
  address: string;
  status: string;
  portalBlocked: boolean;
  hasActiveContract: boolean;
  visible: boolean;
}

// GET — lista todas las publicaciones del portal para moderación.
export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const db = getAdminDb();
  const propsSnap = await db.collectionGroup('propiedades').get();

  const candidates = propsSnap.docs
    .map(d => {
      const adminRef = d.ref.parent.parent;
      const appRef = adminRef?.parent.parent;
      const adminId = adminRef?.id;
      if (!adminId || appRef?.id !== APP_ID) return null;
      const data = d.data() as any;
      if (data.publicarEnPortal !== true) return null;
      return { adminId, propertyId: d.id, data };
    })
    .filter((c): c is { adminId: string; propertyId: string; data: any } => c !== null);

  const adminIds = [...new Set(candidates.map(c => c.adminId))];

  const adminInfo: Record<string, { name: string; contracts: Set<string> }> = {};
  await Promise.all(
    adminIds.map(async adminId => {
      const [profileSnap, contractsSnap] = await Promise.all([
        db.collection('artifacts').doc(APP_ID).collection('users').doc(adminId)
          .collection('config').doc('profile').get(),
        db.collection('artifacts').doc(APP_ID).collection('users').doc(adminId)
          .collection('contratos').where('status', '==', 'Vigente').get(),
      ]);
      const contracts = new Set<string>();
      contractsSnap.docs.forEach(c => {
        const pid = (c.data() as { propertyId?: string }).propertyId;
        if (pid) contracts.add(pid);
      });
      adminInfo[adminId] = {
        name: (profileSnap.data() as any)?.displayName ?? adminId,
        contracts,
      };
    }),
  );

  const listings: PortalListing[] = candidates.map(c => {
    const info = adminInfo[c.adminId];
    const portalBlocked = c.data.portalBlocked === true;
    const hasActiveContract = info.contracts.has(c.propertyId);
    return {
      adminId: c.adminId,
      adminName: info.name,
      propertyId: c.propertyId,
      name: c.data.name ?? '(sin nombre)',
      address: c.data.address ?? '',
      status: c.data.status ?? '',
      portalBlocked,
      hasActiveContract,
      visible: !portalBlocked && !hasActiveContract && c.data.status === 'Disponible',
    };
  });

  return NextResponse.json({ listings });
}

// POST — bloquea, desbloquea o quita una publicación.
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { adminId, propertyId, action } = await req.json().catch(() => ({}));
  if (!adminId || !propertyId || !['block', 'unblock', 'unpublish'].includes(action)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const ref = getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('propiedades').doc(propertyId);

  const update =
    action === 'block' ? { portalBlocked: true }
    : action === 'unblock' ? { portalBlocked: false }
    : { publicarEnPortal: false, portalBlocked: false };

  await ref.set(update, { merge: true });

  return NextResponse.json({ ok: true });
}
