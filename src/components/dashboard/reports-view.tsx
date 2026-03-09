
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  Download, 
  FileSpreadsheet, 
  TrendingUp, 
  Users, 
  Building,
  AlertCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const INGRESO_DATA = [
  { name: 'Ene', ingreso: 1250000 },
  { name: 'Feb', ingreso: 1350000 },
  { name: 'Mar', ingreso: 1680000 },
  { name: 'Abr', ingreso: 1845000 },
];

const OCCUPANCY_DATA = [
  { name: 'Ocupadas', value: 94 },
  { name: 'Vacantes', value: 6 },
];

const PROPERTY_RANKING = [
  { id: '1', name: 'Las Heras 4B', owner: 'Juan Pérez', ingreso: 185000, margin: '95%' },
  { id: '2', name: 'Florida Local', owner: 'Jorge Paez', ingreso: 450000, margin: '92%' },
  { id: '3', name: 'Quinta del Sol', owner: 'Marta Rodriguez', ingreso: 250000, margin: '88%' },
];

const COLORS = ['#f97316', '#e2e8f0'];

export function ReportsView() {
  const exportToCSV = (type: string) => {
    try {
      let content = "";
      if (type === 'ranking') {
        content = "ID,Propiedad,Propietario,Ingreso,Margen\n" + 
          PROPERTY_RANKING.map(p => `${p.id},${p.name},${p.owner},${p.ingreso},${p.margin}`).join("\n");
      }
      
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute("download", `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error exporting CSV:", e);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ocupación Promedio</p>
                <h3 className="text-2xl font-black">94.2%</h3>
              </div>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">+2.1%</Badge>
            </div>
            <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: '94.2%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Morosidad Global</p>
                <h3 className="text-2xl font-black text-red-600">4.2%</h3>
              </div>
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">+0.5%</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Promedio 8 días de atraso
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ingreso Neto (Mes)</p>
                <h3 className="text-2xl font-black text-primary">$ 1.84M</h3>
              </div>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">+12%</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-bold">
              <TrendingUp className="h-3 w-3" /> Máximo histórico alcanzado
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Churn de Contratos</p>
                <h3 className="text-2xl font-black">1.8%</h3>
              </div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Bajo</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> 2 rescisiones este mes
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolución de Recaudación (Pesos)
            </CardTitle>
            <CardDescription>Comparativa de ingresos brutos últimos 4 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={INGRESO_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`$ ${value.toLocaleString()}`, "Ingreso"]}
                  />
                  <Bar dataKey="ingreso" name="Ingreso" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              Ocupación del Portafolio
            </CardTitle>
            <CardDescription>Porcentaje de unidades alquiladas vs vacantes.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-[300px] w-full flex flex-col items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={OCCUPANCY_DATA}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {OCCUPANCY_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Ocupadas (94%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                  <span className="text-xs text-muted-foreground font-medium">Vacantes (6%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Top Unidades por Rentabilidad</CardTitle>
              <CardDescription>Propiedades con mejor flujo de caja y cumplimiento.</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV('ranking')}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead className="text-right">Ingreso Mensual</TableHead>
                  <TableHead className="text-right">Margen Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PROPERTY_RANKING.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold">{p.name}</TableCell>
                    <TableCell className="text-xs">{p.owner}</TableCell>
                    <TableCell className="text-right font-black text-primary">$ {p.ingreso.toLocaleString('es-AR')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-green-600 font-bold">
                        {p.margin} <ArrowUpRight className="h-3 w-3" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Reporte de Antigüedad Mora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Vencido 0-30 días</span>
                <span className="font-black text-orange-600">$ 188.700</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: '70%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Vencido 31-60 días</span>
                <span className="font-black text-red-500">$ 45.000</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full">
                <div className="h-full bg-red-500 rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Vencido +61 días</span>
                <span className="font-black text-red-700">$ 12.000</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full">
                <div className="h-full bg-red-800 rounded-full" style={{ width: '10%' }} />
              </div>
            </div>
            <Button variant="ghost" className="w-full text-xs text-primary gap-2 mt-4">
              Descargar Informe de Deuda Detallado <Download className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
