'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIKeyRequiredNoticeProps {
  /** Texto específico de qué función queda bloqueada, ej: "el análisis de riesgo legal". */
  feature?: string;
  className?: string;
}

/**
 * Se muestra en lugar de cualquier función de IA cuando el admin todavía no
 * cargó su propia API key de Gemini. No hay key compartida de respaldo —
 * cada admin paga su propio uso, así que sin key la función simplemente no
 * corre (ver src/ai/gemini.ts — MissingApiKeyError).
 */
export function AIKeyRequiredNotice({ feature, className }: AIKeyRequiredNoticeProps) {
  return (
    <div className={cn(
      'rounded-xl border border-dashed border-violet-300 bg-violet-50 p-5 text-center space-y-2.5',
      className,
    )}>
      <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
        <Sparkles className="h-4.5 w-4.5 text-violet-600" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-violet-900">Necesitás tu propia API key de Gemini</p>
        <p className="text-xs text-violet-700 max-w-sm mx-auto">
          {feature ? `Para usar ${feature} hace falta ` : 'Esta función usa Inteligencia Artificial y hace falta '}
          tu propia key de Google Gemini — es gratuita y se carga una sola vez en Configuración.
        </p>
      </div>
      <Button
        size="sm"
        className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
        onClick={() => window.dispatchEvent(new CustomEvent('alquila-navigate', { detail: { tab: 'Configuración' } }))}
      >
        Ir a Configuración
      </Button>
    </div>
  );
}
