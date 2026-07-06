import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseAuth } from '@/lib/auth';
import { isMercadoPagoConfigured } from '@/lib/billing/providers/mercadopago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/config/integrations-status
 * Indica qué integraciones que dependen de secretos de servidor (no visibles
 * en el cliente) están realmente configuradas, para que la UI no muestre
 * botones "activos" que solo fallan al hacer click.
 */
export async function GET(req: NextRequest) {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;

  const [mercadoPago] = await Promise.all([isMercadoPagoConfigured()]);
  const notarize = !!process.env.POLYGON_PRIVATE_KEY;

  return NextResponse.json({ mercadoPago, notarize });
}
