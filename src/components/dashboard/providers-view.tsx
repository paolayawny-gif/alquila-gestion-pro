'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, Star, CheckCircle2, Clock, Plus, Phone, DollarSign,
  ShieldCheck, Wrench, Zap, Sparkles, Trash2, Edit2, XCircle,
  ClipboardList, FileCheck, HardHat, Paintbrush, Flame,
  Building2, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MaintenanceTask, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID = 'alquilagestion-pro';

type ProviderCategory = 'Fontanería' | 'Electricidad' | 'Limpieza' | 'Legal' | 'Administración' | 'Pintura' | 'Gas' | 'Albañilería';
type ProviderStatus = 'Verificado' | 'En evaluación' | 'Suspendido';
type BudgetStatus = 'Pendiente' | 'Aprobado' | 'Rechazado';

interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  description: string;
  phone: string;
  email?: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  status: ProviderStatus;
  certifications?: string[];
  notes?: string;
  ownerId: string;
  createdAt: string;
}

interface BudgetReview {
  id: string;
  taskId: string;
  taskConcept: string;
  propertyName: string;
  propertyId: string;
  providerId: string;
  providerName: string;
  description: string;
  laborCost: number;
  materialsCost: number;
  serviceFeePercent: number;
  estimatedHours: string;
  status: BudgetStatus;
  ownerId: string;
  createdAt: string;
}

interface ProvidersViewProps {
  tasks: MaintenanceTask[];
  properties: Property[];
  userId?: string;
}

const CATEGORIES: { id: ProviderCategory; label: string; icon: React.ElementType }[] = [
  { id: 'Fontanería',     label: 'Fontanería',     icon: Wrench       },
  { id: 'Electricidad',   label: 'Electricidad',   icon: Zap          },
  { id: 'Limpieza',       label: 'Limpieza',       icon: Sparkles     },
  { id: 'Legal',          label: 'Legal',          icon: ShieldCheck  },
  { id: 'Administración', label: 'Administración', icon: ClipboardList},
  { id: 'Pintura',        label: 'Pintura',        icon: Paintbrush   },
  { id: 'Gas',            label: 'Gas',            icon: Flame        },
  { id: 'Albañilería',    label: 'Albañilería',    icon: HardHat      },
];

