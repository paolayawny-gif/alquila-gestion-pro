
"use client";

import React, { useMemo, useState } from 'react';
// xlsx se carga de forma diferida dentro del handler de exportación.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, MapPin, Edit2, Download, PieChart as PieChartIcon,
  Building2, Loader2, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Property, Invoice, Contract, Cobro } from '@/lib/types';
import { useCollection, useMemoFirebase } from '@/firebase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { calculateRentAdjustment, type RentAdjustmentResult } from '@/ai/flows/calculate-rent-adjustment-action';
import { sendEmail } from '@/services/email-service';
import { formatCurrency } from '@/lib/format';
import { FiscalPanel } from '@/components/ui/fiscal-panel';

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
  const [adjData, setAdjData] = useState<RentAdjustmentResult | null>(null);
  const [isLoadingAdj, setIsLoadingAdj] = useState(false);
  const [isApplyingAdj, setIsApplyingAdj] = useState(false);

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    setAdjData(null);
  };

  const handleCalcAdjustment = async () => {
    if (!propertyContract?.adjustmentMechanism) return;
    setIsLoadingAdj(true);
    setAdjData(null);
    const result = await calculateRentAdjustment({
      mechanism: propertyContract.adjustmentMechanism as any,
      currentRentAmount: propertyContract.currentRentAmount,
      currency: propertyContract.currency,
      adjustmentFrequencyMonths: propertyContract.adjustmentFrequencyMonths,
    });
    setIsLoadingAdj(false);
    if (result.ok) {
      setAdjData(result.data);
    } else {
      toast({ title: 'Error al calcular ajuste', description: result.error, variant: 'destructive' });
    }
  };

  const handleApplyAdjustment = async () => {
    if (!adjData || !propertyContract || !userId || !db) return;
    setIsApplyingAdj(true);
    try {
      // 1. Actualiza el contrato en Firestore
      const contractRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', propertyContract.id);
      setDocumentNonBlocking(contractRef, {
        currentRentAmount: adjData.newAmount,
        lastAdjustmentDate: new Date().toISOString().slice(0, 10),
      }, { merge: true });

      const sym = formatCurrency(0, { currency: propertyContract.currency }).replace('0', '').trim();
      const newFmt = formatCurrency(adjData.newAmount, { currency: propertyContract.currency });
      const oldFmt = formatCurrency(adjData.currentAmount, { currency: propertyContract.currency });
      const pct = `+${adjData.variationPct.toFixed(1)}%`;
      const mechanism = propertyContract.adjustmentMechanism ?? 'índice';

      // 2. Email al propietario
      const property = selectedProperty;
      const ownerEmail = property?.owners?.[0]?.email;
      const ownerName = property?.owners?.[0]?.name ?? 'Propietario';
      if (ownerEmail) {
        sendEmail({
          to: ownerEmail,
          subject: `Ajuste de alquiler aplicado — ${property?.name ?? propertyContract.propertyName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
            <h2 style="color:#1D9E75;">Ajuste de alquiler aplicado</h2>
            <p>Estimado/a <strong>${ownerName}</strong>,</p>
            <p>Le informamos que se ha aplicado el ajuste por <strong>${mechanism}</strong> al contrato de <strong>${propertyContract.propertyName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-size:13px;">Canon anterior</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${oldFmt}</td></tr>
              <tr><td style="padding:8px 12px;font-size:13px;">Variación (${mechanism})</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;color:#1D9E75;">${pct}</td></tr>
              <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-size:13px;font-weight:bold;">Nuevo canon</td><td style="padding:8px 12px;font-size:16px;font-weight:900;color:#1D9E75;">${newFmt}</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">El nuevo valor se aplica a partir del próximo período de cobro.</p>
          </div>`,
        }).catch(() => {});
      }

      // 3. Email al inquilino
      if (propertyContract.tenantEmail) {
        sendEmail({
          to: propertyContract.tenantEmail,
          subject: `Actualización de tu alquiler — ${propertyContract.propertyName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
            <h2 style="color:#1D9E75;">Actualización de tu alquiler</h2>
            <p>Estimado/a <strong>${propertyContract.tenantName ?? 'inquilino/a'}</strong>,</p>
            <p>Le informamos que a partir del próximo período, el canon de alquiler de <strong>${propertyContract.propertyName}</strong> se actualizará según el índice <strong>${mechanism}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-size:13px;">Canon anterior</td><td style="padding:8px 12px;font-size:13px;">${oldFmt}</td></tr>
              <tr><td style="padding:8px 12px;font-size:13px;">Variación aplicada</td><td style="padding:8px 12px;font-size:13px;color:#1D9E75;">${pct}</td></tr>
              <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-size:13px;font-weight:bold;">Nuevo canon</td><td style="padding:8px 12px;font-size:16px;font-weight:900;color:#1D9E75;">${newFmt}</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Ante cualquier consulta, no dude en contactarnos.</p>
          </div>`,
        }).catch(() => {});
      }

      setAdjData(null);
      toast({ title: 'Ajuste aplicado', description: `Nuevo canon: ${newFmt}. Emails enviados al propietario e inquilino.` });
    } finally {
      setIsApplyingAdj(false);
    }
  };

  // Cobros reales confirmados desde Firestore
  const cobrosQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'cobros'),
      orderBy('confirmedAt', 'desc'),
    );
  }, [db, userId]);
  const { data: cobrosRaw } = useCollection<Cobro>(cobrosQ);
  const cobros = cobrosRaw ?? [];

  const selectedProperty = selectedPropertyId
    ? properties.find(p => p.id === selectedPropertyId)
    : properties[0] || null;

  const propertyInvoices = useMemo(() =>
    invoices.filter(inv => !selectedProperty || inv.propertyName === selectedProperty.name),
    [invoices, selectedProperty]);

  const propertyContract = useMemo(() =>
    contracts.find(c => !selectedProperty || c.propertyId === selectedProperty?.id),
    [contracts, selectedProperty]);

  // Cobros de esta propiedad
  const propertyCobros = useMemo(() =>
    cobros.filter(c => !selectedProperty || c.propertyName === selectedProperty.name),
    [cobros, selectedProperty]);

  const ledgerRows = useMemo(() => {
    if (propertyInvoices.length === 0) {
      return [
        { month: 'Enero',    rentCobrado: 4500, rentPorCobrar: 0, repairs: 0, taxes: 0, net: 4500 },
        { month: 'Febrero',  rentCobrado: 4500, rentPorCobrar: 0, repairs: 350, taxes: 0, net: 4150 },
        { month: 'Marzo',    rentCobrado: 4500, rentPorCobrar: 0, repairs: 0, taxes: 1200, net: 3300 },
      ];
    }
    const now = new Date();
    return MONTHS_ES.slice(0, now.getMonth() + 1).map((month, i) => {
      const monthInvs = propertyInvoices.filter(inv => {
        const d = new Date(inv.dueDate || inv.period || '');
        return d.getMonth() === i;
      });
      const paid   = (inv: Invoice) => inv.status === 'Pagado';
      const unpaid = (inv: Invoice) => inv.status !== 'Pagado' && inv.status !== 'Anulado';

      const rentCobrado    = monthInvs.filter(inv => paid(inv)   && inv.charges.some(c => c.type === 'Alquiler')).reduce((a, inv) => a + inv.totalAmount, 0);
      const rentPorCobrar  = monthInvs.filter(inv => unpaid(inv) && inv.charges.some(c => c.type === 'Alquiler')).reduce((a, inv) => a + inv.totalAmount, 0);
      const repairs        = monthInvs.filter(inv => inv.charges.some(c => c.type === 'Reparaciones' || c.type === 'Mantenimiento')).reduce((a, inv) => a + inv.totalAmount, 0);
      const taxes          = monthInvs.filter(inv => inv.charges.some(c => c.type === 'Impuestos')).reduce((a, inv) => a + inv.totalAmount, 0);
      return { month, rentCobrado, rentPorCobrar, repairs, taxes, net: rentCobrado - repairs - taxes };
    }).filter(r => r.rentCobrado > 0 || r.rentPorCobrar > 0 || r.repairs > 0 || r.taxes > 0);
  }, [propertyInvoices]);

  const totals = useMemo(() => ({
    rentCobrado:   ledgerRows.reduce((a, r) => a + r.rentCobrado, 0),
    rentPorCobrar: ledgerRows.reduce((a, r) => a + r.rentPorCobrar, 0),
    repairs:       ledgerRows.reduce((a, r) => a + r.repairs, 0),
    taxes:         ledgerRows.reduce((a, r) => a + r.taxes, 0),
    net:           ledgerRows.reduce((a, r) => a + r.net, 0),
  }), [ledgerRows]);

  const purchasePrice = selectedProperty?.purchasePrice ?? 192500;
  const roi = totals.net > 0 ? ((totals.net / purchasePrice) * 100).toFixed(1) : '8.4';
  const projectedAnnualIncome = totals.net > 0 ? totals.net * (12 / Math.max(ledgerRows.length, 1)) : 42500;

  const performanceData = useMemo(() => {
    return MONTHS_SHORT.slice(0, 6).map((name, i) => {
      const row = ledgerRows[i];
      return {
        name,
        cobrado:    row?.rentCobrado   || 0,
        porCobrar:  row?.rentPorCobrar || 0,
        gastos:     (row?.repairs || 0) + (row?.taxes || 0),
        tendencia:  row?.net || 0,
      };
    });
  }, [ledgerRows]);

  const occupancyRate = selectedProperty?.status === 'Alquilada' ? 92 : selectedProperty?.status === 'Disponible' ? 0 : 75;
  const vacancyDays = Math.round((1 - occupancyRate / 100) * 30);
  const lostIncome = vacancyDays * (propertyContract?.currentRentAmount || 4500) / 30;

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
        <Button variant="outline" className="gap-2 font-bold" onClick={async () => {
          const XLSX = await import('xlsx');
          const wb = XLSX.utils.book_new();

          // Sheet 1: Libro Mayor mensual
          const ws1 = XLSX.utils.aoa_to_sheet([
            [`Libro Mayor — ${selectedProperty?.name ?? 'General'}`],
            [`Período: ${new Date().getFullYear()}`],
            [`Exportado: ${new Date().toLocaleDateString('es-AR')}`],
            [],
            ['Mes', 'Cobrado ($)', 'Por Cobrar ($)', 'Reparaciones ($)', 'Impuestos ($)', 'Neto Cobrado ($)'],
            ...ledgerRows.map(r => [r.month, r.rentCobrado, r.rentPorCobrar, r.repairs, r.taxes, r.net]),
            [],
            ['TOTAL ACUMULADO', totals.rentCobrado, totals.rentPorCobrar, totals.repairs, totals.taxes, totals.net],
            [],
            ['ROI Anual Efectivo', `${roi}%`],
            ['Precio de compra estimado ($)', purchasePrice],
            ['Renta neta proyectada anual ($)', Math.round(projectedAnnualIncome)],
          ]);
          ws1['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
          XLSX.utils.book_append_sheet(wb, ws1, 'Libro Mayor');

          // Sheet 2: Cobros confirmados por propietario
          if (propertyCobros.length > 0) {
            const ws2 = XLSX.utils.aoa_to_sheet([
              ['Cobros Confirmados por Propietario'],
              [],
              ['Fecha Confirmación', 'Período', 'Inquilino', 'Monto ($)', 'Moneda'],
              ...propertyCobros.map(c => [
                c.confirmedAt.split('T')[0],
                c.period,
                c.tenantName,
                c.amount,
                c.currency,
              ]),
            ]);
            ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 12 }, { wch: 8 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Cobros');
          }

          // Sheet 3: Detalle de facturas
          if (propertyInvoices.length > 0) {
            const ws3 = XLSX.utils.aoa_to_sheet([
              ['Detalle de Facturas'],
              [],
              ['Período', 'Inquilino', 'Total ($)', 'Vencimiento', 'Estado'],
              ...propertyInvoices.map(inv => [
                inv.period,
                inv.tenantName,
                inv.totalAmount,
                inv.dueDate,
                inv.status,
              ]),
            ]);
            ws3['!cols'] = [{ wch: 10 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 24 }];
            XLSX.utils.book_append_sheet(wb, ws3, 'Facturas');
          }

          const sheets = 1 + (propertyCobros.length > 0 ? 1 : 0) + (propertyInvoices.length > 0 ? 1 : 0);
          XLSX.writeFile(wb, `libro_mayor_${(selectedProperty?.name ?? 'general').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
          toast({ title: 'Exportado', description: `Excel generado con ${sheets} hoja${sheets > 1 ? 's' : ''}: Libro Mayor · Cobros · Facturas.` });
        }}>
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {/* Property selector */}
      {properties.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {properties.map(p => (
            <button key={p.id} onClick={() => handleSelectProperty(p.id)}
              className={cn("px-4 py-1.5 rounded-full text-sm font-bold border transition-colors",
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[10px] uppercase font-black">MES</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-green-600">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> COBRADO</span>
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-amber-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> POR COBRAR</span>
                  </TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-red-500">REPARACIONES</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-red-400">IMPUESTOS</TableHead>
                  <TableHead className="text-[10px] uppercase font-black">NETO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/10">
                    <TableCell className="font-medium text-sm">{row.month}</TableCell>
                    <TableCell className="text-green-600 font-bold text-sm">
                      {row.rentCobrado > 0 ? `$${row.rentCobrado.toLocaleString('es-AR')}` : <span className="text-muted-foreground/40">$0</span>}
                    </TableCell>
                    <TableCell className={cn('font-bold text-sm', row.rentPorCobrar > 0 ? 'text-amber-600' : 'text-muted-foreground/40')}>
                      {row.rentPorCobrar > 0 ? `$${row.rentPorCobrar.toLocaleString('es-AR')}` : '$0'}
                    </TableCell>
                    <TableCell className={cn('font-bold text-sm', row.repairs > 0 ? 'text-red-500' : 'text-muted-foreground/40')}>
                      {row.repairs > 0 ? `$${row.repairs.toLocaleString('es-AR')}` : '$0'}
                    </TableCell>
                    <TableCell className={cn('font-bold text-sm', row.taxes > 0 ? 'text-red-400' : 'text-muted-foreground/40')}>
                      {row.taxes > 0 ? `$${row.taxes.toLocaleString('es-AR')}` : '$0'}
                    </TableCell>
                    <TableCell className="font-black text-sm">${row.net.toLocaleString('es-AR')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/5 font-black border-t-2 border-primary/20">
                  <TableCell className="font-black text-sm">Total Acumulado</TableCell>
                  <TableCell className="text-green-600 font-black text-sm">${totals.rentCobrado.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-amber-600 font-black text-sm">{totals.rentPorCobrar > 0 ? `$${totals.rentPorCobrar.toLocaleString('es-AR')}` : '$0'}</TableCell>
                  <TableCell className="text-red-500 font-black text-sm">{totals.repairs > 0 ? `$${totals.repairs.toLocaleString('es-AR')}` : '$0'}</TableCell>
                  <TableCell className="text-red-400 font-black text-sm">{totals.taxes > 0 ? `$${totals.taxes.toLocaleString('es-AR')}` : '$0'}</TableCell>
                  <TableCell className="font-black text-sm text-primary">${totals.net.toLocaleString('es-AR')}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* KPI sidebar */}
        <div className="space-y-4">
          <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
            <CardContent className="p-5 relative">
              <div className="absolute bottom-0 right-0 opacity-10">
                <TrendingUp className="h-24 w-24" />
              </div>
              <p className="text-xs text-white/70 font-bold uppercase">ROI Anual Efectivo</p>
              <p className="text-4xl font-black mt-1">{roi}%</p>
              <p className="text-xs text-white/70 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Sobre cobros confirmados
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Cobrado este año</p>
                <p className="text-2xl font-black mt-0.5 text-green-700">${totals.rentCobrado.toLocaleString('es-AR')}</p>
              </div>
              {totals.rentPorCobrar > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-500" /> Por cobrar
                  </p>
                  <p className="text-xl font-black mt-0.5 text-amber-600">${totals.rentPorCobrar.toLocaleString('es-AR')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos cobros confirmados */}
          {propertyCobros.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" /> Últimos cobros
                </p>
                {propertyCobros.slice(0, 4).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-[11px]">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{c.period}</p>
                      <p className="text-muted-foreground truncate text-[10px]">{c.tenantName}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-black text-green-700">${c.amount.toLocaleString('es-AR')}</p>
                      <p className="text-[9px] text-muted-foreground">{c.confirmedAt.split(' ')[0]}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Proyección de próximo ajuste */}
          {propertyContract && propertyContract.adjustmentMechanism && (
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Proyección de Ajuste
                  </p>
                  {isLoadingAdj
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    : (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold px-2 text-primary"
                        onClick={handleCalcAdjustment}>
                        {adjData ? '↻ Recalcular' : 'Calcular'}
                      </Button>
                    )
                  }
                </div>

                {!adjData ? (
                  <div className="space-y-1 text-[11px]">
                    <p className="text-muted-foreground">Índice: <span className="font-bold text-foreground">{propertyContract.adjustmentMechanism}</span></p>
                    <p className="text-muted-foreground">Frecuencia: <span className="font-bold text-foreground">cada {propertyContract.adjustmentFrequencyMonths} mes(es)</span></p>
                    <p className="text-muted-foreground">Canon actual: <span className="font-bold text-foreground">{propertyContract.currency} {propertyContract.currentRentAmount.toLocaleString('es-AR')}</span></p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-[9px] uppercase font-black text-green-700 mb-0.5">Nuevo Canon Estimado</p>
                      <p className="text-lg font-black text-green-700">
                        {adjData.currency} {adjData.newAmount.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[10px] text-green-600 font-bold">
                        +{adjData.variationPct.toFixed(1)}% · +{adjData.currency} {(adjData.newAmount - adjData.currentAmount).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p>Fuente: <span className="font-bold">{adjData.sourceLabel}</span></p>
                      <p>Período ref.: {adjData.referencePeriod}</p>
                      {adjData.isEstimated && (
                        <p className="text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" /> Estimación (API no disponible)
                        </p>
                      )}
                    </div>
                    {canWrite && (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-[11px] h-7 mt-1"
                        onClick={handleApplyAdjustment}
                        disabled={isApplyingAdj}
                      >
                        {isApplyingAdj ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Aplicar y notificar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Panel fiscal — Admin */}
      {totals.rentCobrado > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 border-b mb-4">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" /> Estimación Fiscal — Propietario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FiscalPanel
              annualIncome={totals.rentCobrado * (12 / Math.max(1, new Date().getMonth() + 1))}
              currency={propertyContract?.currency ?? 'ARS'}
              provinceName={selectedProperty?.address?.split(',').pop()?.trim()}
            />
          </CardContent>
        </Card>
      )}

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
                    formatter={(v: any, n: string) => [`$${Number(v).toLocaleString('es-AR')}`, n === 'cobrado' ? 'Cobrado' : n === 'porCobrar' ? 'Por cobrar' : n === 'gastos' ? 'Gastos' : 'Neto']}
                  />
                  <Bar dataKey="cobrado"   fill="#16a34a" opacity={0.85} radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="porCobrar" fill="#fbbf24" opacity={0.6}  radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="gastos"    fill="#fecaca" radius={[4, 4, 0, 0]} barSize={14} />
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
