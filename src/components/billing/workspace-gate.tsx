'use client';

import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { AlertTriangle, ShieldOff } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useWorkspaceStatus } from '@/hooks/use-workspace-status';

interface WorkspaceGateProps {
  /** UID del admin que gestiona este portal. */
  adminId: string;
  /** Nombre con el que el cliente identifica a su administración (para el mensaje). */
  contactName?: string;
  children: ReactNode;
}

/**
 * Envuelve los portales de inquilino/propietario. Si el admin que los gestiona
 * tiene la suscripción impaga:
 *  - dentro de los 30 días: deja pasar y muestra un banner de aviso flotante
 *  - pasados los 30 días: cierra el portal con una pantalla neutra
 *
 * Mientras carga o si el workspace está activo, no interfiere.
 */
export function WorkspaceGate({ adminId, contactName, children }: WorkspaceGateProps) {
  const auth = useAuth();
  const ws = useWorkspaceStatus(adminId);

  // Cargando o workspace activo → portal normal, sin interferir.
  if (ws.loading || ws.active) return <>{children}</>;

  const contacto = contactName || 'tu administración';

  // Pasaron los 30 días → acceso cerrado.
  if (ws.closed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
            <ShieldOff className="h-10 w-10 text-slate-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-700">Portal no disponible</h1>
          <p className="text-slate-500 text-sm">
            El portal de <strong>{contacto}</strong> no está disponible en este momento.
            Para obtener una copia de tu información, contactate directamente con la administración.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-slate-500 underline mt-4 block mx-auto"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Dentro de la ventana de gracia → portal normal + banner flotante de aviso.
  const fecha = ws.accessClosesAt
    ? ws.accessClosesAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <>
      {children}
      <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,30rem)]">
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-black">Acceso por tiempo limitado</p>
            <p className="mt-0.5">
              {contacto} tiene su suscripción suspendida. Vas a poder consultar y descargar
              tus datos{fecha ? <> hasta el <strong>{fecha}</strong></> : ' por tiempo limitado'}.
              Después de esa fecha el portal se cierra.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
