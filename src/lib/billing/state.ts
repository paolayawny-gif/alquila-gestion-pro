/**
 * Helpers para leer/escribir el BillingState en Firestore (server-side).
 *
 * Path: artifacts/{APP_ID}/users/{adminId}/config/billing
 */

import { getAdminDb } from '@/lib/firebase-admin';
import type { BillingState, ProviderName } from './types';
import type { BillingTier } from './tiers';
import { TRIAL_TIER, tierForUnits } from './tiers';

const APP_ID = 'alquilagestion-pro';

function billingDocRef(adminId: string) {
  return getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('config').doc('billing');
}

/** Lookup global txHash → adminId para recibir webhooks sin conocer el adminId */
function subscriptionLookupRef(subscriptionId: string) {
  return getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('billingSubscriptions').doc(subscriptionId);
}

export async function getBillingState(adminId: string): Promise<BillingState | null> {
  const snap = await billingDocRef(adminId).get();
  if (!snap.exists) return null;
  return snap.data() as BillingState;
}

/** Crea estado inicial con trial de 14 días */
export async function initBillingState(adminId: string): Promise<BillingState> {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const state: BillingState = {
    provider: null,
    customerId: null,
    subscriptionId: null,
    tierId: TRIAL_TIER.id,
    activeUnits: 0,
    status: 'trial',
    trialEndsAt,
    lastSyncedAt: new Date().toISOString(),
  };
  await billingDocRef(adminId).set(state, { merge: false });
  return state;
}

export async function getOrInitBillingState(adminId: string): Promise<BillingState> {
  const existing = await getBillingState(adminId);
  if (existing) return existing;
  return initBillingState(adminId);
}

export async function updateBillingState(
  adminId: string,
  patch: Partial<BillingState>,
): Promise<void> {
  await billingDocRef(adminId).set(
    { ...patch, lastSyncedAt: new Date().toISOString() },
    { merge: true },
  );
}

/** Guarda mapeo subscriptionId → adminId (para webhooks que vienen sin contexto del admin) */
export async function setSubscriptionLookup(
  subscriptionId: string,
  adminId: string,
  provider: ProviderName,
): Promise<void> {
  await subscriptionLookupRef(subscriptionId).set({
    adminId,
    provider,
    createdAt: new Date().toISOString(),
  });
}

export async function getAdminIdBySubscription(subscriptionId: string): Promise<string | null> {
  const snap = await subscriptionLookupRef(subscriptionId).get();
  if (!snap.exists) return null;
  return (snap.data()?.adminId as string) ?? null;
}

/**
 * Cuenta los contratos vigentes (status === 'Vigente') del admin.
 * Esta es la métrica que define el tier.
 */
export async function countActiveUnits(adminId: string): Promise<number> {
  const snap = await getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('contratos')
    .where('status', '==', 'Vigente')
    .count()
    .get();
  return snap.data().count;
}

/** Calcula el tier que corresponde *ahora* al admin según sus contratos vigentes */
export async function calculateCurrentTier(adminId: string): Promise<{ tier: BillingTier; activeUnits: number }> {
  const activeUnits = await countActiveUnits(adminId);
  return { tier: tierForUnits(activeUnits), activeUnits };
}

/** Idempotencia para webhooks — guarda eventos procesados */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const snap = await getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('billingEvents').doc(eventId)
    .get();
  return snap.exists;
}

export async function markEventProcessed(eventId: string, payload: Record<string, any>): Promise<void> {
  await getAdminDb()
    .collection('artifacts').doc(APP_ID)
    .collection('billingEvents').doc(eventId)
    .set({ processedAt: new Date().toISOString(), payload });
}
