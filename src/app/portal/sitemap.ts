import type { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

const APP_ID = 'alquilagestion-pro';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://alquilagestionpro.com';

export const revalidate = 3600; // 1 hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/portal`, changeFrequency: 'daily', priority: 0.9 },
  ];

  try {
    const db = getAdminDb();

    const reqSnap = await db
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('data')
      .collection('portalPlusRequests')
      .get();
    const approved = new Set(reqSnap.docs.filter(d => d.data().status === 'aprobada').map(d => d.id));
    if (approved.size === 0) return entries;

    const propsSnap = await db.collectionGroup('propiedades').get();
    const published: { adminId: string; id: string }[] = [];
    for (const d of propsSnap.docs) {
      const adminRef = d.ref.parent.parent;
      const appRef = adminRef?.parent.parent;
      const adminId = adminRef?.id;
      if (!adminId || appRef?.id !== APP_ID || !approved.has(adminId)) continue;
      const data = d.data() as { status?: string; publicarEnPortal?: boolean; portalBlocked?: boolean };
      if (data.status !== 'Disponible' || data.publicarEnPortal !== true || data.portalBlocked === true) continue;
      published.push({ adminId, id: d.id });
    }

    // Excluye propiedades con contrato vigente.
    const withActiveContract = new Set<string>();
    await Promise.all(
      [...new Set(published.map(p => p.adminId))].map(async adminId => {
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

    for (const p of published) {
      if (withActiveContract.has(`${p.adminId}/${p.id}`)) continue;
      entries.push({
        url: `${BASE_URL}/portal/${p.adminId}/${p.id}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch {
    // Si Firestore no está disponible, devolvemos solo la portada del portal.
  }

  return entries;
}
