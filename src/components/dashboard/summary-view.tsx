
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Scale,
  DollarSign,
  ArrowRight,
  Clock,
  BellRing,
  ArrowUpRight,
  Building2,
  Users2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppAlert, Property, Contract, Invoice, RentalApplication } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface SummaryViewProps {
  onNavigate: (tab: string) => void;
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  applications: RentalApplication[];
}

export function SummaryView({ onNavigate, properties = [], contracts = [], invoices = [], applications = [] }: SummaryViewProps) {
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
    const overdueCount = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').length;
    if (overdueCount > 0) {
      newAlerts.push({
        id: 'overdue_debt',
        title: 'Mora en Cartera',
        description: `Existen ${overdueCount} facturas fuera de término. Los intereses se están calculando.`,
        severity: 'high',
        linkTab: 'Facturas',
        type: 'debt'
      });
    }

    setAlerts(newAlerts);
  }, [invoices]);

  const totalProjected = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-blue-50 border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full"><DollarSign className="h-4 w-4 text-blue-600" /></div>
            <div><p className="text-[10px] uppercase font-black text-blue-600">Dólar MEP Referencia</p><p className="text-xl font-black text-blue-900">$1.185</p></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-purple-50 border-l-4 border-l-purple-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-full"><FileText className="h-4 w-4 text-purple-600" /></div>
            <div><p className="text-[10px] uppercase font-black text-purple-600">Facturación ARCA</p><p className="text-xl font-black text-purple-900">{invoices.filter(i => !!i.arcaInvoiceUrl).length} de {invoices.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50 border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full"><AlertCircle className="h-4 w-4 text-red-600" /></div>
            <div><p className="text-[10px] uppercase font-black text-red-600">Monto en Mora</p><p className="text-xl font-black text-red-900">$ {totalOverdue.toLocaleString('es-AR')}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" /> Alertas de Gestión</CardTitle><CardDescription>Flujo de facturación legal y cobranzas.</CardDescription></div>
            <Badge variant="outline" className="bg-primary/10 text-primary">{alerts.length} Avisos</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className={cn("flex items-start justify-between p-4 rounded-lg border transition-all", alert.severity === 'high' ? "bg-red-50/50 border-red-100" : "bg-muted/30 border-transparent")}>
                <div className="flex gap-3">
                  <div className={cn("mt-1 p-2 rounded-full", alert.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600")}><AlertTriangle className="h-4 w-4" /></div>
                  <div><p className="font-bold text-sm">{alert.title}</p><p className="text-xs text-muted-foreground">{alert.description}</p></div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => alert.linkTab && onNavigate(alert.linkTab)}>Gestionar <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </div>
            ))}
            {alerts.length === 0 && <div className="p-8 text-center text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto opacity-20 text-green-600" /><p className="mt-2">Todo al día.</p></div>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 shadow-sm border-none bg-white">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-600" /> Rendimiento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/20 rounded-xl">
              <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Recaudación Mensual</p>
              <p className="text-2xl font-black text-foreground">$ {totalProjected.toLocaleString('es-AR')}</p>
              <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, ( (totalProjected - totalOverdue) / (totalProjected || 1) ) * 100)}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 text-right">Efectividad de cobro</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Estado Ocupación</p>
              <div className="flex justify-between items-center"><span className="text-sm font-bold">{properties.filter(p => p.status === 'Alquilada').length} / {properties.length}</span><Badge className="bg-green-100 text-green-700 border-none">Saludable</Badge></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
