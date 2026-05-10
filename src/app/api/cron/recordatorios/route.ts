import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendReminder(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = buildTransporter();
  await transporter.sendMail({
    from: `"AlquilaGestión Pro" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  const now = new Date();
  const in5Days  = new Date(now.getTime() + 5  * 86400000);
  const in10Days = new Date(now.getTime() + 10 * 86400000);
  const in30Days = new Date(now.getTime() + 30 * 86400000);

  const results = { invoiceReminders: 0, contractReminders: 0, errors: 0 };

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;

    // ── Facturas próximas a vencer ──────────────────────────────────────────
    const invoicesSnap = await usersRef
      .doc(adminId)
      .collection('facturas')
      .where('status', '==', 'Pendiente')
      .get();

    for (const invDoc of invoicesSnap.docs) {
      const inv = invDoc.data() as any;
      if (!inv.dueDate || !inv.tenantEmail) continue;

      const due = new Date(inv.dueDate.split('/').reverse().join('-'));
      if (isNaN(due.getTime())) continue;

      const daysLeft = Math.round((due.getTime() - now.getTime()) / 86400000);
      if (daysLeft !== 5 && daysLeft !== 1) continue;

      try {
        await sendReminder(
          inv.tenantEmail,
          `Recordatorio: tu factura vence en ${daysLeft} día${daysLeft > 1 ? 's' : ''}`,
          `<div style="font-family:sans-serif;max-width:540px;margin:auto;padding:24px">
            <h2 style="color:#1D9E75">AlquilaGestión Pro</h2>
            <p>Hola <strong>${inv.tenantName ?? 'inquilino'}</strong>,</p>
            <p>Te recordamos que tu factura de <strong>${inv.propertyName}</strong> por el período <strong>${inv.period}</strong>
            vence el <strong>${inv.dueDate}</strong> (en ${daysLeft} día${daysLeft > 1 ? 's' : ''}).</p>
            <p>Monto: <strong>${inv.currency} ${(inv.totalAmount ?? 0).toLocaleString('es-AR')}</strong></p>
            <p style="color:#888;font-size:12px">Este es un recordatorio automático de AlquilaGestión Pro.</p>
          </div>`,
        );
        results.invoiceReminders++;
      } catch { results.errors++; }
    }

    // ── Contratos próximos a vencer ─────────────────────────────────────────
    const contractsSnap = await usersRef
      .doc(adminId)
      .collection('contratos')
      .where('status', 'in', ['Vigente', 'Próximo a Vencer'])
      .get();

    for (const contDoc of contractsSnap.docs) {
      const contract = contDoc.data() as any;
      if (!contract.endDate || !contract.tenantEmail) continue;

      const end = new Date(contract.endDate);
      if (isNaN(end.getTime())) continue;
      if (end > in30Days || end < now) continue;

      const daysLeft = Math.round((end.getTime() - now.getTime()) / 86400000);
      if (daysLeft !== 30 && daysLeft !== 10 && daysLeft !== 5) continue;

      try {
        await sendReminder(
          contract.tenantEmail,
          `Tu contrato vence en ${daysLeft} días`,
          `<div style="font-family:sans-serif;max-width:540px;margin:auto;padding:24px">
            <h2 style="color:#1D9E75">AlquilaGestión Pro</h2>
            <p>Hola <strong>${contract.tenantName ?? 'inquilino'}</strong>,</p>
            <p>Tu contrato de alquiler en <strong>${contract.propertyName}</strong> vence el
            <strong>${end.toLocaleDateString('es-AR')}</strong> (en ${daysLeft} días).</p>
            <p>Comunicate con tu administrador para coordinar la renovación.</p>
            <p style="color:#888;font-size:12px">Este es un recordatorio automático de AlquilaGestión Pro.</p>
          </div>`,
        );
        results.contractReminders++;
      } catch { results.errors++; }
    }
  }

  return NextResponse.json({ ok: true, ...results, runAt: now.toISOString() });
}
