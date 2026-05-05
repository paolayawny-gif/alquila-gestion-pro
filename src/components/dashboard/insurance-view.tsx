'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, ShieldCheck, ShieldAlert, Plus, Flame, Zap, CloudRain, Wind,
  Thermometer, Droplets, AlertTriangle, CheckCircle2, Clock, FileText,
  Download, History, TrendingDown, Building2, ChevronRight, Edit2, Trash2,
  RefreshCw, Loader2, Calendar, DollarSign, Star, Phone, ExternalLink,
  ArrowRight, Activity, BarChart3, Snowflake
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID = 'alquilagestion-pro';

// ── Types ──────────────────────────────────────────────────────────────────────
type PolicyType   = 'Incendio' | 'Responsabilidad Civil' | 'Integral Hogar' | 'Caución' | 'Granizo' | 'Robo y Hurto' | 'Otro';
type PolicyStatus = 'Vigente' | 'Por vencer' | 'Vencida' | 'Cancelada';
type PayStatus    = 'Pagado' | 'Pendiente' | 'Vencido';

interface InsurancePolicy {
  id: string; propertyId: string; propertyName: string;
  type: PolicyType; insurer: string; policyNumber: string;
  coverageAmount: number; annualPremium: number;
  startDate: string; endDate: string;
  totalInstallments: number; paidInstallments: number;
  status: PolicyStatus; documentUrl?: string; notes?: string;
  isMandatory?: boolean;
  ownerId: string; createdAt: string;
}

interface PaymentRecord {
  id: string; policyId: string; policyName: string; propertyName: string;
  installmentNumber: number; amount: number;
  dueDate: string; paidDate?: string;
  status: PayStatus; ownerId: string;
}

interface ParametricCoverage {
  id: string; type: 'Lluvia' | 'Granizo' | 'Viento' | 'Temperatura';
  description: string; costPerEvent: number; isActive: boolean;
  triggerCondition: string; activations: number; totalSaved: number;
  ownerId: string;
}

interface InsuranceViewProps { properties: Property[]; userId?: string }

// ── Config ─────────────────────────────────────────────────────────────────────
const POLICY_TYPES: { id: PolicyType; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'Incendio',              label: 'Incendio (Ley 13.512)',  icon: Flame,         color: 'text-red-600 bg-red-50'     },
  { id: 'Responsabilidad Civil', label: 'Resp. Civil',            icon: ShieldCheck,   color: 'text-blue-600 bg-blue-50'   },
  { id: 'Integral Hogar',        label: 'Integral Hogar',         icon: Building2,     color: 'text-emerald-600 bg-emerald-50' },
  { id: 'Caución',               label: 'Caución',                icon: DollarSign,    color: 'text-purple-600 bg-purple-50' },
  { id: 'Granizo',               label: 'Granizo',                icon: Snowflake,     color: 'text-cyan-600 bg-cyan-50'   },
  { id: 'Robo y Hurto',          label: 'Robo y Hurto',           icon: ShieldAlert,   color: 'text-amber-600 bg-amber-50' },
  { id: 'Otro',                  label: 'Otro',                   icon: Shield,        color: 'text-slate-600 bg-slate-50' },
];

const INSURERS = [
  'Allianz','Mapfre','Zurich','San Cristóbal','Sancor Seguros',
  'Federación Patronal','La Segunda','Rivadavia','HSBC','BBVA Seguros','Otro',
];

const PARAMETRIC_DEFAULTS: Omit<ParametricCoverage,'id'|'ownerId'>[] = [
  { type:'Lluvia',      description:'Cobertura activada automáticamente si la precipitación supera los 2mm en el día.',  costPerEvent: 2500,  isActive:false, triggerCondition:'Lluvia > 2 mm', activations:0, totalSaved:0 },
  { type:'Granizo',     description:'Activación ante eventos de granizo registrados por sensores locales.',              costPerEvent: 8000,  isActive:false, triggerCondition:'Granizo detectado', activations:0, totalSaved:0 },
  { type:'Viento',      description:'Micro-cobertura ante vientos superiores a 60 km/h. Protege mobiliario exterior.',  costPerEvent: 3500,  isActive:false, triggerCondition:'Viento > 60 km/h', activations:0, totalSaved:0 },
  { type:'Temperatura', description:'Cobertura de daños por heladas si la temperatura baja de 0°C.',                    costPerEvent: 5000,  isActive:false, triggerCondition:'Temp < 0°C', activations:0, totalSaved:0 },
];

