import { APP_ID } from '@/lib/constants';
// Client-side utility — called from client components with their Firestore instance.
import type { Firestore } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


export type PropertyEventType =
  | 'message_admin'
  | 'message_tenant'
  | 'message_owner'
  | 'mora_notif'
  | 'invoice_created'
  | 'invoice_paid'
  | 'rent_adjustment';

export interface PropertyEvent {
  id: string;
  propertyId: string;
  propertyName: string;
  type: PropertyEventType;
  title: string;
  detail?: string;
  actor: string;
  actorRole: 'admin' | 'tenant' | 'owner';
  ts: number;
  metadata?: {
    amount?: number;
    currency?: string;
    period?: string;
    daysOverdue?: number;
    contractId?: string;
    invoiceId?: string;
    chatId?: string;
  };
}

export function writePropertyEvent(
  db: Firestore | null,
  adminId: string,
  event: Omit<PropertyEvent, 'id'>
): void {
  if (!db || !adminId) return;
  const id = `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const ref = doc(db, 'artifacts', APP_ID, 'users', adminId, 'propertyEvents', id);
  setDocumentNonBlocking(ref, { ...event, id }, {});
}
