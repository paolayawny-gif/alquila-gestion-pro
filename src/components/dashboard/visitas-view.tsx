"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CalendarDays, List, Settings2, Plus, ChevronLeft, ChevronRight,
  Clock, Search, Loader2, Trash2, Edit2, CheckCircle2, XCircle,
  RotateCcw, Phone, Mail, Home, User, Palette, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { doc, getDoc, collection, query, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import { Visit, VisitStatus, VisitasConfig, EventType, WorkingHourSlot } from '@/lib/types/visitas';
import { Property } from '@/lib/types';
import { sendEmail } from '@/services/email-service';
import {
  emailVisitConfirmation,
  emailVisitCancellation,
  emailVisitReschedule,
} from '@/lib/email-templates';

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_ID = 'alquilagestion-pro';

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#ef4444', '#06b6d4', '#84cc16',
];

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Default working hours: Mon–Fri 9-18, Sat 9-13, Sun off
// Index: 1=Mon … 7=Sun (ISO weekday)
const DEFAULT_WORKING_HOURS: Record<number, WorkingHourSlot> = {
  1: { enabled: true,  start: '09:00', end: '18:00' },
  2: { enabled: true,  start: '09:00', end: '18:00' },
  3: { enabled: true,  start: '09:00', end: '18:00' },
  4: { enabled: true,  start: '09:00', end: '18:00' },
  5: { enabled: true,  start: '09:00', end: '18:00' },
  6: { enabled: true,  start: '09:00', end: '13:00' },
  7: { enabled: false, start: '09:00', end: '13:00' },
};

const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: '1', name: 'Muestra',          color: '#10b981', duration: 60  },
  { id: '2', name: 'Inspección',        color: '#3b82f6', duration: 90  },
  { id: '3', name: 'Mantenimiento',     color: '#f59e0b', duration: 120 },
  { id: '4', name: 'Firma de contrato', color: '#8b5cf6', duration: 30  },
  { id: '5', name: 'Entrega de llaves', color: '#ec4899', duration: 30  },
];