const MARKETPLACE_PARTNERS = [
  { insurer:'San Cristóbal', product:'Integral Hogar',         partner:'Socio Preferente', icon: Building2,  cta:'Cotizar Ahora'      },
  { insurer:'Sancor Seguros', product:'Incendio Comercial',     partner:'Socio: Sancor',    icon: Flame,      cta:'Gestionar Oferta'   },
  { insurer:'Zurich',         product:'Robo y Hurto',           partner:'Socio: Zurich',    icon: ShieldAlert, cta:'Contratar'         },
  { insurer:'Mapfre',         product:'Responsabilidad Civil',  partner:'Socio: Mapfre',    icon: ShieldCheck, cta:'Cotizar'           },
];

const STATUS_CFG: Record<PolicyStatus,{color:string;icon:React.ElementType}> = {
  'Vigente':      { color:'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2 },
  'Por vencer':   { color:'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertTriangle },
  'Vencida':      { color:'bg-red-50 text-red-700 border-red-200',         icon: ShieldAlert   },
  'Cancelada':    { color:'bg-slate-50 text-slate-600 border-slate-200',   icon: Shield        },
};

const PAY_STATUS_CFG: Record<PayStatus,string> = {
  'Pagado':   'bg-green-50 text-green-700 border-green-200',
  'Pendiente':'bg-amber-50 text-amber-700 border-amber-200',
  'Vencido':  'bg-red-50 text-red-700 border-red-200',
};

const fmt  = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fmtM = (n: number) => {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return fmt(n);
};

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr+'T00:00:00').getTime() - Date.now()) / 86_400_000);
}

function policyStatus(endDate: string): PolicyStatus {
  const d = daysUntil(endDate);
  if (d < 0) return 'Vencida';
  if (d <= 30) return 'Por vencer';
  return 'Vigente';
}

// ── Weather widget ─────────────────────────────────────────────────────────────
interface WeatherData { temp: number; humidity: number; wind: number; precipitation: number; nextAlert?: string }

function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,rain&hourly=precipitation_probability&forecast_days=1&timezone=America%2FArgentina%2FBuenos_Aires')
      .then(r => r.json())
      .then(d => {
        const prob = d.hourly?.precipitation_probability ?? [];
        const nextHigh = (prob as number[]).findIndex((p, i) => i > 0 && p > 60);
        setWeather({
          temp:          Math.round(d.current.temperature_2m),
          humidity:      d.current.relative_humidity_2m,
          wind:          Math.round(d.current.wind_speed_10m),
          precipitation: d.current.precipitation ?? 0,
          nextAlert:     nextHigh > 0 ? `Lluvia prevista en ${nextHigh}h` : undefined,
        });
      })
      .catch(() => setWeather({ temp: 20, humidity: 65, wind: 15, precipitation: 0 }))
      .finally(() => setLoading(false));
  }, []);
  return { weather, loading };
}

