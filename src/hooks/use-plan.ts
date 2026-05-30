import { APP_ID } from '@/lib/constants';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { BillingState } from '@/lib/billing/types';
import { getTierById, BILLING_TIERS, TRIAL_TIER } from '@/lib/billing/tiers';


/**
 * Suscripción en tiempo real al BillingState del admin.
 * Devuelve también flags útiles: trial, gracia, suspendido, sobre el límite, etc.
 */
export function usePlan(adminId?: string) {
  const db = useFirestore();
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !adminId) { setLoading(false); return; }
    const ref = doc(db, 'artifacts', APP_ID, 'users', adminId, 'config', 'billing');
    const unsub = onSnapshot(
      ref,
      snap => {
        setState(snap.exists() ? (snap.data() as BillingState) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [db, adminId]);

  const tier = state ? getTierById(state.tierId) : null;

  // Período de gracia: 5 días desde failedChargeAt
  let inGracePeriod = false;
  let gracePeriodEndsAt: Date | null = null;
  if (state?.status === 'past_due' && state.failedChargeAt) {
    const start = new Date(state.failedChargeAt);
    gracePeriodEndsAt = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
    inGracePeriod = Date.now() < gracePeriodEndsAt.getTime();
  }

  // Suscripción creada pero sin autorizar el pago: 48 hs de gracia para completarlo.
  let pendingGraceActive = false;
  let pendingGraceEndsAt: Date | null = null;
  if (state?.status === 'pending') {
    const anchor = state.pendingSince ?? state.lastSyncedAt;
    if (anchor) {
      pendingGraceEndsAt = new Date(new Date(anchor).getTime() + 48 * 60 * 60 * 1000);
      pendingGraceActive = Date.now() < pendingGraceEndsAt.getTime();
    } else {
      pendingGraceActive = true; // sin fecha de referencia → no bloquear
    }
  }

  const trialEndsAt = state?.trialEndsAt ? new Date(state.trialEndsAt) : null;
  const trialActive = state?.status === 'trial' && trialEndsAt ? Date.now() < trialEndsAt.getTime() : false;
  const trialExpired = state?.status === 'trial' && trialEndsAt ? Date.now() >= trialEndsAt.getTime() : false;

  const overLimit = !!(tier && state && state.activeUnits > tier.maxUnits);

  // Bloqueado: trial vencido sin tarjeta, past_due fuera de gracia,
  // pendiente de pago fuera de las 48 hs, pausado o cancelado.
  const blocked =
    trialExpired ||
    (state?.status === 'past_due' && !inGracePeriod) ||
    (state?.status === 'pending' && !pendingGraceActive) ||
    state?.status === 'paused' ||
    state?.status === 'cancelled';

  return {
    state,
    tier,
    loading,
    trialActive,
    trialExpired,
    trialEndsAt,
    inGracePeriod,
    gracePeriodEndsAt,
    pendingGraceActive,
    pendingGraceEndsAt,
    overLimit,
    blocked,
    allTiers: BILLING_TIERS,
    trialTier: TRIAL_TIER,
  };
}
