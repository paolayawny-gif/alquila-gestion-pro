/** Normaliza un número argentino a formato internacional sin + (ej: 5491112345678) */
export function cleanWhatsAppNumber(raw: string): string {
  let n = raw.replace(/[\s\-\(\)\+\.]/g, '');
  // Si empieza con 0 → reemplazar por 54
  if (n.startsWith('0')) n = '54' + n.slice(1);
  // Si tiene 10 dígitos sin código de país → agregar 549 (móvil AR)
  if (n.length === 10) n = '549' + n;
  // Si empieza con 54 pero le falta el 9 de celular (11 dígitos, ej: 5411...)
  if (n.length === 12 && n.startsWith('54') && !n.startsWith('549')) n = '549' + n.slice(2);
  return n;
}

export function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${cleanWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}

export const WA_TEMPLATES = {
  mora: (p: { tenantName: string; propertyName: string; totalOverdue: string; currency: string; daysOverdue: number }) =>
    `Estimado/a ${p.tenantName}, le informamos que registramos pagos pendientes en *${p.propertyName}* por un total de *${p.currency} ${p.totalOverdue}* con ${p.daysOverdue} días de vencimiento. Le solicitamos regularizar la situación a la brevedad. Quedamos a disposición.`,

  invoiceReminder: (p: { tenantName: string; propertyName: string; period: string; amount: string; dueDate: string }) =>
    `Estimado/a ${p.tenantName}, le recordamos que el vencimiento de su alquiler correspondiente al período *${p.period}* en *${p.propertyName}* opera el *${p.dueDate}* por un importe de *${p.amount}*. Ante cualquier consulta, no dude en contactarnos.`,

  rentAdjustment: (p: { tenantName: string; propertyName: string; newRent: string; currency: string; effectiveDate: string }) =>
    `Estimado/a ${p.tenantName}, le informamos que a partir del *${p.effectiveDate}* su alquiler en *${p.propertyName}* se ajusta a *${p.currency} ${p.newRent}* de acuerdo a lo pactado en el contrato. Ante cualquier consulta, estamos a su disposición.`,

  maintenanceUpdate: (p: { tenantName: string; ticketTitle: string; status: string }) =>
    `Estimado/a ${p.tenantName}, le informamos que su solicitud de mantenimiento *"${p.ticketTitle}"* fue actualizada al estado: *${p.status}*. Ante cualquier consulta, no dude en contactarnos.`,

  contractExpiry: (p: { tenantName: string; propertyName: string; daysLeft: number; expiryDate: string }) =>
    `Estimado/a ${p.tenantName}, le informamos que su contrato de alquiler en *${p.propertyName}* vence el *${p.expiryDate}* (en ${p.daysLeft} días). Le sugerimos que nos contacte para gestionar la renovación con anticipación.`,

  welcome: (p: { tenantName: string; propertyName: string }) =>
    `¡Bienvenido/a ${p.tenantName} a *${p.propertyName}*! Por este medio podrá consultarnos cualquier inquietud relacionada con su contrato y propiedad. Estamos a su disposición.`,
};
