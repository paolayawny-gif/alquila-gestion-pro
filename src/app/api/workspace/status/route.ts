import { NextRequest, NextResponse } from 'next/server';
import { getBillingState } from '@/lib/billing/state';
import type { BillingState } from '@/lib/billing/types';
import { requireFirebaseAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 30; // ventana para que inquilinos/propietarios descarguen sus datos

/**
 * Determina si el admin está bloqueado por facturación y desde cuándo.
 * Replica la lógica de `usePlan` (cliente) — mantener ambas en sync.
 */
function evaluateBlocked(state: BillingState): { blocked: boolean; blockedSince: string | null } {
  const now = Date.now();

  if (state.status === 'trial') {
    if (state.trialEndsAt && now >= new Date(state.trialEndsAt).getTime()) {
      return { blocked: true, blockedSince: state.trialEndsAt };
    }
    return { blocked: false, blockedSince: null };
  }

  if (state.status === 'past_due') {
    if (state.failedChargeAt) {
      const graceEnd = new Date(state.failedChargeAt).getTime() + 5 * DAY;
      if (now < graceEnd) return { blocked: false, blockedSince: null };
      return { blocked: true, blockedSince: new Date(graceEnd).toISOString() };
    }
    return { blocked: true, blockedSince: state.lastSyncedAt ?? new Date().toISOString() };
  }

  if (state.status === 'pending') {
    const anchor = state.pendingSince ?? state.lastSyncedAt;
    if (!anchor) return { blocked: false, blockedSince: null };
    const graceEnd = new Date(anchor).getTime() + 2 * DAY;
    if (now < graceEnd) return { blocked: false, blockedSince: null };
    return { blocked: true, blockedSince: new Date(graceEnd).toISOString() };
  }

  if (state.status === 'paused') {
    return { blocked: true, blockedSince: state.lastSyncedAt ?? new Date().toISOString() };
  }

  if (state.status === 'cancelled') {
    return { blocked: true, blockedSince: state.cancelledAt ?? state.lastSyncedAt ?? new Date().toISOString() };
  }

  return { blocked: false, blockedSince: null };
}

/**
 * GET /api/workspace/status?adminId=xxx
 * Para los portales de inquilino/propietario: indica si el espacio de trabajo
 * del admin está activo. Si la suscripción del admin está impaga, devuelve la
 * fecha límite (30 días) hasta la que los clientes pueden seguir accediendo
 * para consultar y descargar sus datos.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireFirebaseAuth(req);
    if (auth instanceof NextResponse) return auth;

    const adminId = req.nextUrl.searchParams.get('adminId');
    if (!adminId) return NextResponse.json({ error: 'adminId requerido' }, { status: 400 });

    const state = await getBillingState(adminId);
    // Sin estado de billing → workspace activo (admin nuevo, sin doc todavía)
    if (!state) return NextResponse.json({ active: true });

    const { blocked, blockedSince } = evaluateBlocked(state);
    if (!blocked || !blockedSince) return NextResponse.json({ active: true });

    const accessClosesAt = new Date(new Date(blockedSince).getTime() + GRACE_DAYS * DAY).toISOString();
    return NextResponse.json({
      active: false,
      accessClosesAt,
      closed: Date.now() >= new Date(accessClosesAt).getTime(),
    });
  } catch (err: any) {
    console.error('[workspace/status]', err);
    // Ante un error nuestro, no dejamos afuera a nadie: respondemos activo.
    return NextResponse.json({ active: true });
  }
}
