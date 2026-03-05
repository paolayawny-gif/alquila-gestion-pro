"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Wrench,
  Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SummaryView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  // Mock data for summary
  const stats = [
    { label: 'Total Alquileres', value: '$ 1.250.000', icon: TrendingUp, trend: '+12%', color: 'text-primary' },
    { label: 'Inquilinos al Día', value: '24', icon: CheckCircle2, trend: '92%', color: 'text-green-600' },
    { label: 'Atrasados', value: '3', icon: AlertTriangle, trend: '8%', color: 'text-orange-500' },
    { label: 'En Legales', value: '1', icon: Scale, trend: '4%', color: 'text-accent' },
  ];

  const recentMaintenance = [
    { id: '1', task: 'Plomería - Depto 4B', date: 'Hace 2 días', status: 'En curso' },
    { id: '2', task: 'Electricidad - Local 1', date: 'Hace 5 días', status: 'Pendiente' },
    { id: '3', task: 'Limpieza Tanques', date: 'Mañana', status: 'Programado' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="shadow-sm border-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className={cn(stat.trend.startsWith('+') ? "text-green-600" : "text-muted-foreground")}>
                  {stat.trend}
                </span> respecto al mes anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Liquidaciones & Financieros */}
        <Card className="lg:col-span-7 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle>Liquidaciones Globales</CardTitle>
            <CardDescription>Resumen de movimientos financieros acumulados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-muted">
                <span className="text-muted-foreground">Total Ingresos Alquileres</span>
                <span className="font-semibold">$ 1.250.000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted">
                <span className="text-muted-foreground">Gastos Mantenimiento</span>
                <span className="font-semibold text-accent">- $ 125.000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-muted">
                <span className="text-muted-foreground">Honorarios Administración</span>
                <span className="font-semibold text-accent">- $ 62.500</span>
              </div>
              <div className="flex justify-between items-center pt-4">
                <span className="text-lg font-bold">Saldo a Propietarios</span>
                <span className="text-2xl font-black text-green-700">$ 1.062.500</span>
              </div>
            </div>
            <Button onClick={() => onNavigate('Liquidaciones')} className="w-full bg-primary hover:bg-primary/90">
              Gestionar Liquidaciones
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Alerts & Maintenance */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Mantenimiento Reciente</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMaintenance.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{m.task}</div>
                      <div className="text-xs text-muted-foreground">{m.date}</div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      m.status === 'En curso' ? "bg-blue-100 text-blue-700" : 
                      m.status === 'Pendiente' ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    )}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-4 text-primary text-xs" onClick={() => onNavigate('Mantenimiento')}>
                Ver Agenda Completa
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-accent flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alertas Legales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Hay <strong>1 caso</strong> pendiente de mediación que requiere atención inmediata.</p>
              <Button variant="link" className="p-0 h-auto text-accent mt-2 text-sm" onClick={() => onNavigate('Legales')}>
                Ir a Legales
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
