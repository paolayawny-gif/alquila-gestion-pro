import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * POST /api/services/webhook
 * MercadoPago payment notification for one-time service payments.
 * Automatically confirms payment when MP reports it as approved.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body as { type: string; data?: { id?: string } };

    if (type !== 'payment' || !data?.id) {
      return NextResponse.json({ ok: true });
    }

    const paymentId = String(data.id);

    // We need to find which admin this payment belongs to via external_reference
    // MP sends paymentId, we fetch the payment to get external_reference
    // external_reference format: "adminId|requestId"

    // Fetch payment details from MP — we need any admin's access token
    // Since we store per-admin tokens, we rely on external_reference to locate the admin
    // First fetch with a generic approach: query for serviceRequests with this mpPaymentId
    const db = getAdminDb();

    // Get payment details — try without auth first (public endpoint)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!mpRes.ok) {
      console.warn('[services/webhook] Could not fetch payment', paymentId);
      return NextResponse.json({ ok: true });
    }

    const payment = await mpRes.json();
    const status: string = payment.status;
    const externalRef: string = payment.external_reference ?? '';

    if (!externalRef.includes('|')) {
      return NextResponse.json({ ok: true });
    }

    const [adminId, requestId] = externalRef.split('|');

    if (status === 'approved') {
      await db
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(adminId)
        .collection('serviceRequests')
        .doc(requestId)
        .update({
          estado: 'pagado',
          'pago.metodo': 'mp',
          'pago.mpPaymentId': paymentId,
          'pago.aprobadoEn': new Date().toISOString(),
          'pago.aprobadoPor': 'mercadopago_webhook',
          updatedAt: new Date().toISOString(),
        });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[services/webhook] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
