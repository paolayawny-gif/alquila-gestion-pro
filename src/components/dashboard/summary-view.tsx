
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign,
  ArrowRight,
  BellRing,
  Building2,
  FileText,
  AlertCircle,
  Clock,
  Wrench,
  Calendar,
  AreaChart as AreaChartIcon,
  BarChart3,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppAlert, Property, Contract, Invoice, RentalApplication, MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface SummaryViewProps {
  onNavigate: (tab: string) => void;
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  applications: RentalApplication[];
  tasks: MaintenanceTask[];
}

export function SummaryView({ 
  onNavigate, 
  properties = [], 
  contracts = [], 
  invoices = [], 
  applications = [],
  tasks = []
}: SummaryViewProps) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  useEffect(() => {
    const newAlerts: AppAlert[] = [];
    
    const missingArcaCount = invoices.filter(i => i.charges.some(c => c.type === 'Alquiler') && !i.arcaInvoiceUrl && i.status !== 'Pagado').length;
    if (missingArcaCount > 0) {
      newAlerts.push({
        id: 'missing_arca',
        type: 'arca_invoice',
        title: 'Facturas ARCA Pendientes',
        description: `Tienes ${missingArcaCount} alquileres sin su comprobante legal formal vinculado.`,
        severity: 'medium',
        linkTab: 'Facturas'
      });
    }

    const overdueInvoices = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente');
    if (overdueInvoices.length > 0) {
      newAlerts.push({
        id: 'overdue_debt',
        title: 'Mora en Cartera',
        description: `Existen ${overdueInvoices.length} facturas fuera de término. Los intereses se están calculando.`,
        severity: 'high',
        linkTab: 'Facturas',
        type: 'debt'
      });
    }

    const today = new Date();
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(today.getDate() + 60);
    
    const expiringSoon = contracts.filter(c => {
      const endDate = new Date(c.endDate);
      return endDate > today && endDate <= sixtyDaysLater;
    });

    if (expiringSoon.length > 0) {
      newAlerts.push({
        id: 'contracts_expiring',
        title: 'Contratos por Vencer',
        description: `Tienes ${expiringSoon.length} contratos que finalizan en los próximos 60 días.`,
        severity: 'medium',
        linkTab: 'Personas',
        type: 'contract'
      });
    }

    const urgentTasks = tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado');
    if (urgentTasks.length > 0) {
      newAlerts.push({
        id: 'urgent_tasks',
        title: 'Reclamos Urgentes',
        description: `Hay ${urgentTasks.length} pedidos de mantenimiento marcados como urgentes.`,
        severity: 'high',
        linkTab: 'Mantenimiento',
        type: 'maintenance'
      });
    }

    setAlerts(newAlerts);
  }, [invoices, contracts, tasks]);

  const totalProjected = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollected = invoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').reduce((acc, i) => acc + i.totalAmount, 0);
  const occupancyRate = properties.length > 0 ? (properties.filter(p => p.status === 'Alquilada').length / properties.length) * 100 : 0;

  // Datos de proyección realistas para el especialista
  const CASHFLOW_DATA = [
    { name: 'Semana 1', cobrado: totalCollected * 0.4, proyectado: totalProjected * 0.3 },
    { name: 'Semana 2', cobrado: totalCollected * 0.7, proyectado: totalProjected * 0.6 },
    { name: 'Semana 3', cobrado: totalCollected * 0.9, proyectado: totalProjected * 0.8 },
    { name: 'Semana 4', cobrado: totalCollected, proyectado: totalProjected },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white border-t-4 border-t-primary">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-primary/20">BRUTO MES</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Recaudación Total</p>
            <h3 className="text-2xl font-black text-foreground">$ {totalProjected.toLocaleString('es-AR')}</h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-red-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-red-50 p-2 rounded-lg text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-red-100 text-red-600">MOROSIDAD</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Total en Riesgo</p>
            <h3 className="text-2xl font-black text-red-600">$ {totalOverdue.toLocaleString('es-AR')}</h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-100 text-blue-600">{occupancyRate.toFixed(1)}%</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Tasa de Ocupación</p>
            <h3 className="text-2xl font-black text-foreground">{properties.filter(p => p.status === 'Alquilada').length} / {properties.length}</h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-orange-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                <Wrench className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-orange-100 text-orange-600">RECLAMOS</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Incidencias Abiertas</p>
            <h3 className="text-2xl font-black text-foreground">{tasks.filter(t => t.status !== 'Cerrado').length}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL DE PROYECCIÓN FINANCIERA (NOVEL) */}
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AreaChartIcon className="h-5 w-5 text-primary" /> 
                Salud del Flujo de Caja
              </CardTitle>
              <CardDescription>Seguimiento de cobranza semanal vs. proyección del mes.</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 font-bold px-3">Efectividad: {((totalCollected / (totalProjected || 1)) * 100).toFixed(0)}%</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CASHFLOW_DATA}>
                  <defs>
                    <linearGradient id="colorCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [`$ ${v.toLocaleString()}`, "Monto"]}
                  />
                  <Area type="monotone" dataKey="proyectado" stroke="#cbd5e1" fill="transparent" strokeDasharray="5 5" name="Esperado" />
                  <Area type="monotone" dataKey="cobrado" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCobrado)" name="Cobrado Real" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 p-4 bg-primary/5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Ya Cobrado</span>
                  <span className="text-lg font-black text-primary">$ {totalCollected.toLocaleString('es-AR')}</span>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Restante Mes</span>
                  <span className="text-lg font-black text-foreground">$ {(totalProjected - totalCollected).toLocaleString('es-AR')}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-primary font-bold text-xs" onClick={() => onNavigate('Facturas')}>
                Ver detalle de facturación <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CENTRO DE NOTIFICACIONES */}
        <Card className="lg:col-span-4 shadow-sm border-none bg-white">
          <CardHeader className="border-b pb-4 mb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-5 w-5 text-primary" /> 
              Atención Inmediata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 4).map(alert => (
              <div 
                key={alert.id} 
                className={cn(
                  "p-3 rounded-xl border transition-all hover:bg-muted/50 flex flex-col gap-2", 
                  alert.severity === 'high' ? "border-red-100 bg-red-50/20" : "border-transparent bg-muted/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full", 
                    alert.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  )}>
                    {alert.type === 'maintenance' ? <Wrench className="h-4 w-4" /> : 
                     alert.type === 'contract' ? <Calendar className="h-4 w-4" /> : 
                     <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-[11px] text-foreground leading-tight">{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.description}</p>
                  </div>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-primary self-end" onClick={() => alert.linkTab && onNavigate(alert.linkTab)}>
                  Gestionar →
                </Button>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="p-8 text-center text-muted-foreground opacity-50 space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
                <p className="text-xs font-bold">Operación al día</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
