'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Building, Users, CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  TrendingUp, BookOpen, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type GoTo = 'Propiedades' | 'Personas' | 'Índices' | 'Configuración' | 'Ayuda';

interface OnboardingWizardProps {
  open: boolean;
  onFinish: (goTo?: GoTo) => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: '¡Bienvenido a AlquilaGestión Pro!',
    description: 'Tu plataforma completa para gestionar alquileres. En pocos pasos te guiamos para aprovechar todo el sistema desde el primer día.',
    icon: Sparkles,
    iconColor: 'text-primary bg-primary/10',
    tip: null,
    cta: null,
  },
  {
    id: 'property',
    title: 'Cargá tu primera propiedad',
    description: 'En "Propiedades" registrás la dirección, tipo, superficie, fotos y manual de cada unidad. Una propiedad cargada ya es suficiente para activar todo el sistema.',
    icon: Building,
    iconColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
    tip: '💡 Podés subir fotos y un tour 360° para mostrarle la unidad a futuros inquilinos sin salir de la app.',
    cta: { label: 'Ir a Propiedades', goTo: 'Propiedades' as GoTo },
  },
  {
    id: 'tenant',
    title: 'Sumá propietario e inquilino',
    description: 'En "Personas y Contratos" registrás al inquilino con su email y al propietario. El sistema genera automáticamente el portal de acceso para cada uno.',
    icon: Users,
    iconColor: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
    tip: '💡 El inquilino puede ver sus facturas, informar pagos y pedir servicios desde su portal privado — sin que vos tengas que reenviar nada.',
    cta: { label: 'Ir a Personas', goTo: 'Personas' as GoTo },
  },
  {
    id: 'whatsapp',
    title: 'Configurá WhatsApp Business',
    description: 'Desde "Configuración" conectás tu número de WhatsApp Business. El sistema envía recordatorios de vencimiento, avisos de ajuste y confirmaciones automáticamente.',
    icon: MessageCircle,
    iconColor: 'text-green-600 bg-green-50 dark:bg-green-950/40',
    tip: '💡 Los recordatorios se envían el día 28 o 29 de cada mes — no necesitás recordarlo ni hacerlo vos.',
    cta: { label: 'Ir a Configuración', goTo: 'Configuración' as GoTo },
  },
  {
    id: 'indices',
    title: 'Cargá los índices oficiales',
    description: 'En "Índices Oficiales" cargás ICL, IPC, CER y Casa Propia. El sistema calcula automáticamente los ajustes de alquiler y los presenta para tu aprobación.',
    icon: TrendingUp,
    iconColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
    tip: '💡 Al aprobar un ajuste, el sistema notifica al propietario e inquilino con el nuevo valor — vos solo aprobás, el resto es automático.',
    cta: { label: 'Ir a Índices', goTo: 'Índices' as GoTo },
  },
  {
    id: 'help',
    title: 'Leé el Centro de Ayuda',
    description: 'Cada sección tiene su propia guía explicando ICL, IPC, CER, liquidaciones, firma electrónica y más. Vale la pena leerlo antes de cargar datos reales.',
    icon: BookOpen,
    iconColor: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
    tip: '💡 El glosario explica en lenguaje simple qué son ICL, IPC, CER y Casa Propia para que puedas explicárselo a tus clientes.',
    cta: { label: 'Ir al Centro de Ayuda', goTo: 'Ayuda' as GoTo },
  },
  {
    id: 'done',
    title: '¡Todo listo para empezar!',
    description: 'Con la propiedad y el contrato cargados, el sistema empieza a generar facturas, controlar vencimientos, enviar recordatorios y habilitar todos los módulos.',
    icon: CheckCircle2,
    iconColor: 'text-green-600 bg-green-50 dark:bg-green-950/40',
    tip: null,
    cta: { label: 'Ir a Propiedades', goTo: 'Propiedades' as GoTo },
  },
] as const;

export function OnboardingWizard({ open, onFinish }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleFinish = (goTo?: GoTo) => {
    onFinish(goTo);
  };

  return (
    <Dialog open={open} onOpenChange={() => handleFinish()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-primary' : i < step ? 'w-3 bg-primary/40' : 'w-3 bg-muted',
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={cn('mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-3', current.iconColor)}>
            <current.icon className="h-8 w-8" aria-hidden="true" />
          </div>

          <DialogTitle className="text-center text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed mt-1">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {/* Tip */}
        {current.tip && (
          <div className="mx-1 rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            {current.tip}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2 mt-2">
          {isLast ? (
            <>
              <Button className="w-full gap-2" onClick={() => handleFinish('Propiedades')}>
                <Building className="h-4 w-4" aria-hidden="true" />
                Ir a Propiedades
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleFinish()}>
                Explorar el panel
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2 w-full">
                {!isFirst && (
                  <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Atrás
                  </Button>
                )}
                <Button className="flex-1 gap-1.5" onClick={() => setStep(s => s + 1)}>
                  {step === 0 ? 'Empezar' : 'Siguiente'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {current.cta && (
                <Button
                  variant="ghost"
                  className="w-full text-xs text-primary hover:text-primary"
                  onClick={() => handleFinish(current.cta!.goTo)}
                >
                  {current.cta.label} ahora →
                </Button>
              )}
              {step > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center w-full"
                  onClick={() => handleFinish()}
                >
                  Omitir guía
                </button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
