"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Monitor, Users, Package, Car, Sparkles, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, Zap, Search, Filter, Mail,
  BarChart3, AlertTriangle, CheckCircle2, Clock,
  MapPin, Building2, DollarSign, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  MonetizableAsset, AssetCategory, AssetStatus, AssetRentUnit, Property,
} from '@/lib/types';
import { MonetizationSpacesPanel } from './monetization-spaces-panel';

// ── Props ─────────────────────────────────────────────────────────────────────
interface MonetizationViewProps {
  assets: MonetizableAsset[];
  properties: Property[];
  userId?: string;
  userEmail?: string;
}


// ── Catálogo de categorías ────────────────────────────────────────────────────
const CATEGORY_CFG: Record<AssetCategory, { icon: React.ReactNode; color: string; badge: string }> = {
  'Pantalla Digital':     { icon: <Monitor className="h-4 w-4" />,  color: 'text-blue-600 bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  'Coworking & Eventos':  { icon: <Users className="h-4 w-4" />,    color: 'text-purple-600 bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
  'Lockers & Almacén':    { icon: <Package className="h-4 w-4" />,  color: 'text-orange-600 bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  'Estacionamiento':      { icon: <Car className="h-4 w-4" />,      color: 'text-slate-600 bg-slate-50',   badge: 'bg-slate-100 text-slate-700' },
  'Área Común':           { icon: <Building2 className="h-4 w-4" />,color: 'text-green-600 bg-green-50',   badge: 'bg-green-100 text-green-700' },
  'Otro':                 { icon: <Sparkles className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50',     badge: 'bg-gray-100 text-gray-700' },
};

const STATUS_CFG: Record<AssetStatus, { dot: string; label: string; badge: string }> = {
  'Disponible':       { dot: 'bg-green-500',  label: 'Disponible',       badge: 'bg-green-100 text-green-700' },
  'Ocupado':          { dot: 'bg-red-500',    label: 'Ocupado',           badge: 'bg-red-100 text-red-700' },
  'En mantenimiento': { dot: 'bg-gray-400',   label: 'En mantenimiento',  badge: 'bg-gray-100 text-gray-600' },
};

const RENT_UNITS: AssetRentUnit[] = ['/mes', '/semana', '/día', '/bloque 4h', '/hora'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMonthly(rate: number, unit: AssetRentUnit): number {
  switch (unit) {
    case '/hora':      return rate * 8 * 22;   // 8h/día × 22 días
    case '/bloque 4h': return rate * 2 * 22;   // 2 bloques/día × 22 días
    case '/día':       return rate * 22;
    case '/semana':    return rate * 4.3;
    case '/mes':       return rate;
  }
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-AR')}`;
}

// ── Recomendación IA simple ───────────────────────────────────────────────────
function generateRecommendation(assets: MonetizableAsset[]): { title: string; body: string; gain: number } | null {
  if (!assets.length) return null;

  // Activos disponibles con mayor revenue potencial
  const available = assets.filter(a => a.status === 'Disponible');
  if (available.length === 0) return null;

  // Categoría con más disponibles
  const counts: Record<string, number> = {};
  for (const a of available) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }
  const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const topAvailable = available.filter(a => a.category === topCat[0]);
  const potentialGain = topAvailable.reduce((s, a) => s + toMonthly(a.baseRate, a.rentUnit), 0);

  return {
    title: `Activar ${topCat[1]} activo${topCat[1] > 1 ? 's' : ''} de ${topCat[0]}`,
    body: `Tenés ${topCat[1]} ${topCat[0].toLowerCase()}${topCat[1] > 1 ? 's' : ''} disponible${topCat[1] > 1 ? 's' : ''}. Activarlos${topCat[1] > 1 ? '' : 'lo'} podría generar hasta ${fmtMoney(Math.round(potentialGain))}/mes de ingreso adicional.`,
    gain: Math.round(potentialGain),
  };
}

// ── Componente principal ──────────────────────────────────────────────────────
export function MonetizationView({ assets, properties, userId, userEmail }: MonetizationViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();

  const [searchQ, setSearchQ] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = (): Partial<MonetizableAsset> => ({
    propertyId: properties[0]?.id ?? '',
    name: '',
    location: '',
    category: 'Pantalla Digital',
    status: 'Disponible',
    baseRate: 0,
    rentUnit: '/mes',
    tenantName: '',
    tenantEmail: '',
    notes: '',
  });
  const [form, setForm] = useState<Partial<MonetizableAsset>>(emptyForm());

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const currentRevenue = assets
      .filter(a => a.status === 'Ocupado')
      .reduce((s, a) => s + toMonthly(a.baseRate, a.rentUnit), 0);
    const potentialRevenue = assets
      .reduce((s, a) => s + toMonthly(a.baseRate, a.rentUnit), 0);
    const gap = potentialRevenue - currentRevenue;
    const gapPct = potentialRevenue > 0 ? Math.round((gap / potentialRevenue) * 100) : 0;

    const byCategory = (cat: AssetCategory) => assets.filter(a => a.category === cat);
    const digitalTotal = byCategory('Pantalla Digital').length;
    const digitalActive = byCategory('Pantalla Digital').filter(a => a.status === 'Ocupado').length;
    const coworkingTotal = byCategory('Coworking & Eventos').length;
    const coworkingOcc = coworkingTotal > 0
      ? Math.round((byCategory('Coworking & Eventos').filter(a => a.status === 'Ocupado').length / coworkingTotal) * 100)
      : 0;
    const lockerRevenue = byCategory('Lockers & Almacén')
      .filter(a => a.status === 'Ocupado')
      .reduce((s, a) => s + toMonthly(a.baseRate, a.rentUnit), 0);

    return { currentRevenue, potentialRevenue, gap, gapPct, digitalTotal, digitalActive, coworkingOcc, lockerRevenue };
  }, [assets]);

  const recommendation = useMemo(() => generateRecommendation(assets), [assets]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...assets];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(a =>
        (a.name ?? '').toLowerCase().includes(q) ||
        (a.propertyName ?? '').toLowerCase().includes(q) ||
        (a.location ?? '').toLowerCase().includes(q)
      );
    }
    if (filterCat !== 'all')    list = list.filter(a => a.category === filterCat);
    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus);
    return list;
  }, [assets, searchQ, filterCat, filterStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = (a: MonetizableAsset) => {
    setEditingId(a.id);
    setForm({ ...a });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.propertyId || !userId || !db) return;
    const property = properties.find(p => p.id === form.propertyId);
    const docId = editingId ?? Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizacion', docId);
    const data: MonetizableAsset = {
      id: docId,
      propertyId: form.propertyId!,
      propertyName: property?.name ?? 'Propiedad desconocida',
      name: form.name!,
      location: form.location ?? '',
      category: (form.category as AssetCategory) ?? 'Otro',
      status: (form.status as AssetStatus) ?? 'Disponible',
      baseRate: Number(form.baseRate) || 0,
      rentUnit: (form.rentUnit as AssetRentUnit) ?? '/mes',
      tenantName: form.tenantName,
      tenantEmail: form.tenantEmail,
      occupiedUntil: form.occupiedUntil,
      notes: form.notes,
      ownerId: userId,
      createdAt: editingId
        ? (assets.find(a => a.id === editingId)?.createdAt ?? new Date().toISOString())
        : new Date().toISOString(),
    };
    setDocumentNonBlocking(docRef, data, { merge: true });
    setIsFormOpen(false);
    toast({ title: editingId ? 'Activo actualizado' : 'Activo creado', description: 'Sincronizado con la nube.' });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizacion', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'Activo eliminado' });
  };

  const handleRentNow = (a: MonetizableAsset) => {
    const subject = encodeURIComponent(`Consulta de alquiler: ${a.name} — ${a.propertyName}`);
    const body = encodeURIComponent(
      `Hola,\n\nMe interesa alquilar el siguiente espacio:\n\n` +
      `• Activo: ${a.name}\n` +
      `• Ubicación: ${a.location} — ${a.propertyName}\n` +
      `• Categoría: ${a.category}\n` +
      `• Tarifa: ${fmtMoney(a.baseRate)}${a.rentUnit}\n\n` +
      `Por favor, indicarme disponibilidad y condiciones.\n\nGracias.`
    );
    window.open(`mailto:${userEmail ?? ''}?subject=${subject}&body=${body}`);
    toast({ title: 'Abriendo cliente de correo…' });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Publicidad y Monetización</h2>
          <p className="text-sm text-muted-foreground">Gestión centralizada de superficies y áreas rentables.</p>
        </div>
        {canWrite && (
          <Button className="bg-accent text-white gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Crear Activo
          </Button>
        )}
      </div>

      {/* ── Smart Insights + Quick stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Optimizador de Ingresos */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white h-full">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Smart Insights</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Optimizador de Ingresos</h3>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Ingreso actual */}
                <div className="p-3 rounded-xl bg-gray-50 border">
                  <p className="text-xs text-muted-foreground">Ingreso Actual</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtMoney(Math.round(stats.currentRevenue))}</p>
                  <Progress value={stats.potentialRevenue > 0 ? (stats.currentRevenue / stats.potentialRevenue) * 100 : 0} className="h-1.5 mt-2" />
                </div>

                {/* Brecha */}
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-xs text-muted-foreground">Brecha de Ocupación</p>
                  <p className="text-xl font-bold text-red-600 mt-0.5">{fmtMoney(Math.round(stats.gap))}</p>
                  <p className="text-[11px] text-red-500 mt-1 font-medium">
                    {stats.gapPct}% sin explotar
                  </p>
                </div>

                {/* Recomendación */}
                <div className="p-3 rounded-xl bg-accent/5 border border-accent/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="h-3 w-3 text-accent" />
                    <p className="text-[10px] font-bold text-accent uppercase tracking-wide">Recomendación IA</p>
                  </div>
                  {recommendation ? (
                    <p className="text-xs text-gray-700 leading-relaxed">{recommendation.title}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Todos los activos activos ✓</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Potencial mensual</p>
                  <p className="text-2xl font-bold text-accent">{fmtMoney(Math.round(stats.potentialRevenue))}</p>
                </div>
                {recommendation && canWrite && (
                  <Button
                    className="bg-accent text-white gap-2"
                    onClick={() => toast({ title: 'Plan de mejora', description: recommendation.body })}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Ejecutar Plan de Mejora
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          {[
            {
              icon: <Monitor className="h-5 w-5 text-blue-600" />,
              bg: 'bg-blue-50',
              label: 'Pantallas Digitales',
              value: `${stats.digitalActive} / ${stats.digitalTotal} Activas`,
              sub: stats.digitalTotal === 0 ? 'Sin pantallas registradas' : `${stats.digitalTotal - stats.digitalActive} disponibles`,
            },
            {
              icon: <Users className="h-5 w-5 text-purple-600" />,
              bg: 'bg-purple-50',
              label: 'Coworking & Eventos',
              value: `${stats.coworkingOcc}% Ocupación`,
              sub: 'Espacios compartidos',
            },
            {
              icon: <Package className="h-5 w-5 text-orange-600" />,
              bg: 'bg-orange-50',
              label: 'Lockers & Almacén',
              value: `${fmtMoney(Math.round(stats.lockerRevenue))} Rev/Mes`,
              sub: 'Ingresos de almacenaje',
            },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm bg-white">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Inventario de Activos ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">Inventario de Activos Monetizables</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs w-44"
                  placeholder="Buscar espacio…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {(Object.keys(CATEGORY_CFG) as AssetCategory[]).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(Object.keys(STATUS_CFG) as AssetStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No hay activos registrados</p>
              {canWrite && (
                <Button variant="outline" className="mt-3 gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Crear primer activo
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Espacio / Activo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Categoría</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Rendimiento</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const catCfg = CATEGORY_CFG[a.category];
                  const stCfg = STATUS_CFG[a.status];
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', catCfg.color)}>
                            {catCfg.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{a.location}{a.propertyName && ` — ${a.propertyName}`}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', catCfg.badge)}>
                          {a.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full', stCfg.dot)} />
                          <span className="text-sm">{stCfg.label}</span>
                        </div>
                        {a.tenantName && a.status === 'Ocupado' && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{a.tenantName}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-bold text-gray-900">
                          {fmtMoney(a.baseRate)}<span className="text-xs font-normal text-muted-foreground">{a.rentUnit}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ≈ {fmtMoney(Math.round(toMonthly(a.baseRate, a.rentUnit)))}/mes
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === 'Disponible' && (
                            <Button
                              size="sm"
                              className="bg-accent text-white text-xs h-7 px-3"
                              onClick={() => handleRentNow(a)}
                            >
                              <Mail className="h-3 w-3 mr-1" /> Rent Now
                            </Button>
                          )}
                          {canWrite && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Análisis de Zonas Calientes ── */}
      {assets.length > 0 && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Visual */}
            <div className="md:w-2/5 bg-gradient-to-br from-accent/10 to-accent/5 p-6 flex flex-col justify-between min-h-40">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <BarChart3 className="h-4 w-4" />
                Zonas de Alta Demanda
              </div>
              {/* Mini heatmap visual */}
              <div className="grid grid-cols-3 gap-1.5 mt-4">
                {(Object.keys(CATEGORY_CFG) as AssetCategory[]).map(cat => {
                  const catAssets = assets.filter(a => a.category === cat);
                  const occupiedPct = catAssets.length > 0
                    ? Math.round((catAssets.filter(a => a.status === 'Ocupado').length / catAssets.length) * 100)
                    : 0;
                  const catCfg = CATEGORY_CFG[cat];
                  return (
                    <div key={cat} className={cn('rounded-lg p-2 flex flex-col items-center text-center', catCfg.color)}>
                      {catCfg.icon}
                      <span className="text-[9px] font-bold mt-1 leading-tight">{cat.split(' ')[0]}</span>
                      <span className="text-[10px] font-bold">{occupiedPct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Análisis de Zonas Calientes</h3>
              {recommendation ? (
                <>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    {recommendation.body}
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 mb-4">
                    <Zap className="h-4 w-4 text-accent shrink-0" />
                    <p className="text-sm font-semibold text-accent">
                      Potencial adicional: {fmtMoney(recommendation.gain)}/mes si se activan todos los activos disponibles.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  Todos tus activos están activos y generando ingresos.
                  Considera agregar nuevos espacios para incrementar el potencial de monetización.
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="gap-2 text-sm"
                  onClick={() => toast({ title: 'Informe detallado', description: 'Próximamente disponible' })}
                >
                  <BarChart3 className="h-4 w-4" /> Ver Informe Detallado
                </Button>
                {canWrite && (
                  <Button
                    className="bg-accent text-white gap-2 text-sm"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4" /> Simular Nueva Instalación
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Dialog Form ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Activo' : 'Nuevo Activo Monetizable'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Propiedad</Label>
              <Select value={form.propertyId} onValueChange={v => setForm({ ...form, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del activo</Label>
              <Input
                placeholder="Pantalla Lobby A, Rooftop…"
                value={form.name ?? ''}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ubicación</Label>
              <Input
                placeholder="Planta 1 – Lobby, etc."
                value={form.location ?? ''}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as AssetCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_CFG) as AssetCategory[]).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AssetStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CFG) as AssetStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tarifa base ($)</Label>
              <Input
                type="number"
                min={0}
                value={form.baseRate ?? ''}
                onChange={e => setForm({ ...form, baseRate: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unidad</Label>
              <Select value={form.rentUnit} onValueChange={v => setForm({ ...form, rentUnit: v as AssetRentUnit })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.status === 'Ocupado' && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Arrendatario</Label>
                  <Input
                    placeholder="Nombre empresa / persona"
                    value={form.tenantName ?? ''}
                    onChange={e => setForm({ ...form, tenantName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email arrendatario</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={form.tenantEmail ?? ''}
                    onChange={e => setForm({ ...form, tenantEmail: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Ocupado hasta</Label>
                  <Input
                    type="date"
                    value={form.occupiedUntil ?? ''}
                    onChange={e => setForm({ ...form, occupiedUntil: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea
                placeholder="Observaciones, especificaciones técnicas…"
                rows={2}
                value={form.notes ?? ''}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {/* Preview tarifa mensual */}
            {(form.baseRate ?? 0) > 0 && (
              <div className="col-span-2 p-2 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-xs text-accent font-medium">
                  ≈ {fmtMoney(Math.round(toMonthly(Number(form.baseRate), form.rentUnit as AssetRentUnit ?? '/mes')))}/mes equivalente
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button className="bg-accent text-white" onClick={handleSave}>
              {editingId ? 'Guardar cambios' : 'Crear Activo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Espacios: ofertas, solicitudes y sugerencias a propietarios ── */}
      <MonetizationSpacesPanel userId={userId} properties={properties} />
    </div>
  );
}
