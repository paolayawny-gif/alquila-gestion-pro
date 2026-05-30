
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useRef } from 'react';
import {
  FileText,
  Receipt,
  Calculator,
  Wrench,
  FolderOpen,
  User,
  Building,
  Calendar,
  DollarSign,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Scale,
  X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import {
  Contract,
  Person,
  Property,
  Invoice,
  Liquidation,
  MaintenanceTask,
  LegalCase,
  ContractFile,
  ContractFileCategory,
} from '@/lib/types';


function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Vigente: 'bg-green-50 text-green-700 border-green-200',
    'Próximo a Vencer': 'bg-amber-50 text-amber-700 border-amber-200',
    Finalizado: 'bg-slate-50 text-slate-500 border-slate-200',
    Rescindido: 'bg-red-50 text-red-700 border-red-200',
    Borrador: 'bg-blue-50 text-blue-700 border-blue-200',
    Pagado: 'bg-green-50 text-green-700 border-green-200',
    Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
    Vencido: 'bg-red-50 text-red-700 border-red-200',
    Pagada: 'bg-green-50 text-green-700 border-green-200',
    Completado: 'bg-green-50 text-green-700 border-green-200',
    'En curso': 'bg-blue-50 text-blue-700 border-blue-200',
    Cerrado: 'bg-slate-50 text-slate-500 border-slate-200',
  };
  return (
    <Badge className={cn('border text-[10px] font-bold', map[status] ?? 'bg-muted text-muted-foreground border-border')}>
      {status}
    </Badge>
  );
}

function formatDateAR(dateStr?: string) {
  if (!dateStr) return '—';
  const p = dateStr.slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
}

interface ContractDetailPanelProps {
  contract: Contract;
  people: Person[];
  properties: Property[];
  invoices: Invoice[];
  liquidations: Liquidation[];
  tasks: MaintenanceTask[];
  legalCases: LegalCase[];
  onClose: () => void;
}

