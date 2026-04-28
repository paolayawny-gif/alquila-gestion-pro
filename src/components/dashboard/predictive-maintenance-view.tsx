
"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BrainCircuit, AlertTriangle, CheckCircle2, Clock, Zap, TrendingUp,
  Thermometer, Droplets, Cpu, Calendar, DollarSign, Wrench, FileDown, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Property, MaintenanceTask } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';

interface PredictiveMaintenanceViewProps {
  properties: Property[];
  tasks: MaintenanceTask[];
  userId?: string;
}

const ASSET_ICONS = [Thermometer, Droplets, Cpu, Wrench];

const RISK_CONFIG = {
  'Alto Riesgo': { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  'Riesgo Medio': { color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', icon: Info },
  'Óptimo': { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2 },
};

type RiskLevel = keyof typeof RISK_CONFIG;

const SCHEDULE_ITEMS = [
  { urgency: 'URGENTE', date: '12 DE OCTUBRE', title: 'Revisión Compresor HVAC U4B', desc: 'Sustitución de rodamientos preventiva basada en análisis de vibración.', saving: 1200, color: 'border-red-400 bg-red-50' },
  { urgency: 'PLANIFICADO', date: '28 DE OCTUBRE', title: 'Lubricación Ascensor C', desc: 'Mantenimiento predictivo de guías y puertas de planta baja a planta 5.', saving: 450, color: 'border-primary/40 bg-primary/5' },
  { urgency: 'PLANIFICADO', date: '5 DE NOVIEMBRE', title: 'Inspección Sistema Eléctrico', desc: 'Revisión anual de cuadros y protecciones según normativa vigente.', saving: 800, color: 'border-primary/40 bg-primary/5' },
];

const SENSOR_DATA = [
  { label: 'Temperatura Motor', value: '87°C', status: 'warning', note: 'Umbral normal: <80°C' },
  { label: 'Vibración (RMS)', value: '4.8 mm/s', status: 'danger', note: 'Umbral normal: <3.5 mm/s' },
  { label: 'Presión de Aceite', value: '2.1 bar', status: 'ok', note: 'Rango normal: 1.8–2.5 bar' },
  { label: 'Horas de Operación', value: '12.400 h', status: 'warning', note: 'Revisión recomendada: >12.000 h' },
];

export function PredictiveMaintenanceView({ properties, tasks, userId }: PredictiveMaintenanceViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSensorDialog, setShowSensorDialog] = useState(false);
  const [approvedOrders, setApprovedOrders] = useState<Set<number>>(new Set());

  const activeProperties = properties.length > 0 ? properties.length : 12;

  const savingsData = [
    { name: 'Jul', preventivo: 3200, reactivo: 5800 },
    { name: 'Ago', preventivo: 2900, reactivo: 6200 },
    { name: 'Sep', preventivo: 3100, reactivo: 5500 },
    { name: 'Oct', preventivo: 2800, reactivo: 7100 },
    { name: 'Nov', preventivo: 2600, reactivo: 6300, projected: true },
    { name: 'Dic', preventivo: 2400, reactivo: 5900, projected: true },
  ];

  const projectedAnnualSaving = 42850;

  const healthIndex = useMemo(() => {
    if (tasks.length === 0) return 86;
    const urgent = tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado').length;
    const total = tasks.length;
    return Math.max(40, Math.round(100 - (urgent / total) * 60));
  }, [tasks]);

  const healthColor = healthIndex >= 80 ? '#16a34a' : healthIndex >= 60 ? '#f97316' : '#ef4444';
  const healthLabel = healthIndex >= 80 ? 'Óptimo' : healthIndex >= 60 ? 'Estable' : 'Crítico';

  const assets = useMemo(() => {
    const base = [
      { name: 'HVAC - Unidad 4B', location: 'Edificio Norte', risk: 'Alto Riesgo' as RiskLevel, lifeRemaining: '15 días', lifeColor: 'text-red-600', lifeWidth: 8, note: 'Patrón de vibración anómalo detectado.' },
      { name: 'Sistema de Bombeo', location: 'Nivel Subterráneo', risk: 'Riesgo Medio' as RiskLevel, lifeRemaining: '3 Meses', lifeColor: 'text-orange-500', lifeWidth: 35, note: 'Caída de presión leve pero constante.' },
      { name: 'Cuadro Principal', location: 'Sector Residencial', risk: 'Óptimo' as RiskLevel, lifeRemaining: '3+ Años', lifeColor: 'text-green-600', lifeWidth: 90, note: 'Flujo de carga estable. Sin anomalías.' },
    ];
    if (properties.length > 0) {
      return properties.slice(0, 3).map((p, i) => ({
        name: base[i]?.name || p.name,
        location: p.address || p.name,
        risk: (p.status === 'En Mantenimiento' ? 'Alto Riesgo' : base[i]?.risk || 'Óptimo') as RiskLevel,
        lifeRemaining: base[i]?.lifeRemaining || '1+ Año',
        lifeColor: base[i]?.lifeColor || 'text-green-600',
        lifeWidth: base[i]?.lifeWidth || 80,
        note: base[i]?.note || 'Sin anomalías detectadas.',
      }));
    }
    return base;
  }, [properties]);

  const recentAlerts = useMemo(() => {
    const aiAlerts = [
      { icon: AlertTriangle, color: 'text-red-500 bg-red-50', title: 'Unidad 4B HVAC', desc: 'Patrones de alta vibración detectados. Servicio recomendado en <15 días.', time: 'Hace 2 horas' },
      { icon: Info, color: 'text-orange-500 bg-orange-50', title: 'Ascensor C - Torre Este', desc: 'Fricción inusual en puerta de planta 4. Lubricación predictiva programada.', time: 'Hace 5 horas' },
    ];
    if (tasks.length > 0) {
      return tasks.filter(t => t.priority === 'Urgente' || t.priority === 'Alta').slice(0, 2).map(t => ({
        icon: AlertTriangle,
        color: t.priority === 'Urgente' ? 'text-red-500 bg-red-50' : 'text-orange-500 bg-orange-50',
        title: t.concept,
        desc: t.description || 'Requiere atención inmediata.',
        time: t.createdAt,
      })).concat(aiAlerts).slice(0, 3);
    }
    return aiAlerts;
  }, [tasks]);

  const handleApproveOrder = (item: typeof SCHEDULE_ITEMS[0], idx: number) => {
    if (!db || !userId) {
      toast({ title: "Error", description: "Debés iniciar sesión para aprobar órdenes.", variant: "destructive" });
      return;
    }
    const id = `pm_${Date.now()}`;
    const docRef = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento'), id);
    setDocumentNonBlocking(docRef, {
      id,
      concept: item.title,
      description: item.desc,
      priority: item.urgency === 'URGENTE' ? 'Urgente' : 'Media',
      status: 'Abierto',
      propertyName: properties[0]?.name || 'General',
      propertyId: properties[0]?.id || '',
      createdAt: new Date().toISOString(),
      source: 'predictivo',
      estimatedSaving: item.saving,
    }, { merge: false });
    setApprovedOrders(prev => new Set([...prev, idx]));
    toast({ title: "Orden aprobada", description: `"${item.title}" fue agregada al plan de mantenimiento.` });
  };

  const handleGenerateReport = () => {
    const rows = [
      ['Activo', 'Ubicación', 'Riesgo', 'Vida Útil Restante', 'Nota'],
      ...assets.map(a => [a.name, a.location, a.risk, a.lifeRemaining, a.note]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `informe_predictivo_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: "Informe generado", description: "El archivo CSV fue descargado." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Mantenimiento Predictivo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inteligencia Artificial monitorizando {activeProperties * 3 + 6} activos críticos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border-primary/30 px-3 py-1.5 font-bold flex items-center gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5" />
            ESTADO IA: {healthLabel.toUpperCase()}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={handleGenerateReport}>
            <FileDown className="h-4 w-4" /> Generar Informe
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-black text-foreground">Ahorro Estimado (YTD)</h3>
                <p className="text-xs text-muted-foreground">Prevención vs. Mantenimiento Reactivo</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border-none font-bold flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +14.2% vs Q3
              </Badge>
            </div>
            <div className="mb-4">
              <span className="text-4xl font-black text-primary">${projectedAnnualSaving.toLocaleString('es-AR')}</span>
              <span className="text-sm text-muted-foreground ml-2">/ ahorro proyectado anual</span>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsData} barSize={20} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={v => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(v: any, n: string) => [`$${Number(v).toLocaleString('es-AR')}`, n === 'preventivo' ? 'Preventivo' : 'Reactivo estimado']}
                  />
                  <Bar dataKey="preventivo" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reactivo" fill="#dcfce7" radius={[4, 4, 0, 0]} />
                  <ReferenceLine x="Oct" stroke="#16a34a" strokeDasharray="4 2" label={{ value: 'Actual', position: 'top', fontSize: 10, fill: '#16a34a' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full gap-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white" />
              <div className="absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-white" />
            </div>
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="12"
                  strokeDasharray={`${(healthIndex / 100) * 314} 314`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{healthIndex}%</span>
              </div>
            </div>
            <div className="text-center relative">
              <h3 className="text-xl font-black">Índice de Salud Global</h3>
              <p className="text-white/70 text-sm mt-1">
                {assets.filter(a => a.risk !== 'Óptimo').length} activos requieren atención a corto plazo.
              </p>
            </div>
            <Button className="bg-white text-primary font-black hover:bg-white/90 w-full" size="sm" onClick={() => setShowDetailsDialog(true)}>
              VER DETALLES
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {assets.map((asset, idx) => {
          const cfg = RISK_CONFIG[asset.risk];
          const RiskIcon = cfg.icon;
          const AssetIcon = ASSET_ICONS[idx % ASSET_ICONS.length];
          return (
            <Card key={idx} className={cn("border shadow-sm bg-white", cfg.border)}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center">
                    <AssetIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge className={cn("border font-bold flex items-center gap-1", cfg.bg, cfg.color, cfg.border)}>
                    <RiskIcon className="h-3 w-3" />
                    {asset.risk}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-black text-foreground">{asset.name}</h4>
                  <p className="text-xs text-muted-foreground">{asset.location}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Vida útil restante estimada</span>
                    <span className={cn("font-black", asset.lifeColor)}>{asset.lifeRemaining}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${asset.lifeWidth}%`, backgroundColor: healthColor }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Zap className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  {asset.note}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" /> Alertas Recientes (IA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAlerts.map((alert, idx) => {
              const Icon = alert.icon;
              return (
                <div key={idx} className="flex gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", alert.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{alert.desc}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Cronograma Generado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {SCHEDULE_ITEMS.map((item, idx) => (
              <div key={idx} className="relative pl-6">
                <div className="absolute left-0 top-2 h-3 w-3 rounded-full border-2 border-primary bg-white" />
                {idx < SCHEDULE_ITEMS.length - 1 && (
                  <div className="absolute left-[5px] top-5 bottom-0 w-0.5 bg-border" />
                )}
                <div className={cn("p-4 rounded-xl border", item.color)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-[10px] font-black uppercase tracking-wider", item.urgency === 'URGENTE' ? 'text-red-600' : 'text-primary')}>
                      {item.urgency} — {item.date}
                    </span>
                    <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-bold">
                      Ahorro est. ${item.saving.toLocaleString()}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-black text-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{item.desc}</p>
                  <div className="flex gap-2 mt-3">
                    {approvedOrders.has(idx) ? (
                      <Badge className="bg-green-100 text-green-700 border-none font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Orden Aprobada
                      </Badge>
                    ) : (
                      <Button size="sm" className="h-7 text-xs bg-primary text-white font-bold px-3" onClick={() => handleApproveOrder(item, idx)}>
                        Aprobar Orden
                      </Button>
                    )}
                    {item.urgency === 'URGENTE' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs font-bold px-3" onClick={() => setShowSensorDialog(true)}>
                        Ver Datos Sensor
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Ver Detalles Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" /> Índice de Salud — Detalle Global
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-2xl font-black text-green-600">{assets.filter(a => a.risk === 'Óptimo').length}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Óptimo</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <p className="text-2xl font-black text-orange-500">{assets.filter(a => a.risk === 'Riesgo Medio').length}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Riesgo Medio</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <p className="text-2xl font-black text-red-600">{assets.filter(a => a.risk === 'Alto Riesgo').length}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Alto Riesgo</p>
              </div>
            </div>
            {assets.map((asset, idx) => {
              const cfg = RISK_CONFIG[asset.risk];
              return (
                <div key={idx} className={cn("p-4 rounded-xl border", cfg.border, cfg.bg)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-black text-sm">{asset.name}</p>
                    <Badge className={cn("border-none font-bold text-xs", cfg.bg, cfg.color)}>{asset.risk}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{asset.location}</p>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Vida útil restante</span>
                    <span className={cn("font-black", asset.lifeColor)}>{asset.lifeRemaining}</span>
                  </div>
                  <Progress value={asset.lifeWidth} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-2 italic">{asset.note}</p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ver Datos Sensor Dialog */}
      <Dialog open={showSensorDialog} onOpenChange={setShowSensorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-red-500" /> Datos del Sensor — HVAC Unidad 4B
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">Última lectura: hace 2 horas — Frecuencia: 15 min</p>
            {SENSOR_DATA.map((s, i) => (
              <div key={i} className={cn("flex items-center justify-between p-3 rounded-xl border",
                s.status === 'danger' ? 'bg-red-50 border-red-200' :
                s.status === 'warning' ? 'bg-orange-50 border-orange-200' :
                'bg-green-50 border-green-200'
              )}>
                <div>
                  <p className="text-sm font-bold">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.note}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-black",
                    s.status === 'danger' ? 'text-red-600' :
                    s.status === 'warning' ? 'text-orange-500' : 'text-green-600'
                  )}>{s.value}</p>
                  <p className={cn("text-[10px] font-bold uppercase",
                    s.status === 'danger' ? 'text-red-500' :
                    s.status === 'warning' ? 'text-orange-400' : 'text-green-600'
                  )}>
                    {s.status === 'danger' ? '⚠ Crítico' : s.status === 'warning' ? '⚡ Atención' : '✓ Normal'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
