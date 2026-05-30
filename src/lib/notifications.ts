import { APP_ID } from '@/lib/constants';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { AppNotification, NotificationType } from '@/lib/types';


export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  refId?: string;
  link?: string;
}

/**
 * Persiste una notificación en `users/{userId}/notifications/{id}`.
 * Las notificaciones complementan los toasts: sobreviven a reloads y aparecen en la campana.
 */
export function createNotification(
  db: Firestore,
  userId: string,
  input: CreateNotificationInput,
): AppNotification {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const notif: AppNotification = {
    id,
    type: input.type,
    title: input.title,
    message: input.message,
    createdAt: new Date().toISOString(),
    read: false,
    refId: input.refId,
    link: input.link,
  };
  const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'notifications', id);
  setDocumentNonBlocking(ref, notif, { merge: false });
  return notif;
}

export function markNotificationRead(db: Firestore, userId: string, notifId: string) {
  const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'notifications', notifId);
  setDocumentNonBlocking(ref, { read: true }, { merge: true });
}

export function markAllNotificationsRead(
  db: Firestore,
  userId: string,
  notifIds: string[],
) {
  notifIds.forEach(id => markNotificationRead(db, userId, id));
}
