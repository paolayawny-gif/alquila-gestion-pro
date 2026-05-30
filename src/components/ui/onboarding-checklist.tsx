'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const APP_ID = 'alquilagestion-pro';

interface Step {
  id: string;
  label: string;
  description: string;
  tab: string;
}

const STEPS: Step[] = [
  {
    id: 'property',
    label: 'Cargá tu primera propiedad',
    description: 'Base del sistema — todo lo demás depende de esto.',
    tab: 'Propiedades',
  },
  {
    id: 'contract',
    label: 'Creá tu primer contrato',
    description: 'Registrá inquilino + contrato para activar facturas y alertas.',
    tab: 'Personas',
  },
  {
    id: 'whatsapp',
    label: 'Conectá WhatsApp Business',
    description: 'Los recordatorios automáticos se envían por acá.',
    tab: 'Configuración',
  },
  {
    id: 'publicpage',
    label: 'Publicá tu página de propiedades',
    description: 'Tus clientes pueden ver las unidades disponibles.',
    tab: 'Configuración',
  },
  {
    id: 'payment',
    label: 'Configurá un método de cobro',
    description: 'MercadoPago, transferencia o link externo.',
    tab: 'Configuración',
  },
];

interface OnboardingChecklistProps {
  userId?: string;
  propertyCount: number;
  contractCount: number;
  onNavigate: (tab: string) => void;
}

export function OnboardingChecklist({
  userId,
  propertyCount,
  contractCount,
  onNavigate,
}: OnboardingChecklistProps) {
  const db = useFirestore();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasWhatsapp, setHasWhatsapp] = useState(false);
  const [hasPublicPage, setHasPublicPage] = useState(false);
  const [hasPayment, setHasPayment] = useState(false);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }

    Promise.all([
      getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile')),
      getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'paymentConfig')),
    ]).then(([profileSnap, paymentSnap]) => {
      const profile = profileSnap.data() ?? {};
      setHasWhatsapp(Boolean(profile.whatsappNumber));
      setHasPublicPage(Boolean(profile.publicPageEnabled));
      setDismissed(Boolean(profile.onboardingChecklistDismissed));

      const payment = paymentSnap.data() ?? {};
      setHasPayment(
        Boolean(payment.mercadoPagoEnabled) ||
        Boolean(payment.transferEnabled) ||
        Boolean(payment.externalLinkEnabled) ||
        Boolean(payment.methods?.length),
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [db, userId]);

  const completions: Record<string, boolean> = {
    property:   propertyCount > 0,
    contract:   contractCount > 0,
    whatsapp:   hasWhatsapp,
    publicpage: hasPublicPage,
    payment:    hasPayment,
  };

  const completedCount = Object.values(completions).filter(Boolean).length;
  const total = STEPS.length;
  const allDone = completedCount === total;

  const handleDismiss = async () => {
    setDismissed(true);
    if (!db || !userId) return;
    await setDoc(
      doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'),
      { onboardingChecklistDismissed: true },
      { merge: true },
    );
  };

  if (loading || dismissed) return null;

  // Once everything is done, show a brief celebration then auto-dismiss
  if (allDone) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 mb-4 animate-in fade-in duration-500">
        <Sparkles className="h-5 w-5 text-green-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-green-800">¡Configuración completa! Estás listo para operar.</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-800 shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-none shadow-sm bg-white mb-4 animate-in fade-in duration-500">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-black">Primeros pasos — {completedCount}/{total} completados</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setCollapsed(v => !v)}
                >
                  {collapsed
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronUp className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  title="Cerrar"
                  onClick={handleDismiss}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${(completedCount / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        {!collapsed && (
          <div className="space-y-1.5">
            {STEPS.map(step => {
              const done = completions[step.id];
              return (
                <button
                  key={step.id}
                  disabled={done}
                  onClick={() => !done && onNavigate(step.tab)}
                  className={cn(
                    'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    done
                      ? 'bg-muted/20 cursor-default'
                      : 'bg-muted/40 hover:bg-primary/5 cursor-pointer',
                  )}
                >
                  {done
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-bold', done && 'line-through text-muted-foreground')}>
                      {step.label}
                    </p>
                    {!done && (
                      <p className="text-[10px] text-muted-foreground">{step.description}</p>
                    )}
                  </div>
                  {!done && (
                    <span className="text-[10px] font-bold text-primary shrink-0">Ir →</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