const DEFAULT_CONFIG: VisitasConfig = {
  eventTypes:   DEFAULT_EVENT_TYPES,
  workingHours: DEFAULT_WORKING_HOURS,
  slotDuration: 30,
  bufferTime:   15,
  autoConfirm:  false,
  notifyVisitor: true,
  notifyAdmin:   true,
  reminderHours: 24,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr: string) {
  const d = parseDate(dateStr);
  return `${pad(d.getDate())} de ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Returns the ISO weekday (1=Mon … 7=Sun) for a date string */
function isoWeekday(dateStr: string) {
  const d = parseDate(dateStr);
  const dow = d.getDay(); // 0=Sun
  return dow === 0 ? 7 : dow;
}

/** Monday of the week containing `date` */
function startOfWeek(date: Date) {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const STATUS_META: Record<VisitStatus, { label: string; color: string; bg: string }> = {
  Pendiente:    { label: 'Pendiente',    color: '#d97706', bg: '#fef3c7' },
  Confirmada:   { label: 'Confirmada',   color: '#059669', bg: '#d1fae5' },
  Realizada:    { label: 'Realizada',    color: '#2563eb', bg: '#dbeafe' },
  Cancelada:    { label: 'Cancelada',    color: '#dc2626', bg: '#fee2e2' },
  Reprogramada: { label: 'Reprogramada', color: '#7c3aed', bg: '#ede9fe' },
};

// ── Month Calendar ────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  visits,
  onDayClick,
  onVisitClick,
}: {
  currentDate: Date;
  visits: Visit[];
  onDayClick: (date: string) => void;
  onVisitClick: (v: Visit) => void;
}) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = formatDate(new Date());

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const offset   = firstDow === 0 ? 6 : firstDow - 1; // Mon-start
    const days     = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, Visit[]> = {};
    for (const v of visits) {
      if (!map[v.scheduledDate]) map[v.scheduledDate] = [];
      map[v.scheduledDate].push(v);
    }
    return map;
  }, [visits]);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 border-l">
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`e-${i}`} className="min-h-[100px] border-r border-b bg-muted/20" />
          );
          const dateStr  = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayVisits = byDate[dateStr] ?? [];
          const isToday  = dateStr === today;
          const shown    = dayVisits.slice(0, 3);
          const extra    = dayVisits.length - 3;

          return (
            <div
              key={dateStr}
              className="min-h-[100px] border-r border-b p-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onDayClick(dateStr)}
            >
              <span className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
              )}>
                {day}
              </span>

              <div className="space-y-0.5">
                {shown.map(v => (
                  <div
                    key={v.id}
                    className="truncate rounded px-1 text-[10px] font-medium text-white leading-4"
                    style={{ backgroundColor: v.eventTypeColor }}
                    onClick={e => { e.stopPropagation(); onVisitClick(v); }}
                    title={`${v.scheduledTime} · ${v.visitorName} · ${v.eventTypeName}`}
                  >
                    {v.scheduledTime} {v.visitorName.split(' ')[0]}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="text-[10px] text-muted-foreground pl-1">+{extra} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week Calendar ─────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8 … 20
const HOUR_H = 64; // px per hour

function WeekView({
  currentDate,
  visits,
  onVisitClick,
  onSlotClick,
}: {
  currentDate: Date;
  visits: Visit[];
  onVisitClick: (v: Visit) => void;
  onSlotClick:  (date: string, time: string) => void;
}) {
  const monday = startOfWeek(currentDate);
  const days   = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today  = formatDate(new Date());

  const byDate = useMemo(() => {
    const map: Record<string, Visit[]> = {};
    for (const v of visits) {
      if (!map[v.scheduledDate]) map[v.scheduledDate] = [];
      map[v.scheduledDate].push(v);
    }
    return map;
  }, [visits]);

  return (
    <div className="overflow-auto">
      {/* Header row */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => {
          const ds    = formatDate(d);
          const isToday = ds === today;
          return (
            <div key={i} className={cn(
              'flex-1 text-center py-2 text-xs font-medium border-l',
              isToday && 'bg-primary/5',
            )}>
              <div className={cn('text-muted-foreground', isToday && 'text-primary font-bold')}>
                {DAY_LABELS[i]}
              </div>
              <div className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold mx-auto',
                isToday ? 'bg-primary text-primary-foreground' : '',
              )}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-14 shrink-0">
          {HOURS.map(h => (
            <div
              key={h}
              className="text-[10px] text-muted-foreground text-right pr-2 border-b"
              style={{ height: HOUR_H }}
            >
              {pad(h)}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, di) => {
          const ds       = formatDate(d);
          const dayVisits = byDate[ds] ?? [];
          const isToday  = ds === today;

          return (
            <div
              key={di}
              className={cn('flex-1 relative border-l', isToday && 'bg-primary/5')}
              style={{ height: HOURS.length * HOUR_H }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-b border-muted/50 cursor-pointer hover:bg-muted/20"
                  style={{ top: (h - 8) * HOUR_H, height: HOUR_H }}
                  onClick={() => onSlotClick(ds, `${pad(h)}:00`)}
                />
              ))}

              {/* Events */}
              {dayVisits.map(v => {
                const mins   = timeToMinutes(v.scheduledTime) - 8 * 60;
                const top    = (mins / 60) * HOUR_H;
                const height = Math.max((v.duration / 60) * HOUR_H - 2, 20);
                return (
                  <div
                    key={v.id}
                    className="absolute left-0.5 right-0.5 rounded px-1 text-white overflow-hidden cursor-pointer hover:brightness-90 transition-all z-10"
                    style={{ top: top + 1, height, backgroundColor: v.eventTypeColor }}
                    onClick={e => { e.stopPropagation(); onVisitClick(v); }}
                    title={`${v.scheduledTime} · ${v.visitorName}`}
                  >
                    <div className="text-[10px] font-semibold leading-tight truncate">
                      {v.scheduledTime}
                    </div>
                    {height > 28 && (
                      <div className="text-[10px] leading-tight truncate opacity-90">
                        {v.visitorName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  visits,
  onVisitClick,
  onSlotClick,
}: {
  currentDate: Date;
  visits: Visit[];
  onVisitClick: (v: Visit) => void;
  onSlotClick:  (date: string, time: string) => void;
}) {
  const ds       = formatDate(currentDate);
  const dayVisits = visits.filter(v => v.scheduledDate === ds);

  return (
    <div className="flex">
      {/* Hour labels */}
      <div className="w-14 shrink-0">
        {HOURS.map(h => (
          <div
            key={h}
            className="text-[10px] text-muted-foreground text-right pr-2 border-b"
            style={{ height: HOUR_H }}
          >
            {pad(h)}:00
          </div>
        ))}
      </div>

      {/* Single day column */}
      <div
        className="flex-1 relative border-l bg-primary/5"
        style={{ height: HOURS.length * HOUR_H }}
      >
        {HOURS.map(h => (
          <div
            key={h}
            className="absolute w-full border-b border-muted/50 cursor-pointer hover:bg-muted/20"
            style={{ top: (h - 8) * HOUR_H, height: HOUR_H }}
            onClick={() => onSlotClick(ds, `${pad(h)}:00`)}
          />
        ))}

        {dayVisits.map(v => {
          const mins   = timeToMinutes(v.scheduledTime) - 8 * 60;
          const top    = (mins / 60) * HOUR_H;
          const height = Math.max((v.duration / 60) * HOUR_H - 2, 36);
          return (
            <div
              key={v.id}
              className="absolute left-1 right-1 rounded-lg px-3 py-1 text-white overflow-hidden cursor-pointer hover:brightness-90 transition-all z-10 shadow-sm"
              style={{ top: top + 1, height, backgroundColor: v.eventTypeColor }}
              onClick={e => { e.stopPropagation(); onVisitClick(v); }}
            >
              <div className="text-xs font-bold">{v.scheduledTime} — {v.eventTypeName}</div>
              {height > 36 && <div className="text-xs opacity-90 truncate">{v.visitorName}</div>}
              {height > 52 && <div className="text-xs opacity-75 truncate">{v.propertyName}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Visit Dialog ──────────────────────────────────────────────────────────────

interface VisitForm {
  propertyId:    string;
  visitorName:   string;
  visitorEmail:  string;
  visitorPhone:  string;
  eventTypeId:   string;
  scheduledDate: string;
  scheduledTime: string;
  duration:      string;
  notes:         string;
  agentName:     string;
  status:        VisitStatus;
}

const EMPTY_FORM: VisitForm = {
  propertyId:    '',
  visitorName:   '',
  visitorEmail:  '',
  visitorPhone:  '',
  eventTypeId:   '',
  scheduledDate: formatDate(new Date()),
  scheduledTime: '10:00',
  duration:      '60',
  notes:         '',
  agentName:     '',
  status:        'Pendiente',
};

// ── Config Section ────────────────────────────────────────────────────────────

function ConfigSection({
  config,
  onSave,
  saving,
}: {
  config: VisitasConfig;
  onSave: (c: VisitasConfig) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<VisitasConfig>(config);
  const [configTab, setConfigTab] = useState<'tipos' | 'horarios' | 'preferencias'>('tipos');
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(PRESET_COLORS[0]);
  const [newDur, setNewDur]       = useState('60');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  useEffect(() => { setLocal(config); }, [config]);

  const addType = () => {
    if (!newName.trim()) return;
    const t: EventType = {
      id:       Date.now().toString(),
      name:     newName.trim(),
      color:    newColor,
      duration: parseInt(newDur) || 60,
    };
    setLocal(prev => ({ ...prev, eventTypes: [...prev.eventTypes, t] }));
    setNewName(''); setNewDur('60');
  };

  const removeType = (id: string) => {
    setLocal(prev => ({ ...prev, eventTypes: prev.eventTypes.filter(t => t.id !== id) }));
  };

  const updateType = (id: string, patch: Partial<EventType>) => {
    setLocal(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  };

  const updateWorkingHour = (day: number, patch: Partial<WorkingHourSlot>) => {
    setLocal(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], ...patch },
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Config tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {(['tipos', 'horarios', 'preferencias'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setConfigTab(tab)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
              configTab === tab
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'tipos' ? 'Tipos de Evento' : tab === 'horarios' ? 'Horarios' : 'Preferencias'}
          </button>
        ))}
      </div>

      {/* ── Tipos de Evento ── */}
      {configTab === 'tipos' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Tipos de evento personalizados</h3>
            <p className="text-sm text-muted-foreground">
              Definí los tipos de visita para tu negocio. Cada uno tiene nombre, color y duración predeterminada.
            </p>
          </div>

          {/* Existing types */}
          <div className="space-y-2">
            {local.eventTypes.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                <div
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {editingTypeId === t.id ? (
                  <div className="flex flex-1 gap-2 flex-wrap">
                    <Input
                      className="h-7 text-sm flex-1 min-w-[120px]"
                      value={t.name}
                      onChange={e => updateType(t.id, { name: e.target.value })}
                    />
                    <Input
                      className="h-7 text-sm w-20"
                      type="number"
                      value={t.duration}
                      onChange={e => updateType(t.id, { duration: parseInt(e.target.value) || 60 })}
                    />
                    <span className="text-sm text-muted-foreground self-center">min</span>
                    <div className="flex gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          className={cn(
                            'h-5 w-5 rounded-full border-2',
                            t.color === c ? 'border-foreground' : 'border-transparent',
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => updateType(t.id, { color: c })}
                        />
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingTypeId(null)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.duration} min</span>
                  </div>
                )}
                {editingTypeId !== t.id && (
                  <div className="flex gap-1">
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingTypeId(t.id)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeType(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new type */}
          <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Agregar nuevo tipo</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Nombre del tipo (ej: Tasación)"
                className="flex-1 min-w-[180px]"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Min"
                className="w-20"
                value={newDur}
                onChange={e => setNewDur(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 items-center">
              <span className="text-xs text-muted-foreground">Color:</span>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform',
                    newColor === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <Button size="sm" onClick={addType} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar tipo
            </Button>
          </div>
        </div>
      )}

      {/* ── Horarios ── */}
      {configTab === 'horarios' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Horarios de atención</h3>
            <p className="text-sm text-muted-foreground">
              Configurá los días y horarios en que aceptás visitas.
            </p>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map(day => {
              const wh = local.workingHours[day] ?? { enabled: false, start: '09:00', end: '18:00' };
              return (
                <div key={day} className="flex items-center gap-4 p-3 border rounded-lg bg-card">
                  <Switch
                    checked={wh.enabled}
                    onCheckedChange={v => updateWorkingHour(day, { enabled: v })}
                  />
                  <span className={cn(
                    'w-20 text-sm font-medium',
                    !wh.enabled && 'text-muted-foreground',
                  )}>
                    {DAY_LABELS_FULL[day - 1]}
                  </span>
                  {wh.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={wh.start}
                        className="w-28 h-8 text-sm"
                        onChange={e => updateWorkingHour(day, { start: e.target.value })}
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input
                        type="time"
                        value={wh.end}
                        className="w-28 h-8 text-sm"
                        onChange={e => updateWorkingHour(day, { end: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Preferencias ── */}
      {configTab === 'preferencias' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Preferencias generales</h3>
            <p className="text-sm text-muted-foreground">
              Configurá el comportamiento predeterminado de la agenda.
            </p>
          </div>

          <div className="grid gap-4 max-w-lg">
            {[
              {
                key: 'autoConfirm' as const,
                label: 'Confirmación automática',
                desc: 'Las visitas pasan directamente a "Confirmada" al crearlas.',
              },
              {
                key: 'notifyVisitor' as const,
                label: 'Notificar al visitante por email',
                desc: 'Envía confirmación, cancelación y recordatorio al visitante.',
              },
              {
                key: 'notifyAdmin' as const,
                label: 'Notificarme a mí',
                desc: 'Recibirás una copia de cada notificación en tu email.',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-card">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <Switch
                  checked={local[key]}
                  onCheckedChange={v => setLocal(prev => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}

            <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
              <div className="flex-1">
                <p className="text-sm font-medium">Recordatorio previo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Horas antes de la visita para enviar el recordatorio.
                </p>
              </div>
              <Select
                value={String(local.reminderHours)}
                onValueChange={v => setLocal(prev => ({ ...prev, reminderHours: parseInt(v) }))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 6, 12, 24, 48].map(h => (
                    <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
              <div className="flex-1">
                <p className="text-sm font-medium">Tiempo entre turnos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Buffer de tiempo libre entre una visita y la siguiente.
                </p>
              </div>
              <Select
                value={String(local.bufferTime)}
                onValueChange={v => setLocal(prev => ({ ...prev, bufferTime: parseInt(v) }))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 10, 15, 30, 60].map(m => (
                    <SelectItem key={m} value={String(m)}>{m === 0 ? 'Sin buffer' : `${m} min`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={() => onSave(local)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface VisitasViewProps {
  userId?:     string;
  properties: Property[];
}

export function VisitasView({ userId, properties }: VisitasViewProps) {
  const { toast } = useToast();
  const db = useFirestore();

  // ── Section & calendar view state ─────────────────────────────────────────
  const [section, setSection]     = useState<'calendar' | 'lista' | 'config'>('calendar');
  const [calView, setCalView]     = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showDialog, setShowDialog]   = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [form, setForm]               = useState<VisitForm>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  // ── Config ────────────────────────────────────────────────────────────────
  const [config, setConfig]         = useState<VisitasConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── List filters ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType,   setFilterType]   = useState('all');
  const [search,       setSearch]       = useState('');

  // ── Firestore ─────────────────────────────────────────────────────────────
  const visitsCol = useMemo(() => {
    if (!userId || !db) return null;
    return collection(db, 'artifacts', APP_ID, 'users', userId, 'visitas');
  }, [userId, db]);

  const visitsQuery = useMemo(
    () => visitsCol ? query(visitsCol, orderBy('createdAt', 'desc')) : null,
    [visitsCol],
  );
  const { data: visitsData } = useCollection<Visit>(visitsQuery);
  const visits: Visit[] = useMemo(() => visitsData ?? [], [visitsData]);

  // Load config once
  useEffect(() => {
    if (!userId || !db || configLoaded) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'visitasConfig', 'settings');
    getDoc(ref).then(snap => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() as VisitasConfig });
      setConfigLoaded(true);
    });
  }, [userId, db, configLoaded]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const configRef = useCallback(() => {
    if (!userId || !db) return null;
    return doc(db, 'artifacts', APP_ID, 'users', userId, 'visitasConfig', 'settings');
  }, [userId, db]);

  const saveConfig = useCallback(async (newConfig: VisitasConfig) => {
    const ref = configRef();
    if (!ref) return;
    setSavingConfig(true);
    setConfig(newConfig);
    setDocumentNonBlocking(ref, newConfig, {});
    setSavingConfig(false);
    toast({ title: 'Configuración guardada' });
  }, [configRef, toast]);

  const openNewVisit = useCallback((date?: string, time?: string) => {
    setEditingVisit(null);
    setForm({
      ...EMPTY_FORM,
      scheduledDate: date ?? formatDate(new Date()),
      scheduledTime: time ?? '10:00',
      status: config.autoConfirm ? 'Confirmada' : 'Pendiente',
    });
    setShowDialog(true);
  }, [config.autoConfirm]);

  const openEditVisit = useCallback((v: Visit) => {
    setEditingVisit(v);
    setForm({
      propertyId:    v.propertyId,
      visitorName:   v.visitorName,
      visitorEmail:  v.visitorEmail,
      visitorPhone:  v.visitorPhone ?? '',
      eventTypeId:   v.eventTypeId,
      scheduledDate: v.scheduledDate,
      scheduledTime: v.scheduledTime,
      duration:      String(v.duration),
      notes:         v.notes ?? '',
      agentName:     v.agentName ?? '',
      status:        v.status,
    });
    setDetailVisit(null);
    setShowDialog(true);
  }, []);

  const handleSave = async () => {
    if (!userId || !db || !visitsCol) return;
    if (!form.propertyId || !form.visitorName || !form.visitorEmail || !form.eventTypeId) {
      toast({ title: 'Completá los campos obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const property   = properties.find(p => p.id === form.propertyId);
      const eventType  = config.eventTypes.find(t => t.id === form.eventTypeId);
      const now        = Date.now();

      const visitData: Omit<Visit, 'id'> = {
        propertyId:      form.propertyId,
        propertyName:    property?.name ?? property?.address ?? '',
        propertyAddress: property?.address,
        visitorName:     form.visitorName,
        visitorEmail:    form.visitorEmail,
        visitorPhone:    form.visitorPhone || undefined,
        eventTypeId:     form.eventTypeId,
        eventTypeName:   eventType?.name ?? '',
        eventTypeColor:  eventType?.color ?? '#10b981',
        scheduledDate:   form.scheduledDate,
        scheduledTime:   form.scheduledTime,
        duration:        parseInt(form.duration) || eventType?.duration || 60,
        status:          form.status,
        notes:           form.notes || undefined,
        agentName:       form.agentName || undefined,
        createdAt:       editingVisit?.createdAt ?? now,
        updatedAt:       now,
      };

      if (editingVisit) {
        const ref = doc(visitsCol, editingVisit.id);
        setDocumentNonBlocking(ref, { ...visitData, id: editingVisit.id }, { merge: true });
      } else {
        const ref = doc(visitsCol);
        setDocumentNonBlocking(ref, { ...visitData, id: ref.id }, {});

        // Send confirmation email if enabled
        if (config.notifyVisitor && form.visitorEmail) {
          sendEmail({
            to:      form.visitorEmail,
            subject: `Visita confirmada — ${property?.name ?? ''}`,
            html:    emailVisitConfirmation({
              visitorName:     form.visitorName,
              propertyName:    property?.name ?? property?.address ?? '',
              propertyAddress: property?.address,
              visitDate:       formatDisplayDate(form.scheduledDate),
              visitTime:       form.scheduledTime,
              eventType:       eventType?.name ?? '',
              duration:        parseInt(form.duration) || eventType?.duration || 60,
              agentName:       form.agentName || undefined,
              notes:           form.notes || undefined,
            }),
          }).catch(() => {/* email errors are non-fatal */});
        }
      }

      toast({ title: editingVisit ? 'Visita actualizada' : 'Visita creada' });
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (visit: Visit, status: VisitStatus) => {
    if (!userId || !db || !visitsCol) return;
    const ref = doc(visitsCol, visit.id);
    setDocumentNonBlocking(ref, { status, updatedAt: Date.now() }, { merge: true });

    if (status === 'Cancelada' && config.notifyVisitor && visit.visitorEmail) {
      sendEmail({
        to:      visit.visitorEmail,
        subject: `Visita cancelada — ${visit.propertyName}`,
        html:    emailVisitCancellation({
          visitorName:  visit.visitorName,
          propertyName: visit.propertyName,
          visitDate:    formatDisplayDate(visit.scheduledDate),
          visitTime:    visit.scheduledTime,
        }),
      }).catch(() => {});
    }

    if (status === 'Reprogramada' && config.notifyVisitor && visit.visitorEmail) {
      sendEmail({
        to:      visit.visitorEmail,
        subject: `Visita reprogramada — ${visit.propertyName}`,
        html:    emailVisitReschedule({
          visitorName:  visit.visitorName,
          propertyName: visit.propertyName,
          oldDate:      formatDisplayDate(visit.scheduledDate),
          oldTime:      visit.scheduledTime,
          newDate:      '—',
          newTime:      '—',
        }),
      }).catch(() => {});
    }

    setDetailVisit(null);
    toast({ title: `Estado actualizado: ${status}` });
  };

  const handleDelete = async (id: string) => {
    if (!userId || !db || !visitsCol) return;
    const ref = doc(visitsCol, id);
    deleteDocumentNonBlocking(ref);
    setDetailVisit(null);
    toast({ title: 'Visita eliminada' });
  };

  // ── Calendar navigation ───────────────────────────────────────────────────
  const navigate = (dir: 1 | -1) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (calView === 'month') d.setMonth(d.getMonth() + dir);
      else if (calView === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const calTitle = useMemo(() => {
    if (calView === 'month') return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (calView === 'week') {
      const mon = startOfWeek(currentDate);
      const sun = addDays(mon, 6);
      return `${pad(mon.getDate())}/${pad(mon.getMonth() + 1)} — ${pad(sun.getDate())}/${pad(sun.getMonth() + 1)} ${sun.getFullYear()}`;
    }
    return `${pad(currentDate.getDate())} de ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [calView, currentDate]);

  // ── Filtered visits ───────────────────────────────────────────────────────
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (filterType   !== 'all' && v.eventTypeId !== filterType) return false;
      if (search && !`${v.visitorName} ${v.propertyName} ${v.visitorEmail}`
            .toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [visits, filterStatus, filterType, search]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     visits.length,
    pendiente: visits.filter(v => v.status === 'Pendiente').length,
    hoy:       visits.filter(v => v.scheduledDate === formatDate(new Date())).length,
    semana:    visits.filter(v => {
      const mon = startOfWeek(new Date());
      const sun = addDays(mon, 6);
      const d   = parseDate(v.scheduledDate);
      return d >= mon && d <= sun;
    }).length,
  }), [visits]);

  // ── Visible visits for current calendar period ────────────────────────────
  const calendarVisits = useMemo(() => {
    if (calView === 'month') {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      return visits.filter(v => v.scheduledDate.startsWith(`${y}-${m}`));
    }
    if (calView === 'week') {
      const mon = startOfWeek(currentDate);
      const sun = addDays(mon, 6);
      return visits.filter(v => {
        const d = parseDate(v.scheduledDate);
        return d >= mon && d <= sun;
      });
    }
    return visits.filter(v => v.scheduledDate === formatDate(currentDate));
  }, [visits, calView, currentDate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitas y Turnos</h1>
          <p className="text-muted-foreground mt-1">
            Agenda de visitas, inspecciones y reuniones de tu cartera
          </p>
        </div>
        <Button onClick={() => openNewVisit()} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Nueva Visita
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,     color: 'text-foreground'      },
          { label: 'Pendientes',  value: stats.pendiente, color: 'text-amber-600'        },
          { label: 'Hoy',         value: stats.hoy,       color: 'text-primary'          },
          { label: 'Esta semana', value: stats.semana,    color: 'text-blue-600'         },
        ].map(s => (
          <Card key={s.label} className="py-4">
            <CardContent className="pt-0 pb-0 text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section selector */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'calendar', label: 'Calendario', icon: CalendarDays },
          { id: 'lista',    label: 'Lista',       icon: List         },
          { id: 'config',   label: 'Configuración', icon: Settings2  },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id as typeof section)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              section === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── CALENDAR SECTION ── */}
      {section === 'calendar' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* View toggle */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                {(['month', 'week', 'day'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCalView(v)}
                    className={cn(
                      'px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors',
                      calView === v
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[180px] text-center">{calTitle}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs"
                >
                  Hoy
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="overflow-hidden p-0">
            {calView === 'month' && (
              <MonthView
                currentDate={currentDate}
                visits={calendarVisits}
                onDayClick={date => { setCurrentDate(parseDate(date)); setCalView('day'); }}
                onVisitClick={v => setDetailVisit(v)}
              />
            )}
            {calView === 'week' && (
              <WeekView
                currentDate={currentDate}
                visits={calendarVisits}
                onVisitClick={v => setDetailVisit(v)}
                onSlotClick={(date, time) => openNewVisit(date, time)}
              />
            )}
            {calView === 'day' && (
              <DayView
                currentDate={currentDate}
                visits={calendarVisits}
                onVisitClick={v => setDetailVisit(v)}
                onSlotClick={(date, time) => openNewVisit(date, time)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── LIST SECTION ── */}
      {section === 'lista' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar visitante, propiedad…"
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(Object.keys(STATUS_META) as VisitStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {config.eventTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredVisits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">No hay visitas para mostrar</p>
                <p className="text-sm mt-1">Creá la primera con el botón &quot;Nueva Visita&quot;</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Visitante</TableHead>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.map(v => {
                    const meta = STATUS_META[v.status];
                    return (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setDetailVisit(v)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: v.eventTypeColor }} />
                            <span className="text-sm">{v.eventTypeName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{v.visitorName}</div>
                          <div className="text-xs text-muted-foreground">{v.visitorEmail}</div>
                        </TableCell>
                        <TableCell className="text-sm">{v.propertyName}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {formatDisplayDate(v.scheduledDate)}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {v.scheduledTime} · {v.duration} min
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="text-xs font-medium border-0"
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7"
                            onClick={e => { e.stopPropagation(); openEditVisit(v); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CONFIG SECTION ── */}
      {section === 'config' && (
        <Card>
          <CardContent className="pt-6">
            <ConfigSection config={config} onSave={saveConfig} saving={savingConfig} />
          </CardContent>
        </Card>
      )}

      {/* ── CREATE / EDIT DIALOG ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVisit ? 'Editar visita' : 'Nueva visita'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Property */}
            <div className="space-y-1.5">
              <Label>Propiedad *</Label>
              <Select value={form.propertyId} onValueChange={v => setForm(f => ({ ...f, propertyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una propiedad" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name ?? p.address ?? p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event type */}
            <div className="space-y-1.5">
              <Label>Tipo de visita *</Label>
              <Select value={form.eventTypeId} onValueChange={v => {
                const et = config.eventTypes.find(t => t.id === v);
                setForm(f => ({ ...f, eventTypeId: v, duration: String(et?.duration ?? 60) }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {config.eventTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name} ({t.duration} min)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visitor info */}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre del visitante *</Label>
                <Input
                  placeholder="Ej: María García"
                  value={form.visitorName}
                  onChange={e => setForm(f => ({ ...f, visitorName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="visitante@email.com"
                  value={form.visitorEmail}
                  onChange={e => setForm(f => ({ ...f, visitorEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={form.visitorPhone}
                  onChange={e => setForm(f => ({ ...f, visitorPhone: e.target.value }))}
                />
              </div>
            </div>

            {/* Date, time, duration */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={form.scheduledDate}
                  onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hora *</Label>
                <Input
                  type="time"
                  value={form.scheduledTime}
                  onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duración (min)</Label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                />
              </div>
            </div>

            {/* Agent */}
            <div className="space-y-1.5">
              <Label>Agente responsable</Label>
              <Input
                placeholder="Nombre del agente"
                value={form.agentName}
                onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
              />
            </div>

            {/* Status (only when editing) */}
            {editingVisit && (
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as VisitStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as VisitStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Indicaciones especiales, referencia del inmueble, etc."
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingVisit ? 'Guardar cambios' : 'Crear visita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL DIALOG ── */}
      <Dialog open={!!detailVisit} onOpenChange={open => !open && setDetailVisit(null)}>
        <DialogContent className="max-w-md">
          {detailVisit && (() => {
            const meta = STATUS_META[detailVisit.status];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: detailVisit.eventTypeColor }} />
                    <DialogTitle className="text-base">{detailVisit.eventTypeName}</DialogTitle>
                  </div>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <Badge
                      className="text-xs font-semibold border-0"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDisplayDate(detailVisit.scheduledDate)} · {detailVisit.scheduledTime}
                      {' '}({detailVisit.duration} min)
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{detailVisit.visitorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{detailVisit.visitorEmail}</span>
                    </div>
                    {detailVisit.visitorPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{detailVisit.visitorPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{detailVisit.propertyName}</span>
                    </div>
                    {detailVisit.agentName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Agente: {detailVisit.agentName}</span>
                      </div>
                    )}
                    {detailVisit.notes && (
                      <div className="p-2.5 bg-muted/50 rounded-md text-muted-foreground italic text-xs">
                        {detailVisit.notes}
                      </div>
                    )}
                  </div>

                  {/* Quick status actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {detailVisit.status !== 'Confirmada' && detailVisit.status !== 'Realizada' && (
                      <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleStatusChange(detailVisit, 'Confirmada')}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar
                      </Button>
                    )}
                    {detailVisit.status === 'Confirmada' && (
                      <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleStatusChange(detailVisit, 'Realizada')}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar realizada
                      </Button>
                    )}
                    {detailVisit.status !== 'Cancelada' && detailVisit.status !== 'Realizada' && (
                      <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={() => handleStatusChange(detailVisit, 'Reprogramada')}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reprogramar
                      </Button>
                    )}
                    {detailVisit.status !== 'Cancelada' && detailVisit.status !== 'Realizada' && (
                      <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => handleStatusChange(detailVisit, 'Cancelada')}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(detailVisit.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditVisit(detailVisit)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
