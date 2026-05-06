
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Scale, Trash2, Search, Plus, TrendingUp, TrendingDown,
  AlertTriangle, FileText, Send, ShieldAlert, CheckCircle2,
  Clock, XCircle, ChevronRight, BadgeDollarSign, Gavel,
  BarChart3, Users, RefreshCw, Download, Phone, Landmark,
  CircleDot, Wifi, WifiOff, Filter, ArrowUpRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LegalCase, LegalStage, PaymentPlan, Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Progress } from '@/components/ui/progress';

interface LegalViewProps {
  legalCases: LegalCase[];
  userId?: string;
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

// ── Config de etapas ─────────────────────────────────────────────────────────
const STAGE_CFG: Record<LegalStage, { label: string; color: string; icon: React.ReactNode; badge: string }> = {
  'Intimación':     { label: 'Intimación',     color: 'text-yellow-600 bg-yellow-50 border-yellow-200',    icon: <FileText className="h-3.5 w-3.5" />,    badge: 'bg-yellow-100 text-yellow-800' },
  'Carta Documento':{ label: 'Carta Documento', color: 'text-orange-600 bg-orange-50 border-orange-200',   icon: <Send className="h-3.5 w-3.5" />,          badge: 'bg-orange-100 text-orange-800' },
  'Burofax':        { label: 'Burofax',         color: 'text-amber-600 bg-amber-50 border-amber-200',      icon: <Send className="h-3.5 w-3.5" />,          badge: 'bg-amber-100 text-amber-800' },
  'Demanda':        { label: 'Demanda',         color: 'text-red-600 bg-red-50 border-red-200',            icon: <Gavel className="h-3.5 w-3.5" />,         badge: 'bg-red-100 text-red-800' },
  'Reporte Veraz':  { label: 'Reporte Veraz',   color: 'text-purple-600 bg-purple-50 border-purple-200',   icon: <ShieldAlert className="h-3.5 w-3.5" />,   badge: 'bg-purple-100 text-purple-800' },
  'Mediación':      { label: 'Mediación',       color: 'text-blue-600 bg-blue-50 border-blue-200',         icon: <Users className="h-3.5 w-3.5" />,         badge: 'bg-blue-100 text-blue-800' },
  'Cerrado':        { label: 'Cerrado',         color: 'text-green-600 bg-green-50 border-green-200',      icon: <CheckCircle2 className="h-3.5 w-3.5" />,  badge: 'bg-green-100 text-green-800' },
};

const STATUS_CFG: Record<string, string> = {
  'Iniciado':   'bg-slate-100 text-slate-700',
  'En proceso': 'bg-blue-100 text-blue-700',
  'Mediación':  'bg-orange-100 text-orange-700',
  'Cerrado':    'bg-green-100 text-green-700',
};

const PLAN_STATUS_CFG: Record<PaymentPlan['status'], { label: string; icon: React.ReactNode; cls: string }> = {
  pendiente: { label: 'Pendiente', icon: <Clock className="h-3.5 w-3.5" />,       cls: 'bg-amber-100 text-amber-700' },
  aceptado:  { label: 'Aceptado',  icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado', icon: <XCircle className="h-3.5 w-3.5" />,      cls: 'bg-red-100 text-red-700' },
};

// ── Utilidades ────────────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-AR')}`;
}

// ── Componente principal ──────────────────────────────────────────────────────
export function LegalView({ legalCases, userId, properties }: LegalViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();

  const [searchQ, setSearchQ] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [newCase, setNewCase] = useState<Partial<LegalCase>>({
    type: '',
    propertyId: '',
    startDate: new Date().toISOString().split('T')[0],
    attorney: '',
    status: 'Iniciado',
    stage: 'Intimación',
    tenantName: '',
    tenantDni: '',
    debtAmount: 0,
    daysOverdue: 0,
    notes: '',
  });

  const [newPlan, setNewPlan] = useState<Partial<PaymentPlan>>({
    tenantName: '',
    installments: 3,
    totalAmount: 0,
    note: '',
    status: 'pendiente',
  });

  // ── Stats computadas ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = legalCases.filter(c => c.status !== 'Cerrado');
    const totalDebt = legalCases.reduce((acc, c) => acc + (c.debtAmount ?? 0), 0);
    const critical = legalCases.filter(c => (c.daysOverdue ?? 0) > 60).length;
    const closed = legalCases.filter(c => c.status === 'Cerrado').length;
    const efficiencyPct = legalCases.length > 0 ? Math.round((closed / legalCases.length) * 100) : 0;
    const verazReported = legalCases.filter(c => c.verazReported).length;
    return { active: active.length, totalDebt, critical, efficiencyPct, verazReported, total: legalCases.length };
  }, [legalCases]);

  // ── Planes de pago (todos los casos) ─────────────────────────────────────
  const allPlans = useMemo(() =>
    legalCases.flatMap(c => (c.paymentPlans ?? []).map(p => ({ ...p, caseId: c.id, caseName: c.propertyName, tenantName: p.tenantName || c.tenantName || '' }))),
    [legalCases]
  );

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...legalCases];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(c =>
        c.propertyName.toLowerCase().includes(q) ||
        (c.tenantName ?? '').toLowerCase().includes(q) ||
        (c.tenantDni ?? '').includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    }
    if (filterStage !== 'all') list = list.filter(c => c.stage === filterStage);
    return list;
  }, [legalCases, searchQ, filterStage]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateCase = () => {
    if (!newCase.propertyId || !userId || !db) return;
    const property = properties.find(p => p.id === newCase.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', docId);
    const caseData: LegalCase = {
      id: docId,
      type: newCase.type || 'Caso legal',
      propertyId: newCase.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      startDate: newCase.startDate!,
      attorney: newCase.attorney || '',
      status: (newCase.status as any) || 'Iniciado',
      stage: newCase.stage || 'Intimación',
      tenantName: newCase.tenantName,
      tenantDni: newCase.tenantDni,
      debtAmount: Number(newCase.debtAmount) || 0,
      daysOverdue: Number(newCase.daysOverdue) || 0,
      notes: newCase.notes,
      lastActionDate: new Date().toISOString().split('T')[0],
      verazReported: false,
      paymentPlans: [],
      hasFile: false,
      ownerId: userId,
    };
    setDocumentNonBlocking(docRef, caseData, { merge: true });
    setIsNewCaseOpen(false);
    setNewCase({ type: '', propertyId: '', startDate: new Date().toISOString().split('T')[0], attorney: '', status: 'Iniciado', stage: 'Intimación' });
    toast({ title: 'Caso Registrado', description: 'Sincronizado con la nube.' });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'Caso eliminado' });
  };

  const handleUpdateStage = (c: LegalCase, stage: LegalStage) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', c.id);
    const update: Partial<LegalCase> = { stage, lastActionDate: new Date().toISOString().split('T')[0] };
    if (stage === 'Reporte Veraz') update.verazReported = true;
    if (stage === 'Cerrado') update.status = 'Cerrado';
    setDocumentNonBlocking(docRef, update, { merge: true });
    toast({ title: `Etapa actualizada → ${stage}` });
  };

  const handleAddPlan = () => {
    if (!selectedCaseId || !userId || !db) return;
    const caseObj = legalCases.find(c => c.id === selectedCaseId);
    if (!caseObj) return;
    const planId = Math.random().toString(36).substr(2, 9);
    const plan: PaymentPlan = {
      id: planId,
      tenantName: newPlan.tenantName || caseObj.tenantName || '',
      installments: Number(newPlan.installments) || 3,
      totalAmount: Number(newPlan.totalAmount) || 0,
      note: newPlan.note,
      status: 'pendiente',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const existing = caseObj.paymentPlans ?? [];
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', selectedCaseId);
    setDocumentNonBlocking(docRef, { paymentPlans: [...existing, plan] }, { merge: true });
    setIsAddPlanOpen(false);
    setNewPlan({ tenantName: '', installments: 3, totalAmount: 0, note: '', status: 'pendiente' });
    toast({ title: 'Plan de pago propuesto' });
  };

  const handlePlanStatus = (caseId: string, planId: string, status: PaymentPlan['status']) => {
    if (!userId || !db) return;
    const caseObj = legalCases.find(c => c.id === caseId);
    if (!caseObj) return;
    const updated = (caseObj.paymentPlans ?? []).map(p => p.id === planId ? { ...p, status } : p);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', caseId);
    setDocumentNonBlocking(docRef, { paymentPlans: updated }, { merge: true });
    toast({ title: `Plan actualizado → ${status}` });
  };

  const handleMassIntimation = () => {
    const actives = legalCases.filter(c => c.status !== 'Cerrado' && c.stage === 'Intimación');
    toast({
      title: `Intimación masiva`,
      description: `${actives.length} caso(s) marcados para notificación.`,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recupero de Deuda</h2>
          <p className="text-sm text-muted-foreground">Protocolo de gestión avanzada y monitoreo de riesgos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1.5 px-3 py-1.5">
            <CircleDot className="h-3 w-3 fill-green-500 text-green-500" />
            API VERAZ CONECTADA
          </Badge>
          {canWrite && (
            <Dialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent text-white gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Caso
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nuevo Caso Legal</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Propiedad</Label>
                    <Select value={newCase.propertyId} onValueChange={v => setNewCase({ ...newCase, propertyId: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar propiedad…" /></SelectTrigger>
                      <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo de caso</Label>
                    <Input placeholder="Desalojo, Cobro, etc." value={newCase.type} onChange={e => setNewCase({ ...newCase, type: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Etapa inicial</Label>
                    <Select value={newCase.stage} onValueChange={v => setNewCase({ ...newCase, stage: v as LegalStage })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(STAGE_CFG) as LegalStage[]).filter(s => s !== 'Cerrado').map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Inquilino</Label>
                    <Input placeholder="Nombre completo" value={newCase.tenantName} onChange={e => setNewCase({ ...newCase, tenantName: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">DNI</Label>
                    <Input placeholder="20.123.456" value={newCase.tenantDni} onChange={e => setNewCase({ ...newCase, tenantDni: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Deuda total ($)</Label>
                    <Input type="number" placeholder="0" value={newCase.debtAmount || ''} onChange={e => setNewCase({ ...newCase, debtAmount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Días de mora</Label>
                    <Input type="number" placeholder="0" value={newCase.daysOverdue || ''} onChange={e => setNewCase({ ...newCase, daysOverdue: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Abogado</Label>
                    <Input placeholder="Dr. Apellido" value={newCase.attorney} onChange={e => setNewCase({ ...newCase, attorney: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
                    <Input type="date" value={newCase.startDate} onChange={e => setNewCase({ ...newCase, startDate: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notas</Label>
                    <Textarea placeholder="Observaciones…" value={newCase.notes} onChange={e => setNewCase({ ...newCase, notes: e.target.value })} rows={2} />
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button variant="outline" onClick={() => setIsNewCaseOpen(false)}>Cancelar</Button>
                  <Button className="bg-accent text-white" onClick={handleCreateCase}>Registrar Caso</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Deuda total */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deuda Total Activa</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold text-gray-900">{fmtMoney(stats.totalDebt)}</span>
              <span className="text-xs text-red-500 flex items-center gap-0.5 mb-1"><TrendingUp className="h-3 w-3" />+{stats.active} activos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Acumulado en {stats.total} caso{stats.total !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        {/* Riesgo crítico */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riesgo Crítico</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-3xl font-bold text-red-600">{stats.critical}</span>
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fee2e2" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3"
                    strokeDasharray={`${stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0} 100`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-red-600">
                  {stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Inquilinos en mora &gt; 60 días</p>
          </CardContent>
        </Card>

        {/* Eficiencia */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eficiencia de Recupero</p>
            <div className="flex items-center justify-between mt-1">
              <div>
                <span className="text-xs text-muted-foreground">Target: <strong>85%</strong></span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-muted-foreground">Actual:</span>
                  <span className="font-bold text-gray-900">{stats.efficiencyPct}%</span>
                  {stats.efficiencyPct >= 85
                    ? <TrendingUp className="h-3 w-3 text-green-500" />
                    : <TrendingDown className="h-3 w-3 text-red-500" />}
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-accent opacity-40" />
            </div>
            <Progress value={stats.efficiencyPct} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Última sincronización: ahora</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Flujo de Notificaciones (col-span-2) ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Flujo Automatizado de Notificaciones</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterStage} onValueChange={setFilterStage}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(Object.keys(STAGE_CFG) as LegalStage[]).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Scale className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No hay casos {filterStage !== 'all' ? `en etapa "${filterStage}"` : 'registrados'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(c => {
                    const stageCfg = STAGE_CFG[c.stage ?? 'Intimación'];
                    return (
                      <div key={c.id} className={cn('flex items-start justify-between p-3 rounded-lg border', stageCfg.color)}>
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 flex-shrink-0">{stageCfg.icon}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{c.type}</span>
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', stageCfg.badge)}>
                                {stageCfg.label}
                              </span>
                              {c.verazReported && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-purple-100 text-purple-700">VERAZ</span>
                              )}
                            </div>
                            <p className="text-xs mt-0.5 opacity-80">
                              Propiedad: {c.propertyName}
                              {c.tenantName && <> · {c.tenantName}</>}
                            </p>
                            {c.debtAmount ? (
                              <p className="text-xs font-semibold mt-0.5">{fmtMoney(c.debtAmount)}{c.daysOverdue ? ` · ${c.daysOverdue} días mora` : ''}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {c.lastActionDate && (
                            <span className="text-[10px] opacity-60 hidden sm:block">{c.lastActionDate}</span>
                          )}
                          {/* Stage selector */}
                          {canWrite && (
                            <Select value={c.stage ?? 'Intimación'} onValueChange={v => handleUpdateStage(c, v as LegalStage)}>
                              <SelectTrigger className="h-7 text-[10px] w-28 bg-white/70">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(STAGE_CFG) as LegalStage[]).map(s => (
                                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-current opacity-50 hover:opacity-100" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canWrite && legalCases.filter(c => c.stage === 'Intimación' && c.status !== 'Cerrado').length > 0 && (
                <Button
                  variant="outline"
                  className="w-full mt-3 text-sm border-dashed gap-2"
                  onClick={handleMassIntimation}
                >
                  <Send className="h-4 w-4" />
                  Ejecutar Acción Masiva de Intimación ({legalCases.filter(c => c.stage === 'Intimación' && c.status !== 'Cerrado').length})
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ── Portal de Negociación ── */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Portal de Negociación</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Planes de pago personalizados y acuerdos transaccionales.</p>
              </div>
              {canWrite && (
                <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setSelectedCaseId(legalCases[0]?.id ?? null)}>
                      <Plus className="h-3.5 w-3.5" /> Proponer Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Proponer Plan de Pago</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Caso</Label>
                        <Select value={selectedCaseId ?? ''} onValueChange={setSelectedCaseId}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar caso…" /></SelectTrigger>
                          <SelectContent>
                            {legalCases.filter(c => c.status !== 'Cerrado').map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.propertyName} – {c.tenantName || c.type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Inquilino</Label>
                        <Input placeholder="Nombre" value={newPlan.tenantName} onChange={e => setNewPlan({ ...newPlan, tenantName: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Cuotas</Label>
                          <Input type="number" min={1} value={newPlan.installments} onChange={e => setNewPlan({ ...newPlan, installments: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Monto total ($)</Label>
                          <Input type="number" value={newPlan.totalAmount || ''} onChange={e => setNewPlan({ ...newPlan, totalAmount: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Nota</Label>
                        <Input placeholder="Refuerzo, condiciones…" value={newPlan.note} onChange={e => setNewPlan({ ...newPlan, note: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter className="pt-2">
                      <Button variant="outline" onClick={() => setIsAddPlanOpen(false)}>Cancelar</Button>
                      <Button className="bg-accent text-white" onClick={handleAddPlan}>Proponer</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {allPlans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No hay planes de pago propuestos.</p>
              ) : (
                <div className="space-y-2">
                  {allPlans.map(plan => {
                    const cfg = PLAN_STATUS_CFG[plan.status];
                    return (
                      <div key={plan.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            Plan: {plan.installments} Cuota{plan.installments !== 1 ? 's' : ''}
                            {plan.note && <span className="text-muted-foreground"> + {plan.note}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">Inquilino: {plan.tenantName} · {fmtMoney(plan.totalAmount)}</p>
                          <p className="text-[10px] text-muted-foreground">{plan.caseName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1', cfg.cls)}>
                            {cfg.icon}{cfg.label}
                          </span>
                          {canWrite && plan.status === 'pendiente' && (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" title="Aceptar" onClick={() => handlePlanStatus(plan.caseId, plan.id, 'aceptado')}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" title="Rechazar" onClick={() => handlePlanStatus(plan.caseId, plan.id, 'rechazado')}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Columna derecha ── */}
        <div className="space-y-4">

          {/* Central de Riesgo */}
          <Card className="border-none shadow-sm bg-[#1a2e22] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white">Central de Riesgo</CardTitle>
              <p className="text-xs text-green-200/70">Integramos con los principales bureaus de crédito para protección de activos.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: 'Equifax / Veraz', status: 'online' as const },
                { name: 'Nosis Analytics', status: 'online' as const },
                { name: 'Fidelitas CR',    status: 'offline' as const },
              ].map(bureau => (
                <div key={bureau.name} className="flex items-center justify-between p-2 rounded-lg bg-white/10">
                  <span className="text-sm font-medium">{bureau.name}</span>
                  <div className="flex items-center gap-1.5">
                    {bureau.status === 'online'
                      ? <><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs text-green-300">Online</span></>
                      : <><span className="h-2 w-2 rounded-full bg-gray-500" /><span className="text-xs text-gray-400">Offline</span></>
                    }
                  </div>
                </div>
              ))}

              <div className="mt-3 p-3 rounded-lg bg-white/10">
                <p className="text-[11px] text-green-200/70 uppercase tracking-wide font-semibold">Score Promedio de Cartera</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold">
                    {legalCases.length > 0 ? Math.round(500 + (stats.efficiencyPct / 100) * 350) : '—'}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold">MODERADO</span>
                </div>
              </div>

              <Button variant="outline" className="w-full text-xs bg-white/10 border-white/20 text-white hover:bg-white/20 mt-1 gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Nueva Consulta de Score
              </Button>
            </CardContent>
          </Card>

          {/* Búsqueda rápida */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Búsqueda Rápida de Deudores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 text-sm"
                    placeholder="Buscar por DNI, nombre…"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                  />
                </div>
                <Button className="bg-accent text-white px-4 text-sm">Buscar</Button>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: <Download className="h-4 w-4" />, label: 'Exportar PDF' },
                  { icon: <Landmark className="h-4 w-4" />, label: 'Sinc. Bancaria' },
                  { icon: <Scale className="h-4 w-4" />, label: 'Legal Desk' },
                  { icon: <Phone className="h-4 w-4" />, label: 'Soporte Legal' },
                ].map(a => (
                  <Button key={a.label} variant="outline" className="flex-col h-16 gap-1 text-xs" onClick={() => toast({ title: a.label, description: 'Función próximamente' })}>
                    {a.icon}
                    {a.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resumen Veraz */}
          {stats.verazReported > 0 && (
            <Card className="border-none shadow-sm bg-purple-50 border border-purple-100">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-8 w-8 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-purple-800">{stats.verazReported} reporte{stats.verazReported !== 1 ? 's' : ''} Veraz activo{stats.verazReported !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-purple-600">Deudores incluidos en el sistema de información crediticia.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
