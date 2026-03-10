
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  FileText, 
  Wrench, 
  Download, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  MessageSquare,
  Bell
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase';
import { Contract, Property, Invoice, MaintenanceTask } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TenantPortalViewProps {
  contracts: Contract[];
  properties: Property[];
  invoices: Invoice[];
  tasks: MaintenanceTask[];
}

export function TenantPortalView({ contracts, properties, invoices, tasks }: TenantPortalViewProps) {
  const { user } = useUser();

  // Filtrado de datos por el correo del usuario logueado
  // En una gestión real, el administrador asocia el correo al inquilino.
  const myContract = contracts.find(c => c.tenantName?.toLowerCase().includes(user?.email?.split('@')[0].toLowerCase() || ''));
  const myProperty = properties.find(p => p.id === myContract?.propertyId);
  const myInvoices = invoices.filter(i => i.contractId === myContract?.id);
  const myTasks = tasks.filter(t => t.propertyId === myProperty?.id);

  const pendingInvoices = myInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
  const totalDue = pendingInvoices.reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Sistema de Notificaciones del Inquilino */}
      {totalDue > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-full animate-pulse flex-shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-primary">Recordatorio de Pago</p>
              <p className="text-xs text-primary/80">
                Tienes {pendingInvoices.length} factura(s) pendientes de pago por un total de $ {totalDue.toLocaleString('es-AR')}.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-primary text-white hover:bg-primary/90 whitespace-nowrap">Pagar Ahora</Button>
        </div>
      )}

      {!myContract && (
        <Card className="bg-muted/30 border-dashed border-2 flex flex-col items-center justify-center p-12 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="max-w-md">
            <h3 className="text-lg font-bold">Sin contrato vinculado</h3>
            <p className="text-sm text-muted-foreground">No hemos encontrado un contrato activo vinculado a tu correo electrónico ({user?.email}). Por favor, contacta a la administración.</p>
          </div>
        </Card>
      )}

      {myContract && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Estado de Cuenta</CardDescription>
                <CardTitle className={cn("text-3xl font-black", totalDue > 0 ? "text-red-600" : "text-green-600")}>
                  $ {totalDue.toLocaleString('es-AR')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {totalDue > 0 ? (
                    <><AlertCircle className="h-3 w-3" /> Tienes pagos pendientes</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3" /> Estás al día</>
                  )}
                </p>
                <Button className="w-full mt-4 bg-primary/10 text-primary hover:bg-primary/20 gap-2 border-none">
                  <CreditCard className="h-4 w-4" /> Medios de Pago
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Próximo Ajuste ({myContract.adjustmentMechanism})</CardDescription>
                <CardTitle className="text-3xl font-black">2026-09-15</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Frecuencia: {myContract.adjustmentFrequencyMonths} meses</span>
                    <span className="font-bold">60%</span>
                  </div>
                  <Progress value={60} className="h-1.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Reclamos Activos</CardDescription>
                <CardTitle className="text-3xl font-black">{myTasks.filter(t => t.status !== 'Cerrado').length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Gestiona tus incidencias
                </p>
                <Button variant="outline" className="w-full mt-4 gap-2">
                  <Wrench className="h-4 w-4" /> Nuevo Reclamo
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Historial de Facturación</CardTitle>
                    <CardDescription>Consulte sus cuotas de alquiler y servicios.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary gap-1">
                    <Download className="h-4 w-4" /> Ver Todo
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Periodo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.period}</TableCell>
                          <TableCell className="text-right font-black">$ {inv.totalAmount.toLocaleString('es-AR')}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "border-none",
                              inv.status === 'Pagado' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                            )}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {myInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No hay facturas registradas aún.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Mi Alquiler</CardTitle>
                  <CardDescription>Unidad: {myProperty?.name || 'Cargando...'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Dirección:</span>
                      <span className="font-bold text-right">{myProperty?.address}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Vencimiento:</span>
                      <span className="font-bold">{myContract.endDate}</span>
                    </div>
                    <Separator />
                    <Button variant="outline" className="w-full gap-2 h-10">
                      <Download className="h-4 w-4" /> PDF Contrato
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
                <CardHeader>
                  <CardTitle className="text-lg">Centro de Ayuda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="ghost" className="w-full justify-start gap-3 h-14 hover:bg-white bg-white/50 border-none shadow-sm">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <p className="text-sm font-bold">Chat Administrativo</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Atención 09:00 a 18:00</p>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
