import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getBillingProvider, getTierById } from '@/lib/billing';
import { calculateCurrentTier, updateBillingState } from '@/lib/billing/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * Cron diario que recorre todos los admins:
 *  - Recalcula tier según contratos vigentes
 *  - Si el tier cambió y la suscripción está activa → actualiza monto en proveedor
 *  - Si el trial venció → marca past_due (la app lo bloquea hasta activación)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  let tierChanges = 0;
  let trialExpirations = 0;
  let processed = 0;
  const errors: string[] = [];

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;
    try {
      const billingSnap = await usersRef.doc(adminId).collection('config').doc('billing').get();
      if (!billingSnap.exists) continue;
      const state = billingSnap.data() as any;

      // 1. Trial vencido
      if (state.status === 'trial' && state.trialEndsAt && new Date(state.trialEndsAt) <= new Date()) {
        await updateBillingState(adminId, { status: 'past_due', failedChargeAt: new Date().toISOString() });
        trialExpirations++;
        processed++;
        continue;
      }

      // 2. Recalcular tier
      const { tier: shouldBe, activeUnits } = await calculateCurrentTier(adminId);
      const currentTier = getTierById(state.tierId);

      if (currentTier?.id === shouldBe.id) {
        await updateBillingState(adminId, { activeUnits });
        processed++;
        continue;
      }

      // Tier cambió
      if (state.status === 'active' && state.subscriptionId) {
        const provider = getBillingProvider();
        await provider.updateSubscriptionTier({
          subscriptionId: state.subscriptionId,
          newTier: shouldBe,
        });
      }
      await updateBillingState(adminId, { tierId: shouldBe.id, activeUnits });
      tierChanges++;
      processed++;
    } catch (e: any) {
      errors.push(`${adminId}: ${e?.message ?? e}`);
    }
  }

  return NextResponse.json({ ok: true, processed, tierChanges, trialExpirations, errors });
}
