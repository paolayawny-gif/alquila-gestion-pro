import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import {
  emailInvoiceReminder,
  emailRentAdjustment,
  emailRentAdjustmentOwner,
  emailContractExpiry,
  emailMora,
} from '@/lib/email-templates';
import { WA_TEMPLATES } from '@/lib/whatsapp';
import { sendWhatsAppText, toE164AR } from '@/lib/whatsapp-sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

function fmt(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function buildTransporter(user?: string, pass?: string) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: user ?? process.env.SMTP_USER,
      pass: pass ?? process.env.SMTP_PASS,
    },
  });
}

async function sendEmail(to: string, subject: string, html: string, smtpUser?: string, smtpPass?: string) {
  const user = smtpUser ?? process.env.SMTP_USER;
  const pass = smtpPass ?? process.env.SMTP_PASS;
  if (!user || !pass) return;
  await buildTransporter(user, pass).sendMail({
    from: `"AlquilaGestión Pro" <${user}>`,
    to,
    subject,
    html,
  });
}

async function sendWA(phone: string, message: string, waPhoneId?: string, waToken?: string) {
  if (!phone) return;
  await sendWhatsAppText({
    to: toE164AR(phone),
    message,
    phoneNumberId: waPhoneId,
    accessToken: waToken,
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
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isEndOfMonth = daysInMonth - dayOfMonth <= 1; // day 28/29/30/31

  const results = {
    invoiceReminders: 0,
    contractReminders: 0,
    adjustmentNotifications: 0,
    moraAlerts: 0,
    pendingNotifications: 0,
    errors: 0,
  };

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;

    // Load admin profile for credentials + name
    let smtpUser: string | undefined;
    let smtpPass: string | undefined;
    let waPhone: string | undefined;
    let waPhoneId: string | undefined;
    let waToken: string | undefined;
    let adminName = 'Tu administrador';

    try {
      const profileSnap = await usersRef.doc(adminId).collection('config').doc('profile').get();
      if (profileSnap.exists) {
        const p = profileSnap.data() as any;
        smtpUser = p.smtpUser;
        smtpPass = p.smtpPass;
        waPhone = p.whatsappNumber;
        waPhoneId = p.waPhoneNumberId;
        waToken = p.waAccessToken;
        adminName = p.displayName ?? adminName;
      }
    } catch { /* continue without custom SMTP */ }

    // ── 1. Facturas próximas a vencer ──────────────────────────────────────────
    try {
      const invoicesSnap = await usersRef
        .doc(adminId).collection('facturas')
        .where('status', '==', 'Pendiente')
        .get();

      for (const invDoc of invoicesSnap.docs) {
        const inv = invDoc.data() as any;
        if (!inv.dueDate || !inv.tenantEmail) continue;
        const due = new Date(inv.dueDate.split('/').reverse().join('-'));
        if (isNaN(due.getTime())) continue;
        const daysLeft = Math.round((due.getTime() - now.getTime()) / 86400000);
        if (daysLeft !== 5 && daysLeft !== 1) continue;

        const amountStr = fmt(inv.totalAmount ?? 0);
        try {
          await sendEmail(
            inv.tenantEmail,
            `Recordatorio: tu factura vence ${daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`}`,
            emailInvoiceReminder({
              tenantName: inv.tenantName ?? 'inquilino',
              propertyName: inv.propertyName ?? '',
              period: inv.period ?? '',
              amount: amountStr,
              currency: inv.currency ?? 'ARS',
              dueDate: inv.dueDate,
              daysLeft,
              adminName,
            }),
            smtpUser,
            smtpPass,
          );
          results.invoiceReminders++;
        } catch { results.errors++; }

        // WhatsApp reminder on day before or same day
        if (daysLeft <= 1 && inv.tenantPhone) {
          try {
            await sendWA(
              inv.tenantPhone,
              WA_TEMPLATES.invoiceReminder({
                tenantName: inv.tenantName ?? 'inquilino',
                propertyName: inv.propertyName ?? '',
                period: inv.period ?? '',
                amount: `${inv.currency ?? 'ARS'} ${amountStr}`,
                dueDate: inv.dueDate,
              }),
              waPhoneId,
              waToken,
            );
          } catch { results.errors++; }
        }
      }
    } catch { results.errors++; }

    // ── 2. Contratos próximos a vencer ─────────────────────────────────────────
    try {
      const contractsSnap = await usersRef
        .doc(adminId).collection('contratos')
        .where('status', 'in', ['Vigente', 'Próximo a Vencer'])
        .get();

      const in5Days  = new Date(now.getTime() + 5  * 86400000);
      const in10Days = new Date(now.getTime() + 10 * 86400000);
      const in30Days = new Date(now.getTime() + 30 * 86400000);

      for (const contDoc of contractsSnap.docs) {
        const c = contDoc.data() as any;
        if (!c.endDate || !c.tenantEmail) continue;
        const end = new Date(c.endDate);
        if (isNaN(end.getTime()) || end > in30Days || end < now) continue;
        const daysLeft = Math.round((end.getTime() - now.getTime()) / 86400000);
        if (daysLeft !== 30 && daysLeft !== 10 && daysLeft !== 5) continue;

        try {
          await sendEmail(
            c.tenantEmail,
            `Tu contrato vence en ${daysLeft} días`,
            emailContractExpiry({
              tenantName: c.tenantName ?? 'inquilino',
              propertyName: c.propertyName ?? '',
              expiryDate: end.toLocaleDateString('es-AR'),
              daysLeft,
              adminName,
              adminPhone: waPhone,
            }),
            smtpUser,
            smtpPass,
          );
          results.contractReminders++;
        } catch { results.errors++; }

        // WhatsApp for 10 and 5 days
        if ((daysLeft === 10 || daysLeft === 5) && c.tenantPhone) {
          try {
            await sendWA(
              c.tenantPhone,
              WA_TEMPLATES.contractExpiry({
                tenantName: c.tenantName ?? 'inquilino',
                propertyName: c.propertyName ?? '',
                daysLeft,
                expiryDate: end.toLocaleDateString('es-AR'),
              }),
              waPhoneId,
              waToken,
            );
          } catch { results.errors++; }
        }
      }
    } catch { results.errors++; }

    // ── 3. Mora — facturas vencidas ─────────────────────────────────────────────
    try {
      const overdueSnap = await usersRef
        .doc(adminId).collection('facturas')
        .where('status', '==', 'Vencido')
        .get();

      for (const invDoc of overdueSnap.docs) {
        const inv = invDoc.data() as any;
        if (!inv.dueDate || !inv.tenantEmail) continue;
        const due = new Date(inv.dueDate.split('/').reverse().join('-'));
        if (isNaN(due.getTime())) continue;
        const daysOverdue = Math.round((now.getTime() - due.getTime()) / 86400000);
        // Send mora alert at 3, 7, 15 days overdue
        if (daysOverdue !== 3 && daysOverdue !== 7 && daysOverdue !== 15) continue;

        const principal = inv.totalAmount ?? 0;
        const dailyRate = (inv.lateFeePercentage ?? 0.5) / 100;
        const penalty = Math.round(principal * dailyRate * daysOverdue);
        const total = principal + penalty;

        try {
          await sendEmail(
            inv.tenantEmail,
            `⚠ Alquiler vencido hace ${daysOverdue} días — ${inv.propertyName}`,
            emailMora({
              tenantName: inv.tenantName ?? 'inquilino',
              propertyName: inv.propertyName ?? '',
              daysOverdue,
              totalOverdue: fmt(principal),
              penalty: fmt(penalty),
              total: fmt(total),
              currency: inv.currency ?? 'ARS',
              adminName,
            }),
            smtpUser,
            smtpPass,
          );
          results.moraAlerts++;
        } catch { results.errors++; }

        if (daysOverdue === 3 && inv.tenantPhone) {
          try {
            await sendWA(
              inv.tenantPhone,
              WA_TEMPLATES.mora({
                tenantName: inv.tenantName ?? 'inquilino',
                propertyName: inv.propertyName ?? '',
                totalOverdue: fmt(total),
                currency: inv.currency ?? 'ARS',
                daysOverdue,
              }),
              waPhoneId,
              waToken,
            );
          } catch { results.errors++; }
        }
      }
    } catch { results.errors++; }

    // ── 4. Ajustes aprobados — notificar propietario e inquilino ───────────────
    // Runs on day 28/29 for adjustments approved in the last 3 days not yet notified
    if (isEndOfMonth) {
      try {
        const adjSnap = await usersRef
          .doc(adminId).collection('rentAdjustments')
          .where('status', '==', 'aprobado')
          .get();

        for (const adjDoc of adjSnap.docs) {
          const adj = adjDoc.data() as any;
          // Skip if already notified
          if (adj.notifiedTenantAt) continue;

          const formatCurrency = (n: number) => `${adj.currency ?? 'ARS'} ${fmt(n)}`;
          const effectiveDate = adj.dueDate
            ? new Date(adj.dueDate).toLocaleDateString('es-AR')
            : now.toLocaleDateString('es-AR');

          const templateParams = {
            tenantName: adj.tenantName ?? 'inquilino',
            propertyName: adj.propertyName ?? '',
            currentRent: fmt(adj.currentAmount),
            newRent: fmt(adj.proposedAmount),
            currency: adj.currency ?? 'ARS',
            variationPct: (adj.variationPct ?? 0).toFixed(1),
            mechanism: adj.mechanism ?? 'Índice',
            effectiveDate,
            adminName,
          };

          // Email tenant
          if (adj.tenantEmail) {
            try {
              await sendEmail(
                adj.tenantEmail,
                `Actualización de alquiler — ${adj.propertyName}`,
                emailRentAdjustment(templateParams),
                smtpUser,
                smtpPass,
              );
              results.adjustmentNotifications++;
            } catch { results.errors++; }
          }

          // WhatsApp tenant
          if (adj.tenantPhone) {
            try {
              await sendWA(
                adj.tenantPhone,
                WA_TEMPLATES.rentAdjustment({
                  tenantName: adj.tenantName ?? 'inquilino',
                  propertyName: adj.propertyName ?? '',
                  newRent: fmt(adj.proposedAmount),
                  currency: adj.currency ?? 'ARS',
                  effectiveDate,
                }),
                waPhoneId,
                waToken,
              );
            } catch { results.errors++; }
          }

          // Email owner
          if (adj.ownerEmail) {
            try {
              await sendEmail(
                adj.ownerEmail,
                `Ajuste de alquiler aplicado — ${adj.propertyName}`,
                emailRentAdjustmentOwner({
                  ownerName: 'Propietario',
                  ...templateParams,
                }),
                smtpUser,
                smtpPass,
              );
            } catch { results.errors++; }
          }

          // Mark as notified
          await adjDoc.ref.update({
            notifiedTenantAt: now.toISOString(),
            notifiedOwnerAt: now.toISOString(),
          });
        }
      } catch { results.errors++; }
    }

    // ── 5. Procesar cola pendingNotifications ──────────────────────────────────
    try {
      const notifSnap = await usersRef
        .doc(adminId).collection('pendingNotifications')
        .where('sent', '==', false)
        .limit(20)
        .get();

      for (const notifDoc of notifSnap.docs) {
        const n = notifDoc.data() as any;
        try {
          if (n.type === 'rent_adjustment') {
            if (n.tenantEmail) {
              await sendEmail(
                n.tenantEmail,
                `Actualización de alquiler — ${n.propertyName}`,
                emailRentAdjustment({
                  tenantName: n.tenantName,
                  propertyName: n.propertyName,
                  currentRent: fmt(n.currentAmount),
                  newRent: fmt(n.proposedAmount),
                  currency: 'ARS',
                  variationPct: (n.variationPct ?? 0).toFixed(1),
                  mechanism: n.mechanism ?? 'Índice',
                  effectiveDate: now.toLocaleDateString('es-AR'),
                  adminName,
                }),
                smtpUser,
                smtpPass,
              );
            }
            if (n.ownerEmail) {
              await sendEmail(
                n.ownerEmail,
                `Ajuste de alquiler aplicado — ${n.propertyName}`,
                emailRentAdjustmentOwner({
                  ownerName: 'Propietario',
                  tenantName: n.tenantName,
                  propertyName: n.propertyName,
                  currentRent: fmt(n.currentAmount),
                  newRent: fmt(n.proposedAmount),
                  currency: 'ARS',
                  variationPct: (n.variationPct ?? 0).toFixed(1),
                  mechanism: n.mechanism ?? 'Índice',
                  effectiveDate: now.toLocaleDateString('es-AR'),
                }),
                smtpUser,
                smtpPass,
              );
            }
          }
          await notifDoc.ref.update({ sent: true, sentAt: now.toISOString() });
          results.pendingNotifications++;
        } catch { results.errors++; }
      }
    } catch { results.errors++; }
  }

  return NextResponse.json({ ok: true, ...results, runAt: now.toISOString() });
}
