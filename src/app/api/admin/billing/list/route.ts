import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireSuperAdmin } from '@/lib/firebase-admin';
import { getTierById, BILLING_TIERS } from '@/lib/billing';
import type { BillingState } from '@/lib/billing/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * GET /api/admin/billing/list
 * Auth: Bearer <idToken> de super admin
 *
 * Devuelve TODOS los admins de la plataforma con su billing state agregado.
 * Solo expone los datos de facturación — NO mezcla contratos/inquilinos/etc.
 * de cada admin (eso queda privado del admin).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'));

    const db = getAdminDb();
    const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
    const adminDocs = await usersRef.listDocuments();

    const rows: Array<{
      adminId: string;
      adminEmail: string | null;
      adminName: string | null;
      state: BillingState | null;
      tierLabel: string;
      tierPriceARS: number;
      activeContracts: number;
      registeredAt: string | null;
    }> = [];

    let mrr = 0;
    let active = 0;
    let trial = 0;
    let pastDue = 0;
    let cancelled = 0;

    for (const adminRef of adminDocs) {
      const adminId = adminRef.id;

      const [billingSnap, profileSnap, contractsCount] = await Promise.all([
        usersRef.doc(adminId).collection('config').doc('billing').get(),
        usersRef.doc(adminId).collection('config').doc('profile').get(),
        usersRef.doc(adminId).collection('contratos').where('status', '==', 'Vigente').count().get().catch(() => null),
      ]);

      const state = billingSnap.exists ? (billingSnap.data() as BillingState) : null;
      const profile = profileSnap.exists ? profileSnap.data() : null;
      const tier = state ? getTierById(state.tierId) : null;
      const activeContracts = contractsCount?.data().count ?? 0;

      // Email/nombre lo intentamos sacar de Auth (más confiable que profile)
      let adminEmail: string | null = profile?.email ?? null;
      let adminName: string | null = profile?.name ?? null;
      try {
        const userRecord = await getAdminAuthRecord(adminId);
        adminEmail = userRecord?.email ?? adminEmail;
        adminName = userRecord?.displayName ?? adminName;
      } catch {}

      rows.push({
        adminId,
        adminEmail,
        adminName,
        state,
        tierLabel: tier?.label ?? '—',
        tierPriceARS: tier?.priceARS ?? 0,
        activeContracts,
        registeredAt: profile?.createdAt ?? null,
      });

      if (state) {
        if (state.status === 'active') {
          mrr += tier?.priceARS ?? 0;
          active++;
        } else if (state.status === 'trial') trial++;
        else if (state.status === 'past_due') pastDue++;
        else if (state.status === 'cancelled') cancelled++;
      }
    }

    return NextResponse.json({
      ok: true,
      rows,
      metrics: {
        totalAdmins: rows.length,
        active,
        trial,
        pastDue,
        cancelled,
        mrrARS: mrr,
      },
      tiers: BILLING_TIERS,
    });
  } catch (err: any) {
    const status = err.message?.includes('super admin') ? 403 : err.message?.includes('Bearer') ? 401 : 500;
    return NextResponse.json({ error: err.message ?? 'Error' }, { status });
  }
}

async function getAdminAuthRecord(uid: string) {
  const { getAdminAuth } = await import('@/lib/firebase-admin');
  return getAdminAuth().getUser(uid).catch(() => null);
}
