
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Visit } from '@/lib/types/visitas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  BellRing,
  Building2,
  FileText,
  AlertCircle,
  Clock,
  Wrench,
  Calendar,
  AreaChart as AreaChartIcon,
  BarChart3,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppAlert, Property, Contract, Invoice, RentalApplication, MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/format';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';

const APP_ID = 'alquilagestion-pro';
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_LABELS  = ['L','M','M','J','V','S','D'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function VisitsCalendarWidget({ userId, onNavigate }: { userId?: string; onNavigate: (tab: string) => void }) {
  const db = useFirestore();
  const [calDate, setCalDate] = useState(new Date());

  const visitsQuery = useMemoFirebase(() => {
    if (!userId || !db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'visitas'), orderBy('scheduledDate'));
  }, [userId, db]);
  const { data: visitsData } = useCollection<Visit>(visitsQuery);
  const visits = visitsData ?? [];

  const year  = calDate.getFullYear();
  const month = calDate.getMonth();
  const today = fmtDate(new Date());

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const offset   = firstDow === 0 ? 6 : firstDow - 1;
    const days     = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const visitDates = useMemo(() => {
    const set: Record<string, string[]> = {};
    for (const v of visits) {
      if (!set[v.scheduledDate]) set[v.scheduledDate] = [];
      set[v.scheduledDate].push(v.eventTypeColor ?? '#10b981');
    }
    return set;
  }, [visits]);

  // Próximas 3 visitas desde hoy
  const upcoming = useMemo(() =>
    visits
      .filter(v => v.scheduledDate >= today && v.status !== 'Cancelada')
      .sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime))
      .slice(0, 3),
  [visits, today]);

  return (
    <Card className="shadow-sm border-none bg-white">
      <CardHeader className="border-b pb-3 mb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-primary" />
            Agenda de Visitas
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-primary font-bold h-auto p-0"
            onClick={() => onNavigate('Visitas')}>
            Ver todo →
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Mini calendar */}
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
              onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <span className="text-xs font-bold text-foreground">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
              onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((l, i) => (
              <div key={i} className="text-center text-[9px] font-bold text-muted-foreground py-0.5">{l}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const dateStr = `${year}-${pad(month+1)}-${pad(day)}`;
              const colors  = visitDates[dateStr];
              const isToday = dateStr === today;
              return (
                <button
                  key={dateStr}
                  onClick={() => onNavigate('Visitas')}
                  className={cn(
                    'flex flex-col items-center py-0.5 rounded transition-colors hover:bg-primary/10',
                    isToday && 'bg-primary/10',
                  )}
                >
                  <span className={cn(
                    'text-[11px] font-medium leading-tight',
                    isToday ? 'text-primary font-bold' : 'text-foreground',
                    !colors && !isToday && 'text-muted-foreground',
                  )}>
                    {day}
                  </span>
                  {colors ? (
                    <div className="flex gap-0.5 mt-0.5">
                      {colors.slice(0,3).map((c, ci) => (
                        <div key={ci} className="h-1 w-1 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  ) : <div className="h-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming visits */}
        {upcoming.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Próximas visitas</p>
            {upcoming.map(v => (
              <button
                key={v.id}
                onClick={() => onNavigate('Visitas')}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
              >
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: v.eventTypeColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-foreground truncate">{v.visitorName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{v.propertyName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-foreground">{v.scheduledTime}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {String(parseInt(v.scheduledDate.split('-')[2])).padStart(2,'0')}/{v.scheduledDate.split('-')[1]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {upcoming.length === 0 && visits.length === 0 && (
          <div className="py-4 text-center text-muted-foreground opacity-50">
            <p className="text-xs">Sin visitas agendadas</p>
            <Button variant="link" size="sm" className="text-xs text-primary font-bold p-0 h-auto mt-1"
              onClick={() => onNavigate('Visitas')}>
              + Agendar visita
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SummaryViewProps {
  onNavigate: (tab: string) => void;
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  applications: RentalApplication[];
  tasks: MaintenanceTask[];
  userId?: string;
}

export function SummaryView({
  onNavigate,
  properties = [],
  contracts = [],
  invoices = [],
  applications = [],
  tasks = [],
  userId,
}: SummaryViewProps) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [bcraRate, setBcraRate] = useState<{ compra: number; venta: number; fecha: string } | null>(null);

  useEffect(() => {
    fetch('/api/bcra/cotizacion')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && !d.error && setBcraRate(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const newAlerts: AppAlert[] = [];
    
    const missingArcaCount = invoices.filter(i => i.charges.some(c => c.type === 'Alquiler') && !i.arcaInvoiceUrl && i.status !== 'Pagado').length;
    if (missingArcaCount > 0) {
      newAlerts.push({
        id: 'missing_arca',
        type: 'arca_invoice',
        title: 'Facturas ARCA Pendientes',
        description: `Tienes ${missingArcaCount} alquileres sin su comprobante legal formal vinculado.`,
        severity: 'medium',
        linkTab: 'Facturas'
      });
    }

    const overdueInvoices = invoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente');
    if (overdueInvoices.length > 0) {
      newAlerts.push({
        id: 'overdue_debt',
        title: 'Mora en Cartera',
        description: `Existen ${overdueInvoices.length} facturas fuera de término. Los intereses se están calculando.`,
        severity: 'high',
        linkTab: 'Facturas',
        type: 'debt'
      });
    }

    const today = new Date();
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(today.getDate() + 60);
    
    const expiringSoon = contracts.filter(c => {
      const endDate = new Date(c.endDate);
      return endDate > today && endDate <= sixtyDaysLater;
    });

    if (expiringSoon.length > 0) {
      newAlerts.push({
        id: 'contracts_expiring',
        title: 'Contratos por Vencer',
        description: `Tienes ${expiringSoon.length} contratos que finalizan en los próximos 60 días.`,
        severity: 'medium',
        linkTab: 'Personas',
        type: 'contract'
      });
    }

    const urgentTasks = tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado');
    if (urgentTasks.length > 0) {
      newAlerts.push({
        id: 'urgent_tasks',
        title: 'Reclamos Urgentes',
        description: `Hay ${urgentTasks.length} pedidos de mantenimiento marcados como urgentes.`,
        severity: 'high',
        linkTab: 'Mantenimiento',
        type: 'maintenance'
      });
    }

    setAlerts(newAlerts);
  }, [invoices, contracts, tasks]);

  const recentActivity = useMemo(() => {
    const events: { id: string; icon: React.ReactNode; title: string; subtitle: string; time: string; color: string }[] = [];
    invoices.slice(0, 3).forEach(inv => {
      if (inv.status === 'Pagado') {
        events.push({
          id: `inv-${inv.id}`,
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: `Pago recibido: $${inv.totalAmount.toLocaleString('es-AR')}`,
          subtitle: inv.propertyName || 'Propiedad',
          time: inv.period || 'Reciente',
          color: 'text-green-600 bg-green-50'
        });
      } else if (inv.status === 'Vencido' || inv.status === 'Pendiente') {
        events.push({
          id: `inv-late-${inv.id}`,
          icon: <AlertCircle className="h-4 w-4" />,
          title: `Pago atrasado detectado`,
          subtitle: inv.propertyName || 'Propiedad',
          time: inv.dueDate || 'Vencido',
          color: 'text-red-600 bg-red-50'
        });
      }
    });
    tasks.slice(0, 2).forEach(t => {
      if (t.priority === 'Urgente' || t.priority === 'Alta') {
        events.push({
          id: `task-${t.id}`,
          icon: <Wrench className="h-4 w-4" />,
          title: `Nuevo reclamo: ${t.concept}`,
          subtitle: t.propertyName,
          time: t.createdAt,
          color: 'text-orange-600 bg-orange-50'
        });
      }
    });
    contracts.slice(0, 1).forEach(c => {
      const endDate = new Date(c.endDate);
      const diff = (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (diff > 0 && diff < 90) {
        events.push({
          id: `contract-${c.id}`,
          icon: <FileText className="h-4 w-4" />,
          title: `Contrato próximo a vencer`,
          subtitle: c.propertyName || 'Contrato',
          time: c.endDate,
          color: 'text-blue-600 bg-blue-50'
        });
      }
    });
    return events.slice(0, 5);
  }, [invoices, tasks, contracts]);

  const arsInvoices = invoices.filter(i => !i.currency || i.currency === 'ARS');
  const usdInvoices = invoices.filter(i => i.currency === 'USD');

  const totalProjected = arsInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalProjectedUSD = usdInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollected = arsInvoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollectedUSD = usdInvoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOverdue = arsInvoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOverdueUSD = usdInvoices.filter(i => i.status === 'Vencido' || i.status === 'Pendiente').reduce((acc, i) => acc + i.totalAmount, 0);
  const occupancyRate = properties.length > 0 ? (properties.filter(p => p.status === 'Alquilada').length / properties.length) * 100 : 0;

  // ── KPIs avanzados ──────────────────────────────────────────────────────
  const advancedKpis = useMemo(() => {
    const now = new Date();

    // Tasa de cobro en término (pagadas / emitidas)
    const collectionRate = invoices.length > 0
      ? Math.round((invoices.filter(i => i.status === 'Pagado').length / invoices.length) * 100)
      : 100;

    // Tiempo promedio de cierre de tickets (días)
    const closedWithDates = tasks.filter(t => t.status === 'Cerrado' && t.closedAt && t.createdAt);
    const avgCloseDays = closedWithDates.length > 0
      ? Math.round(
          closedWithDates.reduce((acc, t) => {
            const d = (new Date(t.closedAt!).getTime() - new Date(t.createdAt).getTime()) / 86_400_000;
            return acc + Math.max(0, d);
          }, 0) / closedWithDates.length,
        )
      : null;

    // Score de riesgo de cartera (100 = sin riesgo)
    const overdueRatio   = totalProjected > 0 ? totalOverdue / totalProjected : 0;
    const vacancyRatio   = properties.length > 0 ? properties.filter(p => p.status !== 'Alquilada').length / properties.length : 0;
    const expiring30     = contracts.filter(c => {
      const end = new Date(c.endDate);
      return end > now && (end.getTime() - now.getTime()) < 30 * 86_400_000;
    }).length;
    const expiringRatio  = contracts.length > 0 ? expiring30 / contracts.length : 0;
    const urgentOpen     = tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado').length;
    const urgentRatio    = tasks.length > 0 ? urgentOpen / tasks.length : 0;

    const riskScore = Math.max(0, Math.min(100, Math.round(
      100 - (overdueRatio * 35 + vacancyRatio * 25 + expiringRatio * 20 + urgentRatio * 20) * 100,
    )));

    const riskLevel = riskScore >= 80 ? 'Saludable' : riskScore >= 55 ? 'Moderado' : 'En riesgo';
    const riskColor = riskScore >= 80 ? 'text-green-600' : riskScore >= 55 ? 'text-orange-500' : 'text-red-600';

    const activeContracts = contracts.filter(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer').length;

    return { collectionRate, avgCloseDays, riskScore, riskLevel, riskColor, activeContracts };
  }, [invoices, tasks, contracts, properties, totalOverdue, totalProjected]);

  const CASHFLOW_DATA = [
    { name: 'Semana 1', cobrado: totalCollected * 0.4, proyectado: totalProjected * 0.3 },
    { name: 'Semana 2', cobrado: totalCollected * 0.7, proyectado: totalProjected * 0.6 },
    { name: 'Semana 3', cobrado: totalCollected * 0.9, proyectado: totalProjected * 0.8 },
    { name: 'Semana 4', cobrado: totalCollected, proyectado: totalProjected },
  ];

  const projectionData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const total = contracts
        .filter(c =>
          (c.status === 'Vigente' || c.status === 'Próximo a Vencer') &&
          new Date(c.endDate) >= month,
        )
        .reduce((sum, c) => sum + (c.currentRentAmount || 0), 0);
      return {
        name: month.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        ingreso: total,
      };
    });
  }, [contracts]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white border-t-4 border-t-primary">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-primary/20">BRUTO MES</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Recaudación Total</p>
            <h3 className="text-2xl font-black text-foreground">{formatCurrency(totalProjected)}</h3>
            {totalProjectedUSD > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5 font-bold">{formatCurrency(totalProjectedUSD, { currency: 'USD' })}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-red-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-red-50 p-2 rounded-lg text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-red-100 text-red-600">MOROSIDAD</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Total en Riesgo</p>
            <h3 className="text-2xl font-black text-red-600">{formatCurrency(totalOverdue)}</h3>
            {totalOverdueUSD > 0 && (
              <p className="text-[10px] text-red-400 mt-0.5 font-bold">{formatCurrency(totalOverdueUSD, { currency: 'USD' })}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-100 text-blue-600">{occupancyRate.toFixed(1)}%</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Tasa de Ocupación</p>
            <h3 className="text-2xl font-black text-foreground">{properties.filter(p => p.status === 'Alquilada').length} / {properties.length}</h3>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border-t-4 border-t-orange-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-orange-50 p-2 rounded-lg text-orange-600">
                <Wrench className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-orange-100 text-orange-600">RECLAMOS</Badge>
            </div>
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Incidencias Abiertas</p>
            <h3 className="text-2xl font-black text-foreground">{tasks.filter(t => t.status !== 'Cerrado').length}</h3>
          </CardContent>
        </Card>
      </div>

      {/* ── Fila de KPIs avanzados ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cobro en término */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Cobro en término</p>
            <div className="flex items-end gap-2">
              <span className={cn('text-2xl font-black', advancedKpis.collectionRate >= 80 ? 'text-green-600' : advancedKpis.collectionRate >= 60 ? 'text-orange-500' : 'text-red-600')}>
                {advancedKpis.collectionRate}%
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-colors', advancedKpis.collectionRate >= 80 ? 'bg-green-500' : advancedKpis.collectionRate >= 60 ? 'bg-orange-400' : 'bg-red-500')}
                style={{ width: `${advancedKpis.collectionRate}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1.5">{invoices.filter(i => i.status === 'Pagado').length} de {invoices.length} facturas</p>
          </CardContent>
        </Card>

        {/* Tiempo promedio cierre tickets */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Tiempo cierre tickets</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-black">
                {advancedKpis.avgCloseDays !== null ? advancedKpis.avgCloseDays : '—'}
              </span>
              {advancedKpis.avgCloseDays !== null && <span className="text-sm text-muted-foreground mb-0.5">días prom.</span>}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1.5">
              {tasks.filter(t => t.status === 'Cerrado').length} tickets cerrados
              {advancedKpis.avgCloseDays === null && ' — sin datos suficientes'}
            </p>
          </CardContent>
        </Card>

        {/* Score de riesgo */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Score de cartera</p>
            <div className="flex items-center gap-2">
              <span className={cn('text-2xl font-black', advancedKpis.riskColor)}>{advancedKpis.riskScore}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-colors', advancedKpis.riskScore >= 80 ? 'bg-green-500' : advancedKpis.riskScore >= 55 ? 'bg-orange-400' : 'bg-red-500')}
                style={{ width: `${advancedKpis.riskScore}%` }} />
            </div>
            <p className={cn('text-[9px] mt-1.5 font-bold', advancedKpis.riskColor)}>{advancedKpis.riskLevel}</p>
          </CardContent>
        </Card>

        {/* Contratos activos */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Contratos activos</p>
            <span className="text-2xl font-black">{advancedKpis.activeContracts}</span>
            <p className="text-[9px] text-muted-foreground mt-1.5">
              de {contracts.length} totales ·{' '}
              {contracts.filter(c => c.status === 'Próximo a Vencer').length > 0 && (
                <span className="text-orange-500 font-bold">{contracts.filter(c => c.status === 'Próximo a Vencer').length} por vencer</span>
              )}
              {contracts.filter(c => c.status === 'Próximo a Vencer').length === 0 && 'todos al día'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AreaChartIcon className="h-5 w-5 text-primary" /> 
                Salud del Flujo de Caja
              </CardTitle>
              <CardDescription>Seguimiento de cobranza semanal vs. proyección del mes.</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 font-bold px-3">Efectividad: {((totalCollected / (totalProjected || 1)) * 100).toFixed(0)}%</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CASHFLOW_DATA}>
                  <defs>
                    <linearGradient id="colorCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(v: any) => [`$ ${v.toLocaleString()}`, "Monto"]}
                  />
                  <Area type="monotone" dataKey="proyectado" stroke="#cbd5e1" fill="transparent" strokeDasharray="5 5" name="Esperado" />
                  <Area type="monotone" dataKey="cobrado" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCobrado)" name="Cobrado Real" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 p-4 bg-primary/5 rounded-2xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Ya Cobrado</span>
                  <span className="text-lg font-black text-primary">{formatCurrency(totalCollected)}</span>
                  {totalCollectedUSD > 0 && <span className="text-[10px] font-bold text-primary/70">{formatCurrency(totalCollectedUSD, { currency: 'USD' })}</span>}
                </div>
                <Separator orientation="vertical" className="h-10 mx-2" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Restante Mes</span>
                  <span className="text-lg font-black text-foreground">{formatCurrency(totalProjected - totalCollected)}</span>
                  {totalProjectedUSD > 0 && <span className="text-[10px] font-bold text-muted-foreground">{formatCurrency(totalProjectedUSD - totalCollectedUSD, { currency: 'USD' })}</span>}
                </div>
                {bcraRate && (
                  <>
                    <Separator orientation="vertical" className="h-10 mx-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-muted-foreground uppercase">USD Oficial BCRA</span>
                      <span className="text-lg font-black text-foreground">{formatCurrency(bcraRate.venta)}</span>
                      <span className="text-[9px] text-muted-foreground">compra {formatCurrency(bcraRate.compra)} · {bcraRate.fecha}</span>
                    </div>
                  </>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-primary font-bold text-xs" onClick={() => onNavigate('Facturas')}>
                Ver detalle de facturación <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-sm border-none bg-white">
            <CardHeader className="border-b pb-3 mb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-5 w-5 text-primary" />
                Atención Inmediata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 3).map(alert => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-xl border transition-colors hover:bg-muted/50 flex flex-col gap-1.5",
                    alert.severity === 'high' ? "border-red-100 bg-red-50/20" : "border-transparent bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-1.5 rounded-full",
                      alert.severity === 'high' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {alert.type === 'maintenance' ? <Wrench className="h-3.5 w-3.5" /> :
                       alert.type === 'contract' ? <Calendar className="h-3.5 w-3.5" /> :
                       <AlertTriangle className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className="font-bold text-[11px] text-foreground leading-tight">{alert.title}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.description}</p>
                    </div>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-primary self-end" onClick={() => alert.linkTab && onNavigate(alert.linkTab)}>
                    Gestionar →
                  </Button>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="py-6 text-center text-muted-foreground opacity-50 space-y-1">
                  <CheckCircle2 className="h-7 w-7 mx-auto text-green-600" />
                  <p className="text-xs font-bold">Operación al día</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white">
            <CardHeader className="border-b pb-3 mb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  Actividad Reciente
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-primary font-bold h-auto p-0" onClick={() => onNavigate('Reportes')}>
                  Ver todo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentActivity.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">Sin actividad reciente.</p>
              )}
              {recentActivity.map(event => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-full shrink-0 mt-0.5", event.color)}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground leading-tight">{event.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{event.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{event.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <VisitsCalendarWidget userId={userId} onNavigate={onNavigate} />
        </div>
      </div>

      {/* ── Proyección de ingresos 12 meses ── */}
      <Card className="shadow-sm border-none bg-white">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Proyección de Ingresos
            </CardTitle>
            <CardDescription>Estimación de ingresos mensuales para los próximos 12 meses según contratos vigentes.</CardDescription>
          </div>
          <Badge className="bg-blue-100 text-blue-700 font-bold px-3">
            {contracts.filter(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer').length} contratos activos
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1D9E75" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => [`$ ${Number(v).toLocaleString('es-AR')}`, 'Ingreso proyectado']}
                />
                <ReferenceLine y={projectionData[0]?.ingreso ?? 0} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="ingreso"
                  stroke="url(#projGrad)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#1D9E75', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name="Ingreso proyectado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            La proyección se reduce cuando contratos vencen. Renovalos antes para mantener la curva estable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
