"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Scale,
  Wrench,
  DollarSign,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SummaryView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [dolarMep, setDolarMep] = useState<number | null>(null);

  useEffect(() => {
    // Simulación de cotización MEP (vía API en prod)
    setDolarMep(1185);
  }, []);

  const stats = [
    { label: 'Recaudación Mensual', value: '$ 1.845.000', icon: TrendingUp, trend: '+18%', color: 'text-primary' },
    { label: 'Ocupación', value: '94%', icon: CheckCircle2, trend: 'Excelente', color: 'text-green-600' },
    { label: 'Mora Temprana', value: '2', icon: AlertTriangle, trend: 'Baja', color: 'text-orange-500' },
    { label: 'Ajustes este mes', value: '5', icon: Clock, trend: 'Pendientes', color: 'text-blue-500' },
  ];

  const upcomingAdjustments = [
    { id: '1', tenant: 'Carlos Sosa', property: 'Heras 4B', date: '15 Abr', index: 'ICL', old: '$120k', new: '$185k' },
    { id: '2', tenant: 'Jorge Paez', property: 'Florida Local', date: '20 Abr', index: 'IPC', old: '$300k', new: 'Calc...' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Indicadores de Mercado (Vital para Argentina) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-blue-50 border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-blue-600">Dólar MEP (Hoy)</p>
              <p className="text-xl font-black text-blue-900">${dolarMep || '...'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50 border-l-4 border-l-orange-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-orange-600">ICL Acumulado (Anual)</p>
              <p className="text-xl font-black text-orange-900">214.5%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50 border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <Scale className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-green-600">Tasa de Mora</p>
              <p className="text-xl font-black text-green-900">4.2%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="shadow-sm border-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stat.value}</div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle>Próximos Ajustes de Alquiler</CardTitle>
            <CardDescription>Basado en los mecanismos ICL/IPC pactados en contrato.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingAdjustments.map((adj) => (
                <div key={adj.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-transparent hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs">
                      {adj.date}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{adj.tenant}</p>
                      <p className="text-[10px] text-muted-foreground">{adj.property} • {adj.index}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground line-through">{adj.old}</p>
                    <p className="font-black text-primary">{adj.new}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8">
                    Notificar <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 shadow-sm border-none bg-white h-fit">
          <CardHeader>
            <CardTitle className="text-base">Tareas Críticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase mb-1">
                <AlertTriangle className="h-3 w-3" /> Mediación Pendiente
              </p>
              <p className="text-sm">Expediente Sosa vs Inmobiliaria requiere carga de pruebas hoy.</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-bold text-blue-600 flex items-center gap-1 uppercase mb-1">
                <Wrench className="h-3 w-3" /> Mantenimiento
              </p>
              <p className="text-sm">3 presupuestos pendientes de aprobación por el propietario.</p>
            </div>
            <Button onClick={() => onNavigate('Legales')} variant="outline" className="w-full text-xs">
              Ver todo el flujo legal
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
