import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AdminPaymentConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/**
 * POST /api/services/webhook?adminId=<id>
 * MercadoPago payment notification for one-time service payments.
 * adminId is passed as query param in the notification_url so we can look up
 * the admin's access token without a circular auth dependency.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body as { type: string; data?: { id?: string } };

    if (type !== 'payment' || !data?.id) {
      return NextResponse.json({ ok: true });
    }

    const paymentId = String(data.id);
    const adminId = req.nextUrl.searchParams.get('adminId');

    if (!adminId) {
      console.warn('[services/webhook] Notificación sin adminId en query param');
      return NextResponse.json({ ok: true });
    }

    const db = getAdminDb();

    // Look up admin's MP access token
    const cfgSnap = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('config').doc('paymentConfig')
      .get();

    const cfg = cfgSnap.exists ? (cfgSnap.data() as AdminPaymentConfig) : null;
    const accessToken = cfg?.mercadopago?.accessToken;

    if (!accessToken) {
      console.warn('[services/webhook] Admin sin accessToken configurado', adminId);
      return NextResponse.json({ ok: true });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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

    const [refAdminId, requestId] = externalRef.split('|');

    // Sanity check: external_reference should match the adminId from query param
    if (refAdminId !== adminId) {
      console.warn('[services/webhook] adminId mismatch', { queryParam: adminId, externalRef: refAdminId });
      return NextResponse.json({ ok: true });
    }

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