const STATUS_STYLES: Record<ProviderStatus, string> = {
  'Verificado':    'bg-green-50 text-green-700 border-green-200',
  'En evaluación': 'bg-amber-50 text-amber-700 border-amber-200',
  'Suspendido':    'bg-red-50 text-red-700 border-red-200',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

const EMPTY_PROVIDER: Partial<Provider> = {
  name: '', category: 'Fontanería', description: '', phone: '',
  email: '', hourlyRate: 0, status: 'En evaluación', certifications: [],
};

const EMPTY_BUDGET: Partial<BudgetReview> = {
  taskId: '', providerId: '', description: '',
  laborCost: 0, materialsCost: 0, serviceFeePercent: 5, estimatedHours: '2-3 horas',
};

export function ProvidersView({ tasks, properties, userId }: ProvidersViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { canWrite, canDelete } = useOrgPermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProviderCategory | 'Todos'>('Todos');
  const [selectedBudget, setSelectedBudget] = useState<BudgetReview | null>(null);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState<Partial<Provider>>(EMPTY_PROVIDER);
  const [budgetForm, setBudgetForm] = useState<Partial<BudgetReview>>(EMPTY_BUDGET);
  const [newCert, setNewCert] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Firestore ──
  const providersQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'proveedores'));
  }, [db, userId]);
  const { data: providersData } = useCollection<Provider>(providersQ);

  const budgetsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'presupuestos'));
  }, [db, userId]);
  const { data: budgetsData } = useCollection<BudgetReview>(budgetsQ);

  const providers = providersData || [];
  const budgets   = budgetsData   || [];

  // ── Filtered ──
  const filteredProviders = useMemo(() => providers.filter(p => {
    const matchCat    = activeCategory === 'Todos' || p.category === activeCategory;
    const matchSearch = !searchTerm
      || p.name.toLowerCase().includes(searchTerm.toLowerCase())
      || p.category.toLowerCase().includes(searchTerm.toLowerCase())
      || (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch && p.status !== 'Suspendido';
  }), [providers, activeCategory, searchTerm]);

  const pendingBudgets = budgets.filter(b => b.status === 'Pendiente');

  // ── Provider handlers ──
  const handleSaveProvider = () => {
    if (!providerForm.name?.trim() || !providerForm.phone?.trim() || !userId || !db) {
      toast({ title: 'Completá nombre y teléfono', variant: 'destructive' }); return;
    }
    const id = editingProvider?.id || Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'proveedores', id);
    const data: Provider = {
      id,
      name:           providerForm.name!,
      category:       (providerForm.category || 'Fontanería') as ProviderCategory,
      description:    providerForm.description || '',
      phone:          providerForm.phone!,
      email:          providerForm.email,
      hourlyRate:     providerForm.hourlyRate || 0,
      rating:         editingProvider?.rating || 0,
      reviewCount:    editingProvider?.reviewCount || 0,
      status:         (providerForm.status || 'En evaluación') as ProviderStatus,
      certifications: providerForm.certifications || [],
      notes:          providerForm.notes,
      ownerId:        userId,
      createdAt:      editingProvider?.createdAt || new Date().toISOString().slice(0, 10),
    };
    setDocumentNonBlocking(ref, data, { merge: true });
    toast({ title: editingProvider ? 'Proveedor actualizado' : 'Proveedor agregado', description: data.name });
    setShowProviderDialog(false);
    setEditingProvider(null);
    setProviderForm(EMPTY_PROVIDER);
  };

  const handleDeleteProvider = (id: string) => {
    if (!userId || !db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'proveedores', id));
    toast({ title: 'Proveedor eliminado' });
  };

  const openEditProvider = (p: Provider) => {
    setEditingProvider(p);
    setProviderForm({ ...p });
    setShowProviderDialog(true);
  };

  // ── Budget handlers ──
  const handleSaveBudget = () => {
    if (!budgetForm.taskId || !budgetForm.providerId || !userId || !db) {
      toast({ title: 'Seleccioná tarea y proveedor', variant: 'destructive' }); return;
    }
    const task     = tasks.find(t => t.id === budgetForm.taskId);
    const provider = providers.find(p => p.id === budgetForm.providerId);
    const property = properties.find(p => p.id === task?.propertyId);
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'presupuestos', id);
    const data: BudgetReview = {
      id,
      taskId:            budgetForm.taskId!,
      taskConcept:       task?.concept || 'Trabajo de mantenimiento',
      propertyName:      property?.name || task?.propertyName || 'Propiedad',
      propertyId:        task?.propertyId || '',
      providerId:        budgetForm.providerId!,
      providerName:      provider?.name || '',
      description:       budgetForm.description || '',
      laborCost:         budgetForm.laborCost || 0,
      materialsCost:     budgetForm.materialsCost || 0,
      serviceFeePercent: budgetForm.serviceFeePercent || 5,
      estimatedHours:    budgetForm.estimatedHours || '2-3 horas',
      status:            'Pendiente',
      ownerId:           userId,
      createdAt:         new Date().toISOString().slice(0, 10),
    };
    setDocumentNonBlocking(ref, data, {});
    toast({ title: 'Presupuesto cargado', description: 'Pendiente de aprobación.' });
    setShowNewBudgetDialog(false);
    setBudgetForm(EMPTY_BUDGET);
  };

  const handleBudgetAction = (budget: BudgetReview, action: BudgetStatus) => {
    if (!userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'presupuestos', budget.id);
    setDocumentNonBlocking(ref, { status: action }, { merge: true });
    toast({
      title: action === 'Aprobado' ? '✅ Presupuesto aprobado' : '❌ Presupuesto rechazado',
      description: `${budget.taskConcept} — ${budget.providerName}`,
    });
    setShowBudgetDialog(false);
    setSelectedBudget(null);
  };

  // ── Budget total helper ──
  const budgetTotal = (b: Partial<BudgetReview>) => {
    const base = (b.laborCost || 0) + (b.materialsCost || 0);
    return Math.round(base * (1 + (b.serviceFeePercent || 0) / 100));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Directorio de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestioná servicios verificados y presupuestos de mantenimiento.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar proveedor..."
              className="pl-9 bg-white w-52"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {canWrite && (
            <>
              <Button
                variant="outline"
                className="gap-2 font-bold border-primary text-primary hover:bg-primary/5"
                onClick={() => { setBudgetForm({ ...EMPTY_BUDGET }); setShowNewBudgetDialog(true); }}
              >
                <FileCheck className="h-4 w-4" /> Cargar Presupuesto
              </Button>
              <Button
                className="gap-2 font-bold bg-primary"
                onClick={() => { setEditingProvider(null); setProviderForm({ ...EMPTY_PROVIDER }); setShowProviderDialog(true); }}
              >
                <Plus className="h-4 w-4" /> Nuevo Proveedor
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* Categories */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black">Categorías</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pt-0">
              <button
                onClick={() => setActiveCategory('Todos')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeCategory === 'Todos' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                Todos los proveedores
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeCategory === cat.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <cat.icon className="h-4 w-4 shrink-0" />
                  {cat.label}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Pending approvals */}
          {pendingBudgets.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  Aprobaciones
                  <Badge className="bg-red-100 text-red-700 border-none font-bold text-xs">{pendingBudgets.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {pendingBudgets.slice(0, 5).map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBudget(b); setShowBudgetDialog(true); }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{b.taskConcept}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {b.propertyName} · {b.providerName}
                        </p>
                      </div>
                      <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs font-black text-primary mt-1">{fmt(budgetTotal(b))}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Provider cards ── */}
        <div className="lg:col-span-3">
          {filteredProviders.length === 0 ? (
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="py-20 text-center text-muted-foreground">
                <HardHat className="h-10 w-10 mx-auto mb-3 opacity-25" />
                <p className="font-semibold">No hay proveedores en esta categoría.</p>
                {canWrite && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Hacé clic en <strong className="text-foreground">Nuevo Proveedor</strong> para agregar uno.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProviders.map(p => {
                const CatIcon = CATEGORIES.find(c => c.id === p.category)?.icon || Wrench;
                return (
                  <Card key={p.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group">
                    <CardContent className="p-4 flex flex-col h-full gap-3">

                      {/* Status + actions */}
                      <div className="flex items-center justify-between">
                        <Badge className={cn('border text-[10px] font-bold gap-1', STATUS_STYLES[p.status])}>
                          {p.status === 'Verificado'    && <CheckCircle2 className="h-3 w-3" />}
                          {p.status === 'En evaluación' && <Clock className="h-3 w-3" />}
                          {p.status === 'Suspendido'    && <AlertTriangle className="h-3 w-3" />}
                          {p.status}
                        </Badge>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canWrite && (
                            <button
                              onClick={() => openEditProvider(p)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteProvider(p.id)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Avatar + name */}
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <CatIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-foreground leading-tight truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.description || p.category}</p>
                          {p.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <StarRating rating={p.rating} />
                              <span className="text-[10px] font-bold text-muted-foreground">
                                ({p.rating.toFixed(1)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                          <span>{p.phone}</span>
                        </div>
                        {p.hourlyRate > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                            <span>
                              <span className="font-bold text-foreground">
                                {fmt(p.hourlyRate)}
                              </span> / hora base
                            </span>
                          </div>
                        )}
                        {(p.certifications || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {p.certifications!.slice(0, 2).map((c, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] border-green-200 text-green-700 bg-green-50 gap-0.5 px-1.5 py-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" /> {c}
                              </Badge>
                            ))}
                            {p.certifications!.length > 2 && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
                                +{p.certifications!.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CTA */}
                      {canWrite && (
                        <Button
                          size="sm"
                          className="w-full gap-2 font-bold text-xs bg-primary"
                          onClick={() => {
                            setBudgetForm({ ...EMPTY_BUDGET, providerId: p.id });
                            setShowNewBudgetDialog(true);
                          }}
                        >
                          <FileCheck className="h-3.5 w-3.5" /> Solicitar Presupuesto
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Dialog: Nuevo / Editar Proveedor
      ══════════════════════════════════════════ */}
      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Editar Proveedor' : 'Agregar Proveedor'}</DialogTitle>
            <DialogDescription>Completá los datos del prestador de servicios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre / Empresa *</Label>
                <Input
                  placeholder="Ej: Servicios Ruiz"
                  value={providerForm.name || ''}
                  onChange={e => setProviderForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select
                  value={providerForm.category}
                  onValueChange={v => setProviderForm(p => ({ ...p, category: v as ProviderCategory }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={providerForm.status}
                  onValueChange={v => setProviderForm(p => ({ ...p, status: v as ProviderStatus }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verificado">Verificado</SelectItem>
                    <SelectItem value="En evaluación">En evaluación</SelectItem>
                    <SelectItem value="Suspendido">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono *</Label>
                <Input
                  placeholder="+54 9 11 ..."
                  value={providerForm.phone || ''}
                  onChange={e => setProviderForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tarifa / hora ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={providerForm.hourlyRate || ''}
                  onChange={e => setProviderForm(p => ({ ...p, hourlyRate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Especialidad / Descripción</Label>
                <Textarea
                  placeholder="Especialidades, años de experiencia..."
                  className="min-h-[70px]"
                  value={providerForm.description || ''}
                  onChange={e => setProviderForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Certificaciones</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: Licencia 2024 · Enter para agregar"
                    value={newCert}
                    onChange={e => setNewCert(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCert.trim()) {
                        e.preventDefault();
                        setProviderForm(p => ({ ...p, certifications: [...(p.certifications || []), newCert.trim()] }));
                        setNewCert('');
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (newCert.trim()) {
                      setProviderForm(p => ({ ...p, certifications: [...(p.certifications || []), newCert.trim()] }));
                      setNewCert('');
                    }
                  }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1 min-h-[24px]">
                  {(providerForm.certifications || []).map((c, i) => (
                    <Badge key={i} variant="outline" className="border-green-200 text-green-700 bg-green-50 gap-1 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {c}
                      <button
                        onClick={() => setProviderForm(p => ({ ...p, certifications: (p.certifications || []).filter((_, j) => j !== i) }))}
                        className="ml-0.5 text-muted-foreground hover:text-destructive leading-none"
                      >×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProviderDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveProvider} className="font-bold px-8">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          Dialog: Cargar Presupuesto
      ══════════════════════════════════════════ */}
      <Dialog open={showNewBudgetDialog} onOpenChange={setShowNewBudgetDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" /> Cargar Presupuesto
            </DialogTitle>
            <DialogDescription>Asociá el presupuesto a una tarea de mantenimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tarea de mantenimiento *</Label>
              <Select value={budgetForm.taskId} onValueChange={v => setBudgetForm(p => ({ ...p, taskId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una tarea..." /></SelectTrigger>
                <SelectContent>
                  {tasks.filter(t => t.status !== 'Cerrado').map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.concept} — {t.propertyName}
                    </SelectItem>
                  ))}
                  {tasks.filter(t => t.status !== 'Cerrado').length === 0 && (
                    <SelectItem value="__none__" disabled>Sin tareas pendientes</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Proveedor *</Label>
              <Select value={budgetForm.providerId} onValueChange={v => setBudgetForm(p => ({ ...p, providerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná proveedor..." /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.category}</SelectItem>
                  ))}
                  {providers.length === 0 && (
                    <SelectItem value="__none__" disabled>Sin proveedores cargados</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción del trabajo</Label>
              <Textarea
                placeholder="Detalle del trabajo a realizar..."
                className="min-h-[70px]"
                value={budgetForm.description || ''}
                onChange={e => setBudgetForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mano de obra ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={budgetForm.laborCost || ''}
                  onChange={e => setBudgetForm(p => ({ ...p, laborCost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Materiales ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={budgetForm.materialsCost || ''}
                  onChange={e => setBudgetForm(p => ({ ...p, materialsCost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tasa serv. (%)</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={budgetForm.serviceFeePercent || ''}
                  onChange={e => setBudgetForm(p => ({ ...p, serviceFeePercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            {/* Total preview */}
            {((budgetForm.laborCost || 0) + (budgetForm.materialsCost || 0)) > 0 && (
              <div className="bg-primary/5 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mano de obra</span>
                  <span className="font-bold">{fmt(budgetForm.laborCost || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Materiales</span>
                  <span className="font-bold">{fmt(budgetForm.materialsCost || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tasa ({budgetForm.serviceFeePercent}%)</span>
                  <span className="font-bold">{fmt(Math.round(
                    ((budgetForm.laborCost || 0) + (budgetForm.materialsCost || 0)) * (budgetForm.serviceFeePercent || 0) / 100
                  ))}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-black text-base">
                  <span>TOTAL</span>
                  <span className="text-primary">{fmt(budgetTotal(budgetForm))}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Tiempo estimado</Label>
              <Input
                placeholder="Ej: 2-3 horas"
                value={budgetForm.estimatedHours || ''}
                onChange={e => setBudgetForm(p => ({ ...p, estimatedHours: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBudgetDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveBudget} className="font-bold px-8 gap-2">
              <FileCheck className="h-4 w-4" /> Cargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          Dialog: Revisión de Presupuesto
      ══════════════════════════════════════════ */}
      {selectedBudget && (
        <Dialog open={showBudgetDialog} onOpenChange={v => { setShowBudgetDialog(v); if (!v) setSelectedBudget(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
            {/* Encabezado */}
            <div className="p-6 pb-4 border-b">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] uppercase tracking-wide">
                  Pendiente de Aprobación
                </Badge>
                <span className="text-[11px] text-muted-foreground font-mono">
                  #{selectedBudget.id.toUpperCase().slice(0, 8)}
                </span>
              </div>
              <h2 className="text-xl font-black">Revisión de Presupuesto</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                PROPIEDAD: <span className="font-bold text-foreground">{selectedBudget.propertyName}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3">
              {/* Detalle de tarea y proveedor */}
              <div className="md:col-span-2 p-6 space-y-5">
                {/* Task */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <h3 className="text-base font-black flex items-center gap-2 mb-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    {selectedBudget.taskConcept}
                  </h3>
                  {selectedBudget.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedBudget.description}</p>
                  )}
                  {/* Task linked info */}
                  {(() => {
                    const task = tasks.find(t => t.id === selectedBudget.taskId);
                    if (!task) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-muted-foreground/10 flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{task.propertyName} · Estado tarea: <strong>{task.status}</strong></span>
                      </div>
                    );
                  })()}
                </div>

                {/* Provider profile */}
                <div>
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider mb-2">
                    Proveedor asignado
                  </p>
                  {(() => {
                    const prov = providers.find(p => p.id === selectedBudget.providerId);
                    if (!prov) return (
                      <p className="text-sm text-muted-foreground">{selectedBudget.providerName}</p>
                    );
                    const CatIcon = CATEGORIES.find(c => c.id === prov.category)?.icon || Wrench;
                    return (
                      <div className="bg-white border rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <CatIcon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-foreground">{prov.name}</p>
                            <p className="text-xs text-primary font-medium">{prov.description || prov.category}</p>
                            {prov.rating > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <StarRating rating={prov.rating} />
                                <span className="text-xs font-bold">{prov.rating.toFixed(1)}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({prov.reviewCount} reseñas)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {prov.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-primary/60" />
                            <span>{prov.phone}</span>
                          </div>
                        )}
                        {(prov.certifications || []).length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-[9px] uppercase font-black text-muted-foreground tracking-wider mb-2">
                              Certificaciones verificadas
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {prov.certifications!.map((c, i) => (
                                <Badge key={i} variant="outline" className="border-green-200 text-green-700 bg-green-50 gap-0.5 text-[10px]">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> {c}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Costo + acciones */}
              <div className="border-t md:border-t-0 md:border-l p-6 flex flex-col">
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider mb-3">
                  Costo estimado
                </p>
                <p className="text-4xl font-black text-primary mb-1">
                  {fmt(budgetTotal(selectedBudget))}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-4">
                  <Clock className="h-3 w-3" /> Tiempo est: {selectedBudget.estimatedHours}
                </p>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mano de Obra</span>
                    <span className="font-bold">{fmt(selectedBudget.laborCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materiales</span>
                    <span className="font-bold">{fmt(selectedBudget.materialsCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tasa Servicio ({selectedBudget.serviceFeePercent}%)
                    </span>
                    <span className="font-bold">{fmt(Math.round(
                      (selectedBudget.laborCost + selectedBudget.materialsCost) * selectedBudget.serviceFeePercent / 100
                    ))}</span>
                  </div>
                </div>

                <Separator className="mb-4" />

                {canWrite && selectedBudget.status === 'Pendiente' && (
                  <div className="space-y-2 mt-auto">
                    <Button
                      className="w-full gap-2 font-bold bg-primary"
                      onClick={() => handleBudgetAction(selectedBudget, 'Aprobado')}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprobar Presupuesto
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2 font-bold text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => handleBudgetAction(selectedBudget, 'Rechazado')}
                    >
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                )}
                {selectedBudget.status !== 'Pendiente' && (
                  <Badge className={cn(
                    'w-full justify-center py-2 font-bold text-sm border',
                    selectedBudget.status === 'Aprobado'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                  )}>
                    {selectedBudget.status === 'Aprobado'
                      ? <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      : <XCircle className="h-4 w-4 mr-1.5" />
                    }
                    {selectedBudget.status}
                  </Badge>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
