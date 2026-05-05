'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sun, Snowflake, PartyPopper, Star, Download, Plus,
  Trash2, SlidersHorizontal, TrendingUp, TrendingDown,
  ChevronRight, Building2, Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Contract } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const APP_ID = 'alquilagestion-pro';

// ── Tipos ──────────────────────────────────────────────
export interface Season {
  id: string;
  name: string;
  startDate: string;   // "15 Abril"
  endDate: string;     // "15 Septiembre"
  minNightlyRate: number;
  seasonType: 'alta' | 'baja' | 'festivo' | 'especial';
}

export interface HybridConfig {
  id: string;             // = propertyId
  hybridEnabled: boolean;
  seasons: Season[];
  ownerId: string;
}

interface HybridRentalsViewProps {
  properties: Property[];
  contracts: Contract[];
  userId?: string;
}

// ── Constantes ────────────────────────────────────────
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Pesos de distribución mensual para modelo híbrido (temporada alta = verano)
const HYBRID_WEIGHTS = [0.058, 0.058, 0.070, 0.082, 0.090, 0.105, 0.125, 0.120, 0.090, 0.078, 0.062, 0.062];

function getMonthlyData(traditionalAnnual: number, hybridAnnual: number) {
  const tradMonthly = traditionalAnnual / 12;
  return MONTHS.map((month, i) => ({
    month,
    traditional: Math.round(tradMonthly),
    hybrid: Math.round(hybridAnnual * HYBRID_WEIGHTS[i]),
  }));
}

const SEASON_ICONS: Record<Season['seasonType'], React.ReactNode> = {
  alta:     <Sun className="h-5 w-5 text-amber-500" />,
  baja:     <Snowflake className="h-5 w-5 text-blue-400" />,
  festivo:  <PartyPopper className="h-5 w-5 text-red-400" />,
  especial: <Star className="h-5 w-5 text-purple-500" />,
};

const SEASON_BG: Record<Season['seasonType'], string> = {
  alta:     'bg-amber-50',
  baja:     'bg-blue-50',
  festivo:  'bg-red-50',
  especial: 'bg-purple-50',
};