// ── Empty policy form ──────────────────────────────────────────────────────────
const EMPTY_POLICY = {
  propertyId: '', type: 'Incendio' as PolicyType, insurer: 'San Cristóbal',
  policyNumber: '', coverageAmount: '', annualPremium: '',
  startDate: '', endDate: '', totalInstallments: 12, paidInstallments: 0,
  isMandatory: false, notes: '', documentUrl: '',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function InsuranceView({ properties, userId }: InsuranceViewProps) {
  const { toast }   = useToast();
  const db          = useFirestore();
  const { user }    = useUser();
  const { canWrite, canDelete } = useOrgPermissions();
  const { weather, loading: weatherLoading } = useWeather();

  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [showAddPolicy,    setShowAddPolicy]     = useState(false);
  const [editingPolicy,    setEditingPolicy]     = useState<InsurancePolicy | null>(null);
  const [policyForm,       setPolicyForm]        = useState({ ...EMPTY_POLICY });
  const [showPayDialog,    setShowPayDialog]     = useState(false);
  const [selectedPolicy,   setSelectedPolicy]   = useState<InsurancePolicy | null>(null);
  const [showAllPartners,  setShowAllPartners]  = useState(false);

  // ── Firestore ──
  const policiesQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'seguros'));
  }, [db, userId]);
  const { data: policiesRaw } = useCollection<InsurancePolicy>(policiesQ);

  const paymentsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'segurosPagos'));
  }, [db, userId]);
  const { data: paymentsRaw } = useCollection<PaymentRecord>(paymentsQ);

  const paramQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'seguroParametrico'));
  }, [db, userId]);
  const { data: paramRaw } = useCollection<ParametricCoverage>(paramQ);

  const policies  = (policiesRaw  ?? []).map(p => ({ ...p, status: policyStatus(p.endDate) }));
  const payments  = paymentsRaw  ?? [];
  const paramCovs = paramRaw     ?? [];

  // Seed parametric defaults if empty
  useEffect(() => {
    if (!db || !userId || paramCovs.length > 0) return;
    PARAMETRIC_DEFAULTS.forEach(def => {
      const id  = Math.random().toString(36).substr(2, 9);
      const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguroParametrico', id);
      setDocumentNonBlocking(ref, { ...def, id, ownerId: userId }, {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, paramCovs.length]);

  // ── Derived stats ──
  const filteredPolicies = useMemo(() =>
    selectedProperty === 'all' ? policies : policies.filter(p => p.propertyId === selectedProperty),
  [policies, selectedProperty]);

  const totalCoverage  = filteredPolicies.reduce((a, p) => a + (p.coverageAmount || 0), 0);
  const activeCount    = filteredPolicies.filter(p => p.status === 'Vigente').length;
  const expiringCount  = filteredPolicies.filter(p => p.status === 'Por vencer').length;
  const expiredCount   = filteredPolicies.filter(p => p.status === 'Vencida').length;
  const mandatoryOK    = filteredPolicies.some(p => p.type === 'Incendio' && p.status === 'Vigente');
  const annualPremiums = filteredPolicies.reduce((a, p) => a + (p.annualPremium || 0), 0);
  const estimatedSavings = Math.round(annualPremiums * 0.18);  // ~18% vs static policies

  // ── Handlers ──
  const handleSavePolicy = () => {
    if (!policyForm.propertyId || !policyForm.policyNumber.trim() || !userId || !db) {
      toast({ title: 'Completá propiedad y número de póliza', variant: 'destructive' }); return;
    }
    const id  = editingPolicy?.id || Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguros', id);
    const prop = properties.find(p => p.id === policyForm.propertyId);
    const data: InsurancePolicy = {
      id, propertyId: policyForm.propertyId,
      propertyName: prop?.name || '',
      type:         policyForm.type,
      insurer:      policyForm.insurer,
      policyNumber: policyForm.policyNumber.trim(),
      coverageAmount:    parseFloat(String(policyForm.coverageAmount)) || 0,
      annualPremium:     parseFloat(String(policyForm.annualPremium)) || 0,
      startDate:         policyForm.startDate,
      endDate:           policyForm.endDate,
      totalInstallments: Number(policyForm.totalInstallments) || 12,
      paidInstallments:  Number(policyForm.paidInstallments) || 0,
      isMandatory:       !!policyForm.isMandatory,
      documentUrl:       policyForm.documentUrl || '',
      notes:             policyForm.notes || '',
      status:            policyStatus(policyForm.endDate),
      ownerId:           userId,
      createdAt:         editingPolicy?.createdAt || new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, { merge: true });
    toast({ title: editingPolicy ? '✅ Póliza actualizada' : '✅ Póliza registrada', description: `${data.type} — ${data.insurer}` });
    setShowAddPolicy(false); setEditingPolicy(null);
    setPolicyForm({ ...EMPTY_POLICY });
  };

  const handleDeletePolicy = (id: string) => {
    if (!userId || !db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'seguros', id));
    toast({ title: 'Póliza eliminada' });
  };

  const openEditPolicy = (p: InsurancePolicy) => {
    setEditingPolicy(p);
    setPolicyForm({
      propertyId: p.propertyId, type: p.type, insurer: p.insurer,
      policyNumber: p.policyNumber, coverageAmount: String(p.coverageAmount),
      annualPremium: String(p.annualPremium), startDate: p.startDate, endDate: p.endDate,
      totalInstallments: p.totalInstallments, paidInstallments: p.paidInstallments,
      isMandatory: !!p.isMandatory, notes: p.notes || '', documentUrl: p.documentUrl || '',
    });
    setShowAddPolicy(true);
  };

  const toggleParametric = (cov: ParametricCoverage) => {
    if (!userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguroParametrico', cov.id);
    setDocumentNonBlocking(ref, { isActive: !cov.isActive }, { merge: true });
    toast({ title: cov.isActive ? `Cobertura "${cov.type}" desactivada` : `✅ Cobertura "${cov.type}" activada` });
  };

  const handleMarkPaid = (policy: InsurancePolicy) => {
    if (!userId || !db) return;
    const newPaid = Math.min(policy.paidInstallments + 1, policy.totalInstallments);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguros', policy.id);
    setDocumentNonBlocking(ref, { paidInstallments: newPaid }, { merge: true });
    // Record payment
    const pId  = Math.random().toString(36).substr(2, 9);
    const pRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'segurosPagos', pId);
    const rec: PaymentRecord = {
      id: pId, policyId: policy.id,
      policyName: `${policy.type} — ${policy.insurer}`,
      propertyName: policy.propertyName,
      installmentNumber: newPaid,
      amount: Math.round(policy.annualPremium / policy.totalInstallments),
      dueDate: new Date().toISOString().slice(0,10),
      paidDate: new Date().toISOString().slice(0,10),
      status: 'Pagado', ownerId: userId,
    };
    setDocumentNonBlocking(pRef, rec, {});
    toast({ title: `Cuota ${newPaid}/${policy.totalInstallments} registrada`, description: fmt(rec.amount) });
  };

  const paramActive = paramCovs.filter(c => c.isActive).length;

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Seguros y Coberturas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Protección inteligente por propiedad. Registro, vencimientos y micro-coberturas paramétricas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Todas las propiedades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las propiedades</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {canWrite && (
            <Button className="gap-2 font-bold bg-primary" onClick={() => { setEditingPolicy(null); setPolicyForm({ ...EMPTY_POLICY }); setShowAddPolicy(true); }}>
              <Plus className="h-4 w-4" /> Nueva Póliza
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coverage total */}
        <Card className="col-span-2 lg:col-span-1 border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('h-2 w-2 rounded-full animate-pulse', mandatoryOK ? 'bg-green-500' : 'bg-red-500')} />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {mandatoryOK ? 'Sistema Activo' : 'Incendio sin cobertura'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Estado de Cobertura Total</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{fmtM(totalCoverage)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{activeCount} póliza{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        {/* Stats */}
        {[
          { label:'Vigentes',   value: activeCount,   color:'text-green-600',  bg:'bg-green-50',  icon: CheckCircle2 },
          { label:'Por vencer', value: expiringCount, color:'text-amber-600',  bg:'bg-amber-50',  icon: AlertTriangle },
          { label:'Vencidas',   value: expiredCount,  color:'text-red-600',    bg:'bg-red-50',    icon: ShieldAlert   },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', s.bg)}>
                <s.icon className={cn('h-5 w-5', s.color)} />
              </div>
              <div>
                <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ════════════════════════════════
            LEFT (2/3): Policies + History
        ════════════════════════════════ */}
        <div className="xl:col-span-2 space-y-6">

          {/* Mandatory compliance alert */}
          {!mandatoryOK && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <Flame className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-red-800">Seguro de Incendio sin cobertura activa</p>
                <p className="text-xs text-red-700 mt-0.5">
                  La <strong>Ley 13.512</strong> de Propiedad Horizontal exige seguro de incendio vigente. Registrá la póliza para cumplir con la normativa.
                </p>
              </div>
              {canWrite && (
                <Button size="sm" className="ml-auto shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                  onClick={() => { setPolicyForm(f => ({ ...f, type: 'Incendio', isMandatory: true })); setShowAddPolicy(true); }}>
                  + Agregar
                </Button>
              )}
            </div>
          )}

          {/* Policies list */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Registro de Pólizas
              </CardTitle>
              <span className="text-xs text-muted-foreground">{filteredPolicies.length} póliza{filteredPolicies.length !== 1 ? 's' : ''}</span>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {filteredPolicies.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold">Sin pólizas registradas</p>
                  {canWrite && (
                    <Button variant="outline" size="sm" className="mt-3 gap-2 font-bold"
                      onClick={() => setShowAddPolicy(true)}>
                      <Plus className="h-3.5 w-3.5" /> Registrar primera póliza
                    </Button>
                  )}
                </div>
              ) : (
                filteredPolicies.map(policy => {
                  const tc = POLICY_TYPES.find(t => t.id === policy.type);
                  const Icon = tc?.icon || Shield;
                  const sc = STATUS_CFG[policy.status];
                  const StatusIcon = sc.icon;
                  const d = daysUntil(policy.endDate);
                  const progress = policy.totalInstallments > 0
                    ? Math.round((policy.paidInstallments / policy.totalInstallments) * 100) : 0;
                  const monthlyInstall = policy.totalInstallments > 0
                    ? Math.round(policy.annualPremium / policy.totalInstallments) : 0;

                  return (
                    <div key={policy.id} className="p-4 rounded-xl border border-border/50 hover:bg-muted/10 transition-colors group">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', tc?.color ?? 'bg-slate-50 text-slate-600')}>
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-black text-sm text-foreground">{policy.type}</p>
                              <p className="text-[11px] text-muted-foreground">{policy.insurer} · #{policy.policyNumber}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge className={cn('border text-[10px] font-bold gap-1 shrink-0', sc.color)}>
                                <StatusIcon className="h-2.5 w-2.5" />
                                {policy.status}
                                {policy.status === 'Por vencer' && d >= 0 && ` (${d}d)`}
                              </Badge>
                              {canWrite && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditPolicy(policy)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                                  {canDelete && <button onClick={() => handleDeletePolicy(policy.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Key info row */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {policy.propertyName}</span>
                            <span className="flex items-center gap-1 font-bold text-foreground">
                              Suma asegurada: {fmtM(policy.coverageAmount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {policy.endDate.split('-').reverse().join('/')}
                            </span>
                          </div>

                          {/* Installments progress */}
                          {policy.totalInstallments > 0 && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Cuota {policy.paidInstallments}/{policy.totalInstallments} · {fmt(monthlyInstall)}/mes</span>
                                <span className="font-bold text-foreground">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-3">
                            {canWrite && policy.paidInstallments < policy.totalInstallments && (
                              <Button size="sm" variant="outline" className="h-7 text-xs font-bold gap-1 border-green-200 text-green-700 hover:bg-green-50"
                                onClick={() => handleMarkPaid(policy)}>
                                <CheckCircle2 className="h-3 w-3" /> Registrar cuota
                              </Button>
                            )}
                            {policy.documentUrl && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs font-bold gap-1 text-muted-foreground"
                                onClick={() => window.open(policy.documentUrl, '_blank')}>
                                <ExternalLink className="h-3 w-3" /> Ver póliza
                              </Button>
                            )}
                            {policy.isMandatory && (
                              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary font-bold">Obligatoria · Ley 13.512</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Payment history */}
          {payments.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Historial de Pagos
                </CardTitle>
                <span className="text-xs text-muted-foreground">{payments.length} registros</span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0 divide-y divide-border/40">
                  {[...payments].sort((a,b) => b.dueDate.localeCompare(a.dueDate)).slice(0,8).map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate">{p.policyName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Cuota {p.installmentNumber} · {p.propertyName} · {p.dueDate.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-foreground">{fmt(p.amount)}</span>
                        <Badge className={cn('border text-[10px] font-bold', PAY_STATUS_CFG[p.status])}>{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Traditional insurance marketplace */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black">Marketplace de Seguros</CardTitle>
              <p className="text-xs text-muted-foreground">Aseguradoras asociadas con condiciones preferenciales para administradores.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MARKETPLACE_PARTNERS.slice(0, showAllPartners ? undefined : 4).map(mp => {
                  const Icon = mp.icon;
                  return (
                    <div key={mp.insurer + mp.product} className="p-3 rounded-xl border border-border/50 hover:shadow-sm transition-shadow group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{mp.partner}</span>
                      </div>
                      <p className="font-black text-sm text-foreground">{mp.product}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{mp.insurer}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs font-bold">Gestionar</Button>
                        <Button size="sm" className="flex-1 h-7 text-xs font-bold bg-primary">{mp.cta}</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Consulting banner */}
              <div className="mt-4 flex items-center gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">Alianza Profesional</p>
                  <p className="font-black text-sm text-foreground">Asesoramiento Especializado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Auditá tu cartera con un corredor matriculado. Sin cargo para administradores.</p>
                </div>
                <Button className="shrink-0 gap-1.5 font-bold bg-primary text-white text-xs">
                  <Phone className="h-3.5 w-3.5" /> Consultar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════
            RIGHT (1/3): Weather + Parametric + Savings
        ════════════════════════════════ */}
        <div className="space-y-6">

          {/* Weather sensor */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sensores Locales · Bs. As.</p>
                {weatherLoading && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />}
              </div>
              {weather && (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{weather.temp}°C</span>
                    <Thermometer className="h-6 w-6 text-slate-400 mb-1" />
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> {weather.humidity}%</span>
                    <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> {weather.wind} km/h</span>
                    {weather.precipitation > 0 && (
                      <span className="flex items-center gap-1 text-blue-400 font-bold"><CloudRain className="h-3.5 w-3.5" /> {weather.precipitation}mm</span>
                    )}
                  </div>
                  {weather.nextAlert && (
                    <div className="mt-3 flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-blue-300 shrink-0" />
                      <span className="text-[11px] text-blue-200 font-bold">{weather.nextAlert}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Parametric micro-coverages */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Micro-coberturas
                </CardTitle>
                {paramActive > 0 && (
                  <Badge className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-black">{paramActive} activa{paramActive > 1 ? 's' : ''}</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Activación automática por condiciones climáticas reales.</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {(paramCovs.length > 0 ? paramCovs : PARAMETRIC_DEFAULTS.map((d,i) => ({ ...d, id: String(i), ownerId: userId ?? '' }))).map(cov => {
                const icons: Record<string,React.ElementType> = { Lluvia: CloudRain, Granizo: Snowflake, Viento: Wind, Temperatura: Thermometer };
                const Icon = icons[cov.type] || Shield;
                return (
                  <div key={cov.id} className={cn(
                    'p-3 rounded-xl border transition-all',
                    cov.isActive ? 'border-emerald-200 bg-emerald-50/40' : 'border-border/50 bg-muted/10'
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', cov.isActive ? 'bg-emerald-100' : 'bg-muted')}>
                          <Icon className={cn('h-4 w-4', cov.isActive ? 'text-emerald-600' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm">Cobertura {cov.type}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{cov.description}</p>
                          <p className="text-[10px] font-bold text-primary mt-1">{fmt(cov.costPerEvent)} / evento · {cov.triggerCondition}</p>
                        </div>
                      </div>
                      {canWrite && (
                        <Switch checked={cov.isActive} onCheckedChange={() => toggleParametric(cov)} className="shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Estimated savings */}
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-5 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <TrendingDown className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ahorro Estimado Anual</p>
                <p className="text-3xl font-black text-emerald-700 mt-1">{fmtM(estimatedSavings)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Vs. pólizas tradicionales estáticas</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Eficiencia del portfolio</span>
                  <span className="font-bold text-emerald-700">~18%</span>
                </div>
                <Progress value={18} max={30} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Expiry timeline */}
          {filteredPolicies.filter(p => p.status !== 'Cancelada').length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Próximos Vencimientos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {[...filteredPolicies]
                  .filter(p => p.status !== 'Cancelada')
                  .sort((a,b) => a.endDate.localeCompare(b.endDate))
                  .slice(0, 4)
                  .map(p => {
                    const d = daysUntil(p.endDate);
                    const tc = POLICY_TYPES.find(t => t.id === p.type);
                    const Icon = tc?.icon || Shield;
                    return (
                      <div key={p.id} className="flex items-center gap-2.5">
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', tc?.color ?? 'bg-slate-50 text-slate-600')}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{p.type} · {p.insurer}</p>
                          <p className="text-[10px] text-muted-foreground">{p.endDate.split('-').reverse().join('/')}</p>
                        </div>
                        <span className={cn('text-xs font-black shrink-0', d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-muted-foreground')}>
                          {d < 0 ? 'Vencida' : d === 0 ? 'Hoy' : `${d}d`}
                        </span>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>


      {/* ══════════════════════════════════════════
          Dialog: Agregar / Editar Póliza
      ══════════════════════════════════════════ */}
      <Dialog open={showAddPolicy} onOpenChange={v => { setShowAddPolicy(v); if (!v) { setEditingPolicy(null); setPolicyForm({ ...EMPTY_POLICY }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Editar Póliza' : 'Registrar Nueva Póliza'}</DialogTitle>
            <DialogDescription>Completá los datos de la póliza de seguro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Property */}
              <div className="col-span-2 space-y-1.5">
                <Label>Propiedad *</Label>
                <Select value={policyForm.propertyId} onValueChange={v => setPolicyForm(f => ({ ...f, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná la propiedad…" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Type */}
              <div className="space-y-1.5">
                <Label>Tipo de Seguro *</Label>
                <Select value={policyForm.type} onValueChange={v => setPolicyForm(f => ({ ...f, type: v as PolicyType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Insurer */}
              <div className="space-y-1.5">
                <Label>Aseguradora</Label>
                <Select value={policyForm.insurer} onValueChange={v => setPolicyForm(f => ({ ...f, insurer: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Policy number */}
              <div className="col-span-2 space-y-1.5">
                <Label>Número de Póliza *</Label>
                <Input placeholder="Ej: PH-2024-90812" value={policyForm.policyNumber} onChange={e => setPolicyForm(f => ({ ...f, policyNumber: e.target.value }))} />
              </div>
              {/* Coverage + premium */}
              <div className="space-y-1.5">
                <Label>Suma Asegurada ($)</Label>
                <Input type="number" placeholder="0" value={policyForm.coverageAmount} onChange={e => setPolicyForm(f => ({ ...f, coverageAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prima Anual ($)</Label>
                <Input type="number" placeholder="0" value={policyForm.annualPremium} onChange={e => setPolicyForm(f => ({ ...f, annualPremium: e.target.value }))} />
              </div>
              {/* Dates */}
              <div className="space-y-1.5">
                <Label>Fecha de Inicio</Label>
                <Input type="date" value={policyForm.startDate} onChange={e => setPolicyForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de Vencimiento</Label>
                <Input type="date" value={policyForm.endDate} onChange={e => setPolicyForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              {/* Installments */}
              <div className="space-y-1.5">
                <Label>Cuotas totales</Label>
                <Input type="number" min="1" max="12" value={policyForm.totalInstallments} onChange={e => setPolicyForm(f => ({ ...f, totalInstallments: parseInt(e.target.value) || 12 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cuotas pagadas</Label>
                <Input type="number" min="0" value={policyForm.paidInstallments} onChange={e => setPolicyForm(f => ({ ...f, paidInstallments: parseInt(e.target.value) || 0 }))} />
              </div>
              {/* Document URL */}
              <div className="col-span-2 space-y-1.5">
                <Label>URL del documento (opcional)</Label>
                <Input placeholder="https://… (link a la póliza en PDF)" value={policyForm.documentUrl} onChange={e => setPolicyForm(f => ({ ...f, documentUrl: e.target.value }))} />
              </div>
              {/* Notes */}
              <div className="col-span-2 space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea placeholder="Observaciones, condiciones especiales…" className="min-h-[60px]" value={policyForm.notes} onChange={e => setPolicyForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {/* Mandatory toggle */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={policyForm.isMandatory} onCheckedChange={v => setPolicyForm(f => ({ ...f, isMandatory: v }))} />
                  <div>
                    <span className="text-sm font-bold">Póliza obligatoria</span>
                    <span className="text-xs text-muted-foreground ml-2">(Ley 13.512 · PH)</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPolicy(false)}>Cancelar</Button>
            <Button className="font-bold px-8" onClick={handleSavePolicy}>
              {editingPolicy ? 'Guardar Cambios' : 'Registrar Póliza'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
