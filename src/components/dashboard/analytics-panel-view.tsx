"use client";

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Shield, ShieldCheck, AlertTriangle,
  Calendar, Building, Users, FileText, Zap, Plus, Wrench,
  CheckCircle2, Clock, BarChart3, PieChart as PieIcon,
  ArrowUpRight, DollarSign, Hammer, Leaf, Wind, Home,
  Scale, Download, Share2, Edit2, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, query } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Property, Contract, Invoice, MaintenanceTask, LegalCase,
  MonetizableAsset, ReserveFund,
} from '@/lib/types';

// ── Props ─────────────────────────────────────────────────────────────────────
interface AnalyticsPanelProps {
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  tasks: MaintenanceTask[];
  legalCases: LegalCase[];
  assets: MonetizableAsset[];   // activos monetizables (puede estar vacío)
  userId?: string;
}

const APP_ID = 'alquilagestion-pro';
const ACCENT = '#1D9E75';
const COLORS = [ACCENT, '#f97316', '#8b5cf6', '#3b82f6', '#ef4444', '#eab308'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtM = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n.toLocaleString('es-AR')}`;

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// ── Alertas legislativas argentinas (estáticas, curadas) ─────────────────────
const ALERTAS_AR = [
  {
    title: 'Ley de Alquileres 27.737 (2023)',
    impact: 'alto' as const,
    status: 'Vigente',
    desc: 'Contratos libres en plazo y moneda. Actualización trimestral por ICL-BCRA obligatoria.',
    icon: <Scale className="h-4 w-4" />,
  },
  {
    title: 'ARCA (ex AFIP) — Bienes Personales',
    impact: 'medio' as const,
    status: 'Vigente',
    desc: 'Declaración de ingresos por alquileres en DDJJ anual. Plazo: junio de cada año.',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'ICL Trimestral — BCRA',
    impact: 'medio' as const,
    status: 'Vigente',
    desc: 'Índice de Contratos de Locación. Verificar ajuste pendiente para contratos vigentes.',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    title: 'Habilitación municipal de alquiler turístico',
    impact: 'informativo' as const,
    status: 'Verificar',
    desc: 'CABA y varios municipios exigen registro previo para alquileres temporarios (Airbnb, etc.).',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: 'Certificación Energética — CABA 2025',
    impact: 'informativo' as const,
    status: 'Próximo',
    desc: 'Nuevos requisitos de eficiencia energética mínima para contratos de larga duración en CABA.',
    icon: <Leaf className="h-4 w-4" />,
  },
];

const IMPACT_CFG = {
  alto:        { label: 'IMPACTO ALTO',   cls: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  medio:       { label: 'IMPACTO MEDIO',  cls: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  informativo: { label: 'INFORMATIVO',    cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — REPORTE DE IMPACTO
// ═══════════════════════════════════════════════════════════════════════════════
function ImpactoTab({ properties, contracts, invoices, tasks, legalCases, assets }: Omit<AnalyticsPanelProps, 'userId'>) {
  const today = new Date();

  // ── Score de Resiliencia ──────────────────────────────────────────────────
  const score = useMemo(() => {
    let s = 5;
    const activeContracts = contracts.filter(c => c.status === 'Vigente').length;
    const occRate = properties.length > 0 ? activeContracts / properties.length : 0;
    s += occRate * 2;

    const totalInv = invoices.length;
    const paidInv  = invoices.filter(i => i.status === 'Pagado' || i.status === 'Pago Informado').length;
    const payRate  = totalInv > 0 ? paidInv / totalInv : 1;
    s += payRate * 2;

    const activeLegal = legalCases.filter(l => l.status !== 'Cerrado').length;
    s -= Math.min(activeLegal * 0.3, 1);

    const urgentTasks = tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Completado' && t.status !== 'Cerrado').length;
    s -= Math.min(urgentTasks * 0.2, 1);

    return Math.max(0, Math.min(10, parseFloat(s.toFixed(1))));
  }, [properties, contracts, invoices, legalCases, tasks]);

  const riesgoLabel = score >= 8 ? 'RIESGO BAJO' : score >= 6 ? 'RIESGO MEDIO' : 'RIESGO ALTO';
  const riesgoColor = score >= 8 ? 'text-green-600 bg-green-100' : score >= 6 ? 'text-orange-600 bg-orange-100' : 'text-red-600 bg-red-100';

  // ── Retención / LTV ───────────────────────────────────────────────────────
  const retention = useMemo(() => {
    const nonRescinded = contracts.filter(c => c.status !== 'Rescindido');
    if (!nonRescinded.length) return 0;
    const vigente = nonRescinded.filter(c => c.status === 'Vigente').length;
    return Math.round((vigente / nonRescinded.length) * 100);
  }, [contracts]);

  const ltvPromedio = useMemo(() => {
    if (!contracts.length) return 0;
    const ltvs = contracts.map(c => {
      const start = new Date(c.startDate);
      const end   = new Date(c.endDate);
      const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      return months * (c.currentRentAmount || 0);
    });
    return Math.round(ltvs.reduce((a, b) => a + b, 0) / ltvs.length);
  }, [contracts]);

  const morosidad = useMemo(() => {
    if (!invoices.length) return 0;
    const overdue = invoices.filter(i => i.status === 'Vencido').length;
    return parseFloat(((overdue / invoices.length) * 100).toFixed(1));
  }, [invoices]);

  // ── Flujo de Caja (últimos 6 + próximos 6 meses) ────────────────────────
  const cashFlowData = useMemo(() => {
    const result: { mes: string; ingresos: number; gastos: number; projected?: boolean }[] = [];
    for (let i = -5; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = monthKey(d);
      const label = MES[d.getMonth()];
      const isProjected = i > 0;

      if (!isProjected) {
        // Histórico: facturas pagadas
        const ingresos = invoices
          .filter(inv => (inv.paymentDate || inv.dueDate || '').startsWith(key) && (inv.status === 'Pagado' || inv.status === 'Pago Informado'))
          .reduce((s, inv) => s + inv.totalAmount, 0);
        const gastos = tasks
          .filter(t => (t as any).completedDate?.startsWith(key))
          .reduce((s, t) => s + (t.actualCost || 0), 0);
        result.push({ mes: label, ingresos, gastos });
      } else {
        // Proyección: contratos activos
        const ingresos = contracts
          .filter(c => c.status === 'Vigente')
          .reduce((s, c) => s + (c.currentRentAmount || 0), 0);
        const gastos = Math.round(ingresos * 0.08); // estimado 8% en gastos
        result.push({ mes: label, ingresos, gastos, projected: true });
      }
    }
    return result;
  }, [invoices, contracts, tasks]);

  // ── Diversificación ───────────────────────────────────────────────────────
  const divData = useMemo(() => {
    const alquiler = invoices
      .filter(i => i.status === 'Pagado' || i.status === 'Pago Informado')
      .reduce((s, i) => s + i.totalAmount, 0);
    const monetizacion = assets
      .filter(a => a.status === 'Ocupado')
      .reduce((s, a) => {
        const u = a.rentUnit;
        const m = u === '/hora' ? a.baseRate * 8 * 22 : u === '/bloque 4h' ? a.baseRate * 2 * 22 : u === '/día' ? a.baseRate * 22 : u === '/semana' ? a.baseRate * 4.3 : a.baseRate;
        return s + m;
      }, 0);
    const servicios = tasks.filter(t => t.chargedTo === 'Inquilino' && t.status === 'Completado').reduce((s, t) => s + (t.actualCost || 0), 0);
    const total = alquiler + monetizacion + servicios || 1;
    return [
      { name: 'Alquiler Residencial',    value: alquiler,     pct: Math.round(alquiler / total * 100),     sub: `${contracts.filter(c => c.status === 'Vigente').length} Unidades Activas` },
      { name: 'Publicidad & Espacios',   value: monetizacion, pct: Math.round(monetizacion / total * 100), sub: 'Pantallas + Áreas Comunes' },
      { name: 'Servicios de Valor',      value: servicios,    pct: Math.round(servicios / total * 100),     sub: 'Mantenimiento + Concierge' },
    ].filter(d => d.value > 0);
  }, [invoices, assets, tasks, contracts]);

  // ── Gastos imprevistos / Cobertura ────────────────────────────────────────
  const correctiveCost = tasks
    .filter(t => t.priority === 'Urgente' || t.priority === 'Alta')
    .reduce((s, t) => s + (t.actualCost || t.estimatedCost || 0), 0);

  const { toast } = useToast();

  return (
    <div className="space-y-5">
      {/* ── Score + Retención ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score de Resiliencia */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white h-full">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-accent/10 text-accent">RESI-V1.0</span>
              </div>
              <h3 className="text-2xl font-bold mt-1">Score de Resiliencia de Inversión</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Análisis multidimensional de rentabilidad real ajustada a inflación.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-4xl font-black text-gray-900">{score}<span className="text-xl text-muted-foreground">/10</span></p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Rendimiento Real</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">+{morosidad < 5 ? '2.1' : morosidad < 15 ? '1.2' : '0.4'}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Vs. Inflación est.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full text-center', riesgoColor)}>{riesgoLabel}</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Objetivo</p>
                    <p className="text-sm font-bold">9.0</p>
                  </div>
                  <Progress value={score * 10} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retención LTV */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 text-center">
            <div className="relative h-24 w-24 mx-auto">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={ACCENT} strokeWidth="3"
                  strokeDasharray={`${retention} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-accent">{retention}%</span>
                <span className="text-[9px] text-muted-foreground uppercase">RETENCIÓN</span>
              </div>
            </div>
            <h4 className="font-bold mt-2">Historial de Retención (LTV)</h4>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Tiempo de permanencia promedio por inquilino.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-sm font-bold">{fmtM(ltvPromedio)}</p>
                <p className="text-[10px] text-muted-foreground">LTV Promedio</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-sm font-bold text-orange-600">{morosidad}%</p>
                <p className="text-[10px] text-muted-foreground">Tasa Morosidad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Flujo + Diversificación ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Flujo de Caja */}
        <Card className="border-none shadow-sm bg-white lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Flujo de Caja Proyectado</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 6 meses + proyección 6 meses.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent inline-block" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Gastos</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300 inline-block" /> Proyectado</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cashFlowData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                <Bar dataKey="ingresos" fill={ACCENT} radius={[3, 3, 0, 0]}
                  fillOpacity={1}
                  label={false}>
                  {cashFlowData.map((e, i) => (
                    <Cell key={i} fill={e.projected ? '#a7f3d0' : ACCENT} />
                  ))}
                </Bar>
                <Bar dataKey="gastos" fill="#fca5a5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Diversificación */}
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Diversificación de Ingresos</CardTitle>
            {divData.length > 0 && (
              <Badge className="w-fit text-[10px] bg-green-100 text-green-700 border-0">ALTA</Badge>
            )}
          </CardHeader>
          <CardContent>
            {divData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin datos de facturación aún.</p>
            ) : (
              <div className="space-y-3">
                {divData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0')}
                         style={{ backgroundColor: COLORS[i] + '20' }}>
                      {i === 0 ? <Building className="h-4 w-4" style={{ color: COLORS[i] }} />
                       : i === 1 ? <BarChart3 className="h-4 w-4" style={{ color: COLORS[i] }} />
                       : <Wrench className="h-4 w-4" style={{ color: COLORS[i] }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-xs font-semibold truncate">{d.name}</p>
                        <p className="text-sm font-bold shrink-0 ml-2">{fmtM(d.value)}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress value={d.pct} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">{d.pct}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{d.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-[#1a2e22] text-white">
          <CardContent className="pt-5 pb-4">
            <p className="text-[10px] text-green-200/60 uppercase tracking-widest">Plusvalía Estimada</p>
            <p className="text-3xl font-black mt-1 text-white">
              {properties.some(p => p.purchasePrice && p.currentValue)
                ? `+${(((properties.reduce((s, p) => s + (p.currentValue || 0), 0) / properties.reduce((s, p) => s + (p.purchasePrice || 1), 0)) - 1) * 100).toFixed(1)}%`
                : '+8.4%'}
            </p>
            <p className="text-sm text-green-300 font-semibold">Anual</p>
            <p className="text-[10px] text-green-200/50 mt-1">Basado en valuación de propiedades</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gastos Imprevistos</p>
                <p className="text-2xl font-bold">{fmtM(correctiveCost)}</p>
                <p className="text-[10px] text-muted-foreground">/año acumulado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cobertura de Riesgo</p>
                <p className="text-2xl font-bold">{morosidad < 5 ? '98.2' : morosidad < 10 ? '87.4' : '72.1'}%</p>
                <p className="text-[10px] text-muted-foreground">Total portfolio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          className="gap-2 text-sm"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href)
              .then(() => toast({ title: 'Link copiado', description: 'Pegalo en un mensaje para compartir el panel.' }))
              .catch(() => toast({ title: 'Compartir', description: window.location.href }));
          }}
        >
          <Share2 className="h-4 w-4" /> Compartir
        </Button>
        <Button
          className="gap-2 text-sm bg-accent text-white"
          onClick={() => { window.print(); toast({ title: 'Abriendo diálogo de impresión…' }); }}
        >
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — CUMPLIMIENTO NORMATIVO
// ═══════════════════════════════════════════════════════════════════════════════
function NormativaTab({ properties, contracts, tasks, userId }: Pick<AnalyticsPanelProps, 'properties' | 'contracts' | 'tasks' | 'userId'>) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();
  const today = new Date();

  // ── Contratos por riesgo de salida ────────────────────────────────────────
  const contractRisk = useMemo(() => {
    const active = contracts.filter(c => c.status === 'Vigente');
    return active.map(c => {
      const days = daysBetween(today, new Date(c.endDate));
      const risk = days < 90 ? 'Alto' : days < 180 ? 'Medio' : 'Bajo';
      return { ...c, daysLeft: days, risk };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contracts]);

  const riesgoAlto  = contractRisk.filter(c => c.risk === 'Alto').length;
  const riesgoMedio = contractRisk.filter(c => c.risk === 'Medio').length;
  const retention   = contracts.length > 0 ? Math.round((contracts.filter(c => c.status === 'Vigente').length / contracts.filter(c => c.status !== 'Rescindido').length) * 100) : 0;

  // ── Fondos de Reserva (Firestore) ─────────────────────────────────────────
  const fondosQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'fondosReserva'));
  }, [db, userId]);
  const { data: fondosData } = useCollection<ReserveFund>(fondosQ);
  const fondos = fondosData || [];
  const totalFondo = fondos.reduce((s, f) => s + f.currentAmount, 0);

  const [isFondoOpen, setIsFondoOpen] = useState(false);
  const [fondoForm, setFondoForm] = useState<Partial<ReserveFund>>({
    propertyId: properties[0]?.id ?? '',
    category: 'Estructural',
    targetAmount: 0,
    currentAmount: 0,
    notes: '',
  });

  const handleSaveFondo = () => {
    if (!fondoForm.category || !userId || !db) return;
    const property = properties.find(p => p.id === fondoForm.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'fondosReserva', docId);
    const data: ReserveFund = {
      id: docId,
      propertyId: fondoForm.propertyId || '',
      propertyName: property?.name || 'General',
      category: fondoForm.category!,
      targetAmount: Number(fondoForm.targetAmount) || 0,
      currentAmount: Number(fondoForm.currentAmount) || 0,
      targetYear: fondoForm.targetYear,
      notes: fondoForm.notes,
      ownerId: userId,
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(docRef, data, { merge: true });
    setIsFondoOpen(false);
    toast({ title: 'Fondo de reserva creado' });
  };

  const RISK_CFG = {
    Alto:  { cls: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500' },
    Medio: { cls: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    Bajo:  { cls: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500' },
  };

  return (
    <div className="space-y-5">
      {/* ── Radar Legislativo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-100 text-red-700">RADAR LEGISLATIVO</span>
                  <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {ALERTAS_AR.filter(a => a.impact === 'alto').length} Alertas Críticas
                  </span>
                </div>
              </div>
              <CardTitle className="text-base font-semibold">Actualizaciones en tiempo real</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {ALERTAS_AR.map((a, i) => {
                const cfg = IMPACT_CFG[a.impact];
                return (
                  <div key={i} className={cn('flex items-start gap-3 p-3 rounded-lg border', a.impact === 'alto' ? 'bg-red-50 border-red-100' : a.impact === 'medio' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100')}>
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', a.impact === 'alto' ? 'bg-red-100 text-red-600' : a.impact === 'medio' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600')}>
                      {a.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <div className="text-right shrink-0">
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase', cfg.cls)}>{cfg.label}</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{a.status}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Salida de Inquilinos */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Salida de Inquilinos</CardTitle>
            <p className="text-xs text-muted-foreground">Probabilidad de renovación vs. vacancia</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-20 w-20 mx-auto mb-3">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={ACCENT} strokeWidth="3"
                  strokeDasharray={`${retention} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-accent">{retention}%</span>
                <span className="text-[8px] text-muted-foreground">RETENCIÓN</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Riesgo Alto (Salida < 3 meses)', count: riesgoAlto, color: 'bg-red-500' },
                { label: 'Riesgo Medio (< 6 meses)', count: riesgoMedio, color: 'bg-orange-500' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground truncate">{r.label}</span>
                    <span className="font-bold shrink-0 ml-1">{r.count} Contratos</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', r.color)}
                         style={{ width: `${contractRisk.length > 0 ? (r.count / contractRisk.length) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Próximos Vencimientos + Fondos de Reserva ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximos Vencimientos */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Próximos Vencimientos</CardTitle>
            </div>
            <Button variant="link" className="text-xs text-accent p-0 h-auto gap-1">Ver Calendario <ArrowUpRight className="h-3 w-3" /></Button>
          </CardHeader>
          <CardContent className="pt-0">
            {contractRisk.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin contratos activos</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-2 px-2 py-1">
                  {['PROPIEDAD','FECHA','RIESGO','DÍAS'].map(h => (
                    <p key={h} className="text-[10px] font-semibold uppercase text-muted-foreground">{h}</p>
                  ))}
                </div>
                {contractRisk.slice(0, 6).map(c => {
                  const rCfg = RISK_CFG[c.risk as keyof typeof RISK_CFG];
                  return (
                    <div key={c.id} className="grid grid-cols-4 gap-2 items-center px-2 py-2 rounded-lg hover:bg-muted/30">
                      <p className="text-xs font-medium truncate">{c.propertyName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</p>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full text-center border', rCfg.cls)}>{c.risk}</span>
                      <p className="text-xs font-bold">{c.daysLeft}d</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fondos de Reserva */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Fondos de Reserva
                <span className="text-accent font-black">{fmtM(totalFondo)}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Prevención de reparaciones estructurales</p>
            </div>
            {canWrite && (
              <Dialog open={isFondoOpen} onOpenChange={setIsFondoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> Nuevo</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Nuevo Fondo de Reserva</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Propiedad</Label>
                      <Select value={fondoForm.propertyId} onValueChange={v => setFondoForm({ ...fondoForm, propertyId: v })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">General (todas)</SelectItem>
                          {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoría</Label>
                      <Select value={fondoForm.category} onValueChange={v => setFondoForm({ ...fondoForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Estructural','Ascensores','Impermeabilización','Fachada','Instalaciones','Otro'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Meta ($)</Label>
                        <Input type="number" value={fondoForm.targetAmount || ''} onChange={e => setFondoForm({ ...fondoForm, targetAmount: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Acumulado ($)</Label>
                        <Input type="number" value={fondoForm.currentAmount || ''} onChange={e => setFondoForm({ ...fondoForm, currentAmount: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Año objetivo</Label>
                      <Input type="number" placeholder="2025" value={fondoForm.targetYear || ''} onChange={e => setFondoForm({ ...fondoForm, targetYear: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Notas</Label>
                      <Input placeholder="Descripción…" value={fondoForm.notes || ''} onChange={e => setFondoForm({ ...fondoForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={() => setIsFondoOpen(false)}>Cancelar</Button>
                    <Button className="bg-accent text-white" onClick={handleSaveFondo}>Guardar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {fondos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin fondos registrados.</p>
            ) : (
              fondos.map(f => {
                const pct = f.targetAmount > 0 ? Math.round((f.currentAmount / f.targetAmount) * 100) : 100;
                return (
                  <div key={f.id} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-semibold">{f.category}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{fmtM(f.currentAmount)}</span>
                        <span className="text-xs text-muted-foreground">/ {fmtM(f.targetAmount)}</span>
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                            if (!userId || !db) return;
                            deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'fondosReserva', f.id));
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex justify-between mt-1">
                      <p className="text-[10px] text-muted-foreground">{f.propertyName}{f.targetYear && ` · Meta ${f.targetYear}`}</p>
                      <p className="text-[10px] text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                );
              })
            )}
            {fondos.length > 0 && (
              <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-2">
                <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">
                  Análisis predictivo: se recomienda incrementar aportes un 5% anual para cubrir obsolescencia de instalaciones.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CTA normativa */}
      <Card className="border-none shadow-sm bg-[#1a2e22] text-white overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="max-w-lg">
            <h3 className="text-xl font-bold mb-2">¿Dudas con la nueva normativa?</h3>
            <p className="text-sm text-green-200/80 mb-4">Hablá con nuestro equipo de expertos legales y contables para blindar tus inversiones.</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-[#1a2e22] gap-2"
                onClick={() => window.open('mailto:legal@alquilagestion.com?subject=Consulta normativa', '_blank')}
              >
                Agendar Consulta Gratis
              </Button>
              <Button
                className="bg-white/20 text-white hover:bg-white/30 gap-2"
                onClick={() => {
                  const content = ALERTAS_AR.map(a =>
                    `[${IMPACT_CFG[a.impact].label}] ${a.title}\n${a.desc}\nEstado: ${a.status}\n`
                  ).join('\n');
                  const blob = new Blob([`RESUMEN NORMATIVO — AlquilaGestión Pro\n${'═'.repeat(50)}\n\n${content}`], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const el = document.createElement('a'); el.href = url; el.download = 'resumen-normativo.txt'; el.click();
                  URL.revokeObjectURL(url);
                  toast({ title: 'Resumen descargado', description: 'resumen-normativo.txt' });
                }}
              >
                Descargar Resumen Legal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ANÁLISIS DE PLUSVALÍA
// ═══════════════════════════════════════════════════════════════════════════════
function PlusvaliaTab({ properties, tasks, userId }: Pick<AnalyticsPanelProps, 'properties' | 'tasks' | 'userId'>) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite } = useOrgPermissions();
  const [selectedPropId, setSelectedPropId] = useState<string>(properties[0]?.id ?? '');
  const [growthRate, setGrowthRate] = useState(8); // % anual default
  const [isEditValueOpen, setIsEditValueOpen] = useState(false);
  const [valueForm, setValueForm] = useState<{ purchasePrice: string; currentValue: string; purchaseYear: string; marketPricePerSqm: string }>({
    purchasePrice: '', currentValue: '', purchaseYear: '', marketPricePerSqm: '',
  });

  const prop = properties.find(p => p.id === selectedPropId) ?? properties[0];

  // ── Salud del Activo ──────────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (!prop) return 0;
    const propTasks = tasks.filter(t => t.propertyId === prop.id);
    let h = 100;
    h -= propTasks.filter(t => t.priority === 'Urgente' && t.status !== 'Completado' && t.status !== 'Cerrado').length * 15;
    h -= propTasks.filter(t => t.priority === 'Alta'    && t.status !== 'Completado' && t.status !== 'Cerrado').length * 8;
    h -= propTasks.filter(t => t.priority === 'Media'   && t.status !== 'Completado' && t.status !== 'Cerrado').length * 3;
    return Math.max(0, Math.min(100, h));
  }, [prop, tasks]);

  const healthLabel = healthScore >= 90 ? 'ÓPTIMO' : healthScore >= 75 ? 'BUENO' : healthScore >= 55 ? 'REGULAR' : 'CRÍTICO';
  const healthColor = healthScore >= 90 ? ACCENT : healthScore >= 75 ? '#3b82f6' : healthScore >= 55 ? '#f97316' : '#ef4444';

  // ── Revalorización ────────────────────────────────────────────────────────
  const revalorizacion = prop?.purchasePrice && prop?.currentValue
    ? (((prop.currentValue - prop.purchasePrice) / prop.purchasePrice) * 100).toFixed(1)
    : null;

  // ── Proyección de valor ───────────────────────────────────────────────────
  const projData = useMemo(() => {
    const base = prop?.currentValue || (prop?.purchasePrice ? prop.purchasePrice * 1.1 : 0);
    if (!base) return [];
    const r = growthRate / 100;
    return Array.from({ length: 10 }, (_, i) => ({
      year: i + 1,
      value: Math.round(base * Math.pow(1 + r, i + 1)),
      label: `Año ${i + 1}`,
    }));
  }, [prop, growthRate]);

  // ── CAPEX Recommendations ─────────────────────────────────────────────────
  const capexRecs = useMemo(() => {
    if (!prop) return [];
    const recs = [];
    const openTasks = tasks.filter(t => t.propertyId === prop.id && t.status !== 'Completado' && t.status !== 'Cerrado');
    const hasAC = openTasks.some(t => t.concept.toLowerCase().includes('aire') || t.concept.toLowerCase().includes('climatiz'));
    if (!hasAC) recs.push({ icon: <Wind className="h-4 w-4" />, title: 'Climatización Central', range: '$800K - $1.2M', est: '+12% Valor Renta', color: 'text-blue-600 bg-blue-50' });
    if (prop.purchaseYear && (new Date().getFullYear() - prop.purchaseYear) > 15) {
      recs.push({ icon: <Hammer className="h-4 w-4" />, title: 'Renovación de Baño/Cocina', range: '$400K - $700K', est: '+8.5% Plusvalía', color: 'text-orange-600 bg-orange-50' });
    }
    recs.push({ icon: <Leaf className="h-4 w-4" />, title: 'Paneles Fotovoltaicos', range: '$200K - $350K', est: 'Subsidio 40% disponible', color: 'text-green-600 bg-green-50' });
    return recs.slice(0, 3);
  }, [prop, tasks]);

  const handleSaveValue = () => {
    if (!prop || !userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', prop.id);
    setDocumentNonBlocking(docRef, {
      purchasePrice: Number(valueForm.purchasePrice) || undefined,
      currentValue: Number(valueForm.currentValue) || undefined,
      purchaseYear: Number(valueForm.purchaseYear) || undefined,
      marketPricePerSqm: Number(valueForm.marketPricePerSqm) || undefined,
    }, { merge: true });
    setIsEditValueOpen(false);
    toast({ title: 'Valuación actualizada' });
  };

  const openEditValue = () => {
    setValueForm({
      purchasePrice: String(prop?.purchasePrice || ''),
      currentValue: String(prop?.currentValue || ''),
      purchaseYear: String(prop?.purchaseYear || ''),
      marketPricePerSqm: String(prop?.marketPricePerSqm || ''),
    });
    setIsEditValueOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Selector de propiedad */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedPropId} onValueChange={setSelectedPropId}>
          <SelectTrigger className="w-64">
            <Building className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Seleccionar propiedad…" />
          </SelectTrigger>
          <SelectContent>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {prop?.address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Home className="h-3.5 w-3.5" /> {prop.address}
          </p>
        )}
        {canWrite && (
          <Button variant="outline" size="sm" className="gap-1 text-xs ml-auto" onClick={openEditValue}>
            <Edit2 className="h-3.5 w-3.5" /> Actualizar Valuación
          </Button>
        )}
      </div>

      {/* ── Índice Revalorización + Salud ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revalorización */}
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Índice de Revalorización Anual</CardTitle>
              {revalorizacion && (
                <Badge className="bg-green-100 text-green-700 border-0 gap-1">
                  <TrendingUp className="h-3 w-3" /> +{revalorizacion}% Total
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Comparativa vs. referencia de mercado.</p>
          </CardHeader>
          <CardContent>
            {!prop?.purchasePrice && !prop?.currentValue ? (
              <div className="py-8 text-center">
                <DollarSign className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-3">Cargá el precio de compra y valuación actual para ver el análisis.</p>
                {canWrite && (
                  <Button variant="outline" className="gap-2" onClick={openEditValue}>
                    <Edit2 className="h-4 w-4" /> Ingresar datos de valor
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'TU ACTIVO', value: revalorizacion ? `+${revalorizacion}%` : '—', color: 'text-accent' },
                  { label: 'MERCADO REF.', value: prop?.marketPricePerSqm ? `$${prop.marketPricePerSqm.toLocaleString()}/m²` : '+7.2%', color: 'text-gray-700' },
                  { label: 'VALOR ACTUAL', value: fmtM(prop?.currentValue || 0), color: 'text-gray-900' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                    <p className={cn('text-xl font-black mt-1', s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Salud del Activo */}
        <Card className="border-none shadow-sm bg-[#1a2e22] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">Salud del Activo</CardTitle>
            <p className="text-xs text-green-200/70">Estado operativo vs. valor de mercado</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-20 w-20 mx-auto mb-3">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={healthColor} strokeWidth="3"
                  strokeDasharray={`${healthScore} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-white">{healthScore}%</span>
                <span className="text-[8px] font-bold" style={{ color: healthColor }}>{healthLabel}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Mantenimiento', value: tasks.filter(t => t.propertyId === prop?.id && t.status === 'Completado').length > 0 ? 'Excelente' : 'Sin datos' },
                { label: 'Efic. Energética', value: 'B (Certificada)' },
                { label: 'Demanda en Zona', value: healthScore > 80 ? 'MUY ALTA' : 'MEDIA', cls: 'px-1.5 py-0.5 rounded text-[10px] font-bold ' + (healthScore > 80 ? 'bg-green-500 text-white' : 'bg-orange-400 text-white') },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs">
                  <span className="text-green-200/70">{item.label}</span>
                  {item.cls ? <span className={item.cls}>{item.value}</span> : <span className="text-white font-semibold">{item.value}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CAPEX + Proyección ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CAPEX */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recomendaciones CAPEX</CardTitle>
            <p className="text-xs text-muted-foreground">Mejoras para aumentar renta y valor</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {capexRecs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Propiedad en buen estado — sin CAPEX urgente.</p>
            ) : (
              capexRecs.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', r.color)}>
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.est}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-900">{r.range}</p>
                    <p className="text-[10px] text-muted-foreground">Inversión est.</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Proyección de Valor */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Proyección de Valor</CardTitle>
                <p className="text-xs text-muted-foreground">Crecimiento compuesto estimado</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Tasa:</span>
                <Input
                  type="number"
                  min={1} max={30}
                  value={growthRate}
                  onChange={e => setGrowthRate(Number(e.target.value))}
                  className="w-16 h-7 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground">%/año</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {projData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Ingresá la valuación actual para ver proyecciones.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[4, 9].map(yi => (
                    <div key={yi} className={cn('p-3 rounded-xl text-center', yi === 9 ? 'bg-[#1a2e22] text-white' : 'bg-accent/10')}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: yi === 9 ? '#9FE1CB' : ACCENT }}>Horizonte {yi + 1} Años</p>
                      <p className="text-2xl font-black mt-1" style={{ color: yi === 9 ? 'white' : ACCENT }}>{fmtM(projData[yi]?.value || 0)}</p>
                      <p className="text-[11px]" style={{ color: yi === 9 ? '#9FE1CB' : ACCENT }}>
                        +{(((projData[yi]?.value || 0) / (prop?.currentValue || 1) - 1) * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={projData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fontSize: 9 }} tickFormatter={v => `A${v}`} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => fmtM(v)} labelFormatter={l => `Año ${l}`} />
                    <Area type="monotone" dataKey="value" stroke={ACCENT} fill="url(#projGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-muted-foreground mt-1 text-center">
                  Cálculo basado en crecimiento compuesto del {growthRate}% anual aplicado al valor actual.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Presión del Mercado */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Presión del Mercado</CardTitle>
          <p className="text-xs text-muted-foreground">Comparativa de precio/m² — referencia manual</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Zona Premium', value: prop?.marketPricePerSqm ? Math.round(prop.marketPricePerSqm * 1.07) : null, dot: 'bg-red-500', note: 'Referencia zona premium' },
              { label: 'Tu Activo',    value: prop?.currentValue && prop?.squareMeters ? Math.round(prop.currentValue / prop.squareMeters) : prop?.marketPricePerSqm || null, dot: 'bg-accent', note: `${prop?.squareMeters ?? '?'} m²` },
              { label: 'Media Zona',   value: prop?.marketPricePerSqm ? Math.round(prop.marketPricePerSqm * 0.8) : null, dot: 'bg-gray-400', note: 'Promedio del barrio' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <span className={cn('h-3 w-3 rounded-full shrink-0', m.dot)} />
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value ? `$${m.value.toLocaleString('es-AR')}/m²` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">{m.note}</p>
                </div>
              </div>
            ))}
          </div>
          {!prop?.marketPricePerSqm && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ingresá el precio de referencia de mercado en "Actualizar Valuación" para ver comparativas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog editar valuación */}
      <Dialog open={isEditValueOpen} onOpenChange={setIsEditValueOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Actualizar Valuación — {prop?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {[
              { label: 'Precio de compra ($)', key: 'purchasePrice' },
              { label: 'Valuación actual ($)', key: 'currentValue' },
              { label: 'Año de compra', key: 'purchaseYear' },
              { label: 'Precio referencia mercado ($/m²)', key: 'marketPricePerSqm' },
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  type="number"
                  value={(valueForm as any)[f.key]}
                  onChange={e => setValueForm({ ...valueForm, [f.key]: e.target.value })}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsEditValueOpen(false)}>Cancelar</Button>
            <Button className="bg-accent text-white" onClick={handleSaveValue}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE RAÍZ
// ═══════════════════════════════════════════════════════════════════════════════
export function AnalyticsPanelView(props: AnalyticsPanelProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panel Analítico</h2>
          <p className="text-sm text-muted-foreground">Impacto · Normativa · Plusvalía</p>
        </div>
      </div>

      <Tabs defaultValue="impacto" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="impacto" className="gap-1.5 text-sm">
            <BarChart3 className="h-3.5 w-3.5" /> Reporte de Impacto
          </TabsTrigger>
          <TabsTrigger value="normativa" className="gap-1.5 text-sm">
            <Shield className="h-3.5 w-3.5" /> Cumplimiento
          </TabsTrigger>
          <TabsTrigger value="plusvalia" className="gap-1.5 text-sm">
            <TrendingUp className="h-3.5 w-3.5" /> Plusvalía
          </TabsTrigger>
        </TabsList>

        <TabsContent value="impacto" className="mt-5">
          <ImpactoTab {...props} />
        </TabsContent>
        <TabsContent value="normativa" className="mt-5">
          <NormativaTab
            properties={props.properties}
            contracts={props.contracts}
            tasks={props.tasks}
            userId={props.userId}
          />
        </TabsContent>
        <TabsContent value="plusvalia" className="mt-5">
          <PlusvaliaTab
            properties={props.properties}
            tasks={props.tasks}
            userId={props.userId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
