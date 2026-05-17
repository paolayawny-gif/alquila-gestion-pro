import { Firestore, doc, getDoc, updateDoc, arrayUnion, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Anuncio, AnuncioType } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

export function createAnuncio(
  db: Firestore,
  input: { title: string; body: string; type: AnuncioType },
): Anuncio {
  const id = `anuncio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const anuncio: Anuncio = {
    id,
    title: input.title,
    body: input.body,
    type: input.type,
    createdAt: now,
    publishedAt: now,
    isPublished: false,
  };
  const ref = doc(collection(db, 'artifacts', APP_ID, 'anuncios'), id);
  setDocumentNonBlocking(ref, anuncio, { merge: false });
  return anuncio;
}

export function publishAnuncio(db: Firestore, anuncioId: string) {
  const ref = doc(db, 'artifacts', APP_ID, 'anuncios', anuncioId);
  setDocumentNonBlocking(ref, { isPublished: true, publishedAt: new Date().toISOString() }, { merge: true });
}

export function unpublishAnuncio(db: Firestore, anuncioId: string) {
  const ref = doc(db, 'artifacts', APP_ID, 'anuncios', anuncioId);
  setDocumentNonBlocking(ref, { isPublished: false }, { merge: true });
}

export function deleteAnuncio(db: Firestore, anuncioId: string) {
  const ref = doc(db, 'artifacts', APP_ID, 'anuncios', anuncioId);
  deleteDocumentNonBlocking(ref);
}

/** Marca un anuncio como leído para el usuario */
export async function markAnuncioRead(db: Firestore, userId: string, anuncioId: string) {
  const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'meta', 'anunciosLeidos');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    setDocumentNonBlocking(ref, { readIds: [anuncioId] }, { merge: false });
  } else {
    await updateDoc(ref, { readIds: arrayUnion(anuncioId) });
  }
}

/** Marca todos los anuncios publicados como leídos */
export async function markAllAnunciosRead(db: Firestore, userId: string, anuncioIds: string[]) {
  if (!anuncioIds.length) return;
  const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'meta', 'anunciosLeidos');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    setDocumentNonBlocking(ref, { readIds: anuncioIds }, { merge: false });
  } else {
    await updateDoc(ref, { readIds: arrayUnion(...anuncioIds) });
  }
}
