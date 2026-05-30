import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import { emailWelcomeAdmin } from '@/lib/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const { orgId, callerEmail } = await req.json() as { orgId: string; callerEmail?: string };

    if (callerEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    }

    const db = getAdminDb();
    const orgSnap = await db
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('data')
      .collection('organizations').doc(orgId)
      .get();

    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    }

    const org = orgSnap.data() as {
      ownerEmail: string; ownerName: string; name: string; plan: string;
    };

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ ok: true, skipped: 'no_smtp' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"AlquilaGestión Pro" <${smtpUser}>`,
      to: org.ownerEmail,
      subject: `¡Tu cuenta en AlquilaGestión Pro fue activada! 🎉`,
      html: emailWelcomeAdmin({
        ownerName: org.ownerName || org.ownerEmail.split('@')[0],
        orgName: org.name,
        plan: org.plan,
        loginUrl: 'https://alquilagestion.pro',
      }),
    });

    // Registrar que se envió el welcome email
    await db
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('data')
      .collection('organizations').doc(orgId)
      .set({ welcomeEmailSentAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
