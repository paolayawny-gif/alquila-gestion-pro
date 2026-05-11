'use client';

import React from 'react';
import { formatCurrency } from '@/lib/format';
import { getRulesForProvince } from '@/lib/province-rules';
import { cn } from '@/lib/utils';

interface FiscalPanelProps {
  annualIncome: number;
  currency?: 'ARS' | 'USD' | 'UVA';
  adminFee?: number;        // Comisión ya descontada (en misma moneda)
  maintenanceCosts?: number;
  provinceName?: string;
  compact?: boolean;
}

const GANANCIA_MINIMA_NO_IMPONIBLE = 2_700_000; // ARS anuales aprox. 2024 (simplificado)
const GANANCIA_ALICUOTA = 0.35;                  // Tasa marginal alta (simplificado)

export function FiscalPanel({
  annualIncome,
  currency = 'ARS',
  adminFee = 0,
  maintenanceCosts = 0,
  provinceName,
  compact = false,
}: FiscalPanelProps) {
  const rules = getRulesForProvince(provinceName);
  const iibbPct = rules.ingresosBrutosPct;

  const netIncome = Math.max(0, annualIncome - adminFee - maintenanceCosts);
  const iibb = annualIncome * (iibbPct / 100);
  const gananciaBase = Math.max(0, netIncome - GANANCIA_MINIMA_NO_IMPONIBLE);
  const gananciaEstimada = gananciaBase * GANANCIA_ALICUOTA;
  const totalTax = iibb + gananciaEstimada;

  const fmt = (n: number) => formatCurrency(Math.round(n), { currency });

  const rows = [
    { label: 'Ingreso bruto anual (estimado)', value: fmt(annualIncome), bold: false },
    ...(adminFee > 0 ? [{ label: `— Honorarios admin`, value: `- ${fmt(adminFee)}`, bold: false }] : []),
    ...(maintenanceCosts > 0 ? [{ label: `— Mantenimiento`, value: `- ${fmt(maintenanceCosts)}`, bold: false }] : []),
    { label: 'Ingreso neto', value: fmt(netIncome), bold: true },
    { label: `IIBB ${provinceName ? `(${provinceName.slice(0, 12)})` : ''} ${iibbPct}%`, value: fmt(iibb), bold: false, tax: true },
    { label: `Ganancias (tasa marginal aprox.)`, value: fmt(gananciaEstimada), bold: false, tax: true },
    { label: 'Carga fiscal estimada total', value: fmt(totalTax), bold: true, tax: true },
  ];

  return (
    <div className={cn('space-y-1', compact && 'text-xs')}>
      {rows.map((r, i) => (
        <div key={i} className={cn(
          'flex justify-between items-center py-1',
          i < rows.length - 1 && 'border-b border-dashed border-muted',
          r.bold && 'font-black',
        )}>
          <span className={cn('text-muted-foreground text-[11px]', r.bold && 'text-foreground', r.tax && 'text-red-600')}>{r.label}</span>
          <span className={cn('font-bold text-[12px]', r.tax && 'text-red-600')}>{r.value}</span>
        </div>
      ))}
      <p className="text-[9px] text-muted-foreground/60 mt-2 italic">
        * Estimación orientativa. No reemplaza asesoramiento contable. Ganancias: tasa marginal 35% sobre base imponible simplificada. IIBB: alícuota provincial vigente.
      </p>
    </div>
  );
}
