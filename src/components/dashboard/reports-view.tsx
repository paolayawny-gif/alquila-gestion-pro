
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
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  Download, 
  TrendingUp, 
  ShieldCheck, 
  FileText,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Building,
  Users,
  TrendingDown,
  Clock
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Invoice, Person, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const APP_ID = "alquilagestion-pro";
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

export function ReportsView() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const facturasQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'facturas'));
  }, [db, user]);
  const { data: facturas } = useCollection<Invoice>(facturasQuery);

  const peopleQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'inquilinos'));
  }, [db, user]);
  const { data: people } = useCollection<Person>(peopleQuery);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'propiedades'));
  }, [db, user]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const exportToCSV = (type: string) => {
    try {
      let content = "";
      let filename = `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`;

      if (type === 'afip_rg3645') {
        content = "CUIT Inquilino,Nombre Inquilino,Unidad,Monto Alquiler,Periodo\n";
        facturas?.forEach(inv => {
          const rentCharge = inv.charges.find(c => c.type === 'Alquiler');
          const person = people?.find(p => p.fullName === inv.tenantName);
          if (rentCharge) {
            content += `${person?.taxId || 'N/A'},${inv.tenantName},${inv.propertyName},${rentCharge.amount},${inv.period}\n`;
          }
        });
      } else if (type === 'rentabilidad') {
        content = "Propiedad,Monto Total Recaudado,Estado Ocupacion\n";
        properties?.forEach(p => {
          const totalProp = facturas?.filter(f => f.propertyName === p.name).reduce((acc, f) => acc + f.totalAmount, 0) || 0;
          content += `${p.name},${totalProp},${p.status}\n`;
        });
      } else {
        content = "ID,Propiedad,Monto,Estado,Vencimiento\n";
        facturas?.forEach(f => {
          content += `${f.id},${f.propertyName},${f.totalAmount},${f.status},${f.dueDate}\n`;
        });
      }
      
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Reporte Generado", description: `Archivo ${filename} descargado.` });
    } catch (e) {
      console.error("Error exporting CSV:", e);
    }
  };

  const INGRESO_DATA = [
    { name: 'Ene', ingreso: 1250000, cobrado: 1100000 },
    { name: 'Feb', ingreso: 1350000, cobrado: 1280000 },
    { name: 'Mar', ingreso: 1680000, cobrado: 1550000 },
    { name: 'Abr', ingreso: 1845000, cobrado: 1720000 },
  ];

  const DELINQUENCY_DATA = [
    { name: 'Al día', value: 85 },
    { name: '1-10 días', value: 8 },
    { name: '11-30 días', value: 4 },
    { name: '30+ días', value: 3 },
  ];

  const occupancyRate = properties ? (properties.filter(p => p.status === 'Alquilada').length / (properties.length || 1)) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ocupación Promedio</p>
                <h3 className="text-2xl font-black">{occupancyRate.toFixed(1)}%</h3>
              </div>
              <Badge className="bg-green-100 text-green-700">{occupancyRate > 90 ? 'Excelente' : 'Estable'}</Badge>
            </div>
            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${occupancyRate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Morosidad Global</p>
                <h3 className="text-2xl font-black text-red-600">
                  {((DELINQUENCY_DATA[1].value + DELINQUENCY_DATA[2].value + DELINQUENCY_DATA[3].value)).toFixed(1)}%
                </h3>
              </div>
              <div className="p-2 bg-red-50 rounded-full"><TrendingDown className="h-4 w-4 text-red-600" /></div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Promedio 12 días de atraso
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ingreso Neto (Mes)</p>
                <h3 className="text-2xl font-black text-primary">$ 1.84M</h3>
              </div>
              <Badge className="bg-primary/10 text-primary">+12% vs Mar</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-bold">
              <TrendingUp className="h-3 w-3" /> Máximo histórico
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Rescisiones</p>
                <h3 className="text-2xl font-black text-orange-600">1.8%</h3>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-100 uppercase text-[9px]">Bajo Riesgo</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> 2 finalizaciones este mes
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Evolución de Cobranzas
              </CardTitle>
              <CardDescription>Comparativa entre lo facturado y lo efectivamente cobrado.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => exportToCSV('recaudacion')}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={INGRESO_DATA}>
                  <defs>
                    <linearGradient id="colorIngreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`$ ${value.toLocaleString()}`, "Monto"]}
                  />
                  <Area type="monotone" dataKey="ingreso" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorIngreso)" name="Proyectado" />
                  <Area type="monotone" dataKey="cobrado" stroke="#10b981" strokeWidth={3} fillOpacity={0} name="Cobrado Real" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-red-500" />
              Estado de Carteras
            </CardTitle>
            <CardDescription>Rango de días de atraso.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DELINQUENCY_DATA}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {DELINQUENCY_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {DELINQUENCY_DATA.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-bold">{entry.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Ranking de Rentabilidad</CardTitle>
              <CardDescription>Unidades con mayores ingresos brutos acumulados.</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => exportToCSV('rentabilidad')}>
              <Download className="h-3 w-3 mr-2" /> Exportar Ranking
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Ingresos Totales</TableHead>
                  <TableHead className="text-right">Eficiencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties?.slice(0, 5).map((p, idx) => {
                  const total = facturas?.filter(f => f.propertyName === p.name).reduce((acc, f) => acc + f.totalAmount, 0) || 0;
                  return (
                    <TableRow key={p.id} className="group hover:bg-primary/5">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-muted w-5 h-5 flex items-center justify-center rounded-full font-bold">{idx + 1}</span>
                          <span className="font-bold">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-primary">$ {total.toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-green-100 text-green-700 border-none font-bold">100%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!properties || properties.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">No hay datos suficientes.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary font-black uppercase tracking-tighter">
              <ShieldCheck className="h-5 w-5" /> Regímenes Informativos
            </CardTitle>
            <CardDescription>Exportación de datos para cumplimiento fiscal (Argentina).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-5 bg-white rounded-2xl border border-primary/20 space-y-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-xl text-primary shadow-inner">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">RG 3645 - Registro de Operaciones Inmobiliarias</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                    Este reporte genera el archivo necesario para la declaración jurada de inmuebles destinados a vivienda ante la AFIP. Incluye CUIT de partes y montos.
                  </p>
                </div>
              </div>
              <Button onClick={() => exportToCSV('afip_rg3645')} className="w-full bg-primary text-white font-black h-12 gap-2 shadow-md hover:bg-primary/90">
                <Download className="h-4 w-4" /> Generar CSV RG 3645
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/50 rounded-xl border border-dashed text-center space-y-2 opacity-60">
                <p className="text-[10px] font-black uppercase text-muted-foreground">RG 4004</p>
                <p className="text-[9px] text-muted-foreground">Locaciones Comerciales</p>
                <Button disabled variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold">Próximamente</Button>
              </div>
              <div className="p-4 bg-white/50 rounded-xl border border-dashed text-center space-y-2 opacity-60">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Balance Anual</p>
                <p className="text-[9px] text-muted-foreground">Cierre de Ejercicio</p>
                <Button disabled variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold">Próximamente</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
