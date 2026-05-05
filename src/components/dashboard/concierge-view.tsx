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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Search, Plus, Sparkles, Star, ArrowRight, History,
  ChefHat, Car, Shield, Dumbbell, Dog, Leaf,
  Edit2, Trash2, X, CheckCircle2, Clock, AlertCircle,
  Loader2, ImagePlus, Package, Layers, Tag, Crown,
  Calendar, User, Building2, ClipboardList, RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Person, Property, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID = 'alquilagestion-pro';

// ── Types ─────────────────────────────────────────────────────────────────────
type ServiceType     = 'fixed' | 'subscription' | 'quote' | 'tiered';
type ServiceCategory = 'Limpieza' | 'Mascotas' | 'Gastronomía' | 'Autos' | 'Seguridad' | 'Bienestar' | 'Tecnología' | 'Otros';
type RequestStatus   = 'Pendiente' | 'Confirmado' | 'En Progreso' | 'Completado' | 'Cancelado';

interface ServiceTier   { label: string; price: number }
interface ConciergeService {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  type: ServiceType;
  basePrice?: number;
  priceUnit?: string;       // '/hora', '/mes', 'por visita'
  tiers?: ServiceTier[];
  isFeatured?: boolean;
  imageUrl?: string;
  badge?: string;
  isActive: boolean;
  ownerId: string;
  createdAt: string;
}
interface ServiceRequest {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  tenantId?: string;
  tenantName?: string;
  propertyId?: string;
  propertyName?: string;
  selectedTier?: string;
  scheduledDate?: string;
  notes?: string;
  status: RequestStatus;
  totalAmount?: number;
  ownerId: string;
  createdAt: string;
}

interface ConciergeViewProps {
  people:     Person[];
  properties: Property[];
  contracts:  Contract[];
  userId?:    string;
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: { id: ServiceCategory; label: string; icon: React.ElementType }[] = [
  { id: 'Limpieza',    label: 'Limpieza',    icon: Sparkles  },
  { id: 'Mascotas',   label: 'Mascotas',    icon: Dog       },
  { id: 'Gastronomía',label: 'Gastronomía', icon: ChefHat   },
  { id: 'Autos',      label: 'Autos',       icon: Car       },
  { id: 'Seguridad',  label: 'Seguridad',   icon: Shield    },
  { id: 'Bienestar',  label: 'Bienestar',   icon: Leaf      },
  { id: 'Tecnología', label: 'Tecnología',  icon: Sparkles  },
  { id: 'Otros',      label: 'Otros',       icon: MoreHorizontal },
];

const STATUS_CFG: Record<RequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  'Pendiente':   { label: 'Pendiente',   color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock        },
  'Confirmado':  { label: 'Confirmado',  color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: CheckCircle2 },
  'En Progreso': { label: 'En Progreso', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: RefreshCw  },
  'Completado':  { label: 'Completado',  color: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle2 },
  'Cancelado':   { label: 'Cancelado',   color: 'bg-red-50 text-red-700 border-red-200',        icon: AlertCircle  },
};

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR')}` : '';

// ── Empty forms ───────────────────────────────────────────────────────────────
const EMPTY_SVC: Partial<ConciergeService> = {
  name: '', description: '', category: 'Limpieza', type: 'fixed',
  basePrice: 0, priceUnit: 'por visita', isFeatured: false, isActive: true,
  badge: '', imageUrl: '', tiers: [],
};
const EMPTY_REQ: Partial<ServiceRequest> = {
  tenantId: '', propertyId: '', selectedTier: '', scheduledDate: '', notes: '',
};

