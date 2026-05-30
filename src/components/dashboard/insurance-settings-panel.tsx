'use client'
import { APP_ID } from '@/lib/constants';;

/**
 * insurance-settings-panel.tsx
 *
 * Panel de configuración de Seguros — visible sólo para super admin.
 * Gestiona:
 *   1. PAS Partners  (brokers matriculados SSN)
 *   2. Tarifas de comisión por PAS × tipo de seguro
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Users, Plus, Edit2, Trash2, Percent, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Building2, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';


// ── Types ─────────────────────────────────────────────────────────────────────
type PolicyType = 'Incendio' | 'Responsabilidad Civil' | 'Integral Hogar' | 'Caución' | 'Granizo' | 'Robo y Hurto' | 'Otro';

export interface PASPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  matricula: string;          // Nº de matrícula SSN
  insurers: string[];         // Aseguradoras con las que opera
  isDefault: boolean;
  notes: string;
  createdAt: string;
}

export interface CommissionConfig {
  id: string;
  pasId: string;
  pasName: string;
  /** 'Todos' = aplica a todos los tipos no configurados específicamente */
  policyType: PolicyType | 'Todos';
  /** % de la prima que recibe la administradora (ej: 0.03 = 3%) */
  adminRate: number;
  /** % de la prima que recibe la super admin (ej: 0.02 = 2%) */
  superRate: number;
  /** % que el PAS recibe de la aseguradora — solo referencia */
  pasExpectedRate: number;
  notes: string;
  updatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POLICY_TYPES: PolicyType[] = [
  'Incendio', 'Responsabilidad Civil', 'Integral Hogar',
  'Caución', 'Granizo', 'Robo y Hurto', 'Otro',
];

const INSURERS_LIST = [
  'Allianz', 'Mapfre', 'Zurich', 'San Cristóbal', 'Sancor Seguros',
  'Federación Patronal', 'La Segunda', 'Rivadavia', 'HSBC', 'BBVA Seguros',
];

const EMPTY_PAS: Omit<PASPartner, 'id' | 'createdAt'> = {
  name: '', email: '', phone: '', matricula: '',
  insurers: [], isDefault: false, notes: '',
};

