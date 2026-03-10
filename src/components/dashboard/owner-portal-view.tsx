
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  TrendingUp, 
  Calculator, 
  Download, 
  PieChart, 
  FileCheck, 
  AlertCircle,
  ArrowUpRight,
  History,
  CheckCircle2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, Liquidation } from '@/lib/types';
import { useUser } from '@/firebase';

interface OwnerPortalViewProps {
  properties: Property[];
  liquidations: Liquidation[];
}

export function OwnerPortalView({ properties, liquidations }: OwnerPortalViewProps) {
  const { toast } = useToast();
  const { user } = useUser();

  // FILTRADO DINÁMICO: El propietario solo ve las unidades donde su email coincide
  const myProperties = properties.filter(p => 
    p.owners.some(o => o.email.toLowerCase() === user?.email?.toLowerCase())
  );

  const myLiquidations = liquidations.filter(l => 
    l.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    myProperties.some(p => p.id === l.propertyId)
  );

  const totalNetRecieved = myLiquidations
    .filter(l => l.status === 'Pagada')
    .reduce((acc, l) => acc + l.netAmount, 0);

  const handleExportReport = () => {
    try {
      const headers = "Propiedad,Periodo,Monto Bruto,Neto Liquidado,Estado\n";
      const rows = myLiquidations.map(l => 
        `${l.propertyName},${l.period},${l.ingresoAlquiler},${l.netAmount},${l.status}`
      ).join("\n");
      
      const csvContent = headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.href = url;
      link.setAttribute("download", `reporte_liquidaciones_2026.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Reporte Exportado",
        description: "El archivo CSV se ha descargado correctamente."
      });
    } catch (error) {
      toast({
        title: "Error al exportar",
        description: "No se pudo generar el archivo de reporte.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Liquidado este Año</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ {totalNetRecieved.toLocaleString('es-AR')}</h3>
              <div className="p-2 bg-green-50 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Unidades en Gestión</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">{myProperties.length}</h3>
              <div className="p-2 bg-blue-50 rounded-full">
                <Building className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Estado General</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">OK</h3>
              <div className="p-2 bg-green-50 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Participación Promedio</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">
                {myProperties.length > 0 ? 
                  Math.round(myProperties.reduce((acc, p) => 
                    acc + (p.owners.find(o => o.email.toLowerCase() === user?.email?.toLowerCase())?.percentage || 0)
                  , 0) / myProperties.length) : 0}%
              </h3>
              <div className="p-2 bg-muted rounded-full">
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Liquidaciones</CardTitle>
                <CardDescription>Detalle de transferencias recibidas para {user?.email}.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={handleExportReport} disabled={myLiquidations.length === 0}>
                <Download className="h-4 w-4" /> Exportar Reporte
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Neto Liquidado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLiquidations.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-bold">{l.propertyName}</TableCell>
                      <TableCell className="text-xs">{l.period}</TableCell>
                      <TableCell className="text-right text-xs">$ {l.ingresoAlquiler.toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right font-black text-green-700">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "border-none",
                          l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myLiquidations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">No hay liquidaciones registradas para su correo.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Estado de mis Unidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myProperties.map((p) => {
                  const myPart = p.owners.find(o => o.email.toLowerCase() === user?.email?.toLowerCase())?.percentage || 0;
                  return (
                    <div key={p.id} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Building className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            Dirección: {p.address} • Participación: {myPart}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      </div>
                    </div>
                  );
                })}
                {myProperties.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm italic">No tiene propiedades vinculadas a su email.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-lg">Acceso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 h-12 bg-white text-foreground hover:bg-muted border-none shadow-sm">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">PDF Impositivo Anual 2026</span>
              </Button>
              <Button className="w-full justify-start gap-3 h-12 bg-white text-foreground hover:bg-muted border-none shadow-sm">
                <FileCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Contratos Firmados</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
