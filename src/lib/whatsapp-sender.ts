/**
 * WhatsApp Business Cloud API sender (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 *
 * Each admin can configure their own Phone Number ID + Access Token in settings.
 * Falls back to platform-level credentials if available.
 * If no API credentials are set, logs the message for manual sending.
 */

interface WhatsAppTextPayload {
  to: string;           // E.164 without +, e.g. 5491112345678
  message: string;
  phoneNumberId?: string;
  accessToken?: string;
}

interface WhatsAppResult {
  ok: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export async function sendWhatsAppText({
  to,
  message,
  phoneNumberId,
  accessToken,
}: WhatsAppTextPayload): Promise<WhatsAppResult> {
  const pid = phoneNumberId || process.env.WA_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WA_ACCESS_TOKEN;

  if (!pid || !token) {
    // No credentials — log for manual follow-up
    console.log(`[WhatsApp] Sin credenciales. Mensaje para ${to}:\n${message}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pid}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[WhatsApp] API error:', err);
      return { ok: false, error: err };
    }

    const data = await res.json() as { messages?: { id: string }[] };
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err: any) {
    console.error('[WhatsApp] fetch error:', err);
    return { ok: false, error: err.message };
  }
}

/** Cleans an Argentine phone number to E.164 format without +. */
export function toE164AR(raw: string): string {
  let n = raw.replace(/[\s\-\(\)\+\.]/g, '');
  if (n.startsWith('0')) n = '54' + n.slice(1);
  if (n.length === 10) n = '549' + n;
  if (n.length === 12 && n.startsWith('54') && !n.startsWith('549')) n = '549' + n.slice(2);
  return n;
}
