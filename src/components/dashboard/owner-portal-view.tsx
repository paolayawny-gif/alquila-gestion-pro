
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

const LIQUIDATIONS_MOCK = [
  { propiedad: 'Las Heras 4B', periodo: 'Abril 2026', bruto: 185000, neto: 163750, estado: 'Pagada' },
  { propiedad: 'Quinta del Sol', periodo: 'Marzo 2026', bruto: 250000, neto: 152500, estado: 'Pagada' },
];

const PROPERTIES_MOCK = [
  { nombre: 'Las Heras 4B', inquilino: 'Carlos Sosa', estado: 'Alquilada', monto: 185000, ajuste: 'Septiembre 2026' },
  { nombre: 'Quinta del Sol', inquilino: 'Marta Rodriguez', estado: 'Alquilada', monto: 250000, ajuste: 'Julio 2026' },
];

export function OwnerPortalView() {
  const { toast } = useToast();

  const handleExportReport = () => {
    try {
      const headers = "Propiedad,Periodo,Monto Bruto,Neto Liquidado,Estado\n";
      const rows = LIQUIDATIONS_MOCK.map(l => 
        `${l.propiedad},${l.periodo},${l.bruto},${l.neto},${l.estado}`
      ).join("\n");
      
      const csvContent = headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      // Robust download logic for all browsers
      link.href = url;
      link.setAttribute("download", `reporte_liquidaciones_${new Date('2026-01-01').toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Reporte Exportado",
        description: "El archivo CSV se ha descargado en tu carpeta de descargas."
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
      {/* Indicadores de Portafolio */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Liquidado este Mes</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ 316.250</h3>
              <div className="p-2 bg-green-50 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Ocupación</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">100%</h3>
              <div className="p-2 bg-blue-50 rounded-full">
                <Building className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Mora en Cartera</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-red-600">0%</h3>
              <div className="p-2 bg-red-50 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Propiedades</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">{PROPERTIES_MOCK.length}</h3>
              <div className="p-2 bg-muted rounded-full">
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Próximas Liquidaciones */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Liquidaciones</CardTitle>
                <CardDescription>Detalle de transferencias recibidas de la administración.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={handleExportReport}>
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
                  {LIQUIDATIONS_MOCK.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold">{l.propiedad}</TableCell>
                      <TableCell className="text-xs">{l.periodo}</TableCell>
                      <TableCell className="text-right text-xs">$ {l.bruto.toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right font-black text-green-700">$ {l.neto.toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                          {l.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
                {PROPERTIES_MOCK.map((p, i) => (
                  <div key={i} className="p-4 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Building className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{p.nombre}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          Inquilino: {p.inquilino} • {p.estado}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary">$ {p.monto.toLocaleString('es-AR')} / mes</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Próximo Ajuste: {p.ajuste}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reportes y Notificaciones */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-lg">Acceso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-3 h-12 bg-white text-foreground hover:bg-muted border-none shadow-sm">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Descargar PDF Impositivo Anual</span>
              </Button>
              <Button className="w-full justify-start gap-3 h-12 bg-white text-foreground hover:bg-muted border-none shadow-sm">
                <FileCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Ver Contratos Firmados</span>
              </Button>
              <Button className="w-full justify-start gap-3 h-12 bg-white text-foreground hover:bg-muted border-none shadow-sm">
                <History className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Reporte de Mantenimiento Anual</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg text-orange-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Alertas Gestión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-orange-50 rounded-lg text-xs text-orange-800 leading-relaxed border border-orange-100">
                Tiene <strong>1 presupuesto</strong> de reparación pendiente de aprobación en "Quinta del Sol".
              </div>
              <Button variant="outline" className="w-full text-xs gap-2">
                Ir a Mantenimiento <ArrowUpRight className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
