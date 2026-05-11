
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Contract, Invoice, MaintenanceTask, Liquidation, PendingRentAdjustment } from '@/lib/types';
import {
  CalendarRange,
  FileText,
  DollarSign,
  Wrench,
  Calculator,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  LayoutList,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';

interface TimelineViewProps {
  contracts: Contract[];
  invoices: Invoice[];
  tasks: MaintenanceTask[];
  liquidations?: Liquidation[];
  adjustments?: PendingRentAdjustment[];
  onNavigate: (tab: string) => void;
}

type EventType = 'contract_end' | 'invoice_due' | 'maintenance' | 'liquidation' | 'adjustment';

interface TimelineEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  subtitle: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'done';
  severity: 'info' | 'warning' | 'danger' | 'success';
  tab: string;
}

const TYPE_CONFIG: Record<EventType, { icon: React.ElementType; label: string; color: string; bg: string; dot: string }> = {
  contract_end: { icon: FileText,    label: 'Contrato',     color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-500'   },
  invoice_due:  { icon: DollarSign,  label: 'Factura',      color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  maintenance:  { icon: Wrench,      label: 'Mantenimiento',color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  liquidation:  { icon: Calculator,  label: 'Liquidación',  color: 'text-teal-700',   bg: 'bg-teal-50',   dot: 'bg-teal-500'   },
  adjustment:   { icon: TrendingUp,  label: 'Ajuste',       color: 'text-emerald-700',bg: 'bg-emerald-50',dot: 'bg-emerald-500'},
};

const SEVERITY_STYLE = {
  info:    'border-l-blue-400',
  warning: 'border-l-orange-400',
  danger:  'border-l-red-500',
  success: 'border-l-green-500',
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function buildEventKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Calendar grid ─────────────────────────────────────────────────────────────

function CalendarGrid({
  year, month, eventsByDay, onDayClick, selectedKey,
}: {
  year: number;
  month: number;
  eventsByDay: Map<string, TimelineEvent[]>;
  onDayClick: (key: string) => void;
  selectedKey: string | null;
}) {
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl overflow-hidden border bg-white shadow-sm">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-muted-foreground">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-16 border-b border-r last:border-r-0 bg-muted/20" />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const events = eventsByDay.get(key) ?? [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selectedKey === key;
          const hasDanger = events.some(e => e.severity === 'danger');
          const hasWarning = events.some(e => e.severity === 'warning');

          return (
            <button
              key={key}
              onClick={() => events.length > 0 && onDayClick(key)}
              className={cn(
                'h-16 border-b border-r last:border-r-0 p-1.5 flex flex-col items-start transition-colors text-left',
                events.length > 0 ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                (i + 1) % 7 === 0 && 'border-r-0',
              )}
            >
              <span className={cn(
                'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                !isToday && hasDanger && 'text-red-600',
                !isToday && !hasDanger && hasWarning && 'text-orange-600',
              )}>
                {day}
              </span>
              {/* Event dots */}
              {events.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {events.slice(0, 3).map(e => (
                    <span key={e.id} className={cn('w-1.5 h-1.5 rounded-full', TYPE_CONFIG[e.type].dot)} />
                  ))}
                  {events.length > 3 && (
                    <span className="text-[9px] text-muted-foreground font-bold">+{events.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimelineView({
  contracts, invoices, tasks, liquidations = [], adjustments = [], onNavigate,
}: TimelineViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    new Set(['contract_end', 'invoice_due', 'maintenance', 'liquidation', 'adjustment'])
  );

  const toggleType = (t: EventType) =>
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const viewYear  = new Date(today.getFullYear(), today.getMonth() + monthOffset).getFullYear();
  const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset).getMonth();
  const viewStart = new Date(viewYear, viewMonth, 1);
  const viewEnd   = new Date(viewYear, viewMonth + 1, 0);

  const monthLabel = viewStart.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const events: TimelineEvent[] = useMemo(() => {
    const result: TimelineEvent[] = [];

    contracts.forEach(c => {
      if (!c.endDate || c.status === 'Finalizado' || c.status === 'Rescindido') return;
      const d = new Date(c.endDate);
      if (isNaN(d.getTime())) return;
      const diffDays = (d.getTime() - today.getTime()) / 86_400_000;
      result.push({
        id: `c-${c.id}`, date: d, type: 'contract_end',
        title: `Vence contrato: ${c.propertyName ?? 'Propiedad'}`,
        subtitle: c.tenantName ?? 'Inquilino',
        status: d < today ? 'overdue' : diffDays <= 30 ? 'due_soon' : 'upcoming',
        severity: d < today ? 'danger' : diffDays <= 30 ? 'warning' : 'info',
        tab: 'Personas',
      });
    });

    invoices.forEach(i => {
      if (!i.dueDate || i.status === 'Pagado' || i.status === 'Anulado') return;
      const raw = i.dueDate.includes('/') ? i.dueDate.split('/').reverse().join('-') : i.dueDate;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const diffDays = (d.getTime() - today.getTime()) / 86_400_000;
      result.push({
        id: `i-${i.id}`, date: d, type: 'invoice_due',
        title: `Factura vence: ${i.propertyName}`,
        subtitle: `${i.tenantName} · ${i.period ?? ''}`,
        status: i.status === 'Vencido' || d < today ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming',
        severity: i.status === 'Vencido' || d < today ? 'danger' : diffDays <= 7 ? 'warning' : 'info',
        tab: 'Facturas',
      });
    });

    tasks.filter(t => t.status !== 'Completado' && t.status !== 'Cerrado').forEach(t => {
      const parts = t.createdAt.split('/');
      const d = parts.length === 3 ? new Date(+parts[2], +parts[1]-1, +parts[0]) : new Date(t.createdAt);
      if (isNaN(d.getTime())) return;
      result.push({
        id: `m-${t.id}`, date: d, type: 'maintenance',
        title: `Reclamo: ${t.concept}`,
        subtitle: t.propertyName,
        status: t.priority === 'Urgente' ? 'overdue' : 'upcoming',
        severity: t.priority === 'Urgente' ? 'danger' : t.priority === 'Alta' ? 'warning' : 'info',
        tab: 'Mantenimiento',
      });
    });

    liquidations.filter(l => l.status === 'Pendiente').forEach(l => {
      const d = new Date(l.dateCreated);
      if (isNaN(d.getTime())) return;
      result.push({
        id: `l-${l.id}`, date: d, type: 'liquidation',
        title: `Liquidación pendiente: ${l.propertyName}`,
        subtitle: l.ownerName,
        status: 'due_soon', severity: 'warning', tab: 'Liquidaciones',
      });
    });

    adjustments.filter(a => a.status === 'pendiente').forEach(a => {
      const d = new Date(a.dueDate);
      if (isNaN(d.getTime())) return;
      const diffDays = (d.getTime() - today.getTime()) / 86_400_000;
      result.push({
        id: `a-${a.id}`, date: d, type: 'adjustment',
        title: `Ajuste pendiente: ${a.propertyName}`,
        subtitle: `${a.tenantName} · +${a.variationPct.toFixed(1)}%`,
        status: diffDays < 0 ? 'overdue' : diffDays <= 7 ? 'due_soon' : 'upcoming',
        severity: diffDays < 0 ? 'danger' : 'warning',
        tab: 'Ajustes Alquiler',
      });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contracts, invoices, tasks, liquidations, adjustments]);

  const visibleEvents = useMemo(
    () => events.filter(e => e.date >= viewStart && e.date <= viewEnd && activeTypes.has(e.type)),
    [events, viewStart, viewEnd, activeTypes],
  );

  const allMonthEvents = useMemo(
    () => events.filter(e => e.date >= viewStart && e.date <= viewEnd),
    [events, viewStart, viewEnd],
  );

  const countByType = useMemo(() => {
    const m: Record<EventType, number> = { contract_end: 0, invoice_due: 0, maintenance: 0, liquidation: 0, adjustment: 0 };
    allMonthEvents.forEach(e => m[e.type]++);
    return m;
  }, [allMonthEvents]);

  const stats = useMemo(() => ({
    total: visibleEvents.length,
    danger: visibleEvents.filter(e => e.severity === 'danger').length,
    warning: visibleEvents.filter(e => e.severity === 'warning').length,
  }), [visibleEvents]);

  // For calendar: events indexed by YYYY-MM-DD key
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    visibleEvents.forEach(e => {
      const key = buildEventKey(e.date);
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return map;
  }, [visibleEvents]);

  // For list: group by day label
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    visibleEvents.forEach(e => {
      const key = e.date.toLocaleDateString('es-AR');
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      const da = a.split('/').reverse().join('-');
      const db_ = b.split('/').reverse().join('-');
      return da.localeCompare(db_);
    });
  }, [visibleEvents]);

  const selectedDayEvents = selectedDayKey ? (eventsByDay.get(selectedDayKey) ?? []) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black capitalize">{monthLabel}</h2>
          <p className="text-xs text-muted-foreground">Cronograma maestro de eventos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => { setViewMode('calendar'); setSelectedDayKey(null); }}
              className={cn(
                'px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors border-l',
                viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </button>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setMonthOffset(o => o - 1); setSelectedDayKey(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setMonthOffset(0); setSelectedDayKey(null); }}>Hoy</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setMonthOffset(o => o + 1); setSelectedDayKey(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TYPE_CONFIG) as [EventType, typeof TYPE_CONFIG[EventType]][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          const active = activeTypes.has(type);
          const count  = countByType[type];
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                active
                  ? `${cfg.bg} ${cfg.color} border-transparent shadow-sm`
                  : 'bg-white text-muted-foreground border-border opacity-60 hover:opacity-90',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
              <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full', active ? 'bg-white/60' : 'bg-muted')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Eventos este mes</p>
              <p className="text-2xl font-black">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-[10px] text-red-700 font-bold">Críticos</p>
              <p className="text-2xl font-black text-red-700">{stats.danger}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-[10px] text-orange-700 font-bold">Próximos</p>
              <p className="text-2xl font-black text-orange-700">{stats.warning}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            eventsByDay={eventsByDay}
            onDayClick={key => setSelectedDayKey(prev => prev === key ? null : key)}
            selectedKey={selectedDayKey}
          />
          {selectedDayKey && selectedDayEvents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground px-1">
                {new Date(selectedDayKey + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {selectedDayEvents.map(event => {
                const cfg = TYPE_CONFIG[event.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={event.id}
                    className={cn('flex items-start gap-3 p-3 rounded-xl border-l-4 bg-white shadow-sm cursor-pointer hover:shadow transition-shadow', SEVERITY_STYLE[event.severity])}
                    onClick={() => onNavigate(event.tab)}
                  >
                    <div className={cn('p-2 rounded-lg shrink-0', cfg.bg)}>
                      <Icon className={cn('h-4 w-4', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight">{event.title}</p>
                      <p className="text-[10px] text-muted-foreground">{event.subtitle}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[9px] font-bold border-none shrink-0', cfg.bg, cfg.color)}>
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
          {!selectedDayKey && (
            <p className="text-xs text-muted-foreground text-center">Tocá un día con eventos para ver el detalle</p>
          )}
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && (
        grouped.length === 0 ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
              <p className="font-bold text-muted-foreground">Sin eventos para este período</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, dayEvents]) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-black text-muted-foreground bg-background px-2 capitalize">
                    {new Date(dayEvents[0].date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  {dayEvents.map(event => {
                    const cfg = TYPE_CONFIG[event.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={event.id}
                        className={cn('flex items-start gap-3 p-3 rounded-xl border-l-4 bg-white shadow-sm transition-colors hover:shadow cursor-pointer', SEVERITY_STYLE[event.severity])}
                        onClick={() => onNavigate(event.tab)}
                      >
                        <div className={cn('p-2 rounded-lg shrink-0', cfg.bg)}>
                          <Icon className={cn('h-4 w-4', cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground leading-tight">{event.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{event.subtitle}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={cn('text-[9px] font-bold border-none', cfg.bg, cfg.color)}>
                            {cfg.label}
                          </Badge>
                          {event.status === 'overdue' && <span className="text-[9px] font-black text-red-600">URGENTE</span>}
                          {event.status === 'due_soon' && <span className="text-[9px] font-black text-orange-600">PRÓXIMO</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
