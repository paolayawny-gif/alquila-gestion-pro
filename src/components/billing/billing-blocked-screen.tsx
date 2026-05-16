'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authedFetch } from '@/lib/authed-fetch';
import { useToast } from '@/hooks/use-toast';

interface BillingBlockedScreenProps {
  adminId: string;
  adminEmail: string;
  /** Texto que explica por qué quedó bloqueada la cuenta. */
  reason: string;
  onLogout: () => void;
}

/**
 * Pantalla completa que reemplaza al dashboard cuando la suscripción del admin
 * no está activa (trial vencido, pago pendiente fuera de plazo, cancelada, etc).
 * Único camino de salida: autorizar el pago o cerrar sesión.
 */
export function BillingBlockedScreen({ adminId, adminEmail, reason, onLogout }: BillingBlockedScreenProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleCheckout = async () => {
    if (!adminId || !adminEmail) {
      toast({ title: 'No se pudo iniciar el pago', description: 'Falta información de la cuenta.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ adminId, adminEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      window.location.href = data.initUrl;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo iniciar el pago.', variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-black">Suscripción no activa</h1>
        <p className="text-sm text-muted-foreground">{reason}</p>
        <p className="text-sm text-muted-foreground">
          Para seguir usando AlquilaGestión Pro necesitás regularizar el pago de tu suscripción.
        </p>
        <Button onClick={handleCheckout} disabled={busy} className="font-bold gap-2 mt-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Activar suscripción
        </Button>
        <button
          onClick={onLogout}
          className="text-xs text-muted-foreground underline block mx-auto mt-2"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