// ── Service card ──────────────────────────────────────────────────────────────
function FeaturedCard({
  svc, canWrite, onRequest, onEdit, onDelete,
}: { svc: ConciergeService; canWrite: boolean; onRequest: () => void; onEdit: () => void; onDelete: () => void }) {
  const catCfg = CATEGORIES.find(c => c.id === svc.category);
  return (
    <Card className="border-none shadow-md bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative sm:w-56 md:w-72 lg:w-80 shrink-0 bg-emerald-900 min-h-[180px] sm:min-h-0">
          {svc.imageUrl ? (
            <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              {catCfg && <catCfg.icon className="h-16 w-16 text-emerald-300 opacity-50" />}
            </div>
          )}
          {svc.badge && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {svc.badge}
            </span>
          )}
          {canWrite && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={onDelete} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-5 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{svc.category}</p>
              <h3 className="text-xl font-black text-foreground leading-tight">{svc.name}</h3>
            </div>
            {!svc.isActive && <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">Inactivo</Badge>}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">{svc.description}</p>
          <div className="flex items-center justify-between gap-4 mt-auto">
            <div>
              {svc.type === 'fixed' && svc.basePrice != null && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Desde</p>
                  <p className="text-2xl font-black text-emerald-700">{fmt(svc.basePrice)}</p>
                </div>
              )}
              {svc.type === 'subscription' && svc.basePrice != null && (
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black text-emerald-700">{fmt(svc.basePrice)}</p>
                  <p className="text-sm text-muted-foreground">{svc.priceUnit || '/mes'}</p>
                </div>
              )}
              {svc.type === 'quote' && (
                <p className="text-sm font-bold text-amber-600 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">Bajo cotización</p>
              )}
            </div>
            <Button className="gap-2 font-black bg-emerald-600 hover:bg-emerald-700 text-white px-6" onClick={onRequest}>
              Contratar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function ServiceCard({
  svc, canWrite, onRequest, onEdit, onDelete,
}: { svc: ConciergeService; canWrite: boolean; onRequest: (tier?: ServiceTier) => void; onEdit: () => void; onDelete: () => void }) {
  const catCfg = CATEGORIES.find(c => c.id === svc.category);
  const CatIcon = catCfg?.icon || Package;

  return (
    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group overflow-hidden">
      <CardContent className="p-4 flex flex-col h-full gap-3">

        {/* Top row: badge + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {svc.type === 'subscription' && (
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">Suscripción</Badge>
            )}
            {svc.type === 'quote' && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">Bajo cotización</Badge>
            )}
            {svc.badge && svc.type !== 'subscription' && svc.type !== 'quote' && (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold gap-1">
                <Star className="h-2.5 w-2.5 fill-emerald-600" />{svc.badge}
              </Badge>
            )}
            {!svc.isActive && (
              <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">Inactivo</Badge>
            )}
          </div>
          {canWrite && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>

        {/* Icon + name */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            {svc.imageUrl ? (
              <img src={svc.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <CatIcon className="h-6 w-6 text-emerald-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-foreground leading-tight">{svc.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{svc.description}</p>
          </div>
        </div>

        <div className="mt-auto pt-2">
          {/* Fixed price */}
          {svc.type === 'fixed' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Desde</p>
                <p className="text-lg font-black text-emerald-700">{fmt(svc.basePrice)}</p>
              </div>
              <Button size="sm" className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onRequest()}>
                Contratar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Subscription */}
          {svc.type === 'subscription' && (
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <p className="text-xl font-black text-emerald-700">{fmt(svc.basePrice)}</p>
                <p className="text-xs text-muted-foreground">{svc.priceUnit || '/hora'}</p>
              </div>
              <button
                onClick={() => onRequest()}
                className="h-8 w-8 rounded-full border-2 border-emerald-600 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors font-black text-lg"
              >+</button>
            </div>
          )}

          {/* Quote */}
          {svc.type === 'quote' && (
            <button
              onClick={() => onRequest()}
              className="w-full text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Solicitar cotización <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Tiered */}
          {svc.type === 'tiered' && svc.tiers && (
            <div className="flex flex-wrap gap-2">
              {svc.tiers.map((tier, i) => (
                <button
                  key={i}
                  onClick={() => onRequest(tier)}
                  className={cn(
                    'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                    i === svc.tiers!.length - 1
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      : 'border-border text-foreground hover:border-emerald-600 hover:text-emerald-600'
                  )}
                >
                  {tier.label} ({fmt(tier.price)})
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ConciergeView({ people, properties, contracts, userId }: ConciergeViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { canWrite, canDelete } = useOrgPermissions();

  const [searchTerm,       setSearchTerm]       = useState('');
  const [activeCategory,   setActiveCategory]   = useState<ServiceCategory | 'Todos'>('Todos');
  const [showHistory,      setShowHistory]       = useState(false);
  const [showSvcDialog,    setShowSvcDialog]     = useState(false);
  const [showReqDialog,    setShowReqDialog]     = useState(false);
  const [editingSvc,       setEditingSvc]        = useState<ConciergeService | null>(null);
  const [selectedSvc,      setSelectedSvc]       = useState<ConciergeService | null>(null);
  const [selectedTier,     setSelectedTier]      = useState<ServiceTier | undefined>();
  const [svcForm,          setSvcForm]           = useState<Partial<ConciergeService>>(EMPTY_SVC);
  const [reqForm,          setReqForm]           = useState<Partial<ServiceRequest>>(EMPTY_REQ);
  const [newTierLabel,     setNewTierLabel]      = useState('');
  const [newTierPrice,     setNewTierPrice]      = useState('');
  const [historyFilter,    setHistoryFilter]     = useState<RequestStatus | 'Todos'>('Todos');

  // ── Firestore ──
  const svcsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'serviciosConcierge'));
  }, [db, userId]);
  const { data: svcsData } = useCollection<ConciergeService>(svcsQ);

  const reqsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'solicitudesConcierge'));
  }, [db, userId]);
  const { data: reqsData } = useCollection<ServiceRequest>(reqsQ);

  const services  = svcsData ?? [];
  const requests  = reqsData ?? [];
  const tenants   = people.filter(p => p.type === 'Inquilino' || p.type === 'Propietario');

  // ── Filtered services ──
  const filtered = useMemo(() => services.filter(s => {
    const matchCat    = activeCategory === 'Todos' || s.category === activeCategory;
    const matchSearch = !searchTerm
      || s.name.toLowerCase().includes(searchTerm.toLowerCase())
      || s.description.toLowerCase().includes(searchTerm.toLowerCase())
      || s.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  }), [services, activeCategory, searchTerm]);

  const featured  = filtered.find(s => s.isFeatured && s.isActive);
  const rest      = filtered.filter(s => s !== featured);

  const filteredReqs = useMemo(() => {
    if (historyFilter === 'Todos') return requests;
    return requests.filter(r => r.status === historyFilter);
  }, [requests, historyFilter]);

  // ── Stats ──
  const pendingCount   = requests.filter(r => r.status === 'Pendiente').length;
  const activeCount    = requests.filter(r => r.status === 'En Progreso').length;
  const completedCount = requests.filter(r => r.status === 'Completado').length;

  // ── Service CRUD ──
  const handleSaveSvc = () => {
    if (!svcForm.name?.trim()) { toast({ title: 'El nombre es obligatorio', variant: 'destructive' }); return; }
    if (!userId || !db)        { toast({ title: 'Sesión no disponible',      variant: 'destructive' }); return; }
    const id = editingSvc?.id || Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'serviciosConcierge', id);
    const data: ConciergeService = {
      id,
      name:        svcForm.name!,
      description: svcForm.description || '',
      category:    (svcForm.category || 'Otros') as ServiceCategory,
      type:        (svcForm.type || 'fixed') as ServiceType,
      basePrice:   svcForm.basePrice ?? 0,
      priceUnit:   svcForm.priceUnit || '',
      tiers:       svcForm.tiers || [],
      isFeatured:  !!svcForm.isFeatured,
      imageUrl:    svcForm.imageUrl || '',
      badge:       svcForm.badge || '',
      isActive:    svcForm.isActive !== false,
      ownerId:     userId,
      createdAt:   editingSvc?.createdAt || new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, { merge: true });
    toast({ title: editingSvc ? '✅ Servicio actualizado' : '✅ Servicio agregado', description: data.name });
    setShowSvcDialog(false);
    setEditingSvc(null);
    setSvcForm({ ...EMPTY_SVC });
  };

  const handleDeleteSvc = (id: string) => {
    if (!userId || !db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'serviciosConcierge', id));
    toast({ title: 'Servicio eliminado' });
  };

  const openEditSvc = (s: ConciergeService) => {
    setEditingSvc(s);
    setSvcForm({ ...s });
    setShowSvcDialog(true);
  };

  // ── Request ──
  const openRequestDialog = (svc: ConciergeService, tier?: ServiceTier) => {
    setSelectedSvc(svc);
    setSelectedTier(tier);
    setReqForm({ ...EMPTY_REQ, selectedTier: tier?.label });
    setShowReqDialog(true);
  };

  const handleSaveRequest = () => {
    if (!selectedSvc) return;
    if (!userId || !db) { toast({ title: 'Sesión no disponible', variant: 'destructive' }); return; }
    const tenant   = tenants.find(p => p.id === reqForm.tenantId);
    const property = properties.find(p => p.id === reqForm.propertyId);
    const id = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudesConcierge', id);
    const amount = selectedTier?.price ?? selectedSvc.basePrice;
    const data: ServiceRequest = {
      id,
      serviceId:       selectedSvc.id,
      serviceName:     selectedSvc.name,
      serviceCategory: selectedSvc.category,
      tenantId:        reqForm.tenantId || undefined,
      tenantName:      tenant?.fullName || '',
      propertyId:      reqForm.propertyId || undefined,
      propertyName:    property?.name || '',
      selectedTier:    reqForm.selectedTier || selectedTier?.label || '',
      scheduledDate:   reqForm.scheduledDate || '',
      notes:           reqForm.notes || '',
      status:          'Pendiente',
      totalAmount:     amount,
      ownerId:         userId,
      createdAt:       new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, {});
    toast({ title: '✅ Solicitud creada', description: `${selectedSvc.name} — ${tenant?.fullName || 'Sin asignar'}` });
    setShowReqDialog(false);
    setSelectedSvc(null);
    setReqForm({ ...EMPTY_REQ });
  };

  const handleUpdateStatus = (req: ServiceRequest, status: RequestStatus) => {
    if (!userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudesConcierge', req.id);
    setDocumentNonBlocking(ref, { status }, { merge: true });
    toast({ title: `Solicitud → ${status}` });
  };

  // ── Tier helpers in form ──
  const handleAddTier = () => {
    if (!newTierLabel.trim() || !newTierPrice) return;
    setSvcForm(f => ({
      ...f,
      tiers: [...(f.tiers || []), { label: newTierLabel.trim(), price: parseFloat(newTierPrice) }],
    }));
    setNewTierLabel('');
    setNewTierPrice('');
  };
  const handleRemoveTier = (i: number) => {
    setSvcForm(f => ({ ...f, tiers: (f.tiers || []).filter((_, j) => j !== i) }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Servicios Concierge</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">
            Experiencias premium bajo demanda para elevar la calidad de vida de sus inquilinos. Gestioná y solicitá servicios adicionales con un clic.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 relative"
            onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4" /> Ver Historial
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] font-black bg-red-500 text-white rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Button>
          {canWrite && (
            <Button className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setEditingSvc(null); setSvcForm({ ...EMPTY_SVC }); setShowSvcDialog(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Servicio
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pendientes',   value: pendingCount,   color: 'text-amber-600',  bg: 'bg-amber-50',  icon: Clock        },
            { label: 'En Progreso',  value: activeCount,    color: 'text-purple-600', bg: 'bg-purple-50', icon: RefreshCw    },
            { label: 'Completados',  value: completedCount, color: 'text-emerald-600',bg: 'bg-emerald-50',icon: CheckCircle2 },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', s.bg)}>
                  <s.icon className={cn('h-5 w-5', s.color)} />
                </div>
                <div>
                  <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search + categories ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Buscar servicios…" className="pl-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ id: 'Todos' as const, label: 'Todos' }, ...CATEGORIES].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
              )}
            >{cat.label}</button>
          ))}
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-20 text-center text-muted-foreground">
            <Crown className="h-10 w-10 mx-auto mb-3 text-emerald-200" />
            <p className="font-black text-foreground">No hay servicios en esta categoría</p>
            {canWrite && (
              <p className="text-sm mt-1">
                Hacé clic en <strong className="text-foreground">Nuevo Servicio</strong> para agregar el primero.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Featured card ── */}
      {featured && (
        <div className="group">
          <FeaturedCard
            svc={featured}
            canWrite={canWrite}
            onRequest={() => openRequestDialog(featured)}
            onEdit={() => openEditSvc(featured)}
            onDelete={() => handleDeleteSvc(featured.id)}
          />
        </div>
      )}

      {/* ── Service grid ── */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rest.map(svc => (
            <ServiceCard
              key={svc.id}
              svc={svc}
              canWrite={canWrite}
              onRequest={(tier) => openRequestDialog(svc, tier)}
              onEdit={() => openEditSvc(svc)}
              onDelete={() => handleDeleteSvc(svc.id)}
            />
          ))}
        </div>
      )}


      {/* ══════════════════════════════════════════════════
          Dialog: Add / Edit Service
      ══════════════════════════════════════════════════ */}
      <Dialog open={showSvcDialog} onOpenChange={v => { setShowSvcDialog(v); if (!v) { setEditingSvc(null); setSvcForm({ ...EMPTY_SVC }); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSvc ? 'Editar Servicio' : 'Nuevo Servicio Concierge'}</DialogTitle>
            <DialogDescription>Completá los datos del servicio que querés ofrecer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Name + category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre del Servicio *</Label>
                <Input placeholder="Ej: Limpieza Profunda" value={svcForm.name || ''} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={svcForm.category} onValueChange={v => setSvcForm(f => ({ ...f, category: v as ServiceCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Servicio</Label>
                <Select value={svcForm.type} onValueChange={v => setSvcForm(f => ({ ...f, type: v as ServiceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Precio Fijo</SelectItem>
                    <SelectItem value="subscription">Suscripción / Por hora</SelectItem>
                    <SelectItem value="quote">Bajo Cotización</SelectItem>
                    <SelectItem value="tiered">Por Niveles (Ej: Básico / Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Descripción</Label>
                <Textarea placeholder="Describí el servicio brevemente…" className="min-h-[70px]" value={svcForm.description || ''} onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Price section */}
            {(svcForm.type === 'fixed' || svcForm.type === 'subscription') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Precio base ($)</Label>
                  <Input type="number" placeholder="0" value={svcForm.basePrice || ''} onChange={e => setSvcForm(f => ({ ...f, basePrice: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Unidad de precio</Label>
                  <Input placeholder="Ej: /hora, /mes, por visita" value={svcForm.priceUnit || ''} onChange={e => setSvcForm(f => ({ ...f, priceUnit: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Tiers */}
            {svcForm.type === 'tiered' && (
              <div className="space-y-2">
                <Label>Niveles de Servicio</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(svcForm.tiers || []).map((t, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs font-bold bg-muted px-2 py-1 rounded-full">
                      {t.label} · {fmt(t.price)}
                      <button onClick={() => handleRemoveTier(i)} className="text-muted-foreground hover:text-destructive ml-0.5"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nombre del nivel (Ej: Completo)" value={newTierLabel} onChange={e => setNewTierLabel(e.target.value)} className="flex-1 h-8 text-sm" />
                  <Input placeholder="Precio" type="number" value={newTierPrice} onChange={e => setNewTierPrice(e.target.value)} className="w-24 h-8 text-sm" />
                  <Button type="button" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddTier}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Badge + Image URL */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Badge (etiqueta)</Label>
                <Input placeholder="Ej: Más Solicitado, Nuevo" value={svcForm.badge || ''} onChange={e => setSvcForm(f => ({ ...f, badge: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>URL de imagen</Label>
                <Input placeholder="https://…" value={svcForm.imageUrl || ''} onChange={e => setSvcForm(f => ({ ...f, imageUrl: e.target.value }))} />
              </div>
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={!!svcForm.isFeatured} onCheckedChange={v => setSvcForm(f => ({ ...f, isFeatured: v }))} />
                <span className="text-sm font-medium">Destacado (tarjeta grande)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={svcForm.isActive !== false} onCheckedChange={v => setSvcForm(f => ({ ...f, isActive: v }))} />
                <span className="text-sm font-medium">Activo</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSvcDialog(false)}>Cancelar</Button>
            <Button className="font-bold px-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSvc}>
              {editingSvc ? 'Guardar Cambios' : 'Crear Servicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ══════════════════════════════════════════════════
          Dialog: Nueva Solicitud
      ══════════════════════════════════════════════════ */}
      {selectedSvc && (
        <Dialog open={showReqDialog} onOpenChange={v => { setShowReqDialog(v); if (!v) setSelectedSvc(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-emerald-600" /> Solicitar Servicio
              </DialogTitle>
              <DialogDescription>
                <span className="font-bold text-foreground">{selectedSvc.name}</span>
                {selectedTier && <span className="text-muted-foreground"> — {selectedTier.label}</span>}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Price summary */}
              {(selectedTier?.price ?? selectedSvc.basePrice) != null && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                  <span className="text-sm text-emerald-700 font-medium">{selectedTier?.label || 'Precio estimado'}</span>
                  <span className="text-xl font-black text-emerald-700">
                    {fmt(selectedTier?.price ?? selectedSvc.basePrice)}
                    {selectedSvc.priceUnit && <span className="text-sm font-normal text-muted-foreground ml-1">{selectedSvc.priceUnit}</span>}
                  </span>
                </div>
              )}

              {/* Tenant */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Inquilino / Propietario</Label>
                <Select value={reqForm.tenantId} onValueChange={v => setReqForm(f => ({ ...f, tenantId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná la persona…" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.type})</SelectItem>)}
                    {tenants.length === 0 && <SelectItem value="__none__" disabled>Sin personas registradas</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Property */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Propiedad</Label>
                <Select value={reqForm.propertyId} onValueChange={v => setReqForm(f => ({ ...f, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná la propiedad…" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    {properties.length === 0 && <SelectItem value="__none__" disabled>Sin propiedades</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Scheduled date */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Fecha solicitada</Label>
                <Input type="date" value={reqForm.scheduledDate} onChange={e => setReqForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea placeholder="Instrucciones especiales, horarios, acceso…" className="min-h-[70px]" value={reqForm.notes || ''} onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReqDialog(false)}>Cancelar</Button>
              <Button className="font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveRequest}>
                Confirmar Solicitud
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {/* ══════════════════════════════════════════════════
          Dialog: Historial de Solicitudes
      ══════════════════════════════════════════════════ */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <History className="h-5 w-5 text-emerald-600" /> Historial de Solicitudes
            </DialogTitle>
            <DialogDescription>Todas las solicitudes de servicios concierge.</DialogDescription>
          </DialogHeader>

          {/* Filter tabs */}
          <div className="px-6 py-3 border-b flex gap-1.5 flex-wrap">
            {(['Todos', 'Pendiente', 'Confirmado', 'En Progreso', 'Completado', 'Cancelado'] as const).map(s => (
              <button
                key={s}
                onClick={() => setHistoryFilter(s)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold transition-colors',
                  historyFilter === s ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >{s}</button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {filteredReqs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-25" />
                <p className="font-semibold">Sin solicitudes</p>
              </div>
            ) : (
              [...filteredReqs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(req => {
                const cfg = STATUS_CFG[req.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={req.id} className="p-4 bg-muted/20 rounded-xl border border-border/50 hover:bg-white transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-foreground">{req.serviceName}</p>
                          {req.selectedTier && <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">{req.selectedTier}</span>}
                          <Badge className={cn('border text-[10px] font-bold gap-1', cfg.color)}>
                            <StatusIcon className="h-2.5 w-2.5" /> {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          {req.tenantName  && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {req.tenantName}</span>}
                          {req.propertyName && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {req.propertyName}</span>}
                          {req.scheduledDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {req.scheduledDate.split('-').reverse().join('/')}</span>}
                          {req.totalAmount != null && req.totalAmount > 0 && <span className="font-black text-emerald-700">{fmt(req.totalAmount)}</span>}
                        </div>
                        {req.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{req.notes}"</p>}
                      </div>

                      {/* Status actions */}
                      {canWrite && req.status !== 'Completado' && req.status !== 'Cancelado' && (
                        <Select value={req.status} onValueChange={v => handleUpdateStatus(req, v as RequestStatus)}>
                          <SelectTrigger className="h-8 w-36 text-xs font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="Confirmado">Confirmado</SelectItem>
                            <SelectItem value="En Progreso">En Progreso</SelectItem>
                            <SelectItem value="Completado">Completado</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Total: <strong>{requests.length}</strong> solicitudes · <strong className="text-amber-600">{pendingCount} pendientes</strong>
            </p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
