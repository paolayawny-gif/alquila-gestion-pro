import { NextRequest, NextResponse } from 'next/server';
import { requireSessionForAdmin } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AdminPaymentConfig, ServiceRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

/**
 * POST /api/services/payment
 * Body: { adminId, requestId }
 * Creates a MercadoPago Checkout Pro preference for a one-time service payment.
 * Returns: { ok, initUrl, preferenceId }
 */
export async function POST(req: NextRequest) {
  try {
    const { adminId, requestId } = (await req.json()) as { adminId: string; requestId: string };

    if (!adminId || !requestId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    const db = getAdminDb();

    // Load payment config and service request in parallel
    const [cfgSnap, reqSnap] = await Promise.all([
      db
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(adminId)
        .collection('config')
        .doc('paymentConfig')
        .get(),
      db
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(adminId)
        .collection('serviceRequests')
        .doc(requestId)
        .get(),
    ]);

    if (!cfgSnap.exists) {
      return NextResponse.json({ error: 'Sin configuración de cobros' }, { status: 422 });
    }
    if (!reqSnap.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const cfg = cfgSnap.data() as AdminPaymentConfig;
    const serviceReq = { id: reqSnap.id, ...reqSnap.data() } as ServiceRequest;

    if (!cfg.mercadopago?.active || !cfg.mercadopago.accessToken) {
      return NextResponse.json({ error: 'MercadoPago no está configurado' }, { status: 422 });
    }

    const amount = serviceReq.serviceSnapshot.precio;
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'El servicio no tiene precio fijo configurado' }, { status: 422 });
    }

    const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;

    // Create MercadoPago Checkout Pro preference
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.mercadopago.accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: serviceReq.serviceId,
            title: serviceReq.serviceSnapshot.nombre,
            quantity: 1,
            unit_price: amount,
            currency_id: serviceReq.serviceSnapshot.moneda === 'USD' ? 'USD' : 'ARS',
          },
        ],
        back_urls: {
          success: `${baseUrl}/owner?payment=success&requestId=${requestId}`,
          failure: `${baseUrl}/owner?payment=failure&requestId=${requestId}`,
          pending: `${baseUrl}/owner?payment=pending&requestId=${requestId}`,
        },
        auto_return: 'approved',
        external_reference: `${adminId}|${requestId}`,
        metadata: {
          adminId,
          requestId,
          serviceId: serviceReq.serviceId,
          clientEmail: serviceReq.clientEmail,
        },
        notification_url: `${baseUrl}/api/services/webhook`,
      }),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      console.error('[services/payment] MP error:', err);
      return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 502 });
    }

    const mpData = await mpRes.json();
    const initUrl: string = process.env.NODE_ENV === 'production'
      ? mpData.init_point
      : mpData.sandbox_init_point;

    // Update service request with pending payment reference
    await db
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(adminId)
      .collection('serviceRequests')
      .doc(requestId)
      .update({
        estado: 'pago_pendiente',
        'pago.metodo': 'mp',
        'pago.mpPreferenceId': mpData.id,
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({ ok: true, initUrl, preferenceId: mpData.id });
  } catch (e: any) {
    console.error('[services/payment] error:', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
