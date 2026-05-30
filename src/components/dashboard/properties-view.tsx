
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Search, Landmark, X, PlusCircle, Sparkles, Loader2, Send, MessageSquare, Building2, Users, Wrench, TrendingUp, LayoutGrid, List, MapPin, Globe, BookOpen, History, BarChart3, ExternalLink, Share2, Copy, Link2, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, PropertyStatus, PropertyOwner, PropertyManual, Contract, Invoice, MaintenanceTask, RentalApplication, Liquidation, LegalCase, ReserveFund } from '@/lib/types';
import { PropertyDetailView } from '@/components/dashboard/property-detail-view';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { SelectWithOther } from '@/components/ui/select-with-other';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { EmptyState } from '@/components/ui/empty-state';
import { doc, collection, query, where } from 'firebase/firestore';
import { setDocumentNonBlocking, setDocumentSafe, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Schemas } from '@/lib/schemas';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { PropertyTimeline } from '@/components/ui/property-timeline';
import { normalizeAddress } from '@/lib/format';

interface PropertiesViewProps {
  properties: Property[];
  userId?: string;
  contracts?: Contract[];
  invoices?: Invoice[];
  tasks?: MaintenanceTask[];
  applications?: RentalApplication[];
  liquidations?: Liquidation[];
  legalCases?: LegalCase[];
  reserveFunds?: ReserveFund[];
  deepLinkPropertyId?: string | null;
  onDeepLinkConsumed?: () => void;
  onOpenContract?: (c: Contract) => void;
}


