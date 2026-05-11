'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import {
  getRulesForProvince,
  calcularGanancias,
  categoriaMontotributo,
  type RentalActivity,
} from '@/lib/province-rules';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface FiscalPanelProps {
  annualIncome: number;
  currency?: 'ARS' | 'USD' | 'UVA';
  adminFee?: number;
  maintenanceCosts?: number;
  provinceName?: string;
  compact?: boolean;
  showActivitySelector?: boolean;
  defaultActivity?: RentalActivity;
}

const ACTIVITY_LABELS: Record<RentalActivity, string> = {
  Vivienda: 'Vivienda (habitacional)',
  Comercial: 'Comercial / oficina',
  Temporal: 'Temporal / turístico',
  Profesional: 'Consultorios / profesional',
};

export function FiscalPanel({
  annualIncome,
  currency = 'ARS',
  adminFee = 0,
  maintenanceCosts = 0,
  provinceName,
  compact = false,
  showActivitySelector = true,
  defaultActivity = 'Vivienda',
}: FiscalPanelProps) {
  const [activity, setActivity] = useState<RentalActivity>(defaultActivity);

  const rules = getRulesForProvince(provinceName);
  const iibbPct = rules.iibb[activity];

  const netIncome = Math.max(0, annualIncome - adminFee - maintenanceCosts);
  const iibb = annualIncome * (iibbPct / 100);
  const gananciaAnual = currency === 'ARS' ? calcularGanancias(annualIncome) : 0;
  const totalTax = iibb + gananciaAnual;

  const monotributo = currency === 'ARS' ? categoriaMontotributo(annualIncome) : null;
  const monotributoCuotaAnual = monotributo ? monotributo.cuotaMensual * 12 : null;

  const fmt = (n: number) =>
    currency === 'ARS'
      ? formatCurrency(Math.round(n), { currency: 'ARS' })
      : `≈ ${formatCurrency(Math.round(n), { currency })}`;

  const isExento = iibbPct === 0;

  return (
    <div className={cn('space-y-2', compact && 'text-xs')}>
      {showActivitySelector && (
        <div className="flex items-center gap-2">
          <span className={cn('text-muted-foreground shrink-0', compact ? 'text-[10px]' : 'text-xs')}>
            Actividad:
          </span>
          <Select value={activity} onValueChange={(v) => setActivity(v as RentalActivity)}>
            <SelectTrigger className={cn('h-7 text-xs', compact && 'h-6 text-[10px]')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ACTIVITY_LABELS) as RentalActivity[]).map((a) => (
                <SelectItem key={a} value={a} className="text-xs">
                  {ACTIVITY_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Income rows */}
      <div className="space-y-0.5">
        <Row label="Ingreso bruto anual" value={fmt(annualIncome)} compact={compact} />
        {adminFee > 0 && (
          <Row label="— Honorarios administración" value={`- ${fmt(adminFee)}`} compact={compact} muted />
        )}
        {maintenanceCosts > 0 && (
          <Row label="— Mantenimiento estimado" value={`- ${fmt(maintenanceCosts)}`} compact={compact} muted />
        )}
        <Row label="Ingreso neto" value={fmt(netIncome)} compact={compact} bold />
      </div>

      {/* Tax rows */}
      <div className="border-t border-dashed border-muted pt-1.5 space-y-0.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn('font-semibold text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px] uppercase tracking-wide')}>
            Impuestos estimados *
          </span>
        </div>

        <Row
          label={
            isExento
              ? `IIBB ${provinceName ? `(${rules.provincia.slice(0, 14)})` : ''} — Exento`
              : `IIBB ${provinceName ? `(${rules.provincia.slice(0, 14)})` : ''} ${iibbPct}%`
          }
          value={isExento ? '$0' : fmt(iibb)}
          compact={compact}
          tax={!isExento}
          badge={isExento ? 'exento' : undefined}
        />

        {currency === 'ARS' && (
          <Row
            label="Ganancias 4ª cat. (escala 2024)"
            value={gananciaAnual === 0 ? 'No alcanzado' : fmt(gananciaAnual)}
            compact={compact}
            tax={gananciaAnual > 0}
            muted={gananciaAnual === 0}
          />
        )}

        {currency !== 'ARS' && (
          <Row
            label="Ganancias"
            value="N/D (ingreso en moneda extranjera)"
            compact={compact}
            muted
          />
        )}

        <Row
          label="Carga fiscal estimada total"
          value={currency === 'ARS' ? fmt(totalTax) : fmt(iibb)}
          compact={compact}
          bold
          tax
        />
      </div>

      {/* Monotributo comparison */}
      {currency === 'ARS' && monotributo && (
        <div className="border-t border-dashed border-muted pt-1.5">
          <p className={cn('text-muted-foreground mb-1', compact ? 'text-[9px]' : 'text-[10px] uppercase tracking-wide font-semibold')}>
            Monotributo — referencia *
          </p>
          <Row
            label={`Cat. ${monotributo.categoria} (hasta ${fmt(monotributo.ingresoMaximo)}/año)`}
            value={`${fmt(monotributo.cuotaMensual)}/mes`}
            compact={compact}
          />
          <Row
            label="Cuota anual estimada"
            value={fmt(monotributoCuotaAnual!)}
            compact={compact}
          />
          {totalTax > monotributoCuotaAnual! ? (
            <p className={cn('text-amber-600 dark:text-amber-400 font-medium mt-0.5', compact ? 'text-[9px]' : 'text-[11px]')}>
              El Monotributo podría ser más conveniente. Consultá con tu contador.
            </p>
          ) : (
            <p className={cn('text-muted-foreground mt-0.5', compact ? 'text-[9px]' : 'text-[11px]')}>
              Régimen general estimado similar o más conveniente que Monotributo.
            </p>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-1 pt-1 border-t border-dashed border-muted/50">
        <Info className="h-2.5 w-2.5 text-muted-foreground/50 mt-0.5 shrink-0" />
        <p className="text-[9px] text-muted-foreground/60 italic leading-tight">
          * Estimación orientativa con fines informativos. No constituye asesoramiento fiscal ni legal. Las alícuotas de IIBB, las escalas de Ganancias y los parámetros de Monotributo pueden variar. Consultá con un contador matriculado antes de tomar decisiones impositivas.
          {rules.note && ` Ref.: ${rules.note}`}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  compact,
  bold,
  tax,
  muted,
  badge,
}: {
  label: string;
  value: string;
  compact?: boolean;
  bold?: boolean;
  tax?: boolean;
  muted?: boolean;
  badge?: string;
}) {
  return (
    <div className={cn('flex justify-between items-center py-0.5 gap-2', bold && 'font-semibold')}>
      <span
        className={cn(
          'text-[11px]',
          compact && 'text-[10px]',
          bold ? 'text-foreground' : 'text-muted-foreground',
          tax && !muted && 'text-red-600 dark:text-red-400',
          muted && 'text-muted-foreground/60',
        )}
      >
        {label}
        {badge && (
          <Badge variant="outline" className="ml-1.5 text-[8px] py-0 px-1 text-green-600 border-green-300">
            {badge}
          </Badge>
        )}
      </span>
      <span
        className={cn(
          'font-bold text-[12px] shrink-0',
          compact && 'text-[10px]',
          tax && !muted && 'text-red-600 dark:text-red-400',
          muted && 'text-muted-foreground/60 font-normal',
        )}
      >
        {value}
      </span>
    </div>
  );
}
