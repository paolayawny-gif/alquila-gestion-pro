
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
  ArrowUpRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Invoice, Person, Property } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

const APP_ID = "alquilagestion-pro";
const COLORS = ['#f97316', '#e2e8f0'];

export function ReportsView() {
  const { user } = useUser();
  const db = useFirestore();

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

  const exportToCSV = (type: string) => {
    try {
      let content = "";
      let filename = `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`;

      if (type === 'afip_rg3645') {
        // Reporte simplificado para AFIP RG 3645 (Inmuebles destinados a vivienda)
        content = "CUIT Inquilino,Nombre Inquilino,Unidad,Monto Alquiler,Periodo\n";
        facturas?.forEach(inv => {
          const rentCharge = inv.charges.find(c => c.type === 'Alquiler');
          const person = people?.find(p => p.fullName === inv.tenantName);
          if (rentCharge) {
            content += `${person?.taxId || 'N/A'},${inv.tenantName},${inv.propertyName},${rentCharge.amount},${inv.period}\n`;
          }
        });
      } else {
        content = "ID,Propiedad,Monto,Estado\n";
        facturas?.forEach(f => {
          content += `${f.id},${f.propertyName},${f.totalAmount},${f.status}\n`;
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
    { name: 'Ene', ingreso: 1250000 },
    { name: 'Feb', ingreso: 1350000 },
    { name: 'Mar', ingreso: 1680000 },
    { name: 'Abr', ingreso: 1845000 },
  ];

  const OCCUPANCY_DATA = [
    { name: 'Ocupadas', value: 94 },
    { name: 'Vacantes', value: 6 },
  ];

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
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Rescisiones</p>
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

        {/* MÓDULO EXPORTACIÓN AFIP */}
        <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary font-black uppercase tracking-tighter">
              <ShieldCheck className="h-5 w-5" /> Regímenes Informativos
            </CardTitle>
            <CardDescription>Exportación de datos para cumplimiento fiscal (Argentina).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-white rounded-xl border border-primary/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><FileText className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-bold">RG 3645 - Registro de Operaciones Inmobiliarias</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Genera un CSV con CUIT de inquilinos, montos devengados y períodos para facilitar la carga en aplicativos AFIP.</p>
                </div>
              </div>
              <Button onClick={() => exportToCSV('afip_rg3645')} className="w-full bg-primary text-white font-bold h-10 gap-2">
                <Download className="h-4 w-4" /> Exportar Datos RG 3645
              </Button>
            </div>

            <div className="p-4 bg-white rounded-xl border border-muted-foreground/10 space-y-3 opacity-50">
              <div className="flex items-start gap-3">
                <div className="bg-muted p-2 rounded-lg text-muted-foreground"><FileSpreadsheet className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-bold">RG 4004 - Locaciones de Inmuebles</p>
                  <p className="text-[10px] text-muted-foreground">Reporte detallado de locaciones (Próximamente).</p>
                </div>
              </div>
              <Button disabled variant="outline" className="w-full h-10 gap-2">
                <Download className="h-4 w-4" /> No disponible
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
