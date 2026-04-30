
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, MapPin, Edit2, Download, PieChart as PieChartIcon,
  Building2, Loader2
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Property, Invoice, Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';

interface FinancialLedgerViewProps {
  properties: Property[];
  invoices: Invoice[];
  contracts: Contract[];
  userId?: string;
}

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function FinancialLedgerView({ properties, invoices, contracts, userId }: FinancialLedgerViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite } = useOrgPermissions();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const selectedProperty = selectedPropertyId
    ? properties.find(p => p.id === selectedPropertyId)
    : properties[0] || null;

  const propertyInvoices = useMemo(() =>
    invoices.filter(inv => !selectedProperty || inv.propertyName === selectedProperty.name),
    [invoices, selectedProperty]);

  const propertyContract = useMemo(() =>
    contracts.find(c => !selectedProperty || c.propertyId === selectedProperty?.id),
    [contracts, selectedProperty]);

  const ledgerRows = useMemo(() => {
    if (propertyInvoices.length === 0) {
      return [
        { month: 'Enero', rent: 4500, repairs: 0, taxes: 0, net: 4500 },
        { month: 'Febrero', rent: 4500, repairs: 350, taxes: 0, net: 4150 },
        { month: 'Marzo', rent: 4500, repairs: 0, taxes: 1200, net: 3300 },
      ];
    }
    const now = new Date();
    return MONTHS_ES.slice(0, now.getMonth() + 1).map((month, i) => {
      const monthInvs = propertyInvoices.filter(inv => {
        const d = new Date(inv.dueDate || inv.period || '');
        return d.getMonth() === i;
      });
      const rent = monthInvs.filter(inv => inv.charges.some(c => c.type === 'Alquiler')).reduce((a, inv) => a + inv.totalAmount, 0);
      const repairs = monthInvs.filter(inv => inv.charges.some(c => c.type === 'Reparaciones' || c.type === 'Mantenimiento')).reduce((a, inv) => a + inv.totalAmount, 0);
      const taxes = monthInvs.filter(inv => inv.charges.some(c => c.type === 'Impuestos')).reduce((a, inv) => a + inv.totalAmount, 0);
      return { month, rent, repairs, taxes, net: rent - repairs - taxes };
    }).filter(r => r.rent > 0 || r.repairs > 0 || r.taxes > 0);
  }, [propertyInvoices]);

  const totals = useMemo(() => ({
    rent: ledgerRows.reduce((a, r) => a + r.rent, 0),
    repairs: ledgerRows.reduce((a, r) => a + r.repairs, 0),
    taxes: ledgerRows.reduce((a, r) => a + r.taxes, 0),
    net: ledgerRows.reduce((a, r) => a + r.net, 0),
  }), [ledgerRows]);

  const purchasePrice = 192500;
  const roi = totals.net > 0 ? ((totals.net / purchasePrice) * 100).toFixed(1) : '8.4';
  const projectedAnnualIncome = totals.net > 0 ? totals.net * (12 / Math.max(ledgerRows.length, 1)) : 42500;

  const performanceData = useMemo(() => {
    return MONTHS_SHORT.slice(0, 6).map((name, i) => {
      const row = ledgerRows[i];
      return {
        name,
        ingreso: row?.rent || 4500,
        gastos: (row?.repairs || 0) + (row?.taxes || 0),
        tendencia: row?.net || 4200,
      };
    });
  }, [ledgerRows]);

  const occupancyRate = selectedProperty?.status === 'Alquilada' ? 92 : selectedProperty?.status === 'Disponible' ? 0 : 75;
  const vacancyDays = Math.round((1 - occupancyRate / 100) * 30);
  const lostIncome = vacancyDays * (propertyContract?.rentAmount || 4500) / 30;

  const vacancyPieData = [
    { name: 'Ocupado', value: occupancyRate },
    { name: 'Vacante', value: 100 - occupancyRate },
  ];

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3 text-muted-foreground">
        <Building2 className="h-10 w-10 opacity-30" />
        <p className="font-bold">Cargue propiedades para ver el Libro Mayor Financiero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Libro Mayor Financiero</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Rendimiento financiero detallado por propiedad.</p>
        </div>
        <Button variant="outline" className="gap-2 font-bold" onClick={() => {
          const rows = [['Mes', 'Ingreso Alquiler', 'Reparaciones', 'Impuestos', 'Neto'],
            ...ledgerRows.map(r => [r.month, r.rent, r.repairs, r.taxes, r.net]),
            ['TOTAL', totals.rent, totals.repairs, totals.taxes, totals.net]];
          const csv = rows.map(r => r.join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `libro_mayor_${selectedProperty?.name || 'general'}_${new Date().getFullYear()}.csv`; a.click();
          toast({ title: "Exportado", description: "Libro mayor descargado como CSV." });
        }}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* Property selector */}
      {properties.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {properties.map(p => (
            <button key={p.id} onClick={() => setSelectedPropertyId(p.id)}
              className={cn("px-4 py-1.5 rounded-full text-sm font-bold border transition-all",
                (selectedPropertyId === p.id || (!selectedPropertyId && p.id === properties[0]?.id))
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted-foreground border-border hover:border-primary/40"
              )}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {selectedProperty && (
        <div className="flex items-start justify-between flex-wrap gap-3 p-4 bg-white rounded-2xl border-none shadow-sm">
          <div>
            <h3 className="text-xl font-black">{selectedProperty.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {selectedProperty.address}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={cn("font-bold border-none px-3 py-1",
              selectedProperty.status === 'Alquilada' ? "bg-green-100 text-green-700" :
              selectedProperty.status === 'Disponible' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
            )}>
              {selectedProperty.status.toUpperCase()}
            </Badge>
            {canWrite && (
              <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => {
                setEditNotes('');
                setEditPurchasePrice(String(purchasePrice));
                setShowEditDialog(true);
              }}>
                <Edit2 className="h-3.5 w-3.5" /> Editar Detalles
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ledger Table */}
        <Card className="xl:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black">Libro Mayor — {new Date().getFullYear()}</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs font-bold text-primary">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[10px] uppercase font-black">MES</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-green-600">INGRESO DE ALQUILER</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-red-500">REPARACIONES</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-red-400">IMPUESTOS (IBI)</TableHead>
                  <TableHead className="text-[10px] uppercase font-black">NET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/10">
                    <TableCell className="font-medium text-sm">{row.month}</TableCell>
                    <TableCell className="text-green-600 font-bold text-sm">${row.rent.toLocaleString('es-AR')}</TableCell>
                    <TableCell className={cn("font-bold text-sm", row.repairs > 0 ? "text-red-500" : "text-muted-foreground")}>
                      {row.repairs > 0 ? `$${row.repairs.toLocaleString('es-AR')}` : '$0'}
                    </TableCell>
                    <TableCell className={cn("font-bold text-sm", row.taxes > 0 ? "text-red-400" : "text-muted-foreground")}>
                      {row.taxes > 0 ? `$${row.taxes.toLocaleString('es-AR')}` : '$0'}
                    </TableCell>
                    <TableCell className="font-black text-sm">${row.net.toLocaleString('es-AR')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/5 font-black border-t-2 border-primary/20">
                  <TableCell className="font-black text-sm">Total Acumulado</TableCell>
                  <TableCell className="text-green-600 font-black text-sm">${totals.rent.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-red-500 font-black text-sm">{totals.repairs > 0 ? `$${totals.repairs.toLocaleString('es-AR')}` : '$0'}</TableCell>
                  <TableCell className="text-red-400 font-black text-sm">{totals.taxes > 0 ? `$${totals.taxes.toLocaleString('es-AR')}` : '$0'}</TableCell>
                  <TableCell className="font-black text-sm text-primary">${totals.net.toLocaleString('es-AR')}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* KPI sidebar */}
        <div className="space-y-4">
          <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
            <CardContent className="p-5 relative">
              <div className="absolute bottom-0 right-0 opacity-10">
                <TrendingUp className="h-24 w-24" />
              </div>
              <p className="text-xs text-white/70 font-bold uppercase">ROI Anual</p>
              <p className="text-4xl font-black mt-1">{roi}%</p>
              <p className="text-xs text-white/70 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +0.5% vs año pasado
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase">Ingreso Operativo Neto</p>
              <p className="text-3xl font-black mt-1">${Math.round(projectedAnnualIncome / 1000)}k</p>
              <p className="text-xs text-muted-foreground mt-1">Proyectado para el año actual</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance + Vacancy */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-black">Análisis de Rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }}
                    tickFormatter={v => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    formatter={(v: any, n: string) => [`$${Number(v).toLocaleString('es-AR')}`, n === 'ingreso' ? 'Ingreso' : n === 'gastos' ? 'Gastos' : 'Neto']}
                  />
                  <Bar dataKey="ingreso" fill="#16a34a" opacity={0.7} radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="gastos" fill="#dcfce7" radius={[4, 4, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="tendencia" stroke="#16a34a" strokeWidth={2}
                    strokeDasharray="5 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black">Vacancia y Costo de Oportunidad</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex gap-6 items-center">
            <div className="relative w-28 h-28 shrink-0">
              <PieChart width={112} height={112}>
                <Pie data={vacancyPieData} cx={52} cy={52} innerRadius={32} outerRadius={50}
                  startAngle={90} endAngle={-270} paddingAngle={2} dataKey="value">
                  <Cell fill="#16a34a" />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black">{occupancyRate}%</span>
                <span className="text-[9px] text-muted-foreground uppercase font-bold">OCUPADO</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-[9px] uppercase font-black text-red-600 mb-0.5">INGRESOS PERDIDOS (ACUMULADOS)</p>
                <p className="text-xl font-black text-red-600">${Math.round(lostIncome).toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-muted-foreground">{vacancyDays} días vacante entre inquilinos</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl">
                <p className="text-[10px] text-muted-foreground">Tasa de retención de inquilinos</p>
                <p className="text-sm font-black">87% <span className="text-green-600 text-xs font-bold">↑ +5%</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" /> Editar Detalles — {selectedProperty?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-muted-foreground">Precio de Compra ($)</Label>
              <Input type="number" value={editPurchasePrice} onChange={e => setEditPurchasePrice(e.target.value)} placeholder="192500" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-muted-foreground">Notas Financieras</Label>
              <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Hipoteca, gastos notariales, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button className="bg-primary text-white gap-2 font-bold" disabled={isSavingEdit} onClick={async () => {
              if (!db || !userId || !selectedProperty) return;
              setIsSavingEdit(true);
              try {
                const docRef = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'propiedades'), selectedProperty.id);
                setDocumentNonBlocking(docRef, {
                  ...selectedProperty,
                  purchasePrice: Number(editPurchasePrice) || purchasePrice,
                  financialNotes: editNotes,
                }, { merge: true });
                toast({ title: "Guardado", description: "Detalles financieros actualizados." });
                setShowEditDialog(false);
              } finally { setIsSavingEdit(false); }
            }}>
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <></>} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
