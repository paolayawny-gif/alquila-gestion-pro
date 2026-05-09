import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/services/email-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run in the last 2 days of the month
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate();
  if (daysLeft > 2) {
    return NextResponse.json({ skipped: true, daysLeft });
  }

  // Next month label and due date (day 10 of next month)
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const dueDate = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 10)
    .toLocaleDateString('es-AR');

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  let invoicesCreated = 0;
  let emailsSent = 0;

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;

    const [contractsSnap, existingInvSnap, peopleSnap, propertiesSnap] = await Promise.all([
      usersRef.doc(adminId).collection('contratos').where('status', '==', 'Vigente').get(),
      usersRef.doc(adminId).collection('facturas').where('period', '==', nextMonth).get(),
      usersRef.doc(adminId).collection('inquilinos').get(),
      usersRef.doc(adminId).collection('inmuebles').get(),
    ]);

    // Contracts that already have a rent invoice this month
    const alreadyDone = new Set(
      existingInvSnap.docs
        .filter(d => (d.data().charges ?? []).some((c: any) => c.type === 'Alquiler'))
        .map(d => d.data().contractId as string)
    );

    const peopleMap = new Map(peopleSnap.docs.map(d => [d.data().email as string, d.data()]));
    const propertiesMap = new Map(propertiesSnap.docs.map(d => [d.id, d.data()]));

    for (const contractDoc of contractsSnap.docs) {
      const contract = { id: contractDoc.id, ...contractDoc.data() } as any;
      if (alreadyDone.has(contract.id)) continue;

      const property = propertiesMap.get(contract.propertyId) as any;
      const ownerEmail: string = property?.owners?.[0]?.email ?? '';
      const ownerName: string = property?.owners?.[0]?.name ?? 'Propietario';

      // Create invoice document
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
      };
      await usersRef.doc(adminId).collection('facturas').doc(docId).set(invoiceData);
      invoicesCreated++;

      // Previous overdue interests
      const prevSnap = await usersRef.doc(adminId).collection('facturas')
        .where('contractId', '==', contract.id)
        .where('status', 'in', ['Pendiente', 'Vencido'])
        .get();
      const prevInterest = prevSnap.docs
        .filter(d => d.data().period !== nextMonth)
        .reduce((acc, d) => acc + (d.data().lateFees ?? 0), 0);

      // CBU lookup
      const ownerPerson = peopleMap.get(ownerEmail) as any;
      const bankInfo = ownerPerson?.bankDetails;
      const cbuLine: string | null = bankInfo?.cbu
        ? `CBU: ${bankInfo.cbu}${bankInfo.alias ? ` · Alias: ${bankInfo.alias}` : ''}${bankInfo.bank ? ` (${bankInfo.bank})` : ''}`
        : null;

      const cur = contract.currency === 'USD' ? 'U$D' : '$';
      const fmt = (n: number) => `${cur} ${n.toLocaleString('es-AR')}`;
      const total = contract.currentRentAmount + prevInterest;

      // ── Email to tenant ────────────────────────────────────────────────────
      if (contract.tenantEmail) {
        const overdueRow = prevInterest > 0
          ? `<tr style="background:#fff3cd;"><td style="padding:8px 12px;font-size:13px;color:#856404;">Mora anterior</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;color:#856404;">${fmt(prevInterest)}</td></tr>`
          : '';
        const cbuRow = cbuLine
          ? `<tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Datos de pago</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${cbuLine}</td></tr>`
          : '';
        await sendEmail({
          to: contract.tenantEmail,
          subject: `Liquidación de alquiler ${nextMonth} — ${contract.propertyName ?? ''}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#1a1a2e;">Liquidación de alquiler — ${nextMonth}</h2>
              <p>Estimado/a <strong>${contract.tenantName ?? ''}</strong>,</p>
              <p>Le informamos la liquidación de alquiler para el período <strong>${nextMonth}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Propiedad</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${contract.propertyName ?? ''}</td></tr>
                <tr><td style="padding:8px 12px;font-size:13px;">Alquiler</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${fmt(contract.currentRentAmount)}</td></tr>
                ${overdueRow}
                <tr style="background:#e8f5e9;"><td style="padding:8px 12px;font-size:13px;font-weight:bold;">Total</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;color:#2e7d32;">${fmt(total)}</td></tr>
                <tr><td style="padding:8px 12px;font-size:13px;">Vencimiento</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${dueDate}</td></tr>
                ${cbuRow}
              </table>
              <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:14px;margin:16px 0;">
                <p style="margin:0;font-size:12px;color:#1565c0;">
                  Conforme a la RG AFIP 1415/03, la factura fiscal se emitirá al percibirse el pago
                  o al vencimiento del plazo (${dueDate}), lo que ocurra primero.
                </p>
              </div>
              <p style="font-size:11px;color:#aaa;margin-top:24px;">Aviso automático del sistema de administración. No respondas este correo.</p>
            </div>
          `,
        });
        emailsSent++;
      }

      // ── Email to owner ─────────────────────────────────────────────────────
      if (ownerEmail) {
        const overdueRow = prevInterest > 0
          ? `<tr style="background:#fff3cd;"><td style="padding:8px 12px;font-size:13px;color:#856404;">Intereses mora anterior</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;color:#856404;">${fmt(prevInterest)}</td></tr>`
          : '';
        await sendEmail({
          to: ownerEmail,
          subject: `Liquidación ${nextMonth} — ${contract.propertyName ?? ''}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#1a1a2e;">Liquidación de alquiler — ${nextMonth}</h2>
              <p>Estimado/a <strong>${ownerName}</strong>,</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Inquilino</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${contract.tenantName ?? ''}</td></tr>
                <tr><td style="padding:8px 12px;font-size:13px;">Alquiler del mes</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${fmt(contract.currentRentAmount)}</td></tr>
                ${overdueRow}
                <tr style="background:#e8f5e9;"><td style="padding:8px 12px;font-size:13px;font-weight:bold;">Total a cobrar</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;color:#2e7d32;">${fmt(total)}</td></tr>
                <tr><td style="padding:8px 12px;font-size:13px;">Vencimiento</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${dueDate}</td></tr>
              </table>
              <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:14px;margin:16px 0;">
                <p style="margin:0;font-size:12px;color:#1565c0;">
                  <strong>📋 RG AFIP 1415/03:</strong> Debe emitir la factura ARCA al percibir el pago
                  <strong>o</strong> al vencimiento del plazo (${dueDate}), lo que ocurra primero.
                  Recibirá un aviso automático en ambos casos.
                </p>
              </div>
              <p style="font-size:11px;color:#aaa;margin-top:24px;">Aviso automático del sistema de administración. No respondas este correo.</p>
            </div>
          `,
        });
        emailsSent++;
      }
    }
  }

  return NextResponse.json({ ok: true, invoicesCreated, emailsSent, nextMonth });
}
