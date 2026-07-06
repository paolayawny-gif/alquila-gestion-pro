import { getAdminDb } from '@/lib/firebase-admin';
import { redactPropertyForPublic } from '@/lib/redact-public-property';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Property } from '@/lib/types';
import { PropertyDetail } from './property-detail';

const APP_ID = 'alquilagestion-pro';

interface Props {
  params: Promise<{ adminId: string; propertyId: string }>;
}

async function getPropertyData(adminId: string, propertyId: string) {
  try {
    return await loadPropertyData(adminId, propertyId);
  } catch (err) {
    console.error('[portal] No se pudo cargar la propiedad:', err);
    return null;
  }
}

async function loadPropertyData(adminId: string, propertyId: string) {
  const db = getAdminDb();
  const base = db.collection('artifacts').doc(APP_ID).collection('users').doc(adminId);

  const [propSnap, profileSnap, requestSnap, contractsSnap] = await Promise.all([
    base.collection('propiedades').doc(propertyId).get(),
    base.collection('config').doc('profile').get(),
    db.collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('data')
      .collection('portalPlusRequests').doc(adminId)
      .get(),
    base.collection('contratos')
      .where('propertyId', '==', propertyId)
      .where('status', '==', 'Vigente')
      .get(),
  ]);

  if (!propSnap.exists) return null;

  // Solo visible si el super-admin aprobó el Portal Plus de este admin.
  if (requestSnap.data()?.status !== 'aprobada') return null;

  const profile = profileSnap.exists ? (profileSnap.data() as any) : {};

  // Redactado (sin owners/contacto del propietario) — PropertyDetail nunca lee esos
  // campos, el cast solo asegura al compilador que el resto del shape coincide.
  const property = redactPropertyForPublic({ id: propSnap.id, ...(propSnap.data() as any) }) as Property;
  // Disponible, habilitada por el admin, no bloqueada y sin contrato vigente.
  if (property.status !== 'Disponible') return null;
  if (property.publicarEnPortal !== true || property.portalBlocked === true) return null;
  if (!contractsSnap.empty) return null;

  return { property, profile, adminId };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { adminId, propertyId } = await params;
  const data = await getPropertyData(adminId, propertyId);
  if (!data) return { title: 'Propiedad no encontrada' };
  const { property } = data;
  return {
    title: `${property.name} — ${property.address}`,
    description: `${property.type} en alquiler en ${property.address}. ${property.squareMeters ?? ''} m². Contactá para más información.`,
    openGraph: {
      title: `${property.name} — ${property.address}`,
      description: `${property.type} en alquiler en ${property.address}.`,
      images: property.photos?.[0] ? [property.photos[0]] : undefined,
    },
  };
}

export const revalidate = 300;

export default async function Page({ params }: Props) {
  const { adminId, propertyId } = await params;
  const data = await getPropertyData(adminId, propertyId);
  if (!data) return notFound();
  return <PropertyDetail {...data} />;
}
