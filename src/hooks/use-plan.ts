'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { BillingState } from '@/lib/billing/types';
import { getTierById, BILLING_TIERS, TRIAL_TIER } from '@/lib/billing/tiers';

const APP_ID = 'alquilagestion-pro';

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

  const trialEndsAt = state?.trialEndsAt ? new Date(state.trialEndsAt) : null;
  const trialActive = state?.status === 'trial' && trialEndsAt ? Date.now() < trialEndsAt.getTime() : false;
  const trialExpired = state?.status === 'trial' && trialEndsAt ? Date.now() >= trialEndsAt.getTime() : false;

  const overLimit = !!(tier && state && state.activeUnits > tier.maxUnits);

  // Bloqueado: trial vencido sin tarjeta, o past_due fuera de gracia, o cancelado
  const blocked =
    trialExpired ||
    (state?.status === 'past_due' && !inGracePeriod) ||
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
    overLimit,
    blocked,
    allTiers: BILLING_TIERS,
    trialTier: TRIAL_TIER,
  };
}