export function PropertiesView({ properties, userId, contracts = [], invoices = [], tasks = [], applications = [], liquidations = [], legalCases = [], reserveFunds = [], deepLinkPropertyId, onDeepLinkConsumed, onOpenContract }: PropertiesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();

  // Cuento dependencias de cada propiedad para bloquear deletes peligrosos.
  // Los contratos llegan por props desde app-client — no hace falta re-suscribir.
  const vigentesByProp = useMemo(() => {
    const map = new Map<string, number>();
    contracts
      .filter(c => c.status === 'Vigente')
      .forEach(c => map.set(c.propertyId, (map.get(c.propertyId) ?? 0) + 1));
    return map;
  }, [contracts]);

  const getDeleteBlocker = (p: Property): string | null => {
    const vigentes = vigentesByProp.get(p.id) ?? 0;
    if (vigentes > 0) {
      return `Esta propiedad tiene ${vigentes} contrato${vigentes > 1 ? 's' : ''} vigente${vigentes > 1 ? 's' : ''}. Finalizalo${vigentes > 1 ? 's' : ''} antes de eliminar.`;
    }
    return null;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'maintenance'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [formErrors, setFormErrors] = useState<{ name?: string; address?: string }>({});
  const [timelineProperty, setTimelineProperty] = useState<Property | null>(null);
  
  const [invitingOwner, setInvitingOwner] = useState<{name: string, email: string} | null>(null);
  const [isDraftingInvite, setIsDraftingInvite] = useState(false);
  const [invitationDraft, setInvitationDraft] = useState<AiCommunicationAssistantOutput | null>(null);

  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getApplyLink = (p: Property) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/apply?adminId=${userId}&propertyId=${p.id}`;
  };

  const getWhatsAppText = (p: Property) => {
    const link = getApplyLink(p);
    const rooms = p.rooms ? `${p.rooms} amb.` : '';
    const sqm = p.squareMeters ? ` · ${p.squareMeters}m²` : '';
    const amenities = (p.amenities || []).slice(0, 4).map(a => `• ${a}`).join('\n');
    return `🏠 *${p.name}*\n📍 ${p.address}\n${p.type}${rooms ? ' · ' + rooms : ''}${sqm}\n\n${amenities ? amenities + '\n\n' : ''}✅ Disponible para alquilar\n\n📲 Completá tu solicitud acá:\n${link}`;
  };

  const getSocialText = (p: Property) => {
    const link = getApplyLink(p);
    const rooms = p.rooms ? `${p.rooms} ambientes` : '';
    const sqm = p.squareMeters ? ` | ${p.squareMeters}m²` : '';
    const amenities = (p.amenities || []).slice(0, 5).join(' · ');
    return `🏠 ¡Propiedad disponible!\n\n${p.name}\n📍 ${p.address}\n${p.type}${rooms ? ' · ' + rooms : ''}${sqm}\n\n${amenities ? '✨ ' + amenities + '\n\n' : ''}📲 Consultá y completá tu solicitud:\n${link}\n\n#Alquiler #InmobiliariaArgentina #PropiedadDisponible`;
  };

  const getLinkedInText = (p: Property) => {
    const link = getApplyLink(p);
    const rooms = p.rooms ? ` · ${p.rooms} ambientes` : '';
    const sqm = p.squareMeters ? ` · ${p.squareMeters}m²` : '';
    const usage = p.usage === 'Comercial' ? 'local comercial u oficina' : 'propiedad';
    const amenities = (p.amenities || []).slice(0, 4).join(', ');
    return `Tenemos disponible un ${usage} para alquilar.\n\n📌 ${p.name} — ${p.address}\n${p.type}${rooms}${sqm}${amenities ? '\n\nCaracterísticas: ' + amenities : ''}\n\nSi estás buscando o conocés a alguien interesado, podés completar la solicitud de forma rápida y online:\n${link}`;
  };

  const getTwitterText = (p: Property) => {
    const link = getApplyLink(p);
    const rooms = p.rooms ? ` ${p.rooms} amb.` : '';
    const sqm = p.squareMeters ? ` ${p.squareMeters}m²` : '';
    const base = `🏠 ${p.type}${rooms}${sqm} disponible en ${p.address}. Consultá acá: ${link}`;
    return base.length <= 280 ? base : base.substring(0, 277) + '...';
  };

  const getTelegramText = (p: Property) => {
    const link = getApplyLink(p);
    const rooms = p.rooms ? `${p.rooms} amb.` : '';
    const sqm = p.squareMeters ? ` · ${p.squareMeters}m²` : '';
    const amenities = (p.amenities || []).slice(0, 4).map(a => `• ${a}`).join('\n');
    return `🏠 <b>${p.name}</b>\n📍 ${p.address}\n${p.type}${rooms ? ' · ' + rooms : ''}${sqm}\n\n${amenities ? amenities + '\n\n' : ''}✅ Disponible\n\n📲 <a href="${link}">Completar solicitud</a>`;
  };

  // ── Referencias de mercado ──────────────────────────────────────────────────
  type MarketResult = {
    source?: string; zonapropUrl?: string; priceCount?: number;
    min?: number; max?: number; avg?: number; median?: number;
    listings?: string[]; fetchedAt?: string; error?: string;
  };
  const [marketProp,    setMarketProp]    = useState<Property | null>(null);
  const [marketCity,    setMarketCity]    = useState('');
  const [marketNeigh,   setMarketNeigh]   = useState('');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketResult,  setMarketResult]  = useState<MarketResult | null>(null);

  const handleFetchMarket = async () => {
    if (!marketProp) return;
    setMarketLoading(true);
    setMarketResult(null);
    try {
      const params = new URLSearchParams({
        type:  marketProp.type,
        rooms: String(marketProp.rooms ?? 2),
        city:  marketCity || 'Buenos Aires',
        ...(marketNeigh ? { neighborhood: marketNeigh } : {}),
      });
      const res  = await fetch(`/api/market/references?${params}`);
      const data = await res.json();
      setMarketResult(data);
    } catch {
      setMarketResult({ error: 'No se pudo conectar con el servicio.' });
    } finally {
      setMarketLoading(false);
    }
  };

  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    address: '',
    type: 'Departamento',
    usage: 'Vivienda',
    status: 'Disponible',
    squareMeters: 0,
    rooms: 0,
    amenities: [],
    photos: [],
    internalNotes: '',
    owners: [{ name: '', email: '', percentage: 100 }],
    virtualTourUrl: '',
    manuals: [],
  });

  const tabFilteredProperties = useMemo(() => {
    let base = properties;
    if (activeTab === 'available') base = properties.filter(p => p.status === 'Disponible' || p.status === 'Reservada');
    if (activeTab === 'maintenance') base = properties.filter(p => p.status === 'En Mantenimiento');
    return base.filter(p =>
      (p.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.address ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [properties, activeTab, searchTerm]);

  const filteredProperties = tabFilteredProperties;

  const totalProperties = properties.length;
  const occupiedCount = properties.filter(p => p.status === 'Alquilada').length;
  const occupancyRate = totalProperties > 0 ? Math.round((occupiedCount / totalProperties) * 100) : 0;
  const maintenanceCount = properties.filter(p => p.status === 'En Mantenimiento').length;

  const getStatusBadge = (status: PropertyStatus) => {
    const styles = {
      'Disponible': 'bg-green-100 text-green-700 hover:bg-green-100',
      'Reservada': 'bg-blue-100 text-blue-700 hover:bg-blue-100',
      'Alquilada': 'bg-gray-100 text-gray-700 hover:bg-gray-100',
      'En Mantenimiento': 'bg-orange-100 text-orange-700 hover:bg-orange-100'
    };
    return <Badge className={cn("border-none", styles[status])}>{status}</Badge>;
  };

  const getPropertyRisk = (status: PropertyStatus) => {
    if (status === 'Alquilada')        return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">🟢 Sin riesgo</span>;
    if (status === 'Disponible')       return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">🔴 Vacante</span>;
    if (status === 'En Mantenimiento') return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🟡 En obra</span>;
    return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">🔵 Reservada</span>;
  };

  const handleOpenDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData({ ...property, photos: property.photos || [], manuals: property.manuals || [], virtualTourUrl: property.virtualTourUrl || '' });
    } else {
      setEditingProperty(null);
      setFormData({
        name: '', address: '', type: 'Departamento', usage: 'Vivienda',
        status: 'Disponible', squareMeters: 0, rooms: 0,
        amenities: [], photos: [], internalNotes: '',
        owners: [{ name: '', email: '', percentage: 100 }],
        virtualTourUrl: '', manuals: [],
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!deepLinkPropertyId) return;
    const prop = properties.find(p => p.id === deepLinkPropertyId);
    if (prop) {
      setDetailProperty(prop);
      onDeepLinkConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkPropertyId, properties]);

  // Mantener detailProperty sincronizado cuando cambia la lista (ej: edición)
  useEffect(() => {
    if (!detailProperty) return;
    const updated = properties.find(p => p.id === detailProperty.id);
    if (updated && updated !== detailProperty) setDetailProperty(updated);
  }, [properties, detailProperty]);

  const handleOpenInviteDialog = async (owner: PropertyOwner) => {
    setInvitingOwner({ name: owner.name, email: owner.email });
    setIsInviteDialogOpen(true);
    setInvitationDraft(null);
    setIsDraftingInvite(true);
    
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const draft = await aiCommunicationAssistant({
        communicationType: 'portalInvitation',
        ownerName: owner.name,
        role: 'Propietario',
        portalUrl: origin,
        additionalContext: `Le invitamos a ver el rendimiento de su propiedad. Debe registrarse con este email: ${owner.email}`
      });
      setInvitationDraft(draft);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo redactar la invitación.", variant: "destructive" });
    } finally {
      setIsDraftingInvite(false);
    }
  };

  const handleSendOwnerInvitation = () => {
    toast({ title: "Invitación Enviada", description: `Acceso enviado a ${invitingOwner?.email}` });
    setIsInviteDialogOpen(false);
  };

  const addOwner = () => {
    const newOwners = [...(formData.owners || []), { name: '', email: '', percentage: 0 }];
    setFormData({ ...formData, owners: newOwners });
  };

  const removeOwner = (index: number) => {
    const newOwners = (formData.owners || []).filter((_, i) => i !== index);
    setFormData({ ...formData, owners: newOwners });
  };

  const updateOwner = (index: number, field: keyof PropertyOwner, value: string | number) => {
    const newOwners = [...(formData.owners || [])];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setFormData({ ...formData, owners: newOwners });
  };

  const handleSave = () => {
    const errors: { name?: string; address?: string } = {};
    if (!formData.name?.trim()) errors.name = 'El nombre es requerido.';
    if (!formData.address?.trim()) errors.address = 'La dirección es requerida.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !userId || !db) return;

    const docId = editingProperty?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', docId);

    const propertyData: Property = {
      ...formData,
      id: docId,
      ownerId: userId,
      address: normalizeAddress(formData.address),
      photos: formData.photos || [],
      amenities: formData.amenities || [],
      owners: formData.owners || []
    } as Property;

    setDocumentSafe(docRef, Schemas.PropertyPatch, propertyData, { merge: true });
    
    toast({ 
      title: editingProperty ? "Propiedad actualizada" : "Propiedad creada", 
      description: `${formData.name} se ha guardado en la nube.` 
    });
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Propiedad eliminada", description: "La unidad ha sido removida." });
  };

  // Si hay propiedad seleccionada, mostramos pantalla de detalle. Los Dialogs (que
  // viven en el div hidden de abajo) siguen montados y se renderizan vía Portal.
  return (
    <>
    {detailProperty && (
      <PropertyDetailView
        property={detailProperty}
        userId={userId}
        contracts={contracts}
        invoices={invoices}
        liquidations={liquidations}
        tasks={tasks}
        applications={applications}
        legalCases={legalCases}
        reserveFunds={reserveFunds}
        onBack={() => setDetailProperty(null)}
        onEditTechnical={(p) => handleOpenDialog(p)}
        onShare={(p) => setShareProperty(p)}
        onOpenContract={onOpenContract}
      />
    )}
    <div className={cn("space-y-6 animate-in fade-in duration-500", detailProperty && 'hidden')}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Total de Propiedades</p>
              <p className="text-2xl font-black">{totalProperties}</p>
              {totalProperties > 0 && <p className="text-[10px] text-green-600 font-bold flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> +2 este mes</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Tasa de Ocupación</p>
              <p className="text-2xl font-black">{occupancyRate}%</p>
              <p className="text-[10px] text-muted-foreground">{occupancyRate >= 90 ? '95% Objetivo cumplido' : `${occupiedCount} de ${totalProperties} ocupadas`}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-none shadow-sm bg-white", maintenanceCount > 0 && "border-l-4 border-l-orange-400")}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Wrench className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Mantenimiento Activo</p>
              <p className="text-2xl font-black">{maintenanceCount}</p>
              {maintenanceCount > 0 && <p className="text-[10px] text-orange-500 font-bold">Requiere acción</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'available', 'maintenance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-bold transition-colors",
                activeTab === tab
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab === 'all' ? 'Todas las Propiedades' : tab === 'available' ? 'Disponibles' : 'Mantenimiento'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar propiedad..."
              className="pl-9 bg-white w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex border rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-2 transition-colors", viewMode === 'list' ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          {canWrite && (
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />
              Agregar Propiedad
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Editar Propiedad' : 'Alta de Propiedad'}</DialogTitle>
            <DialogDescription>Gestión técnica y legal de la unidad.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={editingProperty ? 'control' : 'specs'} className="mt-4">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6 overflow-x-auto">
              {editingProperty && (
                <TabsTrigger value="control" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent whitespace-nowrap">🎯 Centro de Control</TabsTrigger>
              )}
              <TabsTrigger value="specs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Datos Técnicos</TabsTrigger>
              <TabsTrigger value="owners" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Propietarios</TabsTrigger>
              <TabsTrigger value="portal" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Portal Inquilino</TabsTrigger>
              <TabsTrigger value="extra" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Notas</TabsTrigger>
            </TabsList>

            {editingProperty && (() => {
              const propId = editingProperty.id;
              const propContracts = contracts.filter(c => c.propertyId === propId);
              const activeContract = propContracts.find(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer');
              const propInvoices = invoices.filter(i => propContracts.some(c => c.id === i.contractId));
              const pendingInv = propInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido').slice(0, 5);
              const openTasks = tasks.filter(t => t.propertyId === propId && t.status !== 'Completado').slice(0, 5);
              const propApps = applications.filter(a => a.propertyId === propId).slice(0, 5);
              const daysLeft = activeContract
                ? Math.round((new Date(activeContract.endDate).getTime() - Date.now()) / 86_400_000)
                : null;
              return (
                <TabsContent value="control" className="pt-6 space-y-5">
                  {/* Contrato activo */}
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Contrato activo</p>
                    {activeContract ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{activeContract.tenantName ?? '—'}</span>
                          <span className={cn('text-xs font-black px-2 py-0.5 rounded-full',
                            activeContract.status === 'Vigente' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          )}>{activeContract.status}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activeContract.currency} {activeContract.currentRentAmount.toLocaleString('es-AR')}/mes
                          {' · '}Vence: {new Date(activeContract.endDate).toLocaleDateString('es-AR')}
                          {daysLeft !== null && daysLeft <= 60 && (
                            <span className={cn('ml-1 font-black', daysLeft <= 30 ? 'text-red-600' : 'text-amber-600')}>
                              ({daysLeft}d)
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Sin contrato activo</p>
                    )}
                  </div>

                  {/* Facturas pendientes */}
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      Facturas pendientes
                      {pendingInv.length > 0 && <span className="h-4 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black">{pendingInv.length}</span>}
                    </p>
                    {pendingInv.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sin facturas pendientes</p>
                    ) : (
                      <div className="divide-y">
                        {pendingInv.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span>{inv.period ?? 'Factura'}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{inv.currency} {inv.totalAmount.toLocaleString('es-AR')}</span>
                              <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full',
                                inv.status === 'Vencido' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              )}>{inv.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mantenimiento abierto */}
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      Mantenimiento abierto
                      {openTasks.length > 0 && <span className="h-4 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black">{openTasks.length}</span>}
                    </p>
                    {openTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sin tareas abiertas</p>
                    ) : (
                      <div className="divide-y">
                        {openTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span>{t.concept ?? t.description ?? 'Tarea'}</span>
                            <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full',
                              t.priority === 'Alta' ? 'bg-red-100 text-red-700' :
                              t.priority === 'Media' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            )}>{t.priority ?? t.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Postulantes */}
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      Postulantes
                      {propApps.filter(a => a.status === 'Nueva').length > 0 && (
                        <span className="h-4 px-1.5 rounded-full bg-blue-500 text-white text-[9px] font-black">{propApps.filter(a => a.status === 'Nueva').length} nuevos</span>
                      )}
                    </p>
                    {propApps.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Sin postulantes</p>
                    ) : (
                      <div className="divide-y">
                        {propApps.map(app => (
                          <div key={app.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span>{app.applicantName ?? '—'}</span>
                            <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full',
                              app.status === 'Nueva' ? 'bg-blue-100 text-blue-700' :
                              app.status === 'Aprobada' ? 'bg-green-100 text-green-700' :
                              app.status === 'Rechazada' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            )}>{app.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              );
            })()}

            <TabsContent value="specs" className="space-y-5 pt-6">
              {/* Fila 1: Nombre + Dirección */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre / Referencia *</Label>
                  <Input
                    placeholder="Ej: Las Heras 4B"
                    value={formData.name || ''}
                    onChange={e => { setFormData({ ...formData, name: e.target.value }); if (formErrors.name) setFormErrors(p => ({ ...p, name: undefined })); }}
                    className={formErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección *</Label>
                  <AddressAutocomplete
                    placeholder="Calle y número"
                    value={formData.address || ''}
                    onChange={val => { setFormData({ ...formData, address: val }); if (formErrors.address) setFormErrors(p => ({ ...p, address: undefined })); }}
                  />
                  {formErrors.address && <p className="text-xs text-destructive">{formErrors.address}</p>}
                </div>
              </div>

              {/* Fila 2: Tipo + Uso + Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <SelectWithOther
                    value={formData.type ?? ''}
                    onValueChange={v => setFormData({ ...formData, type: v as any })}
                    options={['Departamento','Casa','Local','Cochera','Oficina','Depósito','Terreno']}
                    otherPlaceholder="Ej: Galpón, Penthouse..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Uso</Label>
                  <SelectWithOther
                    value={formData.usage ?? ''}
                    onValueChange={v => setFormData({ ...formData, usage: v as any })}
                    options={['Vivienda','Comercial','Profesional','Industrial']}
                    otherPlaceholder="Ej: Mixto, Uso especial..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Disponible','Reservada','Alquilada','En Mantenimiento'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fila 3: m² + habitaciones */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Superficie (m²)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.squareMeters || ''}
                    onChange={e => setFormData({ ...formData, squareMeters: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Habitaciones</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.rooms || ''}
                    onChange={e => setFormData({ ...formData, rooms: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="owners" className="space-y-6 pt-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold flex items-center gap-2"><Landmark className="h-4 w-4" /> Propietarios y Copropietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={addOwner}><PlusCircle className="h-3 w-3 mr-1" /> Añadir Dueño</Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Ingrese el email del propietario para que pueda ver esta unidad en su portal personal.</p>
              {(formData.owners || []).map((owner, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-muted/20 rounded-lg">
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-[10px]">Nombre</Label>
                    <Input 
                      value={owner.name} 
                      onChange={(e) => updateOwner(index, 'name', e.target.value)} 
                      placeholder="Nombre Completo" 
                      className="h-8" 
                    />
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <Label className="text-[10px]">Email Acceso</Label>
                    <Input 
                      value={owner.email} 
                      onChange={(e) => updateOwner(index, 'email', e.target.value)} 
                      placeholder="ejemplo@correo.com" 
                      className="h-8" 
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-[10px]">% Part.</Label>
                    <Input 
                      type="number" 
                      value={owner.percentage} 
                      onChange={(e) => updateOwner(index, 'percentage', parseInt(e.target.value) || 0)} 
                      className="h-8" 
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                     <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOwner(index)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* ── Portal Inquilino ── */}
            <TabsContent value="portal" className="space-y-6 pt-6">

              {/* Fotos */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Fotos de la propiedad
                  <span className="text-[10px] font-normal text-muted-foreground">
                    · la primera foto aparece en el portal del inquilino
                  </span>
                </Label>
                <PhotoUpload
                  value={formData.photos || []}
                  onChange={photos => setFormData(f => ({ ...f, photos }))}
                  storagePath={`properties/${editingProperty?.id || 'new'}`}
                  maxPhotos={10}
                />
              </div>

              {/* Tour Virtual */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> URL Tour Virtual 360°
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">(opcional)</span>
                </Label>
                <Input
                  placeholder="https://my.matterport.com/... o YouTube embed"
                  value={formData.virtualTourUrl || ''}
                  onChange={e => setFormData({ ...formData, virtualTourUrl: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Se muestra como iframe interactivo en la pantalla de bienvenida del inquilino. Compatible con Matterport, Google Street View, YouTube, etc.
                </p>
              </div>

              {/* Manuales */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> Manuales de la unidad
                  </Label>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setFormData(f => ({
                      ...f,
                      manuals: [...(f.manuals || []), { name: '', sizeLabel: 'PDF', url: '' }]
                    }))}
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1" /> Agregar manual
                  </Button>
                </div>
                {(formData.manuals || []).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Sin manuales cargados. El inquilino podrá descargarlos desde su portal.
                  </p>
                )}
                {(formData.manuals || []).map((m, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/20 rounded-lg">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px]">Nombre</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ej: Refrigerador Smart"
                        value={m.name}
                        onChange={e => {
                          const ms = [...(formData.manuals || [])];
                          ms[i] = { ...ms[i], name: e.target.value };
                          setFormData(f => ({ ...f, manuals: ms }));
                        }}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px]">Tamaño / tipo</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="PDF · 2.4 MB"
                        value={m.sizeLabel}
                        onChange={e => {
                          const ms = [...(formData.manuals || [])];
                          ms[i] = { ...ms[i], sizeLabel: e.target.value };
                          setFormData(f => ({ ...f, manuals: ms }));
                        }}
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-[10px]">URL del archivo</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="https://..."
                        value={m.url || ''}
                        onChange={e => {
                          const ms = [...(formData.manuals || [])];
                          ms[i] = { ...ms[i], url: e.target.value };
                          setFormData(f => ({ ...f, manuals: ms }));
                        }}
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-center pb-0.5">
                      <Button
                        type="button" size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setFormData(f => ({
                          ...f,
                          manuals: (f.manuals || []).filter((_, j) => j !== i)
                        }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="extra" className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Notas Internas</Label>
                <Textarea
                  className="min-h-[100px]"
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Invitar Propietario al Portal
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            {isDraftingInvite ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Redactando invitación para el Propietario...</p>
              </div>
            ) : invitationDraft ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Asunto</Label>
                  <p className="font-bold text-sm">{invitationDraft.subjectLine}</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm whitespace-pre-wrap leading-relaxed min-h-[200px]">
                  {invitationDraft.draftedMessage}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-primary text-white gap-2 font-bold px-8" 
              onClick={handleSendOwnerInvitation}
              disabled={isDraftingInvite || !invitationDraft}
            >
              <Send className="h-4 w-4" /> Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propiedad</TableHead>
              <TableHead>Tipo / Uso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Propietarios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailProperty(p)}>
                <TableCell>
                  <p className="font-bold">{p.name}</p>
                  {p.address && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {p.address}
                      </p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver en Google Maps"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 text-primary/50 hover:text-primary transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs">{p.type}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{p.usage}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(p.status)}
                    {getPropertyRisk(p.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {(p.owners || []).map((o, idx) => (
                      <div key={idx} className="flex items-center gap-2 group/owner">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full w-fit">
                          {o.name} ({o.percentage}%)
                        </span>
                        {o.email && (
                          <button 
                            onClick={() => handleOpenInviteDialog(o)}
                            className="text-primary opacity-0 group-hover/owner:opacity-100 transition-opacity"
                            title="Enviar Invitación"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    {(p.status === 'Disponible' || p.status === 'Reservada') && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-green-600"
                        title="Compartir propiedad"
                        onClick={() => setShareProperty(p)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Historial del inmueble" onClick={() => setTimelineProperty(p)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-indigo-600"
                      title="Referencias de mercado"
                      onClick={() => { setMarketProp(p); setMarketCity(''); setMarketNeigh(''); setMarketResult(null); }}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <ConfirmDeleteButton
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Eliminar propiedad"
                        itemName={p.name}
                        description={<p>Se eliminará la propiedad y todos sus datos asociados (no se puede deshacer).</p>}
                        blockedReason={getDeleteBlocker(p)}
                        onConfirm={() => handleDelete(p.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProperties.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Building2}
                    title={searchTerm ? 'Sin resultados' : 'No hay propiedades cargadas'}
                    description={searchTerm ? `No se encontraron propiedades para "${searchTerm}".` : 'Agregá tu primera propiedad para empezar a gestionar contratos y facturas.'}
                    action={!searchTerm ? { label: 'Nueva Propiedad', onClick: () => setIsDialogOpen(true), icon: PlusCircle } : undefined}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Dialog: Historial del inmueble */}
      <Dialog open={!!timelineProperty} onOpenChange={open => { if (!open) setTimelineProperty(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Historial — {timelineProperty?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mensajes, facturas, mora y ajustes registrados para este inmueble.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 mt-2">
            {timelineProperty && userId && (
              <PropertyTimeline propertyId={timelineProperty.id} adminId={userId} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Referencias de mercado ── */}
      <Dialog open={!!marketProp} onOpenChange={o => !o && setMarketProp(null)}>
        <DialogContent className="max-w-lg">
          {marketProp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Referencias de Mercado — {marketProp.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Datos pre-cargados */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3">
                  <div><span className="text-muted-foreground">Tipo:</span> <strong>{marketProp.type}</strong></div>
                  <div><span className="text-muted-foreground">Amb.:</span> <strong>{marketProp.rooms ?? '—'}</strong></div>
                </div>

                {/* Inputs de búsqueda */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Ciudad</label>
                    <Input
                      placeholder="Ej: Buenos Aires"
                      value={marketCity}
                      onChange={e => setMarketCity(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Barrio / Zona (opcional)</label>
                    <Input
                      placeholder="Ej: Palermo"
                      value={marketNeigh}
                      onChange={e => setMarketNeigh(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <Button
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={marketLoading || !marketCity}
                  onClick={handleFetchMarket}
                >
                  {marketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  {marketLoading ? 'Consultando Zonaprop...' : 'Buscar referencias'}
                </Button>

                {/* Resultado */}
                {marketResult && (
                  <div className="space-y-3">
                    {marketResult.error ? (
                      <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{marketResult.error}</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Mínimo',  val: marketResult.min  },
                            { label: 'Máximo',  val: marketResult.max  },
                            { label: 'Promedio',val: marketResult.avg  },
                            { label: 'Mediana', val: marketResult.median},
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-indigo-50 rounded-lg p-3 text-center">
                              <p className="text-[10px] font-black text-indigo-400 uppercase">{label}</p>
                              <p className="text-lg font-black text-indigo-700">
                                $ {val?.toLocaleString('es-AR') ?? '—'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {marketResult.listings && marketResult.listings.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-muted-foreground uppercase">
                              Listados encontrados ({marketResult.priceCount})
                            </p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {marketResult.listings.map((l, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1 truncate">{l}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <p className="text-[9px] text-muted-foreground">
                            Fuente: {marketResult.source} · {marketResult.fetchedAt ? new Date(marketResult.fetchedAt).toLocaleTimeString('es-AR') : ''}
                          </p>
                          {marketResult.zonapropUrl && (
                            <a
                              href={marketResult.zonapropUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-indigo-600 flex items-center gap-0.5 font-bold hover:underline"
                            >
                              Ver en Zonaprop <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Compartir propiedad ────────────────────────────────── */}
      <Dialog open={!!shareProperty} onOpenChange={o => !o && setShareProperty(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
          {shareProperty && (() => {
            const applyLink  = getApplyLink(shareProperty);
            const waText     = getWhatsAppText(shareProperty);
            const socialTxt  = getSocialText(shareProperty);
            const linkedinTxt = getLinkedInText(shareProperty);
            const twitterTxt = getTwitterText(shareProperty);
            const telegramTxt = getTelegramText(shareProperty);
            const waUrl      = `https://wa.me/?text=${encodeURIComponent(waText)}`;

            const CopyBtn = ({ text, k, label }: { text: string; k: string; label: string }) => (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                onClick={() => copyToClipboard(text, k)}>
                {copiedKey === k
                  ? <><CheckCheck className="h-3.5 w-3.5 text-green-600" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5" /> {label}</>}
              </Button>
            );

            const NETWORKS = [
              {
                key: 'wa',
                label: 'WhatsApp',
                text: waText,
                hint: 'Negritas con *asteriscos*. Funciona en grupos, contactos y estado.',
                extra: (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-green-700 border-green-200 hover:bg-green-50">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir WhatsApp
                    </Button>
                  </a>
                ),
              },
              {
                key: 'ig',
                label: 'Instagram · Facebook',
                text: socialTxt,
                hint: 'Caption con hashtags. Pegalo junto a las fotos de la propiedad.',
              },
              {
                key: 'li',
                label: 'LinkedIn',
                text: linkedinTxt,
                hint: 'Tono profesional sin emojis. Ideal para locales, oficinas o propietarios con red de contactos.',
              },
              {
                key: 'tw',
                label: 'X · Twitter',
                text: twitterTxt,
                hint: `${twitterTxt.length}/280 caracteres.`,
                charCount: twitterTxt.length,
              },
              {
                key: 'tg',
                label: 'Telegram',
                text: telegramTxt,
                hint: 'Formato HTML (<b> y <a>). Pegalo en canales o grupos de Telegram.',
              },
            ];

            return (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-primary" />
                    Compartir — {shareProperty.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {shareProperty.status === 'Disponible'
                      ? 'Propiedad vacante · publicá y recibí consultas de candidatos.'
                      : 'Propiedad reservada · compartí para confirmar interesados.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1">

                  {/* Link de consulta */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-black tracking-[0.15em] uppercase text-muted-foreground flex items-center gap-1.5">
                      <Link2 className="h-3 w-3" /> Link de consulta
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                      <span className="flex-1 text-[12px] text-muted-foreground truncate font-mono">{applyLink}</span>
                      <CopyBtn text={applyLink} k="link" label="Copiar" />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      El candidato completa nombre, email, ingresos y garantía. Vos recibís la solicitud en el panel de onboarding con análisis de IA.
                    </p>
                  </div>

                  <hr className="border-border" />

                  {/* Redes sociales */}
                  <Tabs defaultValue="wa">
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      {NETWORKS.map(n => (
                        <TabsTrigger key={n.key} value={n.key} className="text-[11px] h-7 px-3">
                          {n.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {NETWORKS.map(n => (
                      <TabsContent key={n.key} value={n.key} className="space-y-2 mt-3">
                        <pre className="text-[11.5px] leading-[1.55] whitespace-pre-wrap bg-muted/30 border border-border rounded-lg p-3 max-h-48 overflow-y-auto font-sans">
                          {n.text}
                        </pre>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground leading-snug flex-1">{n.hint}</p>
                          <div className="flex gap-2 flex-shrink-0">
                            {n.extra}
                            <CopyBtn text={n.text} k={n.key} label="Copiar" />
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
