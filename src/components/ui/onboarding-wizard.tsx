'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building, Users, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  open: boolean;
  onFinish: (goTo?: 'Propiedades' | 'Personas') => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: '¡Bienvenido a AlquilaGestión Pro!',
    description: 'En 2 pasos te guiamos para configurar tu primera propiedad e inquilino. Todo queda guardado automáticamente.',
    icon: Sparkles,
    iconColor: 'text-primary bg-primary/10',
  },
  {
    id: 'property',
    title: 'Primero, cargá tu propiedad',
    description: 'En "Propiedades" podés registrar la dirección, tipo, superficie y fotos. Una vez cargada, podés asociar contratos e inquilinos.',
    icon: Building,
    iconColor: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'tenant',
    title: 'Después, sumá tu inquilino',
    description: 'En "Personas y Contratos" registrás al inquilino con su email y le asociás un contrato. Desde ahí se genera automáticamente el portal de acceso.',
    icon: Users,
    iconColor: 'text-violet-600 bg-violet-50',
  },
  {
    id: 'done',
    title: '¡Listo para arrancar!',
    description: 'Una vez que cargues la propiedad y el inquilino, el sistema empieza a generar facturas, gestionar vencimientos y habilitará todos los módulos.',
    icon: CheckCircle2,
    iconColor: 'text-green-600 bg-green-50',
  },
] as const;

export function OnboardingWizard({ open, onFinish }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) return;
    setStep(s => s + 1);
  };

  const handleFinish = (goTo?: 'Propiedades' | 'Personas') => {
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
            <div className="flex gap-2 w-full">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Atrás
                </Button>
              )}
              <Button className="flex-1 gap-1.5" onClick={handleNext}>
                {step === 0 ? 'Empezar' : 'Siguiente'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
          {step > 0 && !isLast && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center w-full"
              onClick={() => handleFinish()}
            >
              Omitir por ahora
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
