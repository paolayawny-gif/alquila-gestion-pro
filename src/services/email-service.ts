
'use server';

import nodemailer from 'nodemailer';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Nombre visible del remitente, ej: "Inmobiliaria García" */
  fromName?: string;
  /** Si el cliente responde, el mensaje llegará a este email (ej: el email de la inmobiliaria) */
  replyTo?: string;
  /** Credenciales SMTP propias de la org. Si no se proveen, usa las de la plataforma. */
  smtpUser?: string;
  smtpPass?: string;
}

/**
 * Envía un email usando Nodemailer/Gmail.
 *
 * Prioridad de credenciales:
 * 1. smtpUser + smtpPass (email propio de la org)
 * 2. EMAIL_USER + EMAIL_PASS del entorno (email de la plataforma)
 *
 * Si no hay ninguna, entra en modo simulación (útil en desarrollo).
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName = 'AlquilaGestión Pro',
  replyTo,
  smtpUser,
  smtpPass,
}: SendEmailInput) {

  const user = smtpUser || process.env.EMAIL_USER;
  const pass = smtpPass || process.env.EMAIL_PASS;

  // Sin credenciales → modo simulación
  if (!user || !pass) {
    console.warn('[Email] Sin credenciales. Simulando envío.');
    console.log(`PARA: ${to} | ASUNTO: ${subject} | DE: ${fromName}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    const fromAddress = `"${fromName}" <${user}>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Enviado OK:', info.messageId);
    return { success: true, id: info.messageId };
  } catch (err: any) {
    console.error('[Email] Error:', err);
    return { success: false, error: err.message || 'Error desconocido al enviar el correo.' };
  }
}

/**
 * Genera HTML estilizado para emails de invitación a postulantes.
 */
export async function buildInvitationEmail(opts: {
  orgName: string;
  propertyName: string;
  propertyAddress: string;
  applyLink: string;
  senderName?: string;
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <!-- Header -->
    <div style="background:#16a34a;padding:32px 40px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;">AlquilaGestión Pro</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">${opts.orgName}</p>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 12px;">Invitación a postular</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
        Hola, te invitamos a completar tu carpeta digital para el siguiente inmueble:
      </p>
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin-bottom:28px;">
        <p style="margin:0;font-weight:700;color:#1e293b;font-size:16px;">${opts.propertyName}</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${opts.propertyAddress}</p>
      </div>
      <a href="${opts.applyLink}"
         style="display:block;background:#16a34a;color:#ffffff;text-align:center;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:28px;">
        Completar mi postulación →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Este enlace fue generado por ${opts.orgName} a través de AlquilaGestión Pro.
        Si no esperabas este email, podés ignorarlo.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera HTML para notificaciones de mora.
 */
export async function buildMoraNotificationEmail(opts: {
  orgName: string;
  tenantName: string;
  propertyName: string;
  daysOverdue: number;
  totalOverdue: number;
  penalty: number;
}) {
  const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:#dc2626;padding:28px 40px;">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:800;">⚠ Notificación de Mora</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px;">${opts.orgName} · AlquilaGestión Pro</p>
    </div>
    <div style="padding:36px;">
      <p style="color:#475569;margin:0 0 20px;">Estimado/a <strong>${opts.tenantName}</strong>,</p>
      <p style="color:#475569;margin:0 0 20px;line-height:1.6;">
        Le informamos que registra una deuda pendiente por el alquiler de <strong>${opts.propertyName}</strong>:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr style="background:#fef2f2;">
          <td style="padding:12px 16px;font-size:13px;color:#7f1d1d;font-weight:700;">Días en mora</td>
          <td style="padding:12px 16px;font-size:13px;color:#991b1b;font-weight:800;text-align:right;">${opts.daysOverdue} días</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#475569;">Capital adeudado</td>
          <td style="padding:12px 16px;font-size:13px;color:#1e293b;font-weight:700;text-align:right;">${fmt(opts.totalOverdue)}</td>
        </tr>
        <tr style="background:#fef2f2;">
          <td style="padding:12px 16px;font-size:13px;color:#7f1d1d;font-weight:700;">Recargo por mora</td>
          <td style="padding:12px 16px;font-size:13px;color:#dc2626;font-weight:800;text-align:right;">${fmt(opts.penalty)}</td>
        </tr>
        <tr style="background:#1e293b;">
          <td style="padding:14px 16px;font-size:14px;color:#fff;font-weight:800;">TOTAL A REGULARIZAR</td>
          <td style="padding:14px 16px;font-size:14px;color:#fbbf24;font-weight:800;text-align:right;">${fmt(opts.totalOverdue + opts.penalty)}</td>
        </tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        Por favor regularice su situación a la brevedad para evitar acciones legales adicionales.
        Ante cualquier consulta, comuníquese con ${opts.orgName}.
      </p>
    </div>
  </div>
</body>
</html>`;
}
