
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  FileText, 
  Wrench, 
  Download, 
  History, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function TenantPortalView() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary/5 border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold text-primary">Estado de Cuenta</CardDescription>
            <CardTitle className="text-3xl font-black text-primary">$ 238.500</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Vence en 5 días (10/05/2024)
            </p>
            <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-white gap-2">
              <CreditCard className="h-4 w-4" /> Pagar Ahora
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
              <CheckCircle2 className="h-3 w-3 text-green-500" /> 1 completado este mes
            </p>
            <Button variant="outline" className="w-full mt-4 gap-2">
              <Wrench className="h-4 w-4" /> Nuevo Reclamo
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Historial de Pagos */}
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
                  <TableRow>
                    <TableCell className="font-medium">Marzo 2024</TableCell>
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

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Mis Reclamos de Mantenimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Goteo en bidet baño principal</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Ticket #9923 • Enviado el 12/04/2024</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">En Curso</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documentación y Contrato */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Mi Contrato</CardTitle>
              <CardDescription>Unidad: Las Heras 4B</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Inicio:</span>
                  <span className="font-bold">15/05/2023</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fin:</span>
                  <span className="font-bold">15/05/2025</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mecanismo:</span>
                  <span className="font-black text-primary">ICL (Cuatrimestral)</span>
                </div>
                <Separator />
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
                  <p className="text-[10px] text-muted-foreground">Atención Lunes a Viernes 9-18hs</p>
                </div>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="text-sm font-bold">Emergencias 24hs</p>
                  <p className="text-[10px] text-muted-foreground">Cerrajería, Gas, Plomería urgente</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
