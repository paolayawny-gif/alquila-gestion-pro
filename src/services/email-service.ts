
'use server';

import nodemailer from 'nodemailer';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using Gmail/SMTP via Nodemailer.
 * Requires EMAIL_USER and EMAIL_PASS (App Password) environment variables.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn("EMAIL_USER o EMAIL_PASS no encontrados en .env. El envío de email se simulará en la consola.");
    console.log(`--- SIMULACIÓN DE ENVÍO DE EMAIL ---`);
    console.log(`PARA: ${to}`);
    console.log(`ASUNTO: ${subject}`);
    console.log(`CONTENIDO: Ver en el inspector de red o aquí.`);
    console.log(`-------------------------------------`);
    // Simulamos un pequeño delay para la UI
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, simulated: true };
  }

  try {
    // Configuración para Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    const mailOptions = {
      from: `"AlquilaGestión Pro" <${user}>`,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email enviado exitosamente:", info.messageId);

    return { success: true, id: info.messageId };
  } catch (err: any) {
    console.error("Error enviando email via Gmail/SMTP:", err);
    return { success: false, error: err.message || "Error desconocido al enviar el correo." };
  }
}
