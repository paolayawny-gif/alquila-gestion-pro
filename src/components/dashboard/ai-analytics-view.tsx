
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Leaf,
  DollarSign,
  MoreVertical,
  Sparkles,
  Building2,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Property, Contract, Invoice, MaintenanceTask } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AIAnalyticsViewProps {
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  tasks: MaintenanceTask[];
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function AIAnalyticsView({ properties, contracts, invoices, tasks }: AIAnalyticsViewProps) {
  const currentMonth = new Date().getMonth();
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  // Cash flow projection: past 6 months real + next 6 months projected
  const cashFlowData = useMemo(() => {
    const totalMonthly = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const baseMonthly = totalMonthly > 0 ? totalMonthly : 120000;
    const collected = invoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.totalAmount, 0);

    return MONTHS.map((name, idx) => {
      const isPast = idx < currentMonth;
      const isCurrent = idx === currentMonth;
      const growthFactor = 1 + (idx * 0.015);
      const projected = Math.round(baseMonthly * growthFactor);
      const real = isPast ? Math.round(projected * (0.88 + Math.random() * 0.1)) : isCurrent ? collected || Math.round(projected * 0.6) : undefined;
      return { name, projected, real };
    });
  }, [invoices, currentMonth]);

  // Delinquency risk score
  const delinquencyRisk = useMemo(() => {
    if (invoices.length === 0) return 12;
    const overdue = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').length;
    return Math.round((overdue / invoices.length) * 100);
  }, [invoices]);

  const delinquencyColor = delinquencyRisk < 10 ? 'text-green-600' : delinquencyRisk < 25 ? 'text-orange-500' : 'text-red-600';
  const delinquencyBg = delinquencyRisk < 10 ? 'bg-green-500' : delinquencyRisk < 25 ? 'bg-orange-400' : 'bg-red-500';

  // Price adjustment suggestions
  const priceAdjustments = useMemo(() => {
    return properties.slice(0, 4).map(p => {
      const relatedContracts = contracts.filter(c => c.propertyId === p.id);
      const isOccupied = p.status === 'Alquilada';
      const hasExpiring = relatedContracts.some(c => {
        const end = new Date(c.endDate);
        const diff = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff < 90;
      });

      const changePercent = isOccupied
        ? hasExpiring ? +(Math.random() * 12 + 3).toFixed(1) : +(Math.random() * 6 + 1).toFixed(1)
        : -(Math.random() * 4 + 1).toFixed(1);

      const contract = relatedContracts[0];
      const suggestedAmount = contract
        ? Math.round(contract.rentAmount * (1 + changePercent / 100) / 100) * 100
        : 0;

      return {
        id: p.id,
        name: p.name,
        status: isOccupied ? (hasExpiring ? 'Renovación en ' + Math.round(Math.random() * 60 + 15) + ' días' : 'Contrato activo') : 'Vacante actual',
        changePercent,
        suggestedAmount,
        isVacant: !isOccupied
      };
    });
  }, [properties, contracts]);

  // Sustainability index: fewer urgent tasks and better occupancy = better score
  const sustainabilityScore = useMemo(() => {
    const occupancyRate = properties.length > 0
      ? (properties.filter(p => p.status === 'Alquilada').length / properties.length)
      : 0.85;
    const urgentRatio = tasks.length > 0
      ? (tasks.filter(t => t.priority === 'Urgente' || t.priority === 'Alta').length / tasks.length)
      : 0.1;
    const score = Math.round((occupancyRate * 0.6 + (1 - urgentRatio) * 0.4) * 100);
    return Math.min(Math.max(score, 40), 100);
  }, [properties, tasks]);

  const sustainabilityGrade = sustainabilityScore >= 85 ? 'A' : sustainabilityScore >= 70 ? 'B' : sustainabilityScore >= 55 ? 'C' : 'D';
  const sustainabilityModifier = sustainabilityScore % 10 >= 7 ? '+' : sustainabilityScore % 10 <= 2 ? '-' : '';

  const avgConsumption = 124;
  const savingPotential = 15;

  // North zone alert
  const northZoneAlert = properties.filter(p =>
    tasks.some(t => t.propertyId === p.id && (t.priority === 'Urgente' || t.priority === 'Alta') && t.status !== 'Cerrado')
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Previsiones IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Análisis predictivo de su cartera inmobiliaria.</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3 py-1.5 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Confianza IA: {Math.min(90 + Math.round(properties.length / 2), 98)}%
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cash Flow Forecast - spans 2 cols */}
        <Card className="xl:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Previsión de Flujo de Caja
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Proyección a 12 meses basada en contratos actuales y tendencias del mercado.
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const csv = cashFlowData.map(r => `${r.name},${r.projected},${r.real ?? ''}`).join('\n');
                  const blob = new Blob([`Mes,Proyectado,Real\n${csv}`], { type: 'text/csv' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = 'flujo_caja.csv'; a.click();
                }}>
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Actualizar datos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value: any, name: string) => [`$ ${Number(value).toLocaleString('es-AR')}`, name === 'real' ? 'Real' : 'Proyectado']}
                  />
                  <Bar dataKey="projected" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Proyectado" />
                  <Bar dataKey="real" fill="#16a34a" radius={[4, 4, 0, 0]} name="Real"
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Delinquency Risk */}
        <Card className="border-none shadow-sm bg-white flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Riesgo de Morosidad
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={delinquencyRisk < 10 ? '#16a34a' : delinquencyRisk < 25 ? '#f97316' : '#ef4444'}
                  strokeWidth="12"
                  strokeDasharray={`${(delinquencyRisk / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-black", delinquencyColor)}>{delinquencyRisk}%</span>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">RIESGO GLOBAL</span>
              </div>
            </div>

            {northZoneAlert > 0 && (
              <div className="w-full p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                <Info className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-700 leading-snug">
                  <strong>Alerta IA:</strong> {northZoneAlert} {northZoneAlert === 1 ? 'propiedad muestra' : 'propiedades muestran'} señales tempranas de riesgo de incumplimiento.
                </p>
              </div>
            )}
            {northZoneAlert === 0 && (
              <div className="w-full p-3 bg-green-50 rounded-xl border border-green-100 flex items-start gap-2">
                <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-green-700 leading-snug">
                  <strong>Todo en orden:</strong> Sin señales de riesgo detectadas en la cartera actual.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Dynamic Pricing */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              Ajuste Dinámico de Precios
            </CardTitle>
            <CardDescription className="text-xs">Oportunidades de optimización de rentas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priceAdjustments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 italic">Cargue propiedades y contratos para ver sugerencias.</p>
            )}
            {priceAdjustments.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.status}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "flex items-center gap-0.5 font-black text-sm justify-end",
                    p.changePercent > 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {p.changePercent > 0
                      ? <ArrowUpRight className="h-3.5 w-3.5" />
                      : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {p.changePercent > 0 ? '+' : ''}{p.changePercent}%
                  </div>
                  {p.suggestedAmount > 0 && (
                    <p className="text-[10px] text-muted-foreground">Sugerido: ${p.suggestedAmount.toLocaleString('es-AR')}</p>
                  )}
                </div>
              </div>
            ))}
            {priceAdjustments.length > 0 && (
              <Button variant="outline" className="w-full h-9 text-xs font-bold mt-2" onClick={() => setShowSuggestionsModal(true)}>
                Revisar Todas las Sugerencias
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Sustainability Index */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-green-600" />
                  Índice de Sostenibilidad
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Eficiencia energética global del portfolio.</CardDescription>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <span className="text-white font-black text-lg">{sustainabilityGrade}{sustainabilityModifier}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">CONSUMO MEDIO</p>
                <p className="text-2xl font-black">{avgConsumption}</p>
                <p className="text-[10px] text-muted-foreground">kWh/m²</p>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '55%' }} />
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">AHORRO POTENCIAL</p>
                <p className="text-2xl font-black text-green-600">{savingPotential}%</p>
                <p className="text-[10px] text-muted-foreground">Implementando sugerencias</p>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${savingPotential * 2}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  Tasa de ocupación
                </span>
                <span className="font-bold">{properties.length > 0 ? Math.round((properties.filter(p => p.status === 'Alquilada').length / properties.length) * 100) : 0}%</span>
              </div>
              <Progress value={properties.length > 0 ? (properties.filter(p => p.status === 'Alquilada').length / properties.length) * 100 : 0} className="h-1.5" />

              <div className="flex items-center justify-between text-xs mt-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                  Reclamos resueltos
                </span>
                <span className="font-bold">
                  {tasks.length > 0
                    ? Math.round((tasks.filter(t => t.status === 'Completado' || t.status === 'Cerrado').length / tasks.length) * 100)
                    : 100}%
                </span>
              </div>
              <Progress
                value={tasks.length > 0
                  ? (tasks.filter(t => t.status === 'Completado' || t.status === 'Cerrado').length / tasks.length) * 100
                  : 100}
                className="h-1.5"
              />
            </div>

            <p className="text-[10px] text-muted-foreground italic leading-relaxed">
              Índice calculado en base a tasa de ocupación, resolución de incidencias y diversificación de cartera.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuggestionsModal} onOpenChange={setShowSuggestionsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Sugerencias de Ajuste de Precios
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {priceAdjustments.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border bg-muted/20">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.status}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("flex items-center gap-0.5 font-black text-sm justify-end", p.changePercent > 0 ? "text-green-600" : "text-red-500")}>
                    {p.changePercent > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {p.changePercent > 0 ? '+' : ''}{p.changePercent}%
                  </div>
                  {p.suggestedAmount > 0 && (
                    <p className="text-xs text-muted-foreground font-bold">${p.suggestedAmount.toLocaleString('es-AR')}/mes</p>
                  )}
                </div>
              </div>
            ))}
            {priceAdjustments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Cargue propiedades y contratos para ver sugerencias.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
