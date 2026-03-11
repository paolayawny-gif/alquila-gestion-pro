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
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppAlert, Property, Contract, Invoice, RentalApplication, MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
    
    // Alerta de alquileres sin factura ARCA cargada
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

    // Alerta de mora
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

    // Alerta de contratos por vencer (próximos 60 días)
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

    // Alerta de mantenimiento urgente
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
  const totalOverdue = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').reduce((acc, i) => acc + i.totalAmount, 0);
  const occupancyRate = properties.length > 0 ? (properties.filter(p => p.status === 'Alquilada').length / properties.length) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white border-t-4 border-t-primary">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-primary/20">TOTAL MES</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Recaudación Proyectada</p>
            <h3 className="text-2xl font-black text-foreground">$ {totalProjected.toLocaleString('es-AR')}</h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-red-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-red-50 p-2 rounded-lg text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-red-100 text-red-600">EN RIESGO</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Morosidad Actual</p>
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
              <Badge variant="outline" className="text-[10px] font-bold border-orange-100 text-orange-600">PENDIENTES</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Reclamos Abiertos</p>
            <h3 className="text-2xl font-black text-foreground">{tasks.filter(t => t.status !== 'Cerrado').length}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL DE ALERTAS */}
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="h-5 w-5 text-primary" /> 
                Centro de Notificaciones
              </CardTitle>
              <CardDescription>Acciones críticas que requieren su atención inmediata.</CardDescription>
            </div>
            <Badge className="bg-primary text-white">{alerts.length} Pendientes</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={cn(
                  "flex items-start justify-between p-4 rounded-xl border transition-all hover:shadow-md", 
                  alert.severity === 'high' ? "bg-red-50/50 border-red-100" : "bg-muted/20 border-transparent"
                )}
              >
                <div className="flex gap-4">
                  <div className={cn(
                    "p-3 rounded-full flex-shrink-0", 
                    alert.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  )}>
                    {alert.type === 'maintenance' ? <Wrench className="h-5 w-5" /> : 
                     alert.type === 'contract' ? <Calendar className="h-5 w-5" /> : 
                     <AlertTriangle className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-md">{alert.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white transition-colors" onClick={() => alert.linkTab && onNavigate(alert.linkTab)}>
                  Gestionar <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600 opacity-50" />
                </div>
                <p className="font-bold">¡Todo al día!</p>
                <p className="text-xs">No hay alertas críticas pendientes de gestión.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PANEL DE RENDIMIENTO Y VENCIMIENTOS */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" /> Próximos Vencimientos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contracts.filter(c => c.status === 'Vigente').slice(0, 3).map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg group">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold group-hover:text-primary transition-colors truncate max-w-[120px]">{c.tenantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{c.endDate}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase">Finaliza</Badge>
                </div>
              ))}
              <Button variant="link" className="w-full text-xs text-primary font-bold h-auto p-0" onClick={() => onNavigate('Personas')}>
                Ver agenda completa
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-primary/5 border border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Efectividad Cobro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white rounded-xl shadow-inner mb-4">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-[10px] uppercase font-black text-muted-foreground">Cobrado vs Proyectado</p>
                  <p className="text-lg font-black text-primary">
                    {(((totalProjected - totalOverdue) / (totalProjected || 1)) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${Math.min(100, ((totalProjected - totalOverdue) / (totalProjected || 1)) * 100)}%` }} 
                  />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight italic">
                Este KPI mide la rapidez de ingreso de fondos en relación a la facturación emitida del mes actual.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
