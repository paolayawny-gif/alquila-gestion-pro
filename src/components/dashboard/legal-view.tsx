
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Scale, Trash2, Search, Plus, TrendingUp, TrendingDown,
  AlertTriangle, FileText, Send, ShieldAlert, CheckCircle2,
  Clock, XCircle, Gavel,
  BarChart3, Users, RefreshCw, Download, Phone, Landmark,
  CircleDot, Filter, ExternalLink,
  Shield, ShieldCheck, ShieldX, CreditCard, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LegalCase, LegalStage, PaymentPlan, Property, ServiceRequest } from '@/lib/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchDeudaBcra, type BcraDeudaReport } from '@/ai/flows/fetch-deudas-bcra-action';
import { situacionLabel, situacionColor } from '@/lib/bcra-utils';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { setDocumentNonBlocking, setDocumentSafe, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Schemas } from '@/lib/schemas';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { Progress } from '@/components/ui/progress';

interface LegalViewProps {
  legalCases: LegalCase[];
  userId?: string;
  properties: Property[];
}


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
  const [isLegalDeskOpen, setIsLegalDeskOpen] = useState(false);
  const [legalDeskMsg, setLegalDeskMsg] = useState('');
  const [legalDeskEmail, setLegalDeskEmail] = useState('');
  const [legalDeskSending, setLegalDeskSending] = useState(false);

  // ── BCRA Central de Deudores ─────────────────────────────────────────────
  const [cuitInput, setCuitInput] = useState('');
  const [bcraReport, setBcraReport] = useState<BcraDeudaReport | null>(null);
  const [isFetchingBcra, setIsFetchingBcra] = useState(false);

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

  // ── Service requests ──────────────────────────────────────────────────────
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  React.useEffect(() => {
    if (!db || !userId) return;
    getDocs(collection(db, 'artifacts', APP_ID, 'users', userId, 'serviceRequests'))
      .then(snap => {
        setServiceRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRequest)));
      })
      .catch(() => {});
  }, [db, userId]);

  const updateServiceRequest = async (id: string, updates: Partial<ServiceRequest>) => {
    if (!db || !userId) return;
    const now = new Date().toISOString();
    await updateDoc(
      doc(db, 'artifacts', APP_ID, 'users', userId, 'serviceRequests', id),
      { ...updates, updatedAt: now },
    );
    setServiceRequests(prev =>
      prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: now } : r),
    );
  };

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
        (c.propertyName ?? '').toLowerCase().includes(q) ||
        (c.tenantName ?? '').toLowerCase().includes(q) ||
        (c.tenantDni ?? '').includes(q) ||
        (c.type ?? '').toLowerCase().includes(q)
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
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', docId);
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
    setDocumentSafe(docRef, Schemas.LegalCaseCreate, caseData, { merge: true });
    setIsNewCaseOpen(false);
    setNewCase({ type: '', propertyId: '', startDate: new Date().toISOString().split('T')[0], attorney: '', status: 'Iniciado', stage: 'Intimación' });
    toast({ title: 'Caso Registrado', description: 'Sincronizado con la nube.' });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'Caso eliminado' });
  };

  const handleUpdateStage = (c: LegalCase, stage: LegalStage) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', c.id);
    const update: Partial<LegalCase> = { stage, lastActionDate: new Date().toISOString().split('T')[0] };
    if (stage === 'Reporte Veraz') update.verazReported = true;
    if (stage === 'Cerrado') update.status = 'Cerrado';
    setDocumentSafe(docRef, Schemas.LegalCasePatch, update, { merge: true });
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
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', selectedCaseId);
    setDocumentSafe(docRef, Schemas.LegalCasePatch, { paymentPlans: [...existing, plan] }, { merge: true });
    setIsAddPlanOpen(false);
    setNewPlan({ tenantName: '', installments: 3, totalAmount: 0, note: '', status: 'pendiente' });
    toast({ title: 'Plan de pago propuesto' });
  };

  const handlePlanStatus = (caseId: string, planId: string, status: PaymentPlan['status']) => {
    if (!userId || !db) return;
    const caseObj = legalCases.find(c => c.id === caseId);
    if (!caseObj) return;
    const updated = (caseObj.paymentPlans ?? []).map(p => p.id === planId ? { ...p, status } : p);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', caseId);
    setDocumentSafe(docRef, Schemas.LegalCasePatch, { paymentPlans: updated }, { merge: true });
    toast({ title: `Plan actualizado → ${status}` });
  };

  const handleBcraConsult = async (prefillCuit?: string) => {
    const cuit = (prefillCuit ?? cuitInput).replace(/\D/g, '');
    if (!cuit || cuit.length !== 11) {
      toast({ title: 'CUIT inválido', description: 'Ingresá 11 dígitos del CUIT/CUIL del deudor.', variant: 'destructive' });
      return;
    }
    if (prefillCuit) setCuitInput(prefillCuit);
    setIsFetchingBcra(true);
    setBcraReport(null);
    try {
      const res = await fetchDeudaBcra(cuit);
      if (!res.ok) {
        toast({ title: 'Error BCRA', description: res.error, variant: 'destructive' });
        return;
      }
      setBcraReport(res.data);
      toast({ title: 'Consulta BCRA completada', description: `Situación: ${situacionLabel(res.data.maxSituation)}` });
    } catch (e: any) {
      toast({ title: 'Error inesperado', description: e?.message ?? 'No se pudo consultar el BCRA.', variant: 'destructive' });
    } finally {
      setIsFetchingBcra(false);
    }
  };

  const handleMassIntimation = () => {
    if (!userId || !db) return;
    const actives = legalCases.filter(c => c.status !== 'Cerrado' && c.stage === 'Intimación');
    if (actives.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    actives.forEach(c => {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legales', c.id);
      setDocumentSafe(docRef, Schemas.LegalCasePatch, {
        stage: 'Carta Documento' as const,
        lastActionDate: today,
        lastActionNote: 'Acción masiva de intimación ejecutada',
      }, { merge: true });
    });
    toast({
      title: `Intimación masiva ejecutada`,
      description: `${actives.length} caso(s) avanzados a "Carta Documento".`,
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
                            <ConfirmDeleteButton
                              trigger={
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-current opacity-50 hover:opacity-100">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              }
                              title="Eliminar caso legal"
                              itemName={`${c.tenantName ?? 'Inquilino'} • ${c.type}`}
                              description={<p>Si este caso tiene plan de pago activo o reclamos en curso, eliminarlo puede afectar la cobranza.</p>}
                              blockedReason={c.status !== 'Cerrado' ? `Este caso está "${c.status}". Cambialo a "Cerrado" antes de eliminar.` : null}
                              onConfirm={() => handleDelete(c.id)}
                            />
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

          {/* Central de Deudores BCRA */}
          <Card className="border-none shadow-sm bg-[#1a2e22] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Central de Deudores BCRA
              </CardTitle>
              <p className="text-xs text-green-200/70">
                Consultá la situación crediticia de un deudor en el Banco Central de la República Argentina.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Input CUIT */}
              <div className="flex gap-2">
                <Input
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm flex-1"
                  placeholder="CUIT/CUIL (11 dígitos)"
                  value={cuitInput}
                  onChange={e => setCuitInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBcraConsult()}
                />
                <Button
                  className="bg-accent hover:bg-accent/90 text-white gap-1.5 shrink-0"
                  onClick={() => handleBcraConsult()}
                  disabled={isFetchingBcra}
                >
                  {isFetchingBcra
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  Consultar
                </Button>
              </div>

              {/* Acceso rápido desde caso activo */}
              {legalCases.filter(c => c.tenantDni && c.status !== 'Cerrado').length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-green-200/60 uppercase tracking-wide">Consulta rápida por caso</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {legalCases.filter(c => c.tenantDni && c.status !== 'Cerrado').map(c => (
                      <button
                        key={c.id}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left"
                        onClick={() => handleBcraConsult(c.tenantDni!.replace(/\D/g, ''))}
                      >
                        <span className="text-xs font-medium truncate">{c.tenantName || c.propertyName}</span>
                        <span className="text-[10px] text-green-300 shrink-0 ml-2">{c.tenantDni}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultado BCRA */}
              {bcraReport && <BcraInlineResult report={bcraReport} />}

              {/* Separador + links externos */}
              <div className="border-t border-white/10 pt-2 space-y-1">
                <p className="text-[10px] text-green-200/50 uppercase tracking-wide">Servicios externos (requieren cuenta)</p>
                {[
                  { name: 'Veraz / Equifax', url: 'https://www.veraz.com.ar', note: 'Informe personal' },
                  { name: 'Nosis Analytics', url: 'https://www.nosis.com',   note: 'Score comercial' },
                  { name: 'Fidelitas CR',    url: 'https://www.fidelitas.com.ar', note: 'Riesgo crediticio' },
                ].map(s => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group"
                  >
                    <div>
                      <span className="text-xs font-medium">{s.name}</span>
                      <span className="block text-[10px] text-green-200/50">{s.note}</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
                  </a>
                ))}
              </div>
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
                <Button
                  variant="outline" className="flex-col h-16 gap-1 text-xs"
                  onClick={() => {
                    const lines = legalCases.map(c =>
                      `${c.type} | ${c.propertyName} | ${c.tenantName ?? ''} | ${c.stage ?? c.status} | $${(c.debtAmount ?? 0).toLocaleString('es-AR')}`
                    ).join('\n');
                    const blob = new Blob([`CASOS LEGALES\n${'─'.repeat(60)}\n${lines}\n\nTotal casos: ${legalCases.length}\nDeuda total: $${legalCases.reduce((s,c)=>s+(c.debtAmount??0),0).toLocaleString('es-AR')}`], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'casos-legales.txt'; a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: 'Exportado', description: 'casos-legales.txt descargado.' });
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
                <Button
                  variant="outline" className="flex-col h-16 gap-1 text-xs"
                  onClick={() => window.open('https://www.bcra.gob.ar', '_blank')}
                >
                  <Landmark className="h-4 w-4" /> Sinc. BCRA
                </Button>
                <Button
                  variant="outline" className="flex-col h-16 gap-1 text-xs"
                  onClick={() => setIsLegalDeskOpen(true)}
                >
                  <Scale className="h-4 w-4" /> Consultoría Legal
                </Button>
                <Button
                  variant="outline" className="flex-col h-16 gap-1 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast({ title: 'Link copiado', description: 'Compartí con tu asesor legal.' });
                  }}
                >
                  <Phone className="h-4 w-4" /> Compartir
                </Button>
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

      {/* ── Solicitudes de servicios entrantes ── */}
      {serviceRequests.filter(r => r.estado !== 'cancelado').length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black">Solicitudes de servicios</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Pedidos de tus propietarios e inquilinos.</p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
                {serviceRequests.filter(r => r.estado === 'solicitado').length} nuevas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {serviceRequests
              .filter(r => r.estado !== 'cancelado')
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map(r => {
                const STATUS_CFG_SVC: Record<ServiceRequest['estado'], { label: string; cls: string }> = {
                  solicitado:     { label: 'Nuevo',           cls: 'bg-blue-100 text-blue-700' },
                  en_proceso:     { label: 'En proceso',      cls: 'bg-yellow-100 text-yellow-700' },
                  entregado:      { label: 'Entregado',       cls: 'bg-purple-100 text-purple-700' },
                  pago_pendiente: { label: 'Pago pendiente',  cls: 'bg-amber-100 text-amber-700' },
                  pagado:         { label: 'Pagado',          cls: 'bg-green-100 text-green-700' },
                  cancelado:      { label: 'Cancelado',       cls: 'bg-gray-100 text-gray-500' },
                };
                const cfg = STATUS_CFG_SVC[r.estado];
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{r.serviceSnapshot.nombre}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium">{r.clientName ?? r.clientEmail}</span>
                        {' · '}{r.clientType === 'owner' ? 'Propietario' : 'Inquilino'}
                        {' · '}{new Date(r.createdAt).toLocaleDateString('es-AR')}
                      </p>
                      {r.descripcion && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.descripcion}</p>
                      )}
                      {r.archivos?.comprobanteName && (
                        <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                          Comprobante: {r.archivos.comprobanteName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.estado === 'solicitado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 font-bold"
                          onClick={() => updateServiceRequest(r.id, { estado: 'pago_pendiente' })}
                        >
                          Pedir pago
                        </Button>
                      )}
                      {r.estado === 'solicitado' && (
                        <Button
                          size="sm"
                          className="text-xs h-7 font-bold"
                          onClick={() => updateServiceRequest(r.id, { estado: 'en_proceso' })}
                        >
                          Procesar
                        </Button>
                      )}
                      {(r.estado === 'en_proceso' || r.estado === 'pago_pendiente') && r.archivos?.comprobanteName && (
                        <Button
                          size="sm"
                          className="text-xs h-7 font-bold bg-green-600 hover:bg-green-700"
                          onClick={() => updateServiceRequest(r.id, {
                            estado: 'pagado',
                            pago: { metodo: 'transferencia', aprobadoEn: new Date().toISOString(), aprobadoPor: userId },
                          })}
                        >
                          Aprobar pago
                        </Button>
                      )}
                      {r.estado === 'en_proceso' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 font-bold"
                          onClick={() => updateServiceRequest(r.id, { estado: 'entregado' })}
                        >
                          Marcar entregado
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* ── Dialog Consultoría Legal ───────────────────────────────────── */}
      <Dialog open={isLegalDeskOpen} onOpenChange={setIsLegalDeskOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Consultoría legal
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--status-info-bg))] border border-[hsl(var(--status-info-fg))]/20">
              <CreditCard className="h-4 w-4 text-[hsl(var(--status-info-fg))] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[hsl(var(--status-info-fg))] leading-snug">
                Este servicio tiene un costo adicional. Un abogado especialista en derecho inmobiliario se contactará con vos para presupuestar la consulta.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ld-email" className="text-[13px]">Tu email de contacto</Label>
              <Input
                id="ld-email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={legalDeskEmail}
                onChange={e => setLegalDeskEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ld-msg" className="text-[13px]">Describí brevemente tu consulta</Label>
              <Textarea
                id="ld-msg"
                rows={4}
                placeholder={`Tengo ${legalCases.filter(c => c.status !== 'Cerrado').length} caso(s) legales activos. El tema principal es...`}
                value={legalDeskMsg}
                onChange={e => setLegalDeskMsg(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsLegalDeskOpen(false)}>Cancelar</Button>
            <Button
              disabled={!legalDeskEmail || !legalDeskMsg || legalDeskSending}
              onClick={() => {
                setLegalDeskSending(true);
                const subject = encodeURIComponent('Consultoría Legal — AlquilaGestión Pro');
                const body = encodeURIComponent(`Email: ${legalDeskEmail}\n\n${legalDeskMsg}`);
                window.open(`mailto:legal@alquilagestion.pro?subject=${subject}&body=${body}`);
                setTimeout(() => {
                  setLegalDeskSending(false);
                  setIsLegalDeskOpen(false);
                  setLegalDeskMsg('');
                  setLegalDeskEmail('');
                  toast({ title: 'Consulta enviada', description: 'Te contactaremos pronto con el presupuesto.' });
                }, 800);
              }}
            >
              {legalDeskSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar consulta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── BcraInlineResult — resultado compacto para mostrar dentro de la tarjeta ──
interface BcraInlineResultProps {
  report: BcraDeudaReport;
}

function BcraInlineResult({ report }: BcraInlineResultProps) {
  const s = report.maxSituation;
  const color = situacionColor(s);

  const bgClass = color === 'green' ? 'bg-green-500/20 border-green-400/30'
    : color === 'lime'   ? 'bg-lime-500/20 border-lime-400/30'
    : color === 'orange' ? 'bg-orange-500/20 border-orange-400/30'
    : 'bg-red-500/20 border-red-400/30';

  const textClass = color === 'green' ? 'text-green-200'
    : color === 'lime'   ? 'text-lime-200'
    : color === 'orange' ? 'text-orange-200'
    : 'text-red-200';

  const badgeCls = color === 'green' ? 'bg-green-500 text-white'
    : color === 'lime'   ? 'bg-lime-500 text-white'
    : color === 'orange' ? 'bg-orange-500 text-white'
    : 'bg-red-500 text-white';

  const IconComp = s <= 1 ? Shield : s === 2 ? ShieldCheck : s === 3 ? ShieldAlert : ShieldX;

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      {/* Banner */}
      <div className={cn('rounded-lg border p-2.5 flex items-start gap-2', bgClass)}>
        <IconComp className={cn('h-4 w-4 shrink-0 mt-0.5', textClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-bold truncate', textClass)}>
            {report.denominacion || `CUIT ${report.identificacion}`}
          </p>
          <p className={cn('text-xs', textClass)}>
            Situación: <strong>{situacionLabel(s)}</strong>
          </p>
          <div className="flex gap-3 mt-0.5 flex-wrap">
            {report.latestPeriod && (
              <span className="text-[10px] text-white/50">Período: {report.latestPeriod}</span>
            )}
            <span className="text-[10px] text-white/50">{report.totalEntidades} entidad{report.totalEntidades !== 1 ? 'es' : ''}</span>
          </div>
        </div>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', badgeCls)}>
          Sit. {s}
        </span>
      </div>

      {/* Cheques rechazados */}
      {report.hasRejectedChecks && (
        <div className="flex items-center gap-2 p-2 bg-red-500/20 border border-red-400/30 rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5 text-red-300 shrink-0" />
          <p className="text-xs font-bold text-red-200">
            {report.cheques.length} cheque{report.cheques.length !== 1 ? 's' : ''} rechazado{report.cheques.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Detalle de entidades */}
      {report.latestEntidades.length > 0 && (
        <ScrollArea className="max-h-36">
          <div className="space-y-1 pr-1">
            {report.latestEntidades.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/10 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CreditCard className="h-3 w-3 text-white/40 shrink-0" />
                  <span className="truncate text-white/80 font-medium">{e.entidad}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-white/60">$ {e.monto.toLocaleString('es-AR')}</span>
                  <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded text-white',
                    e.situacion <= 1 ? 'bg-green-600' : e.situacion === 2 ? 'bg-lime-600' : e.situacion === 3 ? 'bg-orange-600' : 'bg-red-600'
                  )}>
                    S{e.situacion}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <p className="text-[9px] text-white/30 text-right">
        Consultado: {new Date(report.consultedAt).toLocaleString('es-AR')}
      </p>
    </div>
  );
}
