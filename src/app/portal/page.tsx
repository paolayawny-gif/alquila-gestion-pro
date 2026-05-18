import { getAdminDb } from '@/lib/firebase-admin';
import type { Metadata } from 'next';
import { PortalPage } from './portal-page';

const APP_ID = 'alquilagestion-pro';

export interface PortalProperty {
  id: string;
  adminId: string;
  name: string;
  address: string;
  type: string;
  usage?: string;
  squareMeters?: number;
  rooms?: number;
  amenities?: string[];
  photos?: string[];
  currentRentAmount?: number;
  currency?: string;
  status: string;
}

export interface PortalAdmin {
  adminId: string;
  displayName?: string;
  whatsappNumber?: string;
  logoUrl?: string;
}

// IDs de los admins con Portal Plus aprobado por el super-admin.
async function getApprovedAdminIds(db: FirebaseFirestore.Firestore): Promise<Set<string>> {
  const reqSnap = await db
    .collection('artifacts').doc(APP_ID)
    .collection('superadmin').doc('data')
    .collection('portalPlusRequests')
    .get();
  return new Set(reqSnap.docs.filter(d => d.data().status === 'aprobada').map(d => d.id));
}

async function getPortalData(): Promise<{ properties: PortalProperty[]; admins: Record<string, PortalAdmin> }> {
  try {
    return await loadPortalData();
  } catch (err) {
    // Si Firestore no está disponible, mostramos el portal vacío en vez de un error.
    console.error('[portal] No se pudieron cargar las propiedades:', err);
    return { properties: [], admins: {} };
  }
}

async function loadPortalData(): Promise<{ properties: PortalProperty[]; admins: Record<string, PortalAdmin> }> {
  const db = getAdminDb();

  const approved = await getApprovedAdminIds(db);
  if (approved.size === 0) return { properties: [], admins: {} };

  // Trae todas las propiedades de todos los admins (collection group).
  const propsSnap = await db.collectionGroup('propiedades').get();

  const candidates = propsSnap.docs
    .map(d => {
      const adminRef = d.ref.parent.parent;
      const appRef = adminRef?.parent.parent;
      const adminId = adminRef?.id;
      if (!adminId || appRef?.id !== APP_ID) return null;
      if (!approved.has(adminId)) return null;
      const data = d.data() as Omit<PortalProperty, 'id' | 'adminId'> & {
        publicarEnPortal?: boolean;
        portalBlocked?: boolean;
      };
      // El admin tiene que haber habilitado la publicación; el super-admin no la bloqueó.
      if (data.status !== 'Disponible' || data.publicarEnPortal !== true || data.portalBlocked === true) {
        return null;
      }
      return { id: d.id, adminId, ...data } as PortalProperty;
    })
    .filter((p): p is PortalProperty => p !== null);

  const adminIds = [...new Set(candidates.map(p => p.adminId))];

  // Excluye propiedades con contrato vigente: si está alquilada, no tiene sentido publicarla.
  const withActiveContract = new Set<string>();
  await Promise.all(
    adminIds.map(async adminId => {
      const contractsSnap = await db
        .collection('artifacts').doc(APP_ID)
        .collection('users').doc(adminId)
        .collection('contratos').where('status', '==', 'Vigente')
        .get();
      contractsSnap.docs.forEach(c => {
        const pid = (c.data() as { propertyId?: string }).propertyId;
        if (pid) withActiveContract.add(`${adminId}/${pid}`);
      });
    }),
  );

  const properties = candidates.filter(p => !withActiveContract.has(`${p.adminId}/${p.id}`));

  const admins: Record<string, PortalAdmin> = {};
  await Promise.all(
    adminIds.map(async adminId => {
      const profileSnap = await db
        .collection('artifacts').doc(APP_ID)
        .collection('users').doc(adminId)
        .collection('config').doc('profile')
        .get();
      const profile = profileSnap.exists ? (profileSnap.data() as any) : {};
      admins[adminId] = {
        adminId,
        displayName: profile.displayName,
        whatsappNumber: profile.whatsappNumber,
        logoUrl: profile.logoUrl,
      };
    }),
  );

  return { properties, admins };
}

export const metadata: Metadata = {
  title: 'Portal de propiedades en alquiler — AlquilaGestión Pro',
  description: 'Encontrá propiedades en alquiler publicadas por inmobiliarias y administradores verificados.',
  openGraph: {
    title: 'Portal de propiedades en alquiler',
    description: 'Encontrá propiedades en alquiler de inmobiliarias verificadas.',
  },
};

export const revalidate = 300; // 5 min cache

export default async function Page() {
  const { properties, admins } = await getPortalData();
  return <PortalPage properties={properties} admins={admins} />;
}
