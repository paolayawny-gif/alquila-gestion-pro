
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  TrendingUp, 
  Calculator, 
  Download, 
  PieChart, 
  FileCheck, 
  CheckCircle2,
  Users2,
  Sparkles,
  Eye,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, Liquidation, RentalApplication, DocumentInfo, Invoice } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { query, collection } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface OwnerPortalViewProps {
  properties: Property[];
  liquidations: Liquidation[];
}

const APP_ID = "alquilagestion-pro";

export function OwnerPortalView({ properties, liquidations }: OwnerPortalViewProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // El administrador asocia solicitudes, aquí las recuperamos
  const solicitudesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', 'W1b1I6DKA7fEluL5gugUyKBuSvD3', 'solicitudes'));
  }, [db]);
  const { data: applicationsData } = useCollection<RentalApplication>(solicitudesQuery);
  
  const facturasQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', 'W1b1I6DKA7fEluL5gugUyKBuSvD3', 'facturas'));
  }, [db]);
  const { data: invoicesData } = useCollection<Invoice>(facturasQuery);

  const applications = applicationsData || [];
  const invoices = invoicesData || [];

  // FILTRADO DINÁMICO POR DUEÑO
  const myProperties = properties.filter(p => 
    p.owners.some(o => o.email.toLowerCase() === user?.email?.toLowerCase())
  );

  const myLiquidations = liquidations.filter(l => 
    l.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    myProperties.some(p => p.id === l.propertyId)
  );

  const myApprovedApps = applications.filter(app => 
    app.status === 'Aprobada' && 
    myProperties.some(p => p.id === app.propertyId)
  );

  // Cálculo de Morosidad para el Dueño
  const myInvoices = invoices.filter(inv => 
    myProperties.some(p => p.name === inv.propertyName)
  );
  const overdueAmount = myInvoices
    .filter(inv => inv.status === 'Vencido')
    .reduce((acc, inv) => acc + inv.totalAmount, 0);

  const totalNetRecieved = myLiquidations
    .filter(l => l.status === 'Pagada')
    .reduce((acc, l) => acc + l.netAmount, 0);

  const viewDocument = (doc: DocumentInfo) => {
    if (doc.url) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<html><body style="margin:0; background: #333; display: flex; align-items: center; justify-content: center;"><img src="${doc.url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" /></body></html>`);
      }
    }
  };

  const exportOwnerReport = () => {
    const csvRows = [
      ["Propiedad", "Periodo", "Ingreso Alquiler", "Deducciones Admin", "Deducciones Mant.", "Neto Cobrado", "Estado"],
      ...myLiquidations.map(l => [
        l.propertyName,
        l.period,
        l.ingresoAlquiler.toString(),
        l.adminFeeDeduction.toString(),
        l.maintenanceDeductions.toString(),
        l.netAmount.toString(),
        l.status
      ])
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Duenio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Reporte Generado", description: "Exportando historial de liquidaciones." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-600">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Total Cobrado (Neto)</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ {totalNetRecieved.toLocaleString('es-AR')}</h3>
              <div className="p-2 bg-green-50 rounded-full"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Morosidad Actual</p>
            <div className="flex items-center justify-between">
              <h3 className={cn("text-2xl font-black", overdueAmount > 0 ? "text-red-600" : "text-green-600")}>
                $ {overdueAmount.toLocaleString('es-AR')}
              </h3>
              <div className={cn("p-2 rounded-full", overdueAmount > 0 ? "bg-red-50" : "bg-green-50")}>
                {overdueAmount > 0 ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Unidades Ocupadas</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">
                {myProperties.filter(p => p.status === 'Alquilada').length} / {myProperties.length}
              </h3>
              <div className="p-2 bg-blue-50 rounded-full"><Building className="h-4 w-4 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5 border-primary/20 border">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-primary mb-1">Acciones Rápidas</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-[9px] h-8 gap-1 font-bold border-primary/20 text-primary" onClick={exportOwnerReport}>
                <Download className="h-3 w-3" /> Reporte CSV
              </Button>
              <Button size="sm" variant="outline" className="text-[9px] h-8 gap-1 font-bold border-primary/20 text-primary">
                <BarChart3 className="h-3 w-3" /> Analítica
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* SECCIÓN DE AUDITORÍA DE SOLICITUDES */}
          {myApprovedApps.length > 0 && (
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2"><Users2 className="h-5 w-5 text-primary" /> Nuevos Inquilinos Evaluados</CardTitle>
                <CardDescription>Candidatos aprobados por la administración para sus unidades.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myApprovedApps.map((app) => (
                    <div key={app.id} className="p-4 border rounded-xl hover:border-primary/50 transition-all group">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden">
                          <p className="font-black text-base truncate">{app.applicantName}</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter truncate">{app.propertyName}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedApp(app); setIsDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className={cn("font-black text-[9px]", (app.aiAnalysis?.score || 0) > 70 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                          Score IA: {app.aiAnalysis?.score}/100
                        </Badge>
                        <Badge variant="outline" className="border-primary/20 text-primary text-[9px] font-bold">
                          Ingreso: $ {app.ingreso.toLocaleString('es-AR')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Liquidaciones</CardTitle>
                <CardDescription>Detalle de transferencias recibidas de la administración.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Unidad / Periodo</TableHead>
                    <TableHead className="text-right">Bruto Alquiler</TableHead>
                    <TableHead className="text-right text-orange-600">Deducciones</TableHead>
                    <TableHead className="text-right">Neto Liquidado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLiquidations.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{l.propertyName}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{l.period}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">$ {l.ingresoAlquiler.toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right text-orange-600 text-xs">$ {(l.adminFeeDeduction + l.maintenanceDeductions).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right font-black text-green-700">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge className={cn("border-none font-bold", l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myLiquidations.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No se han registrado liquidaciones.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="bg-blue-50/50">
              <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-blue-600" /> Mis Unidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {myProperties.map((p) => (
                <div key={p.id} className="p-4 bg-white rounded-xl border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-black truncate max-w-[150px]">{p.name}</p>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase px-2 py-0 h-4",
                      p.status === 'Alquilada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mb-4">{p.address}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-dashed">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Estado Pago</span>
                      <span className={cn("text-[10px] font-black", myInvoices.some(inv => inv.propertyName === p.name && inv.status === 'Vencido') ? "text-red-600" : "text-green-600")}>
                        {myInvoices.some(inv => inv.propertyName === p.name && inv.status === 'Vencido') ? "Deuda Pendiente" : "Al Día"}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowUpRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {myProperties.length === 0 && <p className="text-center text-xs text-muted-foreground py-8 italic">No tiene propiedades vinculadas.</p>}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-muted/20 border-t-4 border-t-muted-foreground">
            <CardHeader><CardTitle className="text-lg">Próximos Cobros</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">Ciclo 1 al 10 de Mes</p>
                  <p className="text-[10px] text-muted-foreground">Las liquidaciones se emiten tras la cobranza.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Expediente de {selectedApp.applicantName}</DialogTitle>
                <DialogDescription>Resumen de evaluación para su aprobación final.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                <div className="space-y-6">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <h4 className="text-xs font-black uppercase text-primary mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Informe del Analista IA</h4>
                    <p className="text-sm font-bold text-green-700 mb-2">{selectedApp.aiAnalysis?.recommendation}</p>
                    <p className="text-xs leading-relaxed text-foreground/80 italic">"{selectedApp.aiAnalysis?.reasoning}"</p>
                  </div>
                  
                  {selectedApp.adminNotes && (
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2">Observaciones de Administración</h4>
                      <p className="text-xs leading-relaxed">{selectedApp.adminNotes}</p>
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center p-6 bg-green-50 rounded-2xl border border-green-100">
                    <p className="text-[10px] font-black uppercase text-green-700 mb-1">Capacidad de Pago</p>
                    <p className="text-3xl font-black text-green-900">$ {selectedApp.ingreso.toLocaleString('es-AR')}</p>
                    <p className="text-[9px] text-green-600 mt-1">Ingreso mensual neto declarado</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Carpeta de Documentación</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedApp.documents?.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-primary/50 group transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileCheck className="h-4 w-4 text-primary" />
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold truncate max-w-[200px]">{doc.name}</span>
                            <span className="text-[8px] text-muted-foreground uppercase font-black">{doc.type}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 text-primary" onClick={() => viewDocument(doc)}><Eye className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
