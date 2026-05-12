"use client";

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Home, Edit2, ExternalLink, FileText, Wrench, Users, Receipt, CalendarClock, Shield, AlertTriangle, MapPin, Building2, Sparkles, Download, Upload, Save, ChevronRight, Calendar, DollarSign, TrendingUp, FolderOpen, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Property, Contract, Invoice, Liquidation, MaintenanceTask, RentalApplication, LegalCase, ReserveFund, Currency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';

interface PropertyDetailViewProps {
  property: Property;
  userId?: string;
  contracts: Contract[];
  invoices: Invoice[];
  liquidations: Liquidation[];
  tasks: MaintenanceTask[];
  applications: RentalApplication[];
  legalCases?: LegalCase[];
  reserveFunds?: ReserveFund[];
  onBack: () => void;
  onEditTechnical: (p: Property) => void;
  onShare?: (p: Property) => void;
  onOpenContract?: (c: Contract) => void;
}

export function PropertyDetailView({
  property, userId, contracts, invoices, liquidations, tasks, applications,
  legalCases = [], reserveFunds = [],
  onBack, onEditTechnical, onShare, onOpenContract,
}: PropertyDetailViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<string>('resumen');

  // ── Datos filtrados ──────────────────────────────────────────────────────
  const propContracts = useMemo(() => contracts.filter(c => c.propertyId === property.id), [contracts, property.id]);
  const activeContract = propContracts.find(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer');
  const propInvoices = useMemo(() => invoices.filter(i => propContracts.some(c => c.id === i.contractId) || i.propertyId === property.id), [invoices, propContracts, property.id]);
  const pendingInvoices = propInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
  const paidInvoices = propInvoices.filter(i => i.status === 'Pagado');
  const propLiqs = useMemo(() => liquidations.filter(l => l.propertyId === property.id), [liquidations, property.id]);
  const propTasks = useMemo(() => tasks.filter(t => t.propertyId === property.id), [tasks, property.id]);
  const openTasks = propTasks.filter(t => t.status !== 'Completado' && t.status !== 'Cerrado');
  const propApps = useMemo(() => applications.filter(a => a.propertyId === property.id), [applications, property.id]);
  const newApps = propApps.filter(a => a.status === 'Nueva');
  const propCases = useMemo(() => legalCases.filter(c => c.propertyId === property.id), [legalCases, property.id]);
  const propReserves = useMemo(() => reserveFunds.filter(r => r.propertyId === property.id), [reserveFunds, property.id]);

  const totalCollected = paidInvoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const totalPending = pendingInvoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const daysToExpire = activeContract
    ? Math.round((new Date(activeContract.endDate).getTime() - Date.now()) / 86_400_000)
    : null;

  // ── Form de seguros (edición inline) ─────────────────────────────────────
  const [insurance, setInsurance] = useState(property.insurance ?? {});
  const [savingInsurance, setSavingInsurance] = useState(false);
  const handleSaveInsurance = () => {
    if (!db || !userId) return;
    setSavingInsurance(true);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', property.id);
    setDocumentNonBlocking(ref, { ...property, insurance }, { merge: true });
    setTimeout(() => {
      setSavingInsurance(false);
      toast({ title: 'Seguro actualizado', description: 'La póliza se guardó correctamente.' });
    }, 400);
  };

  const insuranceDaysLeft = insurance?.endDate
    ? Math.round((new Date(insurance.endDate).getTime() - Date.now()) / 86_400_000)
    : null;

  // ── Notas internas (edición inline) ──────────────────────────────────────
  const [notes, setNotes] = useState(property.internalNotes ?? '');
  const handleSaveNotes = () => {
    if (!db || !userId) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', property.id);
    setDocumentNonBlocking(ref, { ...property, internalNotes: notes }, { merge: true });
    toast({ title: 'Notas guardadas' });
  };

  const formatCurrency = (n: number, c: Currency = 'ARS') => `${c} ${n.toLocaleString('es-AR')}`;

  return (
    <div className="space-y-4 pb-12">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="relative">
          {property.photos?.[0] ? (
            <img src={property.photos[0]} alt={property.name} className="w-full h-44 object-cover" />
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Home className="h-16 w-16 text-primary/40" />
            </div>
          )}
          <button
            onClick={onBack}
            className="absolute top-3 left-3 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-colors"
            aria-label="Volver a Propiedades"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Badge className={cn(
            'absolute top-3 right-3 border-none',
            property.status === 'Disponible' && 'bg-green-100 text-green-700',
            property.status === 'Reservada' && 'bg-blue-100 text-blue-700',
            property.status === 'Alquilada' && 'bg-gray-100 text-gray-700',
            property.status === 'En Mantenimiento' && 'bg-orange-100 text-orange-700',
          )}>
            {property.status}
          </Badge>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black leading-tight">{property.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{property.address}{property.unit ? ` · ${property.unit}` : ''}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span className="font-bold uppercase">{property.type}</span>
                {property.rooms ? <><span>·</span><span>{property.rooms} amb.</span></> : null}
                {property.squareMeters ? <><span>·</span><span>{property.squareMeters} m²</span></> : null}
                {property.usage ? <><span>·</span><span>{property.usage}</span></> : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onShare && (
                <Button size="sm" variant="outline" onClick={() => onShare(property)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Compartir
                </Button>
              )}
              <Button size="sm" onClick={() => onEditTechnical(property)} className="gap-2">
                <Edit2 className="h-4 w-4" />
                Editar datos
              </Button>
            </div>
          </div>

          {/* ── KPIs rápidos ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
            <KpiCell icon={<Receipt className="h-4 w-4 text-amber-600" />} label="Pendiente" value={formatCurrency(totalPending)} accent={pendingInvoices.length > 0 ? 'amber' : undefined} />
            <KpiCell icon={<Wrench className="h-4 w-4 text-red-600" />} label="Mantenimiento" value={`${openTasks.length} abiertas`} accent={openTasks.length > 0 ? 'red' : undefined} />
            <KpiCell icon={<Users className="h-4 w-4 text-blue-600" />} label="Postulantes" value={`${newApps.length} nuevos`} accent={newApps.length > 0 ? 'blue' : undefined} />
            <KpiCell
              icon={<CalendarClock className="h-4 w-4 text-primary" />}
              label="Contrato"
              value={daysToExpire !== null ? `Vence en ${daysToExpire}d` : 'Sin contrato'}
              accent={daysToExpire !== null && daysToExpire <= 30 ? 'red' : daysToExpire !== null && daysToExpire <= 60 ? 'amber' : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start border-b rounded-none h-auto bg-transparent p-0 gap-1 overflow-x-auto flex-nowrap">
          {[
            { id: 'resumen',   label: 'Resumen',         icon: TrendingUp },
            { id: 'contratos', label: 'Contratos',       icon: FileText, count: propContracts.length },
            { id: 'pagos',     label: 'Pagos',           icon: Receipt, count: propInvoices.length },
            { id: 'liqs',      label: 'Liquidaciones',   icon: DollarSign, count: propLiqs.length },
            { id: 'mant',      label: 'Mantenimiento',   icon: Wrench, count: propTasks.length, badge: openTasks.length },
            { id: 'postul',    label: 'Postulantes',     icon: Users, count: propApps.length, badge: newApps.length },
            { id: 'legal',     label: 'Legal',           icon: AlertTriangle, count: propCases.length },
            { id: 'seguro',    label: 'Seguros',         icon: Shield, badge: insuranceDaysLeft !== null && insuranceDaysLeft <= 30 ? 1 : 0 },
            { id: 'reserva',   label: 'Reserva',         icon: Building2, count: propReserves.length },
            { id: 'docs',      label: 'Docs / Notas',    icon: FolderOpen },
            { id: 'owners',    label: 'Propietarios',    icon: Users, count: property.owners?.length ?? 0 },
          ].map(t => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent flex items-center gap-1.5 px-3 py-2 whitespace-nowrap text-sm"
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="text-[10px] text-muted-foreground">({t.count})</span>
              )}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span className="h-4 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center">{t.badge}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Resumen ─────────────────────────────────────────────────── */}
        <TabsContent value="resumen" className="pt-6 space-y-4">
          <Section title="Contrato vigente" icon={<FileText className="h-4 w-4 text-primary" />}>
            {activeContract ? (
              <div
                className="rounded-xl border p-4 hover:bg-muted/30 cursor-pointer"
                onClick={() => onOpenContract?.(activeContract)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{activeContract.tenantName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(activeContract.currentRentAmount, activeContract.currency)}/mes · Vence {new Date(activeContract.endDate).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <Badge className={cn(activeContract.status === 'Vigente' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {activeContract.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <Empty>Sin contrato vigente. Generá uno desde Contratos.</Empty>
            )}
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Recaudación histórica" icon={<TrendingUp className="h-4 w-4 text-green-600" />}>
              <div className="space-y-1.5">
                <p className="text-2xl font-black text-green-700">{formatCurrency(totalCollected)}</p>
                <p className="text-xs text-muted-foreground">{paidInvoices.length} facturas pagadas</p>
              </div>
            </Section>
            <Section title="Pendiente de cobro" icon={<Receipt className="h-4 w-4 text-amber-600" />}>
              <div className="space-y-1.5">
                <p className="text-2xl font-black text-amber-700">{formatCurrency(totalPending)}</p>
                <p className="text-xs text-muted-foreground">{pendingInvoices.length} facturas sin pagar</p>
              </div>
            </Section>
          </div>

          {(openTasks.length > 0 || newApps.length > 0 || (insuranceDaysLeft !== null && insuranceDaysLeft <= 60)) && (
            <Section title="Acciones requeridas" icon={<AlertTriangle className="h-4 w-4 text-red-600" />}>
              <div className="space-y-1.5">
                {openTasks.length > 0 && <AlertRow color="red" text={`${openTasks.length} tareas de mantenimiento abiertas`} onClick={() => setActiveTab('mant')} />}
                {newApps.length > 0 && <AlertRow color="blue" text={`${newApps.length} postulantes nuevos sin revisar`} onClick={() => setActiveTab('postul')} />}
                {insuranceDaysLeft !== null && insuranceDaysLeft <= 60 && (
                  <AlertRow
                    color={insuranceDaysLeft <= 30 ? 'red' : 'amber'}
                    text={insuranceDaysLeft <= 0 ? 'Seguro vencido' : `Seguro vence en ${insuranceDaysLeft} días`}
                    onClick={() => setActiveTab('seguro')}
                  />
                )}
              </div>
            </Section>
          )}
        </TabsContent>

        {/* ── Contratos ───────────────────────────────────────────────── */}
        <TabsContent value="contratos" className="pt-6 space-y-2">
          {propContracts.length === 0 ? (
            <Empty>No hay contratos vinculados a esta propiedad.</Empty>
          ) : propContracts.map(c => (
            <button
              key={c.id}
              onClick={() => onOpenContract?.(c)}
              className="w-full text-left rounded-xl border p-4 hover:bg-muted/30 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold">{c.tenantName ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(c.currentRentAmount, c.currency)}/mes · {new Date(c.startDate).toLocaleDateString('es-AR')} → {new Date(c.endDate).toLocaleDateString('es-AR')}
                </p>
              </div>
              <Badge className={cn(
                c.status === 'Vigente' ? 'bg-green-100 text-green-700' :
                c.status === 'Próximo a Vencer' ? 'bg-amber-100 text-amber-700' :
                c.status === 'Finalizado' ? 'bg-slate-100 text-slate-600' :
                'bg-muted text-muted-foreground'
              )}>{c.status}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </TabsContent>

        {/* ── Pagos / Facturas ────────────────────────────────────────── */}
        <TabsContent value="pagos" className="pt-6 space-y-2">
          {propInvoices.length === 0 ? (
            <Empty>Sin facturas registradas.</Empty>
          ) : propInvoices
            .slice()
            .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))
            .map(i => (
              <div key={i.id} className="rounded-xl border p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{i.period}</p>
                    <span className="text-xs text-muted-foreground">{i.tenantName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vence {new Date(i.dueDate).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm">{formatCurrency(i.totalAmount, i.currency)}</p>
                  <Badge className={cn('mt-0.5 text-[9px]',
                    i.status === 'Pagado' ? 'bg-green-100 text-green-700' :
                    i.status === 'Pendiente' ? 'bg-amber-100 text-amber-700' :
                    i.status === 'Vencido' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  )}>{i.status}</Badge>
                </div>
              </div>
            ))}
        </TabsContent>

        {/* ── Liquidaciones ───────────────────────────────────────────── */}
        <TabsContent value="liqs" className="pt-6 space-y-2">
          {propLiqs.length === 0 ? (
            <Empty>Sin liquidaciones generadas para esta propiedad.</Empty>
          ) : propLiqs
            .slice()
            .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
            .map(l => (
              <div key={l.id} className="rounded-xl border p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{l.period}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Para {l.ownerEmail ?? l.ownerName ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm">{formatCurrency(l.netAmount ?? 0, (l as any).currency ?? 'ARS')}</p>
                  <Badge className="mt-0.5 text-[9px] bg-slate-100 text-slate-600">{l.status ?? '—'}</Badge>
                </div>
              </div>
            ))}
        </TabsContent>

        {/* ── Mantenimiento ───────────────────────────────────────────── */}
        <TabsContent value="mant" className="pt-6 space-y-2">
          {propTasks.length === 0 ? (
            <Empty>Sin tareas de mantenimiento.</Empty>
          ) : propTasks
            .slice()
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
            .map(t => (
              <div key={t.id} className="rounded-xl border p-4 flex items-center gap-3">
                <div className={cn('h-2 w-2 rounded-full shrink-0',
                  t.priority === 'Urgente' || t.priority === 'Alta' ? 'bg-red-500' :
                  t.priority === 'Media' ? 'bg-amber-500' : 'bg-slate-300'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{t.concept}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {t.contractorName && <span>👷 {t.contractorName}</span>}
                    {t.actualCost > 0 && <span>· ${t.actualCost.toLocaleString('es-AR')}</span>}
                  </div>
                </div>
                <Badge className={cn('text-[9px]',
                  t.status === 'Completado' || t.status === 'Cerrado' ? 'bg-green-100 text-green-700' :
                  t.status === 'En curso' ? 'bg-blue-100 text-blue-700' :
                  t.status === 'Presupuestado' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                )}>{t.status}</Badge>
              </div>
            ))}
        </TabsContent>

        {/* ── Postulantes ─────────────────────────────────────────────── */}
        <TabsContent value="postul" className="pt-6 space-y-2">
          {propApps.length === 0 ? (
            <Empty>No hay postulantes para esta propiedad.</Empty>
          ) : propApps
            .slice()
            .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
            .map(a => (
              <div key={a.id} className="rounded-xl border p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary">
                  {(a.applicantName ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{a.applicantName}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {a.applicantEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.applicantEmail}</span>}
                    {a.applicantPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.applicantPhone}</span>}
                  </div>
                  {a.ingreso > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos: {formatCurrency(a.ingreso, (a.currency ?? 'ARS') as Currency)}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge className={cn('text-[9px]',
                    a.status === 'Nueva' ? 'bg-blue-100 text-blue-700' :
                    a.status === 'Aprobada' ? 'bg-green-100 text-green-700' :
                    a.status === 'Rechazada' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  )}>{a.status}</Badge>
                  {a.aiAnalysis && <p className="text-[10px] text-muted-foreground mt-1">Score IA: {a.aiAnalysis.score}</p>}
                </div>
              </div>
            ))}
        </TabsContent>

        {/* ── Legales ─────────────────────────────────────────────────── */}
        <TabsContent value="legal" className="pt-6 space-y-2">
          {propCases.length === 0 ? (
            <Empty>Sin causas legales asociadas.</Empty>
          ) : propCases.map(c => (
            <div key={c.id} className="rounded-xl border p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">{c.type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.tenantName ?? '—'}</p>
              </div>
              <Badge className="text-[9px] bg-slate-100 text-slate-600">{c.status}</Badge>
            </div>
          ))}
        </TabsContent>

        {/* ── Seguros ─────────────────────────────────────────────────── */}
        <TabsContent value="seguro" className="pt-6 space-y-4">
          <div className="rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-black">Póliza de seguro</h3>
              </div>
              {insuranceDaysLeft !== null && (
                <Badge className={cn(
                  insuranceDaysLeft <= 0 ? 'bg-red-100 text-red-700' :
                  insuranceDaysLeft <= 30 ? 'bg-red-100 text-red-700' :
                  insuranceDaysLeft <= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {insuranceDaysLeft <= 0 ? 'Vencida' : `Vence en ${insuranceDaysLeft}d`}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Compañía">
                <Input
                  value={insurance?.company ?? ''}
                  onChange={e => setInsurance({ ...insurance, company: e.target.value })}
                  placeholder="Ej: Sancor, Federación Patronal"
                />
              </Field>
              <Field label="N° de póliza">
                <Input
                  value={insurance?.policyNumber ?? ''}
                  onChange={e => setInsurance({ ...insurance, policyNumber: e.target.value })}
                />
              </Field>
              <Field label="Tipo de cobertura">
                <Input
                  value={insurance?.type ?? ''}
                  onChange={e => setInsurance({ ...insurance, type: e.target.value })}
                  placeholder="Integral de hogar, Caución, etc."
                />
              </Field>
              <Field label="Pagado por">
                <Select value={insurance?.paidBy ?? 'Propietario'} onValueChange={(v: any) => setInsurance({ ...insurance, paidBy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Propietario">Propietario</SelectItem>
                    <SelectItem value="Inquilino">Inquilino</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Suma asegurada">
                <div className="flex gap-2">
                  <Select value={insurance?.currency ?? 'ARS'} onValueChange={(v: any) => setInsurance({ ...insurance, currency: v })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={insurance?.coverageAmount ?? ''}
                    onChange={e => setInsurance({ ...insurance, coverageAmount: Number(e.target.value) || 0 })}
                  />
                </div>
              </Field>
              <Field label="Premio mensual">
                <Input
                  type="number"
                  value={insurance?.monthlyPremium ?? ''}
                  onChange={e => setInsurance({ ...insurance, monthlyPremium: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Inicio de vigencia">
                <Input
                  type="date"
                  value={insurance?.startDate ?? ''}
                  onChange={e => setInsurance({ ...insurance, startDate: e.target.value })}
                />
              </Field>
              <Field label="Vencimiento">
                <Input
                  type="date"
                  value={insurance?.endDate ?? ''}
                  onChange={e => setInsurance({ ...insurance, endDate: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Notas">
              <Textarea
                rows={3}
                value={insurance?.notes ?? ''}
                onChange={e => setInsurance({ ...insurance, notes: e.target.value })}
                placeholder="Cláusulas especiales, contacto del broker, etc."
              />
            </Field>

            {insurance?.fileUrl && (
              <a href={insurance.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                <Download className="h-4 w-4" /> {insurance.fileName ?? 'Descargar póliza PDF'}
              </a>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSaveInsurance} disabled={savingInsurance} className="gap-2">
                <Save className="h-4 w-4" />
                {savingInsurance ? 'Guardando...' : 'Guardar póliza'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Reservas ───────────────────────────────────────────────── */}
        <TabsContent value="reserva" className="pt-6 space-y-2">
          {propReserves.length === 0 ? (
            <Empty>Sin fondos de reserva configurados.</Empty>
          ) : propReserves.map(r => {
            const pct = r.targetAmount > 0 ? Math.min(100, Math.round((r.currentAmount / r.targetAmount) * 100)) : 0;
            return (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{r.category}</p>
                    {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                  </div>
                  <p className="text-sm font-black">{pct}%</p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${r.currentAmount.toLocaleString('es-AR')} / ${r.targetAmount.toLocaleString('es-AR')}
                </p>
              </div>
            );
          })}
        </TabsContent>

        {/* ── Docs / Notas ────────────────────────────────────────────── */}
        <TabsContent value="docs" className="pt-6 space-y-4">
          <Section title="Notas internas" icon={<FolderOpen className="h-4 w-4 text-primary" />}>
            <Textarea
              rows={6}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas privadas sobre la propiedad..."
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleSaveNotes} className="gap-2">
                <Save className="h-4 w-4" /> Guardar notas
              </Button>
            </div>
          </Section>

          <Section title={`Manuales (${property.manuals?.length ?? 0})`} icon={<FileText className="h-4 w-4 text-primary" />}>
            {(!property.manuals || property.manuals.length === 0) ? (
              <Empty>No hay manuales cargados. Agregalos desde "Editar datos".</Empty>
            ) : property.manuals.map((m, i) => (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.sizeLabel}</p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </Section>

          {property.virtualTourUrl && (
            <Section title="Tour virtual" icon={<ExternalLink className="h-4 w-4 text-primary" />}>
              <a href={property.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                {property.virtualTourUrl}
              </a>
            </Section>
          )}
        </TabsContent>

        {/* ── Propietarios ────────────────────────────────────────────── */}
        <TabsContent value="owners" className="pt-6 space-y-2">
          {(!property.owners || property.owners.length === 0) ? (
            <Empty>Sin propietarios asignados. Cargá uno desde "Editar datos".</Empty>
          ) : property.owners.map((o, i) => (
            <div key={i} className="rounded-xl border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary">
                {(o.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{o.name}</p>
                <p className="text-xs text-muted-foreground">{o.email}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-lg text-primary">{o.percentage}%</p>
                <p className="text-[10px] text-muted-foreground">titularidad</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function KpiCell({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: 'amber' | 'red' | 'blue' }) {
  return (
    <div className={cn(
      'rounded-lg p-2.5 border',
      accent === 'red' && 'border-red-200 bg-red-50',
      accent === 'amber' && 'border-amber-200 bg-amber-50',
      accent === 'blue' && 'border-blue-200 bg-blue-50',
    )}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-sm font-black mt-1">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="rounded-xl border bg-card p-4 space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic text-center py-6">{children}</p>;
}

function AlertRow({ color, text, onClick }: { color: 'red' | 'amber' | 'blue'; text: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-colors text-left',
        color === 'red' && 'bg-red-50 text-red-700 hover:bg-red-100',
        color === 'amber' && 'bg-amber-50 text-amber-700 hover:bg-amber-100',
        color === 'blue' && 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      )}
    >
      <span>{text}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
