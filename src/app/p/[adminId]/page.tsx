import { getAdminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicPropertyPage } from './public-property-page';

const APP_ID = 'alquilagestion-pro';

interface Props {
  params: Promise<{ adminId: string }>;
}

async function getAdminData(adminId: string) {
  const db = getAdminDb();
  const base = db.collection('artifacts').doc(APP_ID).collection('users').doc(adminId);

  const [profileSnap, propertiesSnap] = await Promise.all([
    base.collection('config').doc('profile').get(),
    base.collection('propiedades').where('status', '==', 'Disponible').get(),
  ]);

  if (!propertiesSnap.docs.length && !profileSnap.exists) return null;

  const profile = profileSnap.exists ? (profileSnap.data() as any) : {};
  const properties = propertiesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  return { profile, properties, adminId };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { adminId } = await params;
  const data = await getAdminData(adminId);
  const name = data?.profile?.displayName ?? 'AlquilaGestión Pro';
  return {
    title: `Propiedades disponibles — ${name}`,
    description: `Encontrá propiedades en alquiler gestionadas por ${name}.`,
    openGraph: {
      title: `Propiedades disponibles — ${name}`,
      description: `Propiedades en alquiler. Contactá a ${name} para más información.`,
    },
  };
}

export const revalidate = 300; // 5 min cache

export default async function Page({ params }: Props) {
  const { adminId } = await params;
  const data = await getAdminData(adminId);
  if (!data) return notFound();
  return <PublicPropertyPage {...data} />;
}
