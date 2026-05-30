
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Search,
  Download,
  Calculator,
  ArrowDownCircle,
  TrendingUp,
  FileCheck,
  Wrench,
  CheckCircle2,
  Mail,
  MessageCircle,
  Percent,
  Eye,
  Loader2,
  Sheet,
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/export-utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person, Invoice, MaintenanceTask, Contract } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, query, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking, setDocumentSafe, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Schemas } from '@/lib/schemas';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, normalizePhoneForWhatsApp } from '@/lib/format';
import { calculateLiquidationNet, recalculateNetWithInterest, computeLiquidationFromSources } from '@/lib/calculations/liquidation';
import { createNotification } from '@/lib/notifications';
import { OwnerRegistryEntry } from '@/components/owner/owner-portal';

// ── Pipeline visual de liquidación ────────────────────────────────────────────

function LiquidationPipeline({ liq }: { liq: Liquidation }) {
  const steps = [
    { key: 'calc',   label: 'Calculado',  done: true },
    { key: 'notify', label: 'Notificado', done: !!liq.ownerEmail },
    { key: 'pdf',    label: 'PDF',        done: liq.status === 'Pagada' },
    { key: 'ledger', label: 'Pagada',     done: liq.status === 'Pagada' },
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={cn(
            'flex flex-col items-center gap-0.5',
          )}>
            <div className={cn(
              'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black',
              s.done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground',
            )}>
              {i + 1}
            </div>
            <span className={cn('text-[7px] font-bold', s.done ? 'text-green-700' : 'text-muted-foreground')}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('h-px w-3 mb-3', s.done ? 'bg-green-400' : 'bg-muted')} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface LiquidationsViewProps {
  liquidations: Liquidation[];
  userId?: string;
  properties: Property[];
  people: Person[];
  contracts?: Contract[];
  invoices?: Invoice[];
  tasks?: MaintenanceTask[];
}


export function LiquidationsView({ liquidations, userId, properties, people, contracts = [], invoices = [], tasks = [] }: LiquidationsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();
  
  const [isNewLiqOpen, setIsNewLiqOpen] = useState(false);
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [period, setPeriod] = useState(new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
  const [propSearch, setPropSearch] = useState('');
  const [previewLiq, setPreviewLiq] = useState<Liquidation | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const sortedProperties = React.useMemo(
    () => [...properties].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [properties]
  );

  const filteredProperties = React.useMemo(() => {
    const q = propSearch.trim().toLowerCase();
    if (!q) return sortedProperties;
    return sortedProperties.filter(p => (p.name ?? '').toLowerCase().includes(q));
  }, [sortedProperties, propSearch]);

  const allFilteredSelected = filteredProperties.length > 0 && filteredProperties.every(p => selectedPropIds.includes(p.id));
  const someFilteredSelected = filteredProperties.some(p => selectedPropIds.includes(p.id));

  const toggleProp = (id: string) => {
    setSelectedPropIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedPropIds(prev => prev.filter(id => !filteredProperties.some(p => p.id === id)));
    } else {
      setSelectedPropIds(prev => Array.from(new Set([...prev, ...filteredProperties.map(p => p.id)])));
    }
  };

  const [interestDialog, setInterestDialog] = useState<{ liq: Liquidation } | null>(null);
  const [interestInput, setInterestInput] = useState('');

  const handleSaveInterest = () => {
    if (!interestDialog || !userId || !db) return;
    const amount = parseFloat(interestInput.replace(',', '.')) || 0;
    const l = interestDialog.liq;
    const newNet = recalculateNetWithInterest(l, amount);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', l.id);
    setDocumentSafe(docRef, Schemas.LiquidationPatch, { interestAmount: amount, netAmount: newNet }, { merge: true });
    setInterestDialog(null);
    setInterestInput('');
    toast({ title: 'Intereses registrados', description: `+${formatCurrency(amount)} sumados al neto de ${l.propertyName}.` });
  };

  const buildWhatsAppLink = (l: Liquidation) => {
    const interests = l.interestAmount ? `\n➕ *Intereses mes ant.:* ${formatCurrency(l.interestAmount)}` : '';
    const msg = `*Liquidación ${l.period} — ${l.propertyName}*\n\nAlquiler bruto: ${formatCurrency(l.ingresoAlquiler)}\nHonorarios admin: -${formatCurrency(l.adminFeeDeduction)}\nServicios/impuestos: -${formatCurrency(l.expenseDeductions)}\nReparaciones: -${formatCurrency(l.maintenanceDeductions)}${interests}\n────────────────\n💰 *Neto a transferir: ${formatCurrency(l.netAmount)}*\n\nAlquilaGestión Pro`;
    const phone = normalizePhoneForWhatsApp(l.ownerPhone);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const buildMailtoLink = (l: Liquidation) => {
    const interests = l.interestAmount ? `\nIntereses mes ant.: +${formatCurrency(l.interestAmount)}` : '';
    const body = `Estimado/a ${l.ownerName},\n\nAdjunto el detalle de su liquidación correspondiente a ${l.period}:\n\nPropiedad: ${l.propertyName}\nAlquiler bruto: ${formatCurrency(l.ingresoAlquiler)}\nHonorarios admin (10%): -${formatCurrency(l.adminFeeDeduction)}\nServicios/impuestos: -${formatCurrency(l.expenseDeductions)}\nReparaciones: -${formatCurrency(l.maintenanceDeductions)}${interests}\n\nNeto a transferir: ${formatCurrency(l.netAmount)}\n\nSaludos,\nAlquilaGestión Pro`;
    return `mailto:${l.ownerEmail || ''}?subject=${encodeURIComponent(`Liquidación ${l.period} — ${l.propertyName}`)}&body=${encodeURIComponent(body)}`;
  };

  const handleCreateLiq = () => {
    if (selectedPropIds.length === 0 || !userId || !db) return;

    let totalDeductions = 0;
    let generated = 0;
    const skipped: string[] = [];

    selectedPropIds.forEach(propId => {
      const property = properties.find(p => p.id === propId);
      if (!property) return;

      const ownerPerson = people.find(p => p.id === property.owners?.[0]?.ownerId);
      const owner = ownerPerson || { id: 'dueño-ext', fullName: property.owners?.[0]?.name || 'Propietario', phone: '' };

      let calc = computeLiquidationFromSources({
        property: { id: property.id, name: property.name },
        period,
        invoices,
        tasks,
      });

      // Si no hay facturas ni mantenimiento, intentar usar el contrato vigente
      if (!calc.hasData) {
        const activeContract = contracts.find(
          c => c.propertyId === property.id && c.status === 'Vigente'
        );
        if (activeContract && activeContract.currentRentAmount > 0) {
          const rentIncome = activeContract.currentRentAmount;
          const adminFee = rentIncome * 0.1;
          calc = {
            rentIncome,
            serviceDeductions: 0,
            maintenanceDeductions: 0,
            adminFee,
            netAmount: rentIncome - adminFee,
            hasData: true,
          };
        }
      }

      // Saltar propiedades sin datos del período ni contrato vigente
      if (!calc.hasData) {
        skipped.push(property.name);
        return;
      }

      const activeContractForLiq = contracts.find(
        c => c.propertyId === property.id && (c.status === 'Vigente' || c.status === 'Próximo a Vencer')
      );

      const docId = Math.random().toString(36).substr(2, 9);
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', docId);

      const liqData: Liquidation = {
        id: docId,
        contractId: activeContractForLiq?.id,
        propertyId: propId,
        propertyName: property.name,
        ownerId: owner.id,
        ownerName: owner.fullName,
        ownerEmail: property.owners?.[0]?.email,
        ownerPhone: ownerPerson?.phone,
        period: period,
        ingresoAlquiler: calc.rentIncome,
        adminFeeDeduction: calc.adminFee,
        maintenanceDeductions: calc.maintenanceDeductions,
        expenseDeductions: calc.serviceDeductions,
        interestAmount: 0,
        netAmount: calc.netAmount,
        status: 'Pendiente',
        dateCreated: new Date().toLocaleDateString('es-AR')
      };

      setDocumentSafe(docRef, Schemas.LiquidationCreate, liqData, { merge: true });
      totalDeductions += calc.serviceDeductions + calc.maintenanceDeductions;
      generated += 1;

      // Notificar al propietario si tiene UID registrado
      const ownerEmail = property.owners?.[0]?.email;
      if (ownerEmail && db) {
        const regDocId = ownerEmail.toLowerCase().replace(/[@.+]/g, '_');
        getDoc(doc(db, 'artifacts', APP_ID, 'ownerRegistry', regDocId)).then(snap => {
          const regEntry = snap.data() as OwnerRegistryEntry | undefined;
          if (regEntry?.ownerUid) {
            createNotification(db, regEntry.ownerUid, {
              type: 'liquidation_ready',
              title: 'Nueva liquidación disponible',
              message: `La liquidación de ${property.name} para ${period} fue generada. Neto: ${formatCurrency(calc.netAmount)}.`,
              refId: docId,
              link: 'Liquidaciones',
            });
          }
        });
      }
    });

    setIsNewLiqOpen(false);
    setSelectedPropIds([]);
    setPropSearch('');

    if (generated === 0) {
      toast({
        title: 'No se generó ninguna liquidación',
        description: `Las ${selectedPropIds.length} unidades seleccionadas no tienen facturas ni mantenimientos cargados para "${period}".`,
        variant: 'destructive',
      });
      return;
    }

    const skipNote = skipped.length > 0
      ? ` (${skipped.length} omitida${skipped.length > 1 ? 's' : ''} por falta de datos)`
      : '';
    toast({
      title: generated > 1 ? `${generated} Liquidaciones Generadas` : 'Liquidación Generada',
      description: `Deducciones totales aplicadas: ${formatCurrency(totalDeductions)}.${skipNote}`,
    });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', id);
    deleteDocumentNonBlocking(docRef);
  };

  const handleDownloadPdf = async (l: Liquidation) => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable  = (await import('jspdf-autotable')).default;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Informe Ejecutivo de Liquidación', 14, 20);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Propietario: ${l.ownerName}`, 14, 30);
      pdf.text(`Propiedad:   ${l.propertyName}`, 14, 36);
      pdf.text(`Período:     ${l.period}`, 14, 42);
      pdf.text(`Emitido:     ${new Date().toLocaleDateString('es-AR')}`, 14, 48);

      pdf.setDrawColor(200);
      pdf.line(14, 52, 196, 52);

      // Summary table
      autoTable(pdf, {
        startY: 56,
        head: [['Concepto', 'Importe']],
        body: [
          ['Ingreso por alquiler',         `$ ${l.ingresoAlquiler.toLocaleString('es-AR')}`],
          ['Comisión administración (−)',   `$ ${l.adminFeeDeduction.toLocaleString('es-AR')}`],
          ['Gastos de mantenimiento (−)',   `$ ${l.maintenanceDeductions.toLocaleString('es-AR')}`],
          ['Gastos varios (−)',              `$ ${l.expenseDeductions.toLocaleString('es-AR')}`],
          ...(l.interestAmount ? [['Intereses (−)', `$ ${l.interestAmount.toLocaleString('es-AR')}`]] : []),
          ['NETO A TRANSFERIR',            `$ ${l.netAmount.toLocaleString('es-AR')}`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [249, 115, 22] },
        footStyles: { fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      });

      // Footer note
      const finalY = (pdf as any).lastAutoTable?.finalY ?? 130;
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text('Este informe ha sido generado automáticamente por AlquilaGestión Pro.', 14, finalY + 10);
      pdf.text('RG AFIP N° 1415/03 — El propietario debe emitir factura ARCA al percibir el pago.', 14, finalY + 15);

      pdf.save(`liquidacion_${l.period.replace(/\s+/g, '_')}_${l.propertyName.replace(/\s+/g, '_')}.pdf`);
      toast({ title: 'PDF generado', description: `Liquidación ${l.period} descargada.` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const cols = [
      { header: 'Propietario',  key: 'ownerName',    width: 24 },
      { header: 'Propiedad',    key: 'propertyName', width: 28 },
      { header: 'Período',      key: 'period',       width: 18 },
      { header: 'Bruto',        key: 'bruto',        width: 16 },
      { header: 'Deducciones',  key: 'deductions',   width: 16 },
      { header: 'Neto',         key: 'net',          width: 16 },
      { header: 'Estado',       key: 'status',       width: 14 },
    ];
    const rows = liquidations.map(l => ({
      ownerName:    l.ownerName ?? '—',
      propertyName: l.propertyName ?? '—',
      period:       l.period ?? '—',
      bruto:        l.ingresoAlquiler?.toLocaleString('es-AR') ?? '0',
      deductions:   (l.maintenanceDeductions + l.expenseDeductions + l.adminFeeDeduction).toLocaleString('es-AR'),
      net:          l.netAmount?.toLocaleString('es-AR') ?? '0',
      status:       l.status ?? '—',
    }));
    const filename = `liquidaciones_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`;
    if (format === 'pdf') {
      exportToPDF('Liquidaciones', `${liquidations.length} registros`, cols, rows, filename);
    } else {
      exportToExcel('Liquidaciones', cols, rows, filename);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar liquidación..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => handleExport('pdf')} disabled={liquidations.length === 0} aria-label="Exportar PDF">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => handleExport('excel')} disabled={liquidations.length === 0} aria-label="Exportar Excel">
            <Sheet className="h-3.5 w-3.5" aria-hidden="true" /> Excel
          </Button>
        </div>
        <Dialog open={isNewLiqOpen} onOpenChange={setIsNewLiqOpen}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2 font-bold shadow-md">
                <Calculator className="h-4 w-4" /> Generar Periodo
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Liquidación Mensual</DialogTitle>
              <DialogDescription>El sistema aplicará deducciones bajo reglas estrictas de responsabilidad.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Propiedades / Unidades</Label>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {selectedPropIds.length} de {properties.length} seleccionadas
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={propSearch}
                    onChange={e => setPropSearch(e.target.value)}
                    placeholder="Buscar unidad..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <div className="rounded-md border border-input">
                  <label className="flex items-center gap-2 p-2.5 border-b border-input bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors">
                    <Checkbox
                      checked={allFilteredSelected ? true : (someFilteredSelected ? 'indeterminate' : false)}
                      onCheckedChange={toggleAll}
                      disabled={filteredProperties.length === 0}
                    />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </span>
                  </label>
                  <ScrollArea className="h-36">
                    {filteredProperties.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground italic">
                        Sin coincidencias.
                      </div>
                    ) : (
                      <ul className="divide-y divide-input/50">
                        {filteredProperties.map(p => {
                          const checked = selectedPropIds.includes(p.id);
                          return (
                            <li key={p.id}>
                              <label className={cn(
                                "flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/40 transition-colors",
                                checked && "bg-primary/5"
                              )}>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleProp(p.id)}
                                />
                                <span className="text-xs font-medium truncate">{p.name}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Período de Liquidación</Label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ej: Junio 2026" />
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-[10px] space-y-1 border border-blue-100">
                  <p className="font-bold text-blue-700 flex items-center gap-1.5"><ArrowDownCircle className="h-3 w-3" /> Deducciones Fiscales/Servicios</p>
                  <p className="text-blue-600 leading-tight">Se restarán automáticamente las facturas cargadas con la marca "Imputar a Propietario".</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg text-[10px] space-y-1 border border-orange-100">
                  <p className="font-bold text-orange-700 flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Deducciones Mantenimiento</p>
                  <p className="text-orange-600 leading-tight">SOLO se restarán reparaciones cerradas, marcadas como "Cargo Propietario" y con aprobación explícita tildada.</p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4 shrink-0">
              <Button
                className="w-full h-11 font-black"
                onClick={handleCreateLiq}
                disabled={selectedPropIds.length === 0}
              >
                {selectedPropIds.length > 1
                  ? `Generar ${selectedPropIds.length} Liquidaciones`
                  : 'Cerrar y Generar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propietario / Unidad</TableHead>
              <TableHead className="text-right">Bruto (Alquiler)</TableHead>
              <TableHead className="text-right text-orange-600">Deducciones</TableHead>
              <TableHead className="text-right">Neto a Pagar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{l.ownerName}</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{l.propertyName} • {l.period}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-xs">$ {l.ingresoAlquiler.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-orange-600 font-medium text-xs">
                  <div className="flex flex-col items-end">
                    <span>$ {(l.maintenanceDeductions + l.expenseDeductions + l.adminFeeDeduction).toLocaleString('es-AR')}</span>
                    {l.maintenanceDeductions > 0 && <span className="text-[8px] flex items-center gap-0.5"><Wrench className="h-2 w-2" /> Reparaciones incl.</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-black text-green-700 text-base">$ {l.netAmount.toLocaleString('es-AR')}</span>
                    {(l.interestAmount ?? 0) > 0 && (
                      <span className="text-[9px] text-blue-600 flex items-center gap-0.5 font-semibold">
                        <TrendingUp className="h-2.5 w-2.5" /> +${(l.interestAmount!).toLocaleString('es-AR')} intereses
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <LiquidationPipeline liq={l} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canWrite && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-blue-500"
                        title="Agregar intereses"
                        onClick={() => { setInterestDialog({ liq: l }); setInterestInput(String(l.interestAmount ?? '')); }}
                      ><Percent className="h-4 w-4" /></Button>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-green-600"
                      title="Enviar por WhatsApp"
                      onClick={() => window.open(buildWhatsAppLink(l), '_blank')}
                    ><MessageCircle className="h-4 w-4" /></Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-primary"
                      title="Enviar por Email"
                      onClick={() => window.open(buildMailtoLink(l), '_blank')}
                    ><Mail className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600" title="Vista previa del informe" onClick={() => setPreviewLiq(l)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Descargar Informe PDF" onClick={() => handleDownloadPdf(l)}><Download className="h-4 w-4" /></Button>
                    {canDelete && (
                      <ConfirmDeleteButton
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                        title="Eliminar liquidación"
                        itemName={`${l.ownerName} • ${l.period}`}
                        description={<p>La liquidación se podrá regenerar después, pero los intereses y ajustes manuales se perderán.</p>}
                        blockedReason={l.status === 'Pagada' ? 'No se puede eliminar una liquidación ya pagada.' : null}
                        onConfirm={() => handleDelete(l.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {liquidations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={Calculator}
                    title="Sin liquidaciones generadas"
                    description="Generá el período mensual para calcular automáticamente las liquidaciones de tus propietarios."
                    action={{ label: 'Generar Período', onClick: () => setIsNewLiqOpen(true), icon: Plus }}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Dialog: agregar intereses del mes anterior */}
      <Dialog open={!!interestDialog} onOpenChange={open => { if (!open) { setInterestDialog(null); setInterestInput(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" /> Intereses del mes anterior
            </DialogTitle>
            <DialogDescription>
              Se sumarán al neto a pagar al propietario de <strong>{interestDialog?.liq.propertyName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Monto de intereses ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 15000"
                value={interestInput}
                onChange={e => setInterestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveInterest()}
                autoFocus
              />
            </div>
            {interestDialog && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-0.5">
                <div className="flex justify-between"><span>Neto actual:</span><span className="font-semibold">$ {interestDialog.liq.netAmount.toLocaleString('es-AR')}</span></div>
                {parseFloat(interestInput.replace(',', '.')) > 0 && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>Neto con intereses:</span>
                    <span>$ {(interestDialog.liq.ingresoAlquiler - interestDialog.liq.adminFeeDeduction - interestDialog.liq.expenseDeductions - interestDialog.liq.maintenanceDeductions + (parseFloat(interestInput.replace(',', '.')) || 0)).toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setInterestDialog(null); setInterestInput(''); }}>Cancelar</Button>
            <Button onClick={handleSaveInterest} disabled={!interestInput || parseFloat(interestInput) < 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Vista previa HTML del informe ── */}
      <Dialog open={!!previewLiq} onOpenChange={(o) => !o && setPreviewLiq(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {previewLiq && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-indigo-600" />
                  Informe de Liquidación — {previewLiq.period}
                </DialogTitle>
              </DialogHeader>

              {/* ── HTML preview ── */}
              <div className="rounded-xl border bg-white p-6 space-y-5 text-sm font-sans">
                {/* Encabezado */}
                <div className="border-b pb-4">
                  <h2 className="text-xl font-black text-gray-900">Informe Ejecutivo de Liquidación</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Generado el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                {/* Datos identificatorios */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['Propietario',  previewLiq.ownerName],
                    ['Propiedad',    previewLiq.propertyName],
                    ['Período',      previewLiq.period],
                    ['Email',        previewLiq.ownerEmail ?? '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">{label}</p>
                      <p className="font-semibold text-foreground mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Tabla de conceptos */}
                <div className="rounded-lg overflow-hidden border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-orange-500 text-white">
                        <th className="text-left py-2 px-3 font-black">Concepto</th>
                        <th className="text-right py-2 px-3 font-black">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Ingreso por alquiler',        amount: previewLiq.ingresoAlquiler,        plus: true  },
                        { label: 'Comisión administración',     amount: previewLiq.adminFeeDeduction,      plus: false },
                        { label: 'Gastos de mantenimiento',     amount: previewLiq.maintenanceDeductions,  plus: false },
                        { label: 'Gastos varios / servicios',   amount: previewLiq.expenseDeductions,      plus: false },
                        ...(previewLiq.interestAmount ? [{ label: 'Intereses a favor', amount: previewLiq.interestAmount, plus: true }] : []),
                      ].map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                          <td className="py-2 px-3 text-gray-700">
                            {!row.plus && <span className="text-red-500 font-bold mr-1">−</span>}
                            {row.label}
                          </td>
                          <td className={`py-2 px-3 text-right font-semibold ${row.plus ? 'text-gray-800' : 'text-red-600'}`}>
                            $ {row.amount.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 border-t-2 border-green-400">
                        <td className="py-3 px-3 font-black text-green-800 text-sm">NETO A TRANSFERIR</td>
                        <td className="py-3 px-3 text-right font-black text-green-700 text-base">
                          $ {previewLiq.netAmount.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Aviso legal */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-800">
                  <p className="font-bold mb-0.5">RG AFIP N° 1415/03</p>
                  <p>El propietario debe emitir la factura ARCA al percibir el pago o al vencimiento, lo que ocurra primero.</p>
                </div>

                {/* Estado */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Estado de la liquidación:</span>
                  <Badge className={previewLiq.status === 'Pagada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                    {previewLiq.status}
                  </Badge>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPreviewLiq(null)}>Cerrar</Button>
                <Button
                  className="bg-primary text-white gap-2"
                  disabled={pdfLoading}
                  onClick={() => handleDownloadPdf(previewLiq)}
                >
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pdfLoading ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
