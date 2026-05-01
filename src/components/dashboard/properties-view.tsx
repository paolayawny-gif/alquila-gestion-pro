
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Search, Landmark, X, PlusCircle, Sparkles, Loader2, Send, MessageSquare, Building2, Users, Wrench, TrendingUp, LayoutGrid, List, MapPin, Globe, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, PropertyStatus, PropertyOwner, PropertyManual } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';

interface PropertiesViewProps {
  properties: Property[];
  userId?: string;
}

const APP_ID = "alquilagestion-pro";

export function PropertiesView({ properties, userId }: PropertiesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'maintenance'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  
  const [invitingOwner, setInvitingOwner] = useState<{name: string, email: string} | null>(null);
  const [isDraftingInvite, setIsDraftingInvite] = useState(false);
  const [invitationDraft, setInvitationDraft] = useState<AiCommunicationAssistantOutput | null>(null);

  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    address: '',
    type: 'Departamento',
    usage: 'Vivienda',
    status: 'Disponible',
    squareMeters: 0,
    rooms: 0,
    amenities: [],
    internalNotes: '',
    owners: [{ name: '', email: '', percentage: 100 }]
  });

  const tabFilteredProperties = useMemo(() => {
    let base = properties;
    if (activeTab === 'available') base = properties.filter(p => p.status === 'Disponible' || p.status === 'Reservada');
    if (activeTab === 'maintenance') base = properties.filter(p => p.status === 'En Mantenimiento');
    return base.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleOpenDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData(property);
    } else {
      setEditingProperty(null);
      setFormData({
        name: '',
        address: '',
        type: 'Departamento',
        usage: 'Vivienda',
        status: 'Disponible',
        squareMeters: 0,
        rooms: 0,
        amenities: [],
        internalNotes: '',
        owners: [{ name: '', email: '', percentage: 100 }]
      });
    }
    setIsDialogOpen(true);
  };

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
    if (!formData.name || !formData.address || !userId || !db) {
      toast({
        title: "Error",
        description: "Complete todos los campos requeridos.",
        variant: "destructive"
      });
      return;
    }

    const docId = editingProperty?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', docId);

    const propertyData: Property = {
      ...formData,
      id: docId,
      ownerId: userId,
      photos: formData.photos || [],
      amenities: formData.amenities || [],
      owners: formData.owners || []
    } as Property;

    setDocumentNonBlocking(docRef, propertyData, { merge: true });
    
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

          <Tabs defaultValue="specs" className="mt-4">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
              <TabsTrigger value="specs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Datos Técnicos</TabsTrigger>
              <TabsTrigger value="owners" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Propietarios</TabsTrigger>
              <TabsTrigger value="portal" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Portal Inquilino</TabsTrigger>
              <TabsTrigger value="extra" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Referencia</Label>
                  <Input 
                    placeholder="Ej: Las Heras 4B" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <AddressAutocomplete
                    placeholder="Calle y número"
                    value={formData.address || ''}
                    onChange={(val) => setFormData({ ...formData, address: val })}
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
                  El inquilino verá el tour en su pantalla de bienvenida. Compatible con Matterport, Google Street View, YouTube, etc.
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
              <TableRow key={p.id}>
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
                <TableCell>{getStatusBadge(p.status)}</TableCell>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProperties.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay propiedades cargadas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
