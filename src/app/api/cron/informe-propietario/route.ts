import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function fmt(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function buildWeeklyOwnerEmail(opts: {
  ownerName: string;
  adminName: string;
  properties: Array<{
    name: string;
    address: string;
    invoices: Array<{ period: string; status: string; amount: number; currency: string }>;
    tasks: Array<{ concept: string; priority: string; status: string }>;
  }>;
}) {
  const BRAND = '#1D9E75';
  const rows = opts.properties.map(p => {
    const paid = p.invoices.filter(i => i.status === 'Pagado');
    const pending = p.invoices.filter(i => ['Pendiente', 'Vencido'].includes(i.status));
    const openTasks = p.tasks.filter(t => !['Completado', 'Cerrado'].includes(t.status));

    return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#f8fafb;padding:14px 20px;border-bottom:1px solid #e2e8f0;">
        <strong style="font-size:15px;color:#1e293b;">${p.name}</strong>
        <span style="display:block;font-size:12px;color:#64748b;">${p.address}</span>
      </div>
      <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div>
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Cobrado</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:${BRAND};">
            ${paid.length ? `${paid[0].currency} ${fmt(paid.reduce((s, i) => s + i.amount, 0))}` : '—'}
          </p>
        </div>
        <div>
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Pendiente</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:${pending.length ? '#dc2626' : '#94a3b8'};">
            ${pending.length ? `${pending[0].currency} ${fmt(pending.reduce((s, i) => s + i.amount, 0))}` : '—'}
          </p>
        </div>
        <div>
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Reclamos</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:${openTasks.length ? '#f59e0b' : '#94a3b8'};">
            ${openTasks.length || '—'}
          </p>
        </div>
      </div>
      ${openTasks.length ? `
      <div style="padding:0 20px 14px;">
        ${openTasks.slice(0, 3).map(t => `
          <div style="font-size:12px;color:#475569;padding:4px 0;border-top:1px dashed #e2e8f0;">
            • ${t.concept} <span style="color:${t.priority === 'Urgente' ? '#dc2626' : '#f59e0b'};font-weight:700;">[${t.priority}]</span>
          </div>
        `).join('')}
      </div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf6;font-family:Arial,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
  <div style="background:${BRAND};padding:28px 36px;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:800;">Informe semanal de tu cartera</h1>
    <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:12px;">
      ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      · Gestionado por ${opts.adminName}
    </p>
  </div>
  <div style="padding:32px 36px;">
    <p style="color:#1e293b;margin:0 0 24px;font-size:14px;">
      Hola <strong>${opts.ownerName}</strong>, aquí está el resumen de tu cartera de esta semana:
    </p>
    ${rows}
  </div>
  <div style="padding:16px 36px;border-top:1px solid #e8f5f0;background:#f8fdfb;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">
      Informe generado automáticamente por <strong>${opts.adminName}</strong> a través de AlquilaGestión Pro. No respondas a este email.
    </p>
  </div>
</div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string, smtpUser?: string, smtpPass?: string) {
  const user = smtpUser ?? process.env.EMAIL_USER ?? process.env.SMTP_USER;
  const pass = smtpPass ?? process.env.EMAIL_PASS ?? process.env.SMTP_PASS;
  if (!user || !pass) return;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });
  await t.sendMail({ from: `"AlquilaGestión Pro" <${user}>`, to, subject, html });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  let sent = 0;
  let errors = 0;

  for (const adminDocRef of adminDocs) {
    const adminId = adminDocRef.id;

    let smtpUser: string | undefined;
    let smtpPass: string | undefined;
    let adminName = 'Tu administrador';

    try {
      const profileSnap = await usersRef.doc(adminId).collection('config').doc('profile').get();
      if (profileSnap.exists) {
        const p = profileSnap.data() as any;
        smtpUser = p.smtpUser;
        smtpPass = p.smtpPass;
        adminName = p.displayName ?? adminName;
      }
    } catch { /* continue */ }

    // Build a map: ownerEmail → { name, properties }
    const ownerMap = new Map<string, { name: string; properties: Map<string, any> }>();

    // Load properties
    const propsSnap = await usersRef.doc(adminId).collection('propiedades').get();
    const propById = new Map<string, any>();
    propsSnap.docs.forEach(d => { propById.set(d.id, { id: d.id, ...d.data() }); });

    propsSnap.docs.forEach(d => {
      const prop = d.data() as any;
      (prop.owners ?? []).forEach((o: any) => {
        if (!o.email) return;
        const email = o.email.toLowerCase();
        if (!ownerMap.has(email)) ownerMap.set(email, { name: o.name, properties: new Map() });
        ownerMap.get(email)!.properties.set(d.id, { ...prop, id: d.id, invoices: [], tasks: [] });
      });
    });

    if (ownerMap.size === 0) continue;

    // Load invoices
    const invSnap = await usersRef.doc(adminId).collection('facturas').get();
    invSnap.docs.forEach(d => {
      const inv = d.data() as any;
      if (!inv.propertyId) return;
      ownerMap.forEach(owner => {
        const prop = owner.properties.get(inv.propertyId);
        if (prop) prop.invoices.push(inv);
      });
    });

    // Load tasks
    const taskSnap = await usersRef.doc(adminId).collection('mantenimiento').get();
    taskSnap.docs.forEach(d => {
      const task = d.data() as any;
      if (!task.propertyId) return;
      ownerMap.forEach(owner => {
        const prop = owner.properties.get(task.propertyId);
        if (prop) prop.tasks.push(task);
      });
    });

    // Send one email per owner
    for (const [email, owner] of ownerMap) {
      const props = Array.from(owner.properties.values());
      if (!props.length) continue;

      const html = buildWeeklyOwnerEmail({
        ownerName: owner.name,
        adminName,
        properties: props.map(p => ({
          name: p.name,
          address: p.address,
          invoices: (p.invoices ?? []).map((i: any) => ({
            period: i.period ?? '',
            status: i.status ?? '',
            amount: i.totalAmount ?? 0,
            currency: i.currency ?? 'ARS',
          })),
          tasks: (p.tasks ?? []).map((t: any) => ({
            concept: t.concept ?? '',
            priority: t.priority ?? 'Media',
            status: t.status ?? '',
          })),
        })),
      });

      try {
        await sendEmail(email, `Informe semanal de tu cartera — ${adminName}`, html, smtpUser, smtpPass);
        sent++;
      } catch { errors++; }
    }
  }

  return NextResponse.json({ ok: true, sent, errors, runAt: new Date().toISOString() });
}
