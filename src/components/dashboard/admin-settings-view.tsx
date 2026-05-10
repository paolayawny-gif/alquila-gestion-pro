'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { buildWaLink } from '@/lib/whatsapp';
import { CreditCard, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { BILLING_TIERS } from '@/lib/billing/tiers';

const APP_ID = 'alquilagestion-pro';

interface AdminSettingsViewProps {
  userId?: string;
}

export function useAdminWhatsApp(userId?: string): { whatsappNumber: string | null; loading: boolean } {
  const db = useFirestore();
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'))
      .then(snap => {
        if (snap.exists()) setWhatsappNumber(snap.data()?.whatsappNumber ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [db, userId]);

  return { whatsappNumber, loading };
}

export function AdminSettingsView({ userId }: AdminSettingsViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [whatsappInput, setWhatsappInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { whatsappNumber, loading } = useAdminWhatsApp(userId);

  // Pre-fill input once loaded
  useEffect(() => {
    if (!loading && whatsappNumber) {
      setWhatsappInput(whatsappNumber);
    }
  }, [loading, whatsappNumber]);

  const handleSave = async () => {
    if (!db || !userId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'),
        { whatsappNumber: whatsappInput.trim(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      toast({ title: 'Guardado', description: 'Número de WhatsApp actualizado correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el número.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const previewNumber = whatsappInput.trim();
  const previewLink = previewNumber
    ? buildWaLink(previewNumber, 'Hola, le escribo desde AlquilaGestión Pro.')
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h2 className="text-2xl font-black text-foreground">Configuración</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Ajustes de tu cuenta y canales de comunicación.</p>
      </div>

      {/* WhatsApp Configuration */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#25D36620' }}>
              <svg viewBox="0 0 24 24" fill="#25D366" className="h-5 w-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-base font-black">Configuración de WhatsApp</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Ingresá tu número de WhatsApp Business. Se usará para enviar notificaciones a inquilinos y propietarios.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Número de WhatsApp</Label>
            <Input
              type="text"
              placeholder="+54 9 11 xxxx xxxx"
              value={whatsappInput}
              onChange={e => setWhatsappInput(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Ingresá el número con código de país. Ej: +54 9 11 4567 8901 (Buenos Aires)
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !whatsappInput.trim()}
            className="gap-2 font-bold"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">Vista previa</CardTitle>
        </CardHeader>
        <CardContent>
          {previewLink ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Link generado:</p>
              <a
                href={previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-green-700 hover:underline break-all"
              >
                {previewLink}
              </a>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hacé clic para probar que el link abre WhatsApp correctamente.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Configurá tu número para ver la vista previa.</p>
          )}
        </CardContent>
      </Card>

      {/* Billing / Plan */}
      <BillingCard userId={userId} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Card
// ─────────────────────────────────────────────────────────────────────────────

function BillingCard({ userId }: { userId?: string }) {
  const { user } = useUser();
  const { toast } = useToast();
  const plan = usePlan(userId);
  const [busy, setBusy] = useState<'checkout' | 'cancel' | 'sync' | null>(null);

  const status = plan.state?.status ?? 'trial';

  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  const handleCheckout = async () => {
    if (!userId || !user?.email) return;
    setBusy('checkout');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userId, adminEmail: user.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      window.location.href = data.initUrl;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo iniciar el cobro.', variant: 'destructive' });
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!userId) return;
    if (!confirm('¿Cancelar la suscripción? El servicio quedará disponible hasta el final del período pagado.')) return;
    setBusy('cancel');
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      toast({ title: 'Suscripción cancelada', description: 'Ya no se realizarán cobros futuros.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo cancelar.', variant: 'destructive' });
    }
    setBusy(null);
  };

  const handleSync = async () => {
    if (!userId) return;
    setBusy('sync');
    try {
      const res = await fetch('/api/billing/sync-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      toast({
        title: data.changed ? 'Plan actualizado' : 'Plan al día',
        description: data.changed
          ? `Pasaste a ${data.newTierId}. El próximo cobro reflejará el nuevo monto.`
          : `Tu plan corresponde a tus ${data.activeUnits} unidades activas.`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo sincronizar.', variant: 'destructive' });
    }
    setBusy(null);
  };

  const StatusBadge = () => {
    const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
      trial:     { label: 'Período de prueba',  cls: 'bg-blue-100 text-blue-800',     icon: Clock },
      pending:   { label: 'Esperando autorización', cls: 'bg-yellow-100 text-yellow-800', icon: Clock },
      active:    { label: 'Activa',             cls: 'bg-green-100 text-green-800',   icon: CheckCircle2 },
      past_due:  { label: 'Pago vencido',       cls: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      paused:    { label: 'Pausada',            cls: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      cancelled: { label: 'Cancelada',          cls: 'bg-gray-200 text-gray-700',     icon: AlertCircle },
    };
    const m = map[status] ?? map.trial;
    const Icon = m.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${m.cls}`}>
        <Icon className="h-3 w-3" />
        {m.label}
      </span>
    );
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-black">Plan y suscripción</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Gestioná tu plan según las unidades activas. Cobro mensual via MercadoPago.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado del plan...
          </p>
        ) : (
          <>
            {/* Estado actual */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Plan vigente</p>
                <p className="text-base font-black">
                  {plan.tier?.label ?? 'Sin plan'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.state?.activeUnits ?? 0} unidades activas
                  {plan.tier && plan.tier.maxUnits ? ` / ${plan.tier.maxUnits}` : ''}
                </p>
              </div>
              <StatusBadge />
            </div>

            {/* Trial info */}
            {plan.trialActive && plan.trialEndsAt && (
              <div className="text-xs p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                Estás en período de prueba hasta el{' '}
                <strong>{plan.trialEndsAt.toLocaleDateString('es-AR')}</strong>.
                Después necesitás activar la suscripción para seguir usando todas las funciones.
              </div>
            )}

            {/* Past due / overdue */}
            {plan.inGracePeriod && plan.gracePeriodEndsAt && (
              <div className="text-xs p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-900">
                El último cobro falló. Tenés tiempo hasta el{' '}
                <strong>{plan.gracePeriodEndsAt.toLocaleDateString('es-AR')}</strong>{' '}
                para regularizar antes que se suspenda el servicio.
              </div>
            )}

            {/* Over limit */}
            {plan.overLimit && (
              <div className="text-xs p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900">
                Tenés más unidades activas que las que cubre tu plan. Hacé click en "Sincronizar plan" para
                pasar al tramo correcto en el próximo cobro.
              </div>
            )}

            {/* Lista de tiers */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Escala de precios</p>
              <div className="space-y-1.5">
                {BILLING_TIERS.map(t => {
                  const isCurrent = plan.tier?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${
                        isCurrent ? 'border-primary bg-primary/5 font-bold' : 'border-border bg-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="font-mono">{formatARS(t.priceARS)} / mes</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Todas las funciones disponibles en todos los tramos.
              </p>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 pt-2">
              {(status === 'trial' || status === 'cancelled' || status === 'pending') && (
                <Button onClick={handleCheckout} disabled={busy === 'checkout'} className="font-bold">
                  {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activar suscripción'}
                </Button>
              )}
              {status === 'past_due' && (
                <Button onClick={handleCheckout} disabled={busy === 'checkout'} className="font-bold">
                  {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar tarjeta'}
                </Button>
              )}
              {status === 'active' && (
                <>
                  <Button variant="outline" onClick={handleSync} disabled={busy === 'sync'} className="font-bold">
                    {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sincronizar plan'}
                  </Button>
                  <Button variant="ghost" onClick={handleCancel} disabled={busy === 'cancel'} className="font-bold text-destructive">
                    {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancelar suscripción'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
