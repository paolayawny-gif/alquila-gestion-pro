import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate();
  if (daysLeft > 2) {
    return NextResponse.json({ skipped: true, daysLeft });
  }

  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const dueDate = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 10)
    .toLocaleDateString('es-AR');

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  let invoicesCreated = 0;

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;

    const [contractsSnap, existingInvSnap, propertiesSnap] = await Promise.all([
      usersRef.doc(adminId).collection('contratos').where('status', '==', 'Vigente').get(),
      usersRef.doc(adminId).collection('facturas').where('period', '==', nextMonth).get(),
      usersRef.doc(adminId).collection('inmuebles').get(),
    ]);

    const alreadyDone = new Set(
      existingInvSnap.docs
        .filter((d: FirebaseFirestore.QueryDocumentSnapshot) => (d.data().charges ?? []).some((c: { type: string }) => c.type === 'Alquiler'))
        .map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.data().contractId as string)
    );

    const propertiesMap = new Map(propertiesSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => [d.id, d.data()]));

    for (const contractDoc of contractsSnap.docs) {
      const contract = { id: contractDoc.id, ...contractDoc.data() } as any;
      if (alreadyDone.has(contract.id)) continue;

      const property = propertiesMap.get(contract.propertyId) as any;
      const ownerEmail: string = property?.owners?.[0]?.email ?? '';

      const docId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const invoiceData = {
        id: docId,
        contractId: contract.id,
        tenantName: contract.tenantName ?? 'Inquilino',
        tenantEmail: contract.tenantEmail ?? '',
        propertyName: contract.propertyName ?? 'Propiedad',
        propertyId: contract.propertyId ?? '',
        ownerEmail,
        period: nextMonth,
        charges: [{
          id: 'rent-charge',
          type: 'Alquiler',
          description: `Alquiler mensual - ${nextMonth}`,
          amount: contract.currentRentAmount,
          imputedTo: 'Inquilino',
        }],
        lateFees: 0,
        totalAmount: contract.currentRentAmount,
        currency: contract.currency ?? 'ARS',
        dueDate,
        status: 'Pendiente',
        pendingApproval: true,
      };

      await usersRef.doc(adminId).collection('facturas').doc(docId).set(invoiceData);
      invoicesCreated++;
    }
  }

  return NextResponse.json({ ok: true, invoicesCreated, pendingApproval: invoicesCreated, nextMonth });
}