const EMPTY_CONFIG: Omit<CommissionConfig, 'id' | 'updatedAt' | 'pasName'> = {
  pasId: '', policyType: 'Todos',
  adminRate: 3, superRate: 2, pasExpectedRate: 17, notes: '',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface InsuranceSettingsPanelProps {
  pasPartners:       PASPartner[];
  commissionConfigs: CommissionConfig[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InsuranceSettingsPanel({
  pasPartners,
  commissionConfigs,
}: InsuranceSettingsPanelProps) {
  const { toast } = useToast();
  const db         = useFirestore();
  const { user }   = useUser();

  // PAS dialog
  const [showPasDialog,  setShowPasDialog]  = useState(false);
  const [editingPas,     setEditingPas]     = useState<PASPartner | null>(null);
  const [pasForm,        setPasForm]        = useState({ ...EMPTY_PAS });
  const [pasInsurers,    setPasInsurers]    = useState<string[]>([]);

  // Commission dialog
  const [showCfgDialog,  setShowCfgDialog]  = useState(false);
  const [editingCfg,     setEditingCfg]     = useState<CommissionConfig | null>(null);
  const [cfgForm,        setCfgForm]        = useState({ ...EMPTY_CONFIG });

  // Expand/collapse per PAS
  const [expandedPas, setExpandedPas] = useState<string | null>(null);

  // ── PAS CRUD ──────────────────────────────────────────────────────────────
  const openAddPas = () => {
    setEditingPas(null);
    setPasForm({ ...EMPTY_PAS });
    setPasInsurers([]);
    setShowPasDialog(true);
  };
  const openEditPas = (p: PASPartner) => {
    setEditingPas(p);
    setPasForm({
      name: p.name, email: p.email, phone: p.phone,
      matricula: p.matricula, insurers: p.insurers,
      isDefault: p.isDefault, notes: p.notes,
    });
    setPasInsurers(p.insurers);
    setShowPasDialog(true);
  };

  const handleSavePas = () => {
    if (!pasForm.name.trim() || !db) {
      toast({ title: 'Completá el nombre del PAS', variant: 'destructive' }); return;
    }
    const id  = editingPas?.id || Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'pasPartners', id);
    const data: PASPartner = {
      id, ...pasForm, insurers: pasInsurers,
      createdAt: editingPas?.createdAt || new Date().toISOString(),
    };
    // If this is set as default, unset all others
    if (data.isDefault) {
      pasPartners.filter(p => p.id !== id && p.isDefault).forEach(p => {
        setDocumentNonBlocking(
          doc(db, 'artifacts', APP_ID, 'pasPartners', p.id),
          { isDefault: false }, { merge: true },
        );
      });
    }
    setDocumentNonBlocking(ref, data, { merge: true });
    toast({ title: editingPas ? '✅ PAS actualizado' : '✅ PAS registrado', description: data.name });
    setShowPasDialog(false);
  };

  const handleDeletePas = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'pasPartners', id));
    // Also remove configs for this PAS
    commissionConfigs.filter(c => c.pasId === id).forEach(c => {
      deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'pasComisiones', c.id));
    });
    toast({ title: 'PAS eliminado' });
  };

  const toggleInsurerInPas = (ins: string) => {
    setPasInsurers(prev =>
      prev.includes(ins) ? prev.filter(i => i !== ins) : [...prev, ins],
    );
  };

  // ── Commission config CRUD ─────────────────────────────────────────────────
  const openAddConfig = (pasId: string) => {
    const pas = pasPartners.find(p => p.id === pasId);
    setEditingCfg(null);
    setCfgForm({ ...EMPTY_CONFIG, pasId });
    setExpandedPas(pasId);
    setShowCfgDialog(true);
  };
  const openEditConfig = (c: CommissionConfig) => {
    setEditingCfg(c);
    setCfgForm({
      pasId:           c.pasId,
      policyType:      c.policyType,
      adminRate:       c.adminRate,
      superRate:       c.superRate,
      pasExpectedRate: c.pasExpectedRate,
      notes:           c.notes,
    });
    setShowCfgDialog(true);
  };

  const handleSaveConfig = () => {
    if (!cfgForm.pasId || !db) {
      toast({ title: 'Seleccioná un PAS', variant: 'destructive' }); return;
    }
    const pas = pasPartners.find(p => p.id === cfgForm.pasId);
    const id  = editingCfg?.id || Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'pasComisiones', id);
    const data: CommissionConfig = {
      id,
      pasId:           cfgForm.pasId,
      pasName:         pas?.name || '',
      policyType:      cfgForm.policyType,
      adminRate:       Number(cfgForm.adminRate)       || 0,
      superRate:       Number(cfgForm.superRate)       || 0,
      pasExpectedRate: Number(cfgForm.pasExpectedRate) || 0,
      notes:           cfgForm.notes,
      updatedAt:       new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, { merge: true });
    toast({
      title: editingCfg ? '✅ Tarifa actualizada' : '✅ Tarifa registrada',
      description: `${pas?.name} · ${data.policyType} → Admin ${data.adminRate}% / Super ${data.superRate}%`,
    });
    setShowCfgDialog(false);
  };

  const handleDeleteConfig = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'pasComisiones', id));
    toast({ title: 'Tarifa eliminada' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header note */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Star className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Sólo visible para Super Admin.</strong> Configurá los brokers PAS partners y las tarifas de comisión acordadas por tipo de seguro.
          Estas tarifas se aplican automáticamente al registrar pólizas y cotizaciones.
        </p>
      </div>

      {/* ── PAS Partners ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> PAS Partners
          </CardTitle>
          <Button size="sm" className="gap-1.5 font-bold bg-primary h-8 text-xs" onClick={openAddPas}>
            <Plus className="h-3.5 w-3.5" /> Agregar PAS
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {pasPartners.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-semibold">Sin brokers PAS configurados</p>
              <p className="text-xs mt-1">Agregá el broker matriculado con el que trabaja la plataforma.</p>
            </div>
          ) : (
            pasPartners.map(pas => {
              const configs  = commissionConfigs.filter(c => c.pasId === pas.id);
              const expanded = expandedPas === pas.id;
              return (
                <div key={pas.id} className="rounded-xl border border-border/50 overflow-hidden">
                  {/* PAS header row */}
                  <div
                    className="flex items-center gap-3 p-3 hover:bg-muted/10 cursor-pointer"
                    onClick={() => setExpandedPas(expanded ? null : pas.id)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm">{pas.name}</p>
                        {pas.isDefault && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black border">
                            Default
                          </Badge>
                        )}
                        {pas.matricula && (
                          <span className="text-[10px] text-muted-foreground font-mono">Mat. {pas.matricula}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{pas.email} · {configs.length} tarifa{configs.length !== 1 ? 's' : ''} config.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={e => { e.stopPropagation(); openEditPas(pas); }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeletePas(pas.id); }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {expanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Commission configs for this PAS */}
                  {expanded && (
                    <div className="border-t border-border/40 bg-muted/5 p-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                          Tarifas por tipo de seguro
                        </p>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold gap-1 px-2"
                          onClick={() => openAddConfig(pas.id)}>
                          <Plus className="h-3 w-3" /> Agregar tarifa
                        </Button>
                      </div>

                      {configs.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          Sin tarifas configuradas — se usan los defaults del sistema (Admin 3% / Super 2%).
                        </p>
                      ) : (
                        configs.map(cfg => (
                          <div key={cfg.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-border/40 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold truncate">
                                {cfg.policyType === 'Todos' ? '📋 Todos los tipos' : cfg.policyType}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-[11px]">
                              <span className="text-muted-foreground">
                                PAS <strong className="text-foreground">{cfg.pasExpectedRate}%</strong>
                              </span>
                              <span className="text-emerald-700">
                                Admin <strong>{cfg.adminRate}%</strong>
                              </span>
                              <span className="text-amber-700">
                                Super <strong>{cfg.superRate}%</strong>
                              </span>
                              <button onClick={() => openEditConfig(cfg)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button onClick={() => handleDeleteConfig(cfg.id)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Insurers this PAS works with */}
                      {pas.insurers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1">Opera con:</p>
                          <div className="flex flex-wrap gap-1">
                            {pas.insurers.map(i => (
                              <Badge key={i} variant="outline" className="text-[9px] font-bold border-border/50">{i}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Default rates info ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" /> Tarifas de Sistema (Fallback)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Se aplican cuando no hay tarifa específica configurada para el PAS + tipo de seguro.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Admin (default)', value: '3%', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { label: 'Super Admin (default)', value: '2%', color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { label: 'Total plataforma', value: '5%', color: 'text-primary bg-primary/5 border-primary/20' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                <p className="text-xl font-black">{s.value}</p>
                <p className="text-[10px] font-bold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════ Dialog: PAS ══════ */}
      <Dialog open={showPasDialog} onOpenChange={v => { setShowPasDialog(v); if (!v) setPasForm({ ...EMPTY_PAS }); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPas ? 'Editar PAS Partner' : 'Agregar PAS Partner'}</DialogTitle>
            <DialogDescription>Broker matriculado SSN con el que opera la plataforma.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre / Razón Social *</Label>
                <Input placeholder="Ej: Estudio Seguros SA" value={pasForm.name}
                  onChange={e => setPasForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="broker@ejemplo.com" value={pasForm.email}
                  onChange={e => setPasForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="+54 11 1234-5678" value={pasForm.phone}
                  onChange={e => setPasForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Matrícula SSN</Label>
                <Input placeholder="Nº de matrícula ante SSN" value={pasForm.matricula}
                  onChange={e => setPasForm(f => ({ ...f, matricula: e.target.value }))} />
              </div>
            </div>

            {/* Insurers */}
            <div className="space-y-2">
              <Label>Aseguradoras con las que opera</Label>
              <div className="flex flex-wrap gap-2">
                {INSURERS_LIST.map(ins => (
                  <button
                    key={ins}
                    onClick={() => toggleInsurerInPas(ins)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors',
                      pasInsurers.includes(ins)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-muted-foreground border-border/60 hover:border-primary/40',
                    )}
                  >
                    {pasInsurers.includes(ins) && <span className="mr-1">✓</span>}
                    {ins}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas del acuerdo</Label>
              <Textarea placeholder="Condiciones especiales, contacto clave, vigencia del acuerdo…"
                className="min-h-[60px]" value={pasForm.notes}
                onChange={e => setPasForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={pasForm.isDefault}
                onCheckedChange={v => setPasForm(f => ({ ...f, isDefault: v }))} />
              <div>
                <span className="text-sm font-bold">PAS por defecto</span>
                <span className="text-xs text-muted-foreground ml-2">Se pre-selecciona en cotizaciones</span>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasDialog(false)}>Cancelar</Button>
            <Button className="font-bold px-8" onClick={handleSavePas}>
              {editingPas ? 'Guardar Cambios' : 'Registrar PAS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════ Dialog: Commission config ══════ */}
      <Dialog open={showCfgDialog} onOpenChange={v => { setShowCfgDialog(v); if (!v) setCfgForm({ ...EMPTY_CONFIG }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCfg ? 'Editar Tarifa' : 'Agregar Tarifa de Comisión'}</DialogTitle>
            <DialogDescription>
              Configurá los porcentajes acordados para este PAS y tipo de seguro.
              Los valores son % sobre la prima anual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* PAS select */}
            <div className="space-y-1.5">
              <Label>PAS Partner *</Label>
              <Select value={cfgForm.pasId} onValueChange={v => setCfgForm(f => ({ ...f, pasId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná el PAS…" /></SelectTrigger>
                <SelectContent>
                  {pasPartners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Policy type */}
            <div className="space-y-1.5">
              <Label>Tipo de seguro</Label>
              <Select
                value={cfgForm.policyType}
                onValueChange={v => setCfgForm(f => ({ ...f, policyType: v as PolicyType | 'Todos' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">📋 Todos (default para este PAS)</SelectItem>
                  {(['Incendio','Responsabilidad Civil','Integral Hogar','Caución','Granizo','Robo y Hurto','Otro'] as PolicyType[]).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                "Todos" aplica cuando no hay tarifa específica para ese tipo.
              </p>
            </div>

            <Separator />

            {/* Rate fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-700 font-black">% PAS (referencia)</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" max="30" step="0.5"
                    placeholder="17"
                    value={cfgForm.pasExpectedRate}
                    onChange={e => setCfgForm(f => ({ ...f, pasExpectedRate: parseFloat(e.target.value) || 0 }))}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Lo que recibe el PAS de la aseguradora</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-emerald-700 font-black">% Admin</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" max="20" step="0.5"
                    placeholder="3"
                    value={cfgForm.adminRate}
                    onChange={e => setCfgForm(f => ({ ...f, adminRate: parseFloat(e.target.value) || 0 }))}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[9px] text-muted-foreground">% sobre prima anual para la admin</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black" style={{ color: '#d97706' }}>% Super</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" max="20" step="0.5"
                    placeholder="2"
                    value={cfgForm.superRate}
                    onChange={e => setCfgForm(f => ({ ...f, superRate: parseFloat(e.target.value) || 0 }))}
                    className="pr-6"
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[9px] text-muted-foreground">% sobre prima anual para super admin</p>
              </div>
            </div>

            {/* Preview */}
            {(cfgForm.adminRate > 0 || cfgForm.superRate > 0) && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <p className="text-[11px] font-black text-foreground mb-1">Ejemplo con prima de $100,000:</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-amber-700">PAS: <strong>${(100000 * cfgForm.pasExpectedRate / 100).toLocaleString('es-AR')}</strong></span>
                  <span className="text-emerald-700">Admin: <strong>${(100000 * cfgForm.adminRate / 100).toLocaleString('es-AR')}</strong></span>
                  <span className="text-primary">Super: <strong>${(100000 * cfgForm.superRate / 100).toLocaleString('es-AR')}</strong></span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea placeholder="Ej: Vigencia del acuerdo, condiciones especiales…"
                className="min-h-[50px]" value={cfgForm.notes}
                onChange={e => setCfgForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCfgDialog(false)}>Cancelar</Button>
            <Button className="font-bold px-8" onClick={handleSaveConfig}>
              {editingCfg ? 'Guardar Cambios' : 'Registrar Tarifa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
