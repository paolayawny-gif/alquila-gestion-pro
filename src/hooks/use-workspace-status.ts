'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';

interface WorkspaceStatus {
  loading: boolean;
  /** El espacio de trabajo del admin está activo (suscripción al día). */
  active: boolean;
  /** Fecha límite de acceso para los clientes si el admin está impago. */
  accessClosesAt: Date | null;
  /** Ya pasó la ventana de 30 días — el portal debe cerrarse. */
  closed: boolean;
}

const ACTIVE: WorkspaceStatus = { loading: false, active: true, accessClosesAt: null, closed: false };

/**
 * Consulta si el admin que gestiona este portal tiene la suscripción al día.
 * Lo usan los portales de inquilino/propietario para mostrar el aviso de gracia
 * o cerrar el acceso pasados los 30 días.
 *
 * Ante cualquier error responde "activo" — nunca deja afuera a un cliente por
 * un fallo de la plataforma.
 */
export function useWorkspaceStatus(adminId?: string): WorkspaceStatus {
  const [status, setStatus] = useState<WorkspaceStatus>({ ...ACTIVE, loading: true });

  useEffect(() => {
    if (!adminId) { setStatus(ACTIVE); return; }
    let cancelled = false;
    authedFetch(`/api/workspace/status?adminId=${encodeURIComponent(adminId)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setStatus({
          loading: false,
          active: d?.active !== false,
          accessClosesAt: d?.accessClosesAt ? new Date(d.accessClosesAt) : null,
          closed: !!d?.closed,
        });
      })
      .catch(() => { if (!cancelled) setStatus(ACTIVE); });
    return () => { cancelled = true; };
  }, [adminId]);

  return status;
}
