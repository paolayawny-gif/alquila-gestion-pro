"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Scale,
  Wrench,
  DollarSign,
  ArrowRight,
  Clock,
  CalendarDays,
  BellRing,
  ArrowUpRight,
  Building2,
  Users2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppAlert } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function SummaryView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [dolarMep, setDolarMep] = useState<number | null>(null);
  
  const [alerts] = useState<AppAlert[]>([
    { 
      id: 'a1', 
      type: 'contract_expiry', 
      title: 'Contrato Próximo a Vencer', 
      description: 'El contrato de Carlos Sosa (Heras 4B) vence en 45 días.', 
      severity: 'high', 
      date: '2024-04-05',
      linkTab: 'Personas'
    },
    { 
      id: 'a2', 
      type: 'overdue_debt', 
      title: 'Mora Superior a 30 días', 
      description: 'Jorge Paez adeuda 2 meses de alquiler en Local Florida.', 
      severity: 'high', 
      date: '2024-04-04',
      linkTab: 'Facturas'
    },
    { 
      id: 'a3', 
      type: 'maintenance_delay', 
      title: 'Reclamo sin gestionar', 
      description: 'Ticket #9923 (Filtración) lleva 72hs sin proveedor asignado.', 
      severity: 'medium', 
      date: '2024-04-03',
      linkTab: 'Mantenimiento'
    }
  ]);

  useEffect(() => {
    setDolarMep(1185);
  }, []);

  const stats = [
    { label: 'Recaudación Mensual', value: '$ 1.845.000', icon: TrendingUp, trend: '+18%', color: 'text-primary' },
    { label: 'Ocupación', value: '94.2%', icon: Building2, trend: 'Saludable', color: 'text-green-600' },
    { label: 'Mora en Cartera', value: '4.2%', icon: AlertTriangle, trend: 'Controlada', color: 'text-orange-500' },
    { label: 'Tickets Activos', value: '12', icon: Wrench, trend: '5 Urgentes', color: 'text-blue-500' },
  ];

  const upcomingAdjustments = [
    { id: '1', tenant: 'Carlos Sosa', property: 'Heras 4B', date: '15 Abr', index: 'ICL', old: '$120k', new: '$185k' },
    { id: '2', tenant: 'Jorge Paez', property: 'Florida Local', date: '20 Abr', index: 'IPC', old: '$300k', new: 'Calculando...' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Indicadores de Mercado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-blue-50 border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-blue-600">Dólar MEP (Referencia)</p>
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
              <p className="text-[10px] uppercase font-black text-green-600">Ocupación Global</p>
              <p className="text-xl font-black text-green-900">94.2%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="shadow-sm border-none bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase">{stat.label}</CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stat.value}</div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1 flex items-center gap-1">
                {stat.trend.includes('+') ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <Clock className="h-3 w-3" />}
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                Alertas de Gestión Inteligente
              </CardTitle>
              <CardDescription>Monitoreo automático de contratos, deudas y plazos.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {alerts.length} Notificaciones
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={cn(
                  "flex items-start justify-between p-4 rounded-lg border transition-all",
                  alert.severity === 'high' ? "bg-red-50/50 border-red-100" : "bg-muted/30 border-transparent"
                )}>
                  <div className="flex gap-3">
                    <div className={cn(
                      "mt-1 p-2 rounded-full",
                      alert.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {alert.type === 'contract_expiry' ? <CalendarDays className="h-4 w-4" /> : 
                       alert.type === 'overdue_debt' ? <AlertTriangle className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs hover:bg-white"
                    onClick={() => alert.linkTab && onNavigate(alert.linkTab)}
                  >
                    Gestionar <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Indexación ICL/IPC
            </CardTitle>
            <CardDescription>Aumentos programados para este mes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAdjustments.map((adj) => (
              <div key={adj.id} className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-black text-blue-700">{adj.index}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">{adj.date}</span>
                </div>
                <p className="text-sm font-bold">{adj.tenant}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{adj.property}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">{adj.old}</span>
                    <span className="text-xs font-black text-primary">{adj.new}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-[10px] uppercase font-black bg-white">
                  Notificar Inquilino
                </Button>
              </div>
            ))}
            <Button onClick={() => onNavigate('Reportes')} variant="link" className="w-full text-xs">
              Ver analítica avanzada <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}