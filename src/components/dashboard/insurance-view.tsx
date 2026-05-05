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
import {
  Shield, ShieldCheck, ShieldAlert, Plus, Flame, CloudRain, Wind,
  Thermometer, Droplets, AlertTriangle, CheckCircle2, FileText,
  History, Building2, Edit2, Trash2,
  Loader2, Calendar, DollarSign, Phone, ExternalLink,
  Activity, Snowflake, Mail, Send, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { checkSSNAuthorization, type SSNResult } from '@/ai/flows/fetch-ssn-action';

const APP_ID           = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';
const ADMIN_COMMISSION  = 0.03;   // 3 % para la administradora
const SUPER_COMMISSION  = 0.02;   // 2 % para super admin

// ── Types ──────────────────────────────────────────────────────────────────────
type PolicyType   = 'Incendio' | 'Responsabilidad Civil' | 'Integral Hogar' | 'Caución' | 'Granizo' | 'Robo y Hurto' | 'Otro';
type PolicyStatus = 'Vigente' | 'Por vencer' | 'Vencida' | 'Cancelada';
type PayStatus    = 'Pagado' | 'Pendiente' | 'Vencido';
type QuoteStatus  = 'Enviada' | 'Respondida' | 'Convertida';

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

interface CommissionRecord {
  id: string; policyId: string; policyType: string; insurer: string;
  propertyName: string; annualPremium: number;
  adminCommission: number; superCommission: number;
  adminEmail: string; adminUserId: string; createdAt: string;
}

interface QuoteRequest {
  id: string; propertyId: string; propertyName: string; propertyAddress: string;
  insurer: string; policyType: PolicyType; coverageAmount: number;
  squareMeters: string; constructionType: string; propertyUse: string;
  ownerName: string; ownerCuit: string; contactEmail: string; contactPhone: string;
  notes: string; status: QuoteStatus;
  quotedPremium?: number;
  adminUserId: string; adminEmail: string; createdAt: string; responseDate?: string;
}

interface InsuranceViewProps { properties: Property[]; userId?: string }

// ── Config ─────────────────────────────────────────────────────────────────────
const POLICY_TYPES: { id: PolicyType; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'Incendio',              label: 'Incendio (Ley 13.512)',  icon: Flame,         color: 'text-red-600 bg-red-50'         },
  { id: 'Responsabilidad Civil', label: 'Resp. Civil',            icon: ShieldCheck,   color: 'text-blue-600 bg-blue-50'       },
  { id: 'Integral Hogar',        label: 'Integral Hogar',         icon: Building2,     color: 'text-emerald-600 bg-emerald-50' },
  { id: 'Caución',               label: 'Caución',                icon: DollarSign,    color: 'text-purple-600 bg-purple-50'   },
  { id: 'Granizo',               label: 'Granizo',                icon: Snowflake,     color: 'text-cyan-600 bg-cyan-50'       },
  { id: 'Robo y Hurto',          label: 'Robo y Hurto',           icon: ShieldAlert,   color: 'text-amber-600 bg-amber-50'     },
  { id: 'Otro',                  label: 'Otro',                   icon: Shield,        color: 'text-slate-600 bg-slate-50'     },
];

const INSURERS = [
  'Allianz','Mapfre','Zurich','San Cristóbal','Sancor Seguros',
  'Federación Patronal','La Segunda','Rivadavia','HSBC','BBVA Seguros','Otro',
];

const CONSTRUCTION_TYPES = [
  'Mampostería (Clase A)',
  'Hormigón armado',
  'Steel Frame / Metalcon',
  'Madera (Clase C)',
  'Mixta (mampostería + steel)',
];

interface MarketplacePartner {
  insurer: string; product: string; partner: string;
  icon: React.ElementType; cta: string;
  types: PolicyType[]; description: string;
}

const MARKETPLACE_PARTNERS: MarketplacePartner[] = [
  {
    insurer: 'San Cristóbal', product: 'Integral Hogar / Incendio PH',
    partner: 'Socio Preferente', icon: Building2, cta: 'Cotizar',
    types: ['Incendio', 'Integral Hogar'],
    description: 'Líder en consorcios de PH. Asistencia 24/7, red nacional de profesionales.',
  },
  {
    insurer: 'Sancor Seguros', product: 'Incendio / Resp. Civil',
    partner: 'Socio: Sancor', icon: Flame, cta: 'Cotizar',
    types: ['Incendio', 'Responsabilidad Civil'],
    description: 'Especialistas en edificios y PHs. Red nacional de productores.',
  },
  {
    insurer: 'Zurich', product: 'Robo y Hurto / Hogar',
    partner: 'Socio: Zurich', icon: ShieldAlert, cta: 'Cotizar',
    types: ['Robo y Hurto', 'Integral Hogar'],
    description: 'Cobertura multirriesgo con respaldo internacional y liquidación rápida.',
  },
  {
    insurer: 'Mapfre', product: 'Resp. Civil / Hogar',
    partner: 'Socio: Mapfre', icon: ShieldCheck, cta: 'Cotizar',
    types: ['Responsabilidad Civil', 'Integral Hogar'],
    description: 'RC para propietarios e inquilinos. Amplia red de liquidadores.',
  },
  {
    insurer: 'Federación Patronal', product: 'Incendio / Consorcio',
    partner: 'Socio: FP', icon: Building2, cta: 'Cotizar',
    types: ['Incendio', 'Responsabilidad Civil'],
    description: 'Fuerte cobertura en AMBA y provincia. Especialistas en consorcios.',
  },
];

