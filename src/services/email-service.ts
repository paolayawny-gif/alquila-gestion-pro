
'use server';

import { Resend } from 'resend';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the Resend service.
 * Requires RESEND_API_KEY environment variable.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY no encontrada. El envío de email se simulará en la consola.");
    console.log(`SIMULACIÓN DE EMAIL A: ${to}\nASUNTO: ${subject}\nCUERPO:\n${html}`);
    // Simulamos un pequeño delay para que la UI muestre el estado de carga
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, simulated: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'AlquilaGestión Pro <notificaciones@tu-dominio.com>', // Cambiar por tu dominio verificado en Resend
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Error enviando email via Resend:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("Error inesperado en servicio de email:", err);
    return { success: false, error: err.message };
  }
}
