import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getWSAAToken, getLastVoucher, emitirFactura } from '@/lib/afip-service';
import { decrypt } from '@/lib/afip-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ID = 'alquilagestion-pro';

export async function POST(req: NextRequest) {
  try {
    const { adminId, ownerEmail, invoiceId } =
      await req.json() as { adminId: string; ownerEmail: string; invoiceId: string };

    const db = getAdminDb();

    // Load AFIP config
    const cfgDoc = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('afip_configs').doc(ownerEmail)
      .get();

    if (!cfgDoc.exists) {
      return NextResponse.json({ error: 'Configuración AFIP no encontrada' }, { status: 404 });
    }
    const cfg = cfgDoc.data()!;
    const certPem = decrypt(cfg.certEncrypted);
    const keyPem  = decrypt(cfg.keyEncrypted);
    const env: 'testing' | 'production' = cfg.environment ?? 'testing';

    // Load invoice
    const invDoc = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('facturas').doc(invoiceId)
      .get();

    if (!invDoc.exists) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    const inv = invDoc.data()!;

    // Re-use cached WSAA token if still valid (within 11h)
    let token: string;
    let sign: string;
    const cacheExpiry = cfg.wsaaCacheExpiry ? new Date(cfg.wsaaCacheExpiry) : null;
    if (cacheExpiry && cacheExpiry > new Date(Date.now() + 60_000)) {
      token = cfg.wsaaCacheToken;
      sign  = cfg.wsaaCacheSign;
    } else {
      const ta = await getWSAAToken(certPem, keyPem, env);
      token = ta.token;
      sign  = ta.sign;
      await cfgDoc.ref.update({
        wsaaCacheToken:  token,
        wsaaCacheSign:   sign,
        wsaaCacheExpiry: ta.expiresAt,
      });
    }

    const cuit            = cfg.cuit as string;
    const puntoVenta      = cfg.puntoVenta as number;
    const tipoComprobante = cfg.tipoComprobante as number; // 6=B, 11=C

    // Get next voucher number
    const lastNro      = await getLastVoucher(token, sign, cuit, puntoVenta, tipoComprobante, env);
    const nroComprobante = lastNro + 1;

    // Build invoice request
    const total        = inv.totalAmount as number;
    const esFacturaC   = tipoComprobante === 11;
    const importeTotal     = total;
    const importeNeto      = esFacturaC ? total : 0;
    const importeNoGravado = esFacturaC ? 0 : total;
    const importeIVA       = 0;

    const today = new Date();
    const fecha = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Period dates from invoice period string (e.g. "mayo 2025")
    const periodoDesde = fecha.slice(0, 6) + '01';
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const periodoHasta = fecha.slice(0, 6) + String(lastDay).padStart(2, '0');

    const result = await emitirFactura(token, sign, {
      cuit, puntoVenta, tipoComprobante,
      concepto:         2,   // Servicios
      docTipo:          99,  // Consumidor Final
      docNro:           0,
      nroComprobante,
      fecha,
      importeTotal,
      importeNoGravado,
      importeNeto,
      importeIVA,
      periodoDesde,
      periodoHasta,
    }, env);

    // Persist CAE to invoice document
    const now = new Date().toISOString();
    await invDoc.ref.update({
      afipCae:            result.cae,
      afipCaeVto:         result.caeFechaVto,
      afipNroComprobante: result.nroComprobante,
      afipPtoVenta:       puntoVenta,
      afipTipoComprobante: tipoComprobante,
      afipEmittedAt:      now,
      status:             'Esperando Factura ARCA',
    });

    return NextResponse.json({
      ok:             true,
      cae:            result.cae,
      caeFechaVto:    result.caeFechaVto,
      nroComprobante: result.nroComprobante,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error emitiendo factura' }, { status: 500 });
  }
}
