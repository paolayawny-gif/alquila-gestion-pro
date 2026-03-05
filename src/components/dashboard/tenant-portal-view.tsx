
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

export function TenantPortalView() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Sistema de Notificaciones del Inquilino */}
      <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-full animate-pulse">
            <Bell className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Recordatorio de Pago</p>
            <p className="text-xs text-primary/80">Tu alquiler de Mayo 2024 vence en 5 días. Evita punitorios pagando antes del 10/05.</p>
          </div>
        </div>
        <Button size="sm" className="bg-primary text-white hover:bg-primary/90">Pagar con MP</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold">Estado de Cuenta</CardDescription>
            <CardTitle className="text-3xl font-black">$ 238.500</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Vence el 10/05/2024
            </p>
            <Button className="w-full mt-4 bg-primary/10 text-primary hover:bg-primary/20 gap-2 border-none">
              <CreditCard className="h-4 w-4" /> Medios de Pago
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold">Próximo Ajuste (ICL)</CardDescription>
            <CardTitle className="text-3xl font-black">15/09/2024</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progreso del periodo</span>
                <span className="font-bold">60%</span>
              </div>
              <Progress value={60} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold">Reclamos Activos</CardDescription>
            <CardTitle className="text-3xl font-black">1</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Ticket #9923 en curso
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
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Abril 2024</TableCell>
                    <TableCell className="font-black">$ 238.500</TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Pagado</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Mi Contrato</CardTitle>
              <CardDescription>Unidad: Las Heras 4B</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mecanismo:</span>
                  <span className="font-black text-primary">ICL (Cuatrimestral)</span>
                </div>
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" /> Descargar PDF Contrato
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Centro de Ayuda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="text-sm font-bold">Chatear con la Inmobiliaria</p>
                  <p className="text-[10px] text-muted-foreground">Respuesta en menos de 2hs</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
