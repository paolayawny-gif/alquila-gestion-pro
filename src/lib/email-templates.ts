/* Branded email templates for AlquilaGestión Pro. */

const BRAND_GREEN = '#1D9E75';
const BRAND_DARK = '#1e293b';

function shell(body: string, footer = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AlquilaGestión Pro</title>
</head>
<body style="margin:0;padding:0;background:#f0faf6;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
  <div style="background:${BRAND_GREEN};padding:28px 36px;display:flex;align-items:center;gap:12px;">
    <div>
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:800;letter-spacing:-0.3px;">AlquilaGestión Pro</h1>
      <p style="color:rgba(255,255,255,0.75);margin:2px 0 0;font-size:12px;">Plataforma de administración de alquileres</p>
    </div>
  </div>
  <div style="padding:36px;">
    ${body}
  </div>
  <div style="padding:20px 36px;border-top:1px solid #e8f5f0;background:#f8fdfb;">
    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
      ${footer || 'Este es un mensaje automático de AlquilaGestión Pro. No respondas a este email.'}
    </p>
  </div>
</div>
</body>
</html>`;
}

function kv(label: string, value: string, highlight = false) {
  return `<tr>
    <td style="padding:10px 14px;font-size:13px;color:#64748b;">${label}</td>
    <td style="padding:10px 14px;font-size:13px;color:${highlight ? BRAND_GREEN : BRAND_DARK};font-weight:700;text-align:right;">${value}</td>
  </tr>`;
}

function table(...rows: string[]) {
  return `<table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin:20px 0;">${rows.join('')}</table>`;
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:block;background:${BRAND_GREEN};color:#fff;text-align:center;padding:13px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:20px 0;">${label}</a>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function emailInvoiceReminder(p: {
  tenantName: string;
  propertyName: string;
  period: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysLeft: number;
  adminName?: string;
}) {
  const urgency = p.daysLeft <= 1 ? '🔴 Último día' : `en ${p.daysLeft} días`;
  return shell(`
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Hola <strong>${p.tenantName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Tu alquiler de <strong>${p.propertyName}</strong> vence <strong>${urgency}</strong>.
    </p>
    ${table(
      kv('Período', p.period),
      kv('Vencimiento', p.dueDate),
      kv('Importe', `${p.currency} ${p.amount}`, true),
    )}
    <p style="color:#475569;font-size:13px;margin:16px 0 0;">
      Si ya realizaste el pago, podés ignorar este mensaje. Si tenés alguna consulta, contactá a tu administrador.
    </p>
  `, `Enviado por ${p.adminName ?? 'tu administrador'} a través de AlquilaGestión Pro.`);
}

export function emailRentAdjustment(p: {
  tenantName: string;
  propertyName: string;
  currentRent: string;
  newRent: string;
  currency: string;
  variationPct: string;
  mechanism: string;
  effectiveDate: string;
  adminName?: string;
}) {
  return shell(`
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Hola <strong>${p.tenantName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Te informamos que el alquiler de <strong>${p.propertyName}</strong> se actualizó a partir del <strong>${p.effectiveDate}</strong>,
      conforme lo pactado en tu contrato.
    </p>
    ${table(
      kv('Índice aplicado', p.mechanism),
      kv('Variación', `+${p.variationPct}%`),
      kv('Alquiler anterior', `${p.currency} ${p.currentRent}`),
      kv('Nuevo alquiler', `${p.currency} ${p.newRent}`, true),
    )}
    <p style="color:#475569;font-size:13px;margin:16px 0 0;">
      Este ajuste se aplica de acuerdo a la cláusula de actualización de tu contrato. Ante cualquier consulta, contactá a tu administrador.
    </p>
  `, `Enviado por ${p.adminName ?? 'tu administrador'} a través de AlquilaGestión Pro.`);
}

export function emailRentAdjustmentOwner(p: {
  ownerName: string;
  propertyName: string;
  tenantName: string;
  currentRent: string;
  newRent: string;
  currency: string;
  variationPct: string;
  mechanism: string;
  effectiveDate: string;
}) {
  return shell(`
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Hola <strong>${p.ownerName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Se aplicó el ajuste de alquiler para <strong>${p.propertyName}</strong> (inquilino: ${p.tenantName}).
    </p>
    ${table(
      kv('Índice aplicado', p.mechanism),
      kv('Variación', `+${p.variationPct}%`),
      kv('Alquiler anterior', `${p.currency} ${p.currentRent}`),
      kv('Nuevo alquiler', `${p.currency} ${p.newRent}`, true),
      kv('Vigencia', p.effectiveDate),
    )}
    <p style="color:#475569;font-size:13px;margin:16px 0 0;">
      La factura correspondiente se generará cuando el inquilino realice el pago.
    </p>
  `);
}

export function emailContractExpiry(p: {
  tenantName: string;
  propertyName: string;
  expiryDate: string;
  daysLeft: number;
  adminName?: string;
  adminPhone?: string;
}) {
  const waLink = p.adminPhone
    ? `https://wa.me/${p.adminPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, soy ${p.tenantName}. Mi contrato de ${p.propertyName} vence pronto y quería consultar por la renovación.`)}`
    : null;

  return shell(`
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Hola <strong>${p.tenantName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Tu contrato de alquiler en <strong>${p.propertyName}</strong> vence el <strong>${p.expiryDate}</strong>
      (en <strong>${p.daysLeft} días</strong>). Te sugerimos contactar a tu administrador para gestionar la renovación.
    </p>
    ${waLink ? btn('💬 Contactar por WhatsApp', waLink) : ''}
  `, `Enviado por ${p.adminName ?? 'tu administrador'} a través de AlquilaGestión Pro.`);
}

export function emailMora(p: {
  tenantName: string;
  propertyName: string;
  daysOverdue: number;
  totalOverdue: string;
  penalty: string;
  total: string;
  currency: string;
  adminName?: string;
}) {
  return shell(`
    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;color:#991b1b;font-weight:700;font-size:14px;">⚠ Deuda en mora — ${p.daysOverdue} días</p>
    </div>
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Estimado/a <strong>${p.tenantName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Le informamos que registra pagos pendientes en <strong>${p.propertyName}</strong>. Le solicitamos regularizar la situación a la brevedad.
    </p>
    ${table(
      kv('Días en mora', `${p.daysOverdue} días`),
      kv('Capital adeudado', `${p.currency} ${p.totalOverdue}`),
      kv('Recargo por mora', `${p.currency} ${p.penalty}`),
      kv('Total a regularizar', `${p.currency} ${p.total}`, true),
    )}
  `, `Enviado por ${p.adminName ?? 'tu administrador'} a través de AlquilaGestión Pro. El no pago puede derivar en acciones legales.`);
}

export function emailServiceRequest(p: {
  clientName: string;
  serviceName: string;
  adminName?: string;
  price?: string;
  currency?: string;
  estado: string;
  notes?: string;
}) {
  return shell(`
    <p style="color:${BRAND_DARK};margin:0 0 6px;font-size:15px;">Hola <strong>${p.clientName}</strong>,</p>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.6;">
      Tu solicitud de servicio <strong>"${p.serviceName}"</strong> fue actualizada.
    </p>
    ${table(
      kv('Estado', p.estado, true),
      ...(p.price ? [kv('Importe', `${p.currency ?? 'ARS'} ${p.price}`)] : []),
      ...(p.notes ? [kv('Nota', p.notes)] : []),
    )}
  `, `Enviado por ${p.adminName ?? 'tu administrador'} a través de AlquilaGestión Pro.`);
}