export function ContractDetailPanel({
  contract,
  people,
  properties,
  invoices,
  liquidations,
  tasks,
  legalCases,
  onClose,
}: ContractDetailPanelProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  // ── Datos del contrato ────────────────────────────────────────────────────
  const tenant = people.find(p => p.id === contract.tenantId);
  const property = properties.find(p => p.id === contract.propertyId);
  const owners = contract.ownerIds?.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
  const guarantors = contract.guarantorIds?.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

  // ── Filtrado por contrato (con fallback a propertyId para datos viejos) ───
  const contractInvoices = invoices.filter(i => i.contractId === contract.id);
  const contractLiquidations = liquidations.filter(
    l => l.contractId === contract.id || (!l.contractId && l.propertyId === contract.propertyId)
  );
  const contractTasks = tasks.filter(
    t => t.contractId === contract.id || (!t.contractId && t.propertyId === contract.propertyId)
  );
  const contractLegal = legalCases.filter(
    l => l.contractId === contract.id || (!l.contractId && l.propertyId === contract.propertyId)
  );

  // ── Archivos adjuntos ─────────────────────────────────────────────────────
  const [fileCategory, setFileCategory] = useState<ContractFileCategory>('comprobante_inquilino');
  const [fileNotes, setFileNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contractFiles: ContractFile[] = contract.contractFiles ?? [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 450_000) {
      toast({ title: 'Archivo demasiado grande', description: 'El archivo debe pesar menos de 450 KB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!db || !user?.uid) return;
      const newFile: ContractFile = {
        id: Math.random().toString(36).slice(2, 9),
        category: fileCategory,
        name: file.name,
        dataUri: ev.target?.result as string,
        uploadedAt: new Date().toISOString(),
        notes: fileNotes.trim() || undefined,
      };
      const updated = [...contractFiles, newFile];
      const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'contratos', contract.id);
      setDocumentNonBlocking(ref, { contractFiles: updated }, { merge: true });
      toast({ title: 'Archivo adjuntado ✓', description: `"${file.name}" guardado en el contrato.` });
      setFileNotes('');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteFile = (fileId: string) => {
    if (!db || !user?.uid) return;
    const updated = contractFiles.filter(f => f.id !== fileId);
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'contratos', contract.id);
    setDocumentNonBlocking(ref, { contractFiles: updated }, { merge: true });
    toast({ title: 'Archivo eliminado' });
  };

  const categoryLabel: Record<ContractFileCategory, string> = {
    comprobante_inquilino: 'Comprobante Inquilino',
    factura_propietario: 'Factura Propietario',
    otro: 'Otro',
  };
  const categoryColor: Record<ContractFileCategory, string> = {
    comprobante_inquilino: 'bg-blue-50 text-blue-700 border-blue-200',
    factura_propietario: 'bg-violet-50 text-violet-700 border-violet-200',
    otro: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  // ── Métricas rápidas ──────────────────────────────────────────────────────
  const totalFacturado = contractInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPagado = contractInvoices.filter(i => i.status === 'Pagado').reduce((s, i) => s + i.totalAmount, 0);
  const totalLiquidado = contractLiquidations.reduce((s, l) => s + l.netAmount, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b bg-gradient-to-r from-primary/5 to-primary/0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-black text-base text-foreground leading-tight">
              {contract.tenantName ?? tenant?.fullName ?? '—'}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {contract.propertyName ?? property?.name ?? '—'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusBadge status={contract.status} />
              <span className="text-[10px] text-muted-foreground">
                {formatDateAR(contract.startDate)} → {formatDateAR(contract.endDate)}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mt-1 -mr-1">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Alquiler Actual</p>
          <p className="text-sm font-black text-primary mt-0.5">
            {contract.currency} {contract.currentRentAmount.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Facturado</p>
          <p className="text-sm font-black text-foreground mt-0.5">
            $ {totalFacturado.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Cobrado</p>
          <p className="text-sm font-black text-green-600 mt-0.5">
            $ {totalPagado.toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumen" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 px-4 pt-3 pb-0 bg-transparent border-b rounded-none justify-start gap-1 h-auto">
          {[
            { value: 'resumen',       label: 'Resumen',       icon: FileText   },
            { value: 'facturas',      label: `Facturas (${contractInvoices.length})`,      icon: Receipt    },
            { value: 'liquidaciones', label: `Liquidaciones (${contractLiquidations.length})`, icon: Calculator },
            { value: 'mantenimiento', label: `Mantenimiento (${contractTasks.length})`,    icon: Wrench     },
            { value: 'documentos',    label: `Docs (${contractFiles.length})`,    icon: FolderOpen },
          ].map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="text-[11px] font-bold h-8 px-3 rounded-t-lg rounded-b-none data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-b-background data-[state=active]:shadow-none border-transparent"
            >
              <t.icon className="h-3 w-3 mr-1.5" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="flex-1">
          {/* ── RESUMEN ── */}
          <TabsContent value="resumen" className="p-5 space-y-5 mt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Partes */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Partes del Contrato</h3>
                <InfoRow icon={User} label="Inquilino" value={tenant?.fullName ?? contract.tenantName ?? '—'} sub={tenant?.email} />
                {owners.length > 0 && owners.map(o => (
                  <InfoRow key={o.id} icon={User} label="Propietario" value={o.fullName} sub={o.email} />
                ))}
                {guarantors.length > 0 && guarantors.map(g => (
                  <InfoRow key={g.id} icon={User} label="Garante" value={g.fullName} sub={g.email} />
                ))}
                <InfoRow icon={Building} label="Propiedad" value={property?.name ?? contract.propertyName ?? '—'} sub={property?.address} />
              </div>

              {/* Plazos y montos */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Condiciones Económicas</h3>
                <InfoRow icon={Calendar} label="Inicio" value={formatDateAR(contract.startDate)} />
                <InfoRow icon={Calendar} label="Vencimiento" value={formatDateAR(contract.endDate)} />
                <InfoRow icon={DollarSign} label="Alquiler Base" value={`${contract.currency} ${contract.baseRentAmount.toLocaleString('es-AR')}`} />
                <InfoRow icon={DollarSign} label="Alquiler Actual" value={`${contract.currency} ${contract.currentRentAmount.toLocaleString('es-AR')}`} />
                <InfoRow icon={DollarSign} label="Depósito" value={`${contract.depositCurrency} ${contract.depositAmount.toLocaleString('es-AR')}`} />
                <InfoRow icon={Calendar} label="Ajuste" value={`${contract.adjustmentMechanism ?? '—'} cada ${contract.adjustmentFrequencyMonths} meses`} />
              </div>
            </div>

            {/* Resumen financiero del contrato */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
              <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-3">Resumen Financiero</h3>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Facturas" value={contractInvoices.length} />
                <MetricCard label="Pagas" value={contractInvoices.filter(i => i.status === 'Pagado').length} color="green" />
                <MetricCard label="Pendientes" value={contractInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido').length} color="amber" />
                <MetricCard label="Liquidaciones" value={contractLiquidations.length} />
                <MetricCard label="Neto Liquidado" value={`$${Math.round(totalLiquidado / 1000)}k`} color="green" />
                <MetricCard label="Tareas Mant." value={contractTasks.length} />
              </div>
            </div>
          </TabsContent>

          {/* ── FACTURAS ── */}
          <TabsContent value="facturas" className="p-5 mt-0">
            {contractInvoices.length === 0 ? (
              <EmptyMsg icon={Receipt} text="No hay facturas para este contrato." />
            ) : (
              <div className="space-y-2">
                {[...contractInvoices]
                  .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
                  .map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/10">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{inv.period}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {formatDateAR(inv.dueDate)}</p>
                      </div>
                      <p className="font-black text-sm text-primary shrink-0">
                        {inv.currency} {inv.totalAmount.toLocaleString('es-AR')}
                      </p>
                      <StatusBadge status={inv.status} />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ── LIQUIDACIONES ── */}
          <TabsContent value="liquidaciones" className="p-5 mt-0">
            {contractLiquidations.length === 0 ? (
              <EmptyMsg icon={Calculator} text="No hay liquidaciones para este contrato." />
            ) : (
              <div className="space-y-2">
                {[...contractLiquidations]
                  .sort((a, b) => (b.dateCreated ?? '').localeCompare(a.dateCreated ?? ''))
                  .map(liq => (
                    <div key={liq.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/10">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{liq.period}</p>
                        <p className="text-[10px] text-muted-foreground">{liq.ownerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-green-600">$ {liq.netAmount.toLocaleString('es-AR')}</p>
                        <p className="text-[10px] text-muted-foreground">Ingreso: ${liq.ingresoAlquiler.toLocaleString('es-AR')}</p>
                      </div>
                      <StatusBadge status={liq.status} />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ── MANTENIMIENTO ── */}
          <TabsContent value="mantenimiento" className="p-5 mt-0">
            {contractTasks.length === 0 ? (
              <EmptyMsg icon={Wrench} text="No hay tareas de mantenimiento para este contrato." />
            ) : (
              <div className="space-y-2">
                {[...contractTasks]
                  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                  .map(task => (
                    <div key={task.id} className="p-3 rounded-xl border border-border/50 hover:bg-muted/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{task.concept}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Costo estimado: ${task.estimatedCost.toLocaleString('es-AR')}</span>
                        {task.contractorName && <span>Contratista: {task.contractorName}</span>}
                        <span>Cargo: {task.chargedTo ?? '—'}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ── DOCUMENTOS ── */}
          <TabsContent value="documentos" className="p-5 mt-0 space-y-5">
            {/* Upload nuevo */}
            <div className="rounded-xl border-2 border-dashed border-border/60 p-4 space-y-3 bg-muted/10">
              <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Agregar Documento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Categoría</Label>
                  <Select value={fileCategory} onValueChange={(v) => setFileCategory(v as ContractFileCategory)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprobante_inquilino">Comprobante Inquilino</SelectItem>
                      <SelectItem value="factura_propietario">Factura Propietario</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nota (opcional)</Label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                    placeholder="Ej: Mayo 2025"
                    value={fileNotes}
                    onChange={e => setFileNotes(e.target.value)}
                  />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2 font-bold"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-3.5 w-3.5" />
                {isUploading ? 'Subiendo…' : 'Seleccionar archivo (máx 450 KB)'}
              </Button>
            </div>

            {/* Lista de archivos */}
            {contractFiles.length === 0 ? (
              <EmptyMsg icon={FolderOpen} text="Sin archivos adjuntos. Podés subir comprobantes del inquilino y facturas del propietario." />
            ) : (
              <div className="space-y-2">
                {contractFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge className={cn('border text-[9px] font-bold shrink-0', categoryColor[f.category])}>
                          {categoryLabel[f.category]}
                        </Badge>
                        <p className="font-bold text-xs truncate">{f.name}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateAR(f.uploadedAt.slice(0, 10))}
                        {f.notes && <span> · {f.notes}</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        title="Descargar"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = f.dataUri;
                          a.download = f.name;
                          a.click();
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Eliminar"
                        onClick={() => handleDeleteFile(f.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documentos del contrato propiamente dicho */}
            {contract.documents?.mainContractName && (
              <div className="pt-3 border-t space-y-2">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Contrato Original</h3>
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold flex-1 truncate">{contract.documents.mainContractName}</span>
                </div>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ── Subcomponentes de utilidad ─────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-6 w-6 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">{label}</p>
        <p className="text-xs font-bold text-foreground truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number | string; color?: 'green' | 'amber' }) {
  return (
    <div className="bg-background rounded-lg border p-2.5 text-center">
      <p className={cn('text-base font-black', color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-foreground')}>
        {value}
      </p>
      <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{label}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Urgente: 'bg-red-50 text-red-700 border-red-200',
    Alta: 'bg-orange-50 text-orange-700 border-orange-200',
    Media: 'bg-amber-50 text-amber-700 border-amber-200',
    Baja: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <Badge className={cn('border text-[9px] font-bold', map[priority] ?? 'bg-muted text-muted-foreground border-border')}>
      {priority}
    </Badge>
  );
}

function EmptyMsg({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