const PARAMETRIC_DEFAULTS: Omit<ParametricCoverage,'id'|'ownerId'>[] = [
  { type:'Lluvia',      description:'Cobertura activada si la precipitación supera los 2mm en el día.',        costPerEvent:2500,  isActive:false, triggerCondition:'Lluvia > 2 mm',    activations:0, totalSaved:0 },
  { type:'Granizo',     description:'Activación ante eventos de granizo registrados por sensores locales.',    costPerEvent:8000,  isActive:false, triggerCondition:'Granizo detectado', activations:0, totalSaved:0 },
  { type:'Viento',      description:'Micro-cobertura ante vientos superiores a 60 km/h.',                     costPerEvent:3500,  isActive:false, triggerCondition:'Viento > 60 km/h', activations:0, totalSaved:0 },
  { type:'Temperatura', description:'Cobertura de daños por heladas si la temperatura baja de 0°C.',          costPerEvent:5000,  isActive:false, triggerCondition:'Temp < 0°C',       activations:0, totalSaved:0 },
];

const STATUS_CFG: Record<PolicyStatus,{color:string;icon:React.ElementType}> = {
  'Vigente':    { color:'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  'Por vencer': { color:'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  'Vencida':    { color:'bg-red-50 text-red-700 border-red-200',       icon: ShieldAlert   },
  'Cancelada':  { color:'bg-slate-50 text-slate-600 border-slate-200', icon: Shield        },
};

const PAY_STATUS_CFG: Record<PayStatus,string> = {
  'Pagado':    'bg-green-50 text-green-700 border-green-200',
  'Pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
  'Vencido':   'bg-red-50 text-red-700 border-red-200',
};

const QUOTE_STATUS_CFG: Record<QuoteStatus, { color: string }> = {
  'Enviada':    { color: 'bg-blue-50 text-blue-700 border-blue-200'    },
  'Respondida': { color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Convertida': { color: 'bg-green-50 text-green-700 border-green-200' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (d < 0)  return 'Vencida';
  if (d <= 30) return 'Por vencer';
  return 'Vigente';
}

/** Genera el cuerpo del email de cotización pre-formateado */
function buildMailtoBody(q: QuoteRequest, adminEmail: string): string {
  const coverageStr = q.coverageAmount > 0
    ? `$${q.coverageAmount.toLocaleString('es-AR')}`
    : 'A cotizar';

  const lines: string[] = [
    `Estimado equipo de ${q.insurer},`,
    '',
    'Por medio de la presente solicito cotización para el siguiente inmueble:',
    '',
    '━━━━ DATOS DEL INMUEBLE ━━━━',
    `Propiedad:            ${q.propertyName}`,
    `Dirección:            ${q.propertyAddress || 'Ver datos adjuntos'}`,
    `Superficie cubierta:  ${q.squareMeters ? q.squareMeters + ' m²' : 'A confirmar'}`,
    `Tipo de construcción: ${q.constructionType}`,
    `Destino:              ${q.propertyUse}`,
    '',
    '━━━━ COBERTURA SOLICITADA ━━━━',
    `Tipo de seguro:  ${q.policyType}`,
    `Suma a asegurar: ${coverageStr}`,
  ];

  if (q.policyType === 'Incendio') {
    lines.push('Encuadre normativo: Ley 13.512 — Propiedad Horizontal (seguro obligatorio)');
  }

  lines.push(
    '',
    '━━━━ DATOS DEL ASEGURADO ━━━━',
    `Nombre / Razón Social: ${q.ownerName || 'A confirmar'}`,
    `CUIT / DNI:            ${q.ownerCuit || 'A confirmar'}`,
    `Teléfono:              ${q.contactPhone || 'A confirmar'}`,
    `Email:                 ${q.contactEmail || adminEmail}`,
  );

  if (q.notes) {
    lines.push('', '━━━━ OBSERVACIONES ━━━━', q.notes);
  }

  lines.push(
    '',
    'Quedo a la espera de su cotización. Solicito respuesta al email indicado.',
    '',
    `Administradora: ${adminEmail}`,
    'Plataforma: AlquilaGestion Pro',
  );

  return lines.join('\n');
}

// ── Weather hook ───────────────────────────────────────────────────────────────
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

// ── Empty forms ────────────────────────────────────────────────────────────────
const EMPTY_POLICY = {
  propertyId: '', type: 'Incendio' as PolicyType, insurer: 'San Cristóbal',
  policyNumber: '', coverageAmount: '', annualPremium: '',
  startDate: '', endDate: '', totalInstallments: 12, paidInstallments: 0,
  isMandatory: false, notes: '', documentUrl: '',
};

const EMPTY_QUOTE = {
  propertyId: '', policyType: 'Incendio' as PolicyType, coverageAmount: '',
  squareMeters: '', constructionType: 'Mampostería (Clase A)', propertyUse: 'Vivienda',
  ownerName: '', ownerCuit: '', contactEmail: '', contactPhone: '', notes: '',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function InsuranceView({ properties, userId }: InsuranceViewProps) {
  const { toast }   = useToast();
  const db          = useFirestore();
  const { user }    = useUser();
  const { canWrite, canDelete } = useOrgPermissions();
  const { weather, loading: weatherLoading } = useWeather();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // ── Policy dialog state ──
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [showAddPolicy,    setShowAddPolicy]     = useState(false);
  const [editingPolicy,    setEditingPolicy]     = useState<InsurancePolicy | null>(null);
  const [policyForm,       setPolicyForm]        = useState({ ...EMPTY_POLICY });

  // ── Quote dialog state ──
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [quotePartner,    setQuotePartner]    = useState<MarketplacePartner | null>(null);
  const [quoteForm,       setQuoteForm]       = useState({ ...EMPTY_QUOTE });

  // ── SSN state ──
  const [ssnStatus,  setSsnStatus]  = useState<Record<string, SSNResult>>({});
  const [ssnLoading, setSsnLoading] = useState(false);

  // ── Firestore: per-user collections ──
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

  const quotesQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'cotizacionesSeguros'));
  }, [db, userId]);
  const { data: quotesRaw } = useCollection<QuoteRequest>(quotesQ);

  // ── Firestore: shared commissions ──
  const commissionsQ = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'seguroComisiones'));
  }, [db]);
  const { data: commissionsRaw } = useCollection<CommissionRecord>(commissionsQ);

  const policies      = (policiesRaw    ?? []).map(p => ({ ...p, status: policyStatus(p.endDate) }));
  const payments      = paymentsRaw     ?? [];
  const paramCovs     = paramRaw        ?? [];
  const quotes        = quotesRaw       ?? [];
  const allCommissions = commissionsRaw ?? [];
  const myCommissions  = isSuperAdmin
    ? allCommissions
    : allCommissions.filter(c => c.adminUserId === userId);

  // ── Seed parametric defaults ──
  useEffect(() => {
    if (!db || !userId || paramCovs.length > 0) return;
    PARAMETRIC_DEFAULTS.forEach(def => {
      const id  = Math.random().toString(36).substr(2, 9);
      const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguroParametrico', id);
      setDocumentNonBlocking(ref, { ...def, id, ownerId: userId }, {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, paramCovs.length]);

  // ── SSN check on mount ──
  useEffect(() => {
    setSsnLoading(true);
    checkSSNAuthorization(MARKETPLACE_PARTNERS.map(p => p.insurer))
      .then(results => {
        const map: Record<string, SSNResult> = {};
        results.forEach(r => { map[r.insurer] = r; });
        setSsnStatus(map);
      })
      .catch(() => {})
      .finally(() => setSsnLoading(false));
  }, []);

  // ── Derived stats ──
  const filteredPolicies = useMemo(() =>
    selectedProperty === 'all' ? policies : policies.filter(p => p.propertyId === selectedProperty),
  [policies, selectedProperty]);

  const totalCoverage  = filteredPolicies.reduce((a, p) => a + (p.coverageAmount || 0), 0);
  const activeCount    = filteredPolicies.filter(p => p.status === 'Vigente').length;
  const expiringCount  = filteredPolicies.filter(p => p.status === 'Por vencer').length;
  const expiredCount   = filteredPolicies.filter(p => p.status === 'Vencida').length;
  const mandatoryOK    = filteredPolicies.some(p => p.type === 'Incendio' && p.status === 'Vigente');
  const paramActive    = paramCovs.filter(c => c.isActive).length;

  // ── Handler: save policy ──
  const handleSavePolicy = () => {
    if (!policyForm.propertyId || !policyForm.policyNumber.trim() || !userId || !db) {
      toast({ title: 'Completá propiedad y número de póliza', variant: 'destructive' }); return;
    }
    const id   = editingPolicy?.id || Math.random().toString(36).substr(2, 9);
    const ref  = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguros', id);
    const prop = properties.find(p => p.id === policyForm.propertyId);
    const data: InsurancePolicy = {
      id, propertyId: policyForm.propertyId,
      propertyName:      prop?.name || '',
      type:              policyForm.type,
      insurer:           policyForm.insurer,
      policyNumber:      policyForm.policyNumber.trim(),
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

    // Commission on new policies only
    if (!editingPolicy && data.annualPremium > 0 && user?.email) {
      const cId  = Math.random().toString(36).substr(2, 9);
      const cRef = doc(db, 'artifacts', APP_ID, 'seguroComisiones', cId);
      const comm: CommissionRecord = {
        id: cId, policyId: id,
        policyType: data.type, insurer: data.insurer,
        propertyName: data.propertyName,
        annualPremium: data.annualPremium,
        adminCommission: Math.round(data.annualPremium * ADMIN_COMMISSION),
        superCommission: Math.round(data.annualPremium * SUPER_COMMISSION),
        adminEmail: user.email, adminUserId: userId,
        createdAt: new Date().toISOString(),
      };
      setDocumentNonBlocking(cRef, comm, {});
    }

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

  // ── Handler: parametric toggle ──
  const toggleParametric = (cov: ParametricCoverage) => {
    if (!userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'seguroParametrico', cov.id);
    setDocumentNonBlocking(ref, { isActive: !cov.isActive }, { merge: true });
    toast({ title: cov.isActive ? `Cobertura "${cov.type}" desactivada` : `✅ Cobertura "${cov.type}" activada` });
  };

  // ── Handler: mark paid ──
  const handleMarkPaid = (policy: InsurancePolicy) => {
    if (!userId || !db) return;
    const newPaid = Math.min(policy.paidInstallments + 1, policy.totalInstallments);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'seguros', policy.id), { paidInstallments: newPaid }, { merge: true });
    const pId  = Math.random().toString(36).substr(2, 9);
    const rec: PaymentRecord = {
      id: pId, policyId: policy.id,
      policyName: `${policy.type} — ${policy.insurer}`,
      propertyName: policy.propertyName,
      installmentNumber: newPaid,
      amount: Math.round(policy.annualPremium / policy.totalInstallments),
      dueDate:  new Date().toISOString().slice(0,10),
      paidDate: new Date().toISOString().slice(0,10),
      status: 'Pagado', ownerId: userId,
    };
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'segurosPagos', pId), rec, {});
    toast({ title: `Cuota ${newPaid}/${policy.totalInstallments} registrada`, description: fmt(rec.amount) });
  };

  // ── Handler: open quote dialog ──
  const openQuoteDialog = (partner: MarketplacePartner) => {
    setQuotePartner(partner);
    setQuoteForm({ ...EMPTY_QUOTE, policyType: partner.types[0] ?? 'Incendio' });
    setShowQuoteDialog(true);
  };

  // ── Handler: send quote ──
  const handleSendQuote = () => {
    if (!quoteForm.propertyId || !quotePartner || !userId || !db) {
      toast({ title: 'Seleccioná una propiedad para continuar', variant: 'destructive' }); return;
    }
    const id   = Math.random().toString(36).substr(2, 9);
    const prop = properties.find(p => p.id === quoteForm.propertyId);
    const quote: QuoteRequest = {
      id, propertyId: quoteForm.propertyId,
      propertyName:    prop?.name    || '',
      propertyAddress: prop?.address || '',
      insurer:         quotePartner.insurer,
      policyType:      quoteForm.policyType,
      coverageAmount:  parseFloat(quoteForm.coverageAmount) || 0,
      squareMeters:    quoteForm.squareMeters || (prop?.squareMeters ? String(prop.squareMeters) : ''),
      constructionType: quoteForm.constructionType,
      propertyUse:     quoteForm.propertyUse,
      ownerName:       quoteForm.ownerName,
      ownerCuit:       quoteForm.ownerCuit,
      contactEmail:    quoteForm.contactEmail || user?.email || '',
      contactPhone:    quoteForm.contactPhone,
      notes:           quoteForm.notes,
      status:          'Enviada',
      adminUserId:     userId,
      adminEmail:      user?.email || '',
      createdAt:       new Date().toISOString(),
    };

    setDocumentNonBlocking(
      doc(db, 'artifacts', APP_ID, 'users', userId, 'cotizacionesSeguros', id),
      quote, {},
    );

    // Abrir mailto pre-formateado
    const body    = buildMailtoBody(quote, user?.email || '');
    const subject = encodeURIComponent(
      `Solicitud de cotización — ${quote.policyType} · ${quote.propertyName}`,
    );
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank');

    setShowQuoteDialog(false);
    setQuoteForm({ ...EMPTY_QUOTE });
    toast({
      title: '✅ Cotización preparada',
      description: `El email se abrió en tu cliente de correo. Envialo a ${quotePartner.insurer} o al broker de tu confianza.`,
    });
  };

  // ── Handler: update quote status ──
  const handleUpdateQuoteStatus = (q: QuoteRequest, status: QuoteStatus) => {
    if (!userId || !db) return;
    const update: Partial<QuoteRequest> = { status };
    if (status === 'Respondida') update.responseDate = new Date().toISOString();
    setDocumentNonBlocking(
      doc(db, 'artifacts', APP_ID, 'users', userId, 'cotizacionesSeguros', q.id),
      update, { merge: true },
    );
    toast({ title: `Cotización marcada como "${status}"` });
  };

  // ── Handler: convert quote to policy ──
  const handleConvertQuote = (q: QuoteRequest) => {
    setPolicyForm({
      propertyId:   q.propertyId,
      type:         q.policyType,
      insurer:      q.insurer,
      policyNumber: '',
      coverageAmount: String(q.coverageAmount || ''),
      annualPremium:  String(q.quotedPremium  || ''),
      startDate:    new Date().toISOString().slice(0, 10),
      endDate:      '',
      totalInstallments: 12,
      paidInstallments:  0,
      isMandatory:  q.policyType === 'Incendio',
      notes:        `Generado desde cotización con ${q.insurer} (${q.createdAt.slice(0,10).split('-').reverse().join('/')})`,
      documentUrl:  '',
    });
    setEditingPolicy(null);
    // Mark as converted
    if (db) {
      setDocumentNonBlocking(
        doc(db, 'artifacts', APP_ID, 'users', userId!, 'cotizacionesSeguros', q.id),
        { status: 'Convertida' }, { merge: true },
      );
    }
    setShowAddPolicy(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Seguros y Coberturas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de pólizas, cotizaciones con aseguradoras y micro-coberturas paramétricas.
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
            <Button className="gap-2 font-bold bg-primary"
              onClick={() => { setEditingPolicy(null); setPolicyForm({ ...EMPTY_POLICY }); setShowAddPolicy(true); }}>
              <Plus className="h-4 w-4" /> Nueva Póliza
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 lg:col-span-1 border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('h-2 w-2 rounded-full animate-pulse', mandatoryOK ? 'bg-green-500' : 'bg-red-500')} />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {mandatoryOK ? 'Sistema Activo' : 'Incendio sin cobertura'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Cobertura Total</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{fmtM(totalCoverage)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{activeCount} póliza{activeCount !== 1 ? 's' : ''} activa{activeCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        {[
          { label:'Vigentes',   value: activeCount,   color:'text-green-600', bg:'bg-green-50', icon: CheckCircle2 },
          { label:'Por vencer', value: expiringCount, color:'text-amber-600', bg:'bg-amber-50', icon: AlertTriangle },
          { label:'Vencidas',   value: expiredCount,  color:'text-red-600',   bg:'bg-red-50',   icon: ShieldAlert  },
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

        {/* ════════════ LEFT (2/3) ════════════ */}
        <div className="xl:col-span-2 space-y-6">

          {/* Mandatory compliance alert */}
          {!mandatoryOK && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <Flame className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-red-800">Seguro de Incendio sin cobertura activa</p>
                <p className="text-xs text-red-700 mt-0.5">
                  La <strong>Ley 13.512</strong> de Propiedad Horizontal exige seguro de incendio vigente.
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
                    <Button variant="outline" size="sm" className="mt-3 gap-2 font-bold" onClick={() => setShowAddPolicy(true)}>
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
                                {policy.status}{policy.status === 'Por vencer' && d >= 0 && ` (${d}d)`}
                              </Badge>
                              {canWrite && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditPolicy(policy)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                                  {canDelete && <button onClick={() => handleDeletePolicy(policy.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {policy.propertyName}</span>
                            <span className="flex items-center gap-1 font-bold text-foreground">Suma: {fmtM(policy.coverageAmount)}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {policy.endDate.split('-').reverse().join('/')}</span>
                          </div>
                          {policy.totalInstallments > 0 && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Cuota {policy.paidInstallments}/{policy.totalInstallments} · {fmt(monthlyInstall)}/mes</span>
                                <span className="font-bold text-foreground">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          )}
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
                <div className="divide-y divide-border/40">
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

          {/* Quote history */}
          {quotes.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> Cotizaciones Solicitadas
                </CardTitle>
                <span className="text-xs text-muted-foreground">{quotes.length} solicitud{quotes.length !== 1 ? 'es' : ''}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/40">
                  {[...quotes].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,6).map(q => (
                    <div key={q.id} className="flex items-start justify-between py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm">{q.policyType} — {q.insurer}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {q.propertyName} · {q.createdAt.slice(0,10).split('-').reverse().join('/')}
                        </p>
                        {q.coverageAmount > 0 && (
                          <p className="text-[11px] font-bold text-foreground mt-0.5">Suma: {fmt(q.coverageAmount)}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge className={cn('border text-[10px] font-bold', QUOTE_STATUS_CFG[q.status].color)}>
                          {q.status}
                        </Badge>
                        {q.status !== 'Convertida' && canWrite && (
                          <Select value={q.status} onValueChange={v => handleUpdateQuoteStatus(q, v as QuoteStatus)}>
                            <SelectTrigger className="h-6 text-[10px] w-28 px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Enviada">Enviada</SelectItem>
                              <SelectItem value="Respondida">Respondida</SelectItem>
                              <SelectItem value="Convertida">Convertida</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {q.status === 'Respondida' && canWrite && (
                          <Button size="sm" className="h-6 text-[10px] font-bold px-2 bg-primary"
                            onClick={() => handleConvertQuote(q)}>
                            Crear póliza
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Marketplace */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black">Marketplace de Aseguradoras</CardTitle>
                {ssnLoading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Solicitá cotizaciones directamente desde la plataforma. El sistema pre-llena los datos de la propiedad.
              </p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MARKETPLACE_PARTNERS.map(mp => {
                  const Icon = mp.icon;
                  const ssn  = ssnStatus[mp.insurer];
                  return (
                    <div key={mp.insurer} className="p-3 rounded-xl border border-border/50 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">{mp.partner}</span>
                          {ssn && (
                            <Badge className={cn(
                              'text-[9px] font-bold border px-1.5 py-0',
                              ssn.authorized
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200',
                            )}>
                              {ssn.authorized ? '✓ Hab. SSN' : 'No reg.'}
                              {ssn.source === 'local' && <span className="opacity-60 ml-0.5">*</span>}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="font-black text-sm text-foreground">{mp.product}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{mp.description}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs font-bold gap-1"
                          onClick={() => openQuoteDialog(mp)}>
                          <Mail className="h-3 w-3" /> Cotizar
                        </Button>
                        <Button size="sm" className="flex-1 h-7 text-xs font-bold bg-primary gap-1"
                          onClick={() => openQuoteDialog(mp)}>
                          <Send className="h-3 w-3" /> Solicitar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SSN source note */}
              {Object.values(ssnStatus).some(s => s.source === 'local') && (
                <p className="text-[10px] text-muted-foreground">
                  * Verificación habilitación SSN: dato de lista interna (API SSN no disponible en este momento).
                  Confirmá en <span className="font-bold">ssn.gob.ar</span>.
                </p>
              )}

              {/* Consulting banner */}
              <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">Alianza Profesional</p>
                  <p className="font-black text-sm text-foreground">¿Tenés un broker de confianza?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usá el botón Cotizar, dejá el destinatario vacío y completá el email de tu corredor matriculado.
                  </p>
                </div>
                <Phone className="h-6 w-6 text-primary/40 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════ RIGHT (1/3) ════════════ */}
        <div className="space-y-6">

          {/* Weather sensor */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sensores · Bs. As.</p>
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
              <p className="text-[11px] text-muted-foreground">Activación automática por clima real.</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {(paramCovs.length > 0 ? paramCovs : PARAMETRIC_DEFAULTS.map((d,i) => ({ ...d, id: String(i), ownerId: userId ?? '' }))).map(cov => {
                const icons: Record<string, React.ElementType> = { Lluvia: CloudRain, Granizo: Snowflake, Viento: Wind, Temperatura: Thermometer };
                const Icon = icons[cov.type] || Shield;
                return (
                  <div key={cov.id} className={cn('p-3 rounded-xl border transition-all',
                    cov.isActive ? 'border-emerald-200 bg-emerald-50/40' : 'border-border/50 bg-muted/10')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                          cov.isActive ? 'bg-emerald-100' : 'bg-muted')}>
                          <Icon className={cn('h-4 w-4', cov.isActive ? 'text-emerald-600' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm">Cobertura {cov.type}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{cov.description}</p>
                          <p className="text-[10px] font-bold text-primary mt-1">{fmt(cov.costPerEvent)} / evento · {cov.triggerCondition}</p>
                        </div>
                      </div>
                      {canWrite && <Switch checked={cov.isActive} onCheckedChange={() => toggleParametric(cov)} className="shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Commission panel */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {isSuperAdmin ? 'Comisiones — Vista General' : 'Mis Comisiones'}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                {isSuperAdmin
                  ? `Tu corte ${SUPER_COMMISSION * 100}% sobre cada póliza gestionada en la plataforma`
                  : `Ganás el ${ADMIN_COMMISSION * 100}% de la prima anual de cada póliza que registrás`}
              </p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className={cn('grid gap-3', isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1')}>
                {isSuperAdmin && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Super Admin (2%)</p>
                    <p className="text-xl font-black text-amber-700 mt-0.5">
                      {fmtM(allCommissions.reduce((a, c) => a + c.superCommission, 0))}
                    </p>
                    <p className="text-[10px] text-amber-600">{allCommissions.length} póliza{allCommissions.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    {isSuperAdmin ? 'Admins (3%)' : `Tu comisión (${ADMIN_COMMISSION * 100}%)`}
                  </p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">
                    {fmtM(myCommissions.reduce((a, c) => a + c.adminCommission, 0))}
                  </p>
                  {!isSuperAdmin && (
                    <p className="text-[10px] text-emerald-600">{myCommissions.length} gestionada{myCommissions.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              {myCommissions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    {[...myCommissions].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4).map(c => (
                      <div key={c.id} className="flex items-start justify-between py-2 border-b border-border/30 last:border-0 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{c.policyType} · {c.insurer}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {isSuperAdmin ? `${c.adminEmail} · ` : ''}{c.propertyName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-black text-emerald-700">
                            {fmt(isSuperAdmin ? c.superCommission : c.adminCommission)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Prima: {fmtM(c.annualPremium)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {myCommissions.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Las comisiones se generan al registrar nuevas pólizas.
                </p>
              )}
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
                        <span className={cn('text-xs font-black shrink-0',
                          d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-muted-foreground')}>
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
          Dialog: Nueva / Editar Póliza
      ══════════════════════════════════════════ */}
      <Dialog open={showAddPolicy} onOpenChange={v => { setShowAddPolicy(v); if (!v) { setEditingPolicy(null); setPolicyForm({ ...EMPTY_POLICY }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Editar Póliza' : 'Registrar Nueva Póliza'}</DialogTitle>
            <DialogDescription>Completá los datos de la póliza.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Propiedad *</Label>
                <Select value={policyForm.propertyId} onValueChange={v => setPolicyForm(f => ({ ...f, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná la propiedad…" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Seguro *</Label>
                <Select value={policyForm.type} onValueChange={v => setPolicyForm(f => ({ ...f, type: v as PolicyType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{POLICY_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Aseguradora</Label>
                <Select value={policyForm.insurer} onValueChange={v => setPolicyForm(f => ({ ...f, insurer: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Número de Póliza *</Label>
                <Input placeholder="Ej: PH-2024-90812" value={policyForm.policyNumber} onChange={e => setPolicyForm(f => ({ ...f, policyNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Suma Asegurada ($)</Label>
                <Input type="number" placeholder="0" value={policyForm.coverageAmount} onChange={e => setPolicyForm(f => ({ ...f, coverageAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prima Anual ($)</Label>
                <Input type="number" placeholder="0" value={policyForm.annualPremium} onChange={e => setPolicyForm(f => ({ ...f, annualPremium: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de Inicio</Label>
                <Input type="date" value={policyForm.startDate} onChange={e => setPolicyForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de Vencimiento</Label>
                <Input type="date" value={policyForm.endDate} onChange={e => setPolicyForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cuotas totales</Label>
                <Input type="number" min="1" max="12" value={policyForm.totalInstallments} onChange={e => setPolicyForm(f => ({ ...f, totalInstallments: parseInt(e.target.value) || 12 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cuotas pagadas</Label>
                <Input type="number" min="0" value={policyForm.paidInstallments} onChange={e => setPolicyForm(f => ({ ...f, paidInstallments: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>URL del documento (opcional)</Label>
                <Input placeholder="https://… (link a la póliza en PDF)" value={policyForm.documentUrl} onChange={e => setPolicyForm(f => ({ ...f, documentUrl: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea placeholder="Observaciones, condiciones especiales…" className="min-h-[60px]" value={policyForm.notes} onChange={e => setPolicyForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
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

      {/* ══════════════════════════════════════════
          Dialog: Solicitar Cotización
      ══════════════════════════════════════════ */}
      <Dialog open={showQuoteDialog} onOpenChange={v => {
        setShowQuoteDialog(v);
        if (!v) { setQuoteForm({ ...EMPTY_QUOTE }); setQuotePartner(null); }
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Cotización — {quotePartner?.insurer}</DialogTitle>
            <DialogDescription>
              Los datos de la propiedad se pre-llenan automáticamente al seleccionarla.
              Completá los datos del asegurado para generar el email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Property */}
            <div className="space-y-1.5">
              <Label>Propiedad *</Label>
              <Select value={quoteForm.propertyId} onValueChange={v => {
                const prop = properties.find(p => p.id === v);
                setQuoteForm(f => ({
                  ...f,
                  propertyId:      v,
                  squareMeters:    prop?.squareMeters ? String(prop.squareMeters) : f.squareMeters,
                  propertyUse:     prop?.usage === 'Comercial' || prop?.usage === 'Industrial'
                                     ? 'Comercio'
                                     : prop?.usage === 'Profesional'
                                     ? 'Profesional'
                                     : 'Vivienda',
                  ownerName:       prop?.owners?.[0]?.name ?? f.ownerName,
                  contactEmail:    prop?.owners?.[0]?.email ?? f.contactEmail,
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná la propiedad…" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {quoteForm.propertyId && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Building2 className="h-3 w-3" />
                  {properties.find(p => p.id === quoteForm.propertyId)?.address}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Policy type */}
              <div className="space-y-1.5">
                <Label>Tipo de Seguro *</Label>
                <Select value={quoteForm.policyType} onValueChange={v => setQuoteForm(f => ({ ...f, policyType: v as PolicyType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(quotePartner?.types ?? POLICY_TYPES.map(t => t.id)).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coverage */}
              <div className="space-y-1.5">
                <Label>Suma a asegurar ($)</Label>
                <Input type="number" placeholder="0" value={quoteForm.coverageAmount}
                  onChange={e => setQuoteForm(f => ({ ...f, coverageAmount: e.target.value }))} />
              </div>

              {/* m² */}
              <div className="space-y-1.5">
                <Label>Superficie cubierta (m²)</Label>
                <Input type="number" placeholder="Ej: 85" value={quoteForm.squareMeters}
                  onChange={e => setQuoteForm(f => ({ ...f, squareMeters: e.target.value }))} />
              </div>

              {/* Construction */}
              <div className="space-y-1.5">
                <Label>Tipo de construcción</Label>
                <Select value={quoteForm.constructionType} onValueChange={v => setQuoteForm(f => ({ ...f, constructionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONSTRUCTION_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Use */}
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Select value={quoteForm.propertyUse} onValueChange={v => setQuoteForm(f => ({ ...f, propertyUse: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vivienda">Vivienda</SelectItem>
                    <SelectItem value="Comercio">Comercio</SelectItem>
                    <SelectItem value="Profesional">Profesional</SelectItem>
                    <SelectItem value="Mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Owner */}
              <div className="space-y-1.5">
                <Label>Nombre del asegurado</Label>
                <Input placeholder="Nombre / Razón social" value={quoteForm.ownerName}
                  onChange={e => setQuoteForm(f => ({ ...f, ownerName: e.target.value }))} />
              </div>

              {/* CUIT */}
              <div className="space-y-1.5">
                <Label>CUIT / DNI</Label>
                <Input placeholder="Ej: 20-12345678-0" value={quoteForm.ownerCuit}
                  onChange={e => setQuoteForm(f => ({ ...f, ownerCuit: e.target.value }))} />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="+54 11 1234-5678" value={quoteForm.contactPhone}
                  onChange={e => setQuoteForm(f => ({ ...f, contactPhone: e.target.value }))} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label>Email de contacto</Label>
                <Input type="email" placeholder="contacto@ejemplo.com" value={quoteForm.contactEmail}
                  onChange={e => setQuoteForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                placeholder="Antigüedad del edificio, piso/depto, condiciones especiales, urgencia…"
                className="min-h-[60px]"
                value={quoteForm.notes}
                onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Ley 13.512 note */}
            {quoteForm.policyType === 'Incendio' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Flame className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>Seguro obligatorio:</strong> La Ley 13.512 exige póliza de incendio vigente en consorcios de PH.
                  Se incluye este encuadre normativo en la solicitud.
                </p>
              </div>
            )}

            {/* How it works */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Se genera un email pre-formateado con todos los datos y se abre en tu cliente de correo.
                Completá el destinatario con el email de tu broker o de la aseguradora.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuoteDialog(false)}>Cancelar</Button>
            <Button className="font-bold px-8 gap-2 bg-primary" onClick={handleSendQuote}>
              <Mail className="h-4 w-4" /> Generar email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