// ── Gráfico de barras SVG ──────────────────────────────
function BarChart({ data }: { data: ReturnType<typeof getMonthlyData> }) {
  const maxVal = Math.max(...data.flatMap(d => [d.traditional, d.hybrid]));
  const barW = 14;
  const gap = 4;
  const groupW = barW * 2 + gap + 8;
  const chartH = 100;
  const paddingB = 20;
  const totalW = data.length * groupW + 8;

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + paddingB}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const x = i * groupW + 4;
        const hTrad   = Math.round((d.traditional / maxVal) * chartH);
        const hHybrid = Math.round((d.hybrid      / maxVal) * chartH);
        // Current month highlight (May = 4)
        const isCurrent = i === new Date().getMonth();
        return (
          <g key={d.month}>
            {/* Barra tradicional */}
            <rect
              x={x}
              y={chartH - hTrad}
              width={barW}
              height={hTrad}
              rx={3}
              fill={isCurrent ? '#94a3b8' : '#cbd5e1'}
            />
            {/* Barra híbrida */}
            <rect
              x={x + barW + gap}
              y={chartH - hHybrid}
              width={barW}
              height={hHybrid}
              rx={3}
              fill={isCurrent ? '#1D9E75' : '#6ee7b7'}
            />
            {/* Label mes */}
            <text
              x={x + barW}
              y={chartH + paddingB - 4}
              textAnchor="middle"
              fontSize="8"
              fill="#94a3b8"
              fontFamily="sans-serif"
            >
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Componente principal ───────────────────────────────
export function HybridRentalsView({ properties, contracts, userId }: HybridRentalsViewProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showAddSeason,      setShowAddSeason]      = useState(false);

  // Estado local de configuración (antes de guardar)
  const [hybridEnabled, setHybridEnabled] = useState(true);
  const [seasons,       setSeasons]       = useState<Season[]>([
    { id: '1', name: 'Temporada Alta (Verano)',   startDate: '15 Abril',    endDate: '15 Septiembre', minNightlyRate: 180, seasonType: 'alta'    },
    { id: '2', name: 'Festivos Locales (Navidad)', startDate: '20 Diciembre', endDate: '05 Enero',      minNightlyRate: 220, seasonType: 'festivo'  },
  ]);

  // Cargar config desde Firestore cuando cambia la propiedad seleccionada
  const hybridQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'hybrid'));
  }, [db, userId]);
  const { data: hybridRaw } = useCollection<HybridConfig>(hybridQ);
  const hybridConfigs = hybridRaw || [];

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Contrato relacionado para calcular ingreso tradicional
  const relatedContract = useMemo(() =>
    contracts.find(c => c.propertyId === selectedPropertyId),
  [contracts, selectedPropertyId]);

  const traditionalAnnual = useMemo(() => {
    if (relatedContract?.currentRentAmount) return relatedContract.currentRentAmount * 12;
    return 24000; // default demo
  }, [relatedContract]);

  const hybridAnnual   = Math.round(traditionalAnnual * 1.354);
  const diffPercent    = Math.round(((hybridAnnual - traditionalAnnual) / traditionalAnnual) * 100);
  const monthlyData    = getMonthlyData(traditionalAnnual, hybridAnnual);

  const handleSelectProperty = (pid: string) => {
    setSelectedPropertyId(pid);
    // Cargar config existente si la hay
    const existing = hybridConfigs.find(h => h.id === pid);
    if (existing) {
      setHybridEnabled(existing.hybridEnabled);
      setSeasons(existing.seasons);
    } else {
      setHybridEnabled(true);
      setSeasons([
        { id: '1', name: 'Temporada Alta (Verano)',    startDate: '15 Abril',    endDate: '15 Septiembre', minNightlyRate: 180, seasonType: 'alta'   },
        { id: '2', name: 'Festivos Locales (Navidad)', startDate: '20 Diciembre', endDate: '05 Enero',     minNightlyRate: 220, seasonType: 'festivo' },
      ]);
    }
  };

  const handleSave = () => {
    if (!selectedPropertyId || !userId || !db) return;
    const cfgRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'hybrid', selectedPropertyId);
    const cfg: HybridConfig = { id: selectedPropertyId, hybridEnabled, seasons, ownerId: userId };
    setDocumentNonBlocking(cfgRef, cfg, {});
    toast({ title: 'Configuración guardada', description: `Rentas híbridas de ${selectedProperty?.name} actualizadas.` });
  };

  const handleDeleteSeason = (id: string) => setSeasons(prev => prev.filter(s => s.id !== id));

  const handleAddSeason = (s: Omit<Season, 'id'>) => {
    setSeasons(prev => [...prev, { ...s, id: `${Date.now()}` }]);
    setShowAddSeason(false);
  };

  // ── Vista: sin propiedad seleccionada ──
  if (!selectedPropertyId) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Rentas Híbridas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Optimizá ingresos alternando entre contratos de largo plazo y alquiler temporal (Airbnb / Booking).
          </p>
        </div>

        {/* Explicación */}
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-sm">¿Qué es el Modo Híbrido?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              El modo híbrido permite alternar automáticamente entre contratos de largo plazo
              y estancias cortas según la configuración del calendario de temporadas.
              En temporada alta podés cobrar hasta un <strong className="text-primary">35% más</strong> con alquiler por noches.
            </p>
          </div>
        </div>

        {/* Selección de propiedad */}
        <div>
          <p className="text-sm font-black mb-3">Seleccioná una propiedad para configurar</p>
          {properties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/50">
              <Building2 className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No tenés propiedades cargadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map(p => {
                const hasConfig = hybridConfigs.some(h => h.id === p.id);
                const cfg = hybridConfigs.find(h => h.id === p.id);
                return (
                  <button key={p.id} onClick={() => handleSelectProperty(p.id)}
                    className="text-left rounded-2xl border hover:border-primary/40 hover:shadow-md transition-all p-4 bg-white group space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {p.photos?.[0]
                          ? <img src={p.photos[0]} alt="" className="h-12 w-12 object-cover rounded-xl" />
                          : <Building2 className="h-6 w-6 text-primary/60" />
                        }
                      </div>
                      <Badge variant={hasConfig && cfg?.hybridEnabled ? 'default' : 'outline'}
                        className={cn('text-[9px] font-black shrink-0',
                          hasConfig && cfg?.hybridEnabled ? 'bg-primary text-white' : '')}>
                        {hasConfig && cfg?.hybridEnabled ? 'Híbrido activo' : 'Sin configurar'}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-black text-sm">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.address}</p>
                    </div>
                    <div className="flex items-center text-[11px] text-primary font-bold gap-1 group-hover:gap-2 transition-all">
                      Configurar <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vista: propiedad seleccionada ──
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Breadcrumb + acciones */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setSelectedPropertyId(null)} className="hover:text-primary font-medium transition-colors">
            Propiedades
          </button>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          <span className="font-bold text-foreground">{selectedProperty?.name}</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          <span className="text-foreground font-bold">Gestión de Rentas Híbridas</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-bold" onClick={() => setSelectedPropertyId(null)}>
            Cancelar
          </Button>
          <Button className="bg-primary font-bold gap-2" onClick={handleSave}>
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Título */}
      <div>
        <h1 className="text-3xl font-black">{selectedProperty?.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configuración de Rentas Híbridas</p>
      </div>

      {/* Fila principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">

        {/* ── Columna izquierda: Estado actual ── */}
        <div className="space-y-4">
          {/* Tarjeta estado */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                {selectedProperty?.photos?.[0]
                  ? <img src={selectedProperty.photos[0]} alt="" className="h-full w-full object-cover" />
                  : <Building2 className="h-8 w-8 text-primary/50" />
                }
              </div>
              <Badge className={cn('mt-1 font-black text-[10px]', hybridEnabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600')}>
                {hybridEnabled ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div>
              <p className="font-black text-base">Estado Actual</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                El modo híbrido permite alternar automáticamente entre contratos de largo plazo
                y estancias cortas según la configuración del calendario.
              </p>
            </div>
          </div>

          {/* Tarjeta modo de gestión */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-black text-sm">Modo de Gestión</p>
                <p className="text-[11px] text-muted-foreground">Híbrido Automatizado</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={hybridEnabled}
                onCheckedChange={setHybridEnabled}
                className="data-[state=checked]:bg-primary"
              />
              <span className={cn('text-sm font-bold', hybridEnabled ? 'text-primary' : 'text-muted-foreground')}>
                {hybridEnabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </div>
            {!hybridEnabled && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-xl p-3 leading-relaxed">
                Con el modo deshabilitado, la propiedad solo usa contratos de largo plazo tradicionales.
              </p>
            )}
          </div>

          {/* Comparativa rápida */}
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <p className="font-black text-sm text-muted-foreground text-[9px] uppercase tracking-widest">Comparativa anual estimada</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Largo plazo (tradicional)</span>
                <span className="font-black text-sm">
                  {relatedContract?.currency || '$'} {traditionalAnnual.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Modelo híbrido</span>
                <span className="font-black text-sm text-primary">
                  {relatedContract?.currency || '$'} {hybridAnnual.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="h-px bg-muted" />
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold">Ganancia adicional</span>
                <span className="font-black text-sm text-green-600">
                  +{(hybridAnnual - traditionalAnnual).toLocaleString('es-AR')} (+{diffPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Columna derecha: Proyección + gráfico ── */}
        <div className="bg-white rounded-2xl border p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-lg leading-tight">Proyección de Ingresos Anual</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Comparativa de modelos de gestión</p>
            </div>
            <button className="h-8 w-8 rounded-xl border hover:bg-muted/40 flex items-center justify-center transition-colors shrink-0">
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Cards comparativas */}
          <div className="grid grid-cols-2 gap-3">
            {/* Tradicional */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5">
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                Largo Plazo (Tradicional)
              </p>
              <p className="text-2xl font-black text-foreground">
                {relatedContract?.currency === 'USD' ? '€' : '$'}{Math.round(traditionalAnnual / 1000)}K
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[11px] font-bold text-red-500">-{diffPercent}% vs Híbrido</span>
              </div>
            </div>

            {/* Híbrido */}
            <div className="rounded-xl bg-primary p-4 space-y-1.5 relative overflow-hidden">
              {/* Decoración fondo */}
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
              <div className="absolute -right-1 top-6 h-8 w-8 rounded-full bg-white/10" />
              <p className="text-[9px] uppercase font-black text-white/70 tracking-widest relative">
                Modelo Híbrido (Proyectado)
              </p>
              <p className="text-2xl font-black text-white relative">
                {relatedContract?.currency === 'USD' ? '€' : '$'}{Math.round(hybridAnnual / 1000)}.{String(Math.round((hybridAnnual % 1000) / 100)).padStart(1, '0')}K
              </p>
              <div className="flex items-center gap-1.5 relative">
                <TrendingUp className="h-3.5 w-3.5 text-green-300" />
                <span className="text-[11px] font-bold text-green-200">+35% Ocupación Óptima</span>
              </div>
            </div>
          </div>

          {/* Gráfico de barras */}
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 inline-block" /> Tradicional</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-300 inline-block" /> Híbrido</span>
            </div>
            <div className="h-36">
              <BarChart data={monthlyData} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Configuración de Temporadas ── */}
      <div className="bg-white rounded-2xl border p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black text-lg">Configuración de Temporadas</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Definí los períodos para alquiler temporal (Airbnb / Booking).
            </p>
          </div>
          <Button variant="outline" className="gap-2 font-bold text-sm shrink-0"
            onClick={() => setShowAddSeason(true)}>
            <Plus className="h-4 w-4" /> Añadir Período
          </Button>
        </div>

        {seasons.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground/40">
            <Sun className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No hay temporadas configuradas.</p>
            <p className="text-xs">Agregá períodos de alta demanda para maximizar ingresos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {seasons.map(s => (
              <div key={s.id}
                className="flex items-center gap-4 rounded-2xl border bg-muted/20 hover:bg-muted/30 transition-colors px-5 py-4">
                {/* Ícono temporada */}
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', SEASON_BG[s.seasonType])}>
                  {SEASON_ICONS[s.seasonType]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.startDate} – {s.endDate}
                  </p>
                </div>

                {/* Tarifa */}
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Tarifa Noche (Mín)</p>
                  <p className="font-black text-lg leading-tight">${s.minNightlyRate.toLocaleString('es-AR')}</p>
                </div>

                {/* Eliminar */}
                <button onClick={() => handleDeleteSeason(s.id)}
                  className="h-8 w-8 rounded-xl hover:bg-destructive/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Resumen de temporadas */}
        {seasons.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <p className="text-[12px] text-primary leading-relaxed">
              <strong>{seasons.length} temporada{seasons.length !== 1 ? 's' : ''} configurada{seasons.length !== 1 ? 's' : ''}.</strong>{' '}
              Tarifa promedio: ${Math.round(seasons.reduce((s, t) => s + t.minNightlyRate, 0) / seasons.length)}/noche.
              Ingreso estimado en alta demanda:{' '}
              <strong>
                ${(Math.round(seasons.reduce((s, t) => s + t.minNightlyRate, 0) / seasons.length) * 30 * seasons.length).toLocaleString('es-AR')}/temporada
              </strong>.
            </p>
          </div>
        )}
      </div>

      {/* Dialog: Agregar temporada */}
      <AddSeasonDialog
        open={showAddSeason}
        onClose={() => setShowAddSeason(false)}
        onAdd={handleAddSeason}
      />
    </div>
  );
}

// ── Dialog: Agregar temporada ──────────────────────────
function AddSeasonDialog({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (s: Omit<Season, 'id'>) => void;
}) {
  const [name,            setName]           = useState('');
  const [startDate,       setStartDate]      = useState('');
  const [endDate,         setEndDate]        = useState('');
  const [minNightlyRate,  setMinNightlyRate] = useState('');
  const [seasonType,      setSeasonType]     = useState<Season['seasonType']>('alta');

  const handleAdd = () => {
    if (!name || !startDate || !endDate || !minNightlyRate) return;
    onAdd({ name, startDate, endDate, minNightlyRate: Number(minNightlyRate), seasonType });
    setName(''); setStartDate(''); setEndDate(''); setMinNightlyRate(''); setSeasonType('alta');
  };

  const valid = name && startDate && endDate && Number(minNightlyRate) > 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" /> Nueva temporada
          </DialogTitle>
          <DialogDescription>
            Configurá un período de alquiler temporal con tarifa mínima por noche.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label>Nombre del período</Label>
            <Input placeholder="Ej: Temporada Alta (Verano)" value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de temporada</Label>
            <Select value={seasonType} onValueChange={v => setSeasonType(v as Season['seasonType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">☀️ Temporada Alta</SelectItem>
                <SelectItem value="baja">❄️ Temporada Baja</SelectItem>
                <SelectItem value="festivo">🎉 Festivos / Feriados</SelectItem>
                <SelectItem value="especial">⭐ Evento Especial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Input placeholder="15 Abril" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Input placeholder="15 Septiembre" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Tarifa */}
          <div className="space-y-1.5">
            <Label>Tarifa mínima por noche ($)</Label>
            <Input
              type="number"
              placeholder="180"
              value={minNightlyRate}
              onChange={e => setMinNightlyRate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold" onClick={handleAdd} disabled={!valid}>
            Agregar período
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
