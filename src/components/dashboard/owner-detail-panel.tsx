"use client";

import React, { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Person, Property, Contract, Invoice, Liquidation, MaintenanceTask, LegalCase,
} from '@/lib/types';
import { ContractDetailPanel } from './contract-detail-panel';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { cn } from '@/lib/utils';
import {
  User, Building2, FileText, Edit2, Save, X, Plus, ChevronRight,
  Phone, Mail, CreditCard, MapPin, Landmark, Home,
} from 'lucide-react';

const APP_ID = "alquilagestion-pro";

interface OwnerDetailPanelProps {
  person: Person;
  people: Person[];
  properties: Property[];
  contracts: Contract[];
  invoices: Invoice[];
  liquidations: Liquidation[];
  tasks: MaintenanceTask[];
  legalCases: LegalCase[];
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function OwnerDetailPanel({
  person, people, properties, contracts, invoices, liquidations, tasks, legalCases,
  userId, open, onClose,
}: OwnerDetailPanelProps) {
  const { toast } = useToast();
  const db = useFirestore();

  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [personForm, setPersonForm] = useState<Partial<Person>>({ ...person });

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Property creation
  const [isPropDialogOpen, setIsPropDialogOpen] = useState(false);
  const [propForm, setPropForm] = useState<Partial<Property>>({});

  // Contract creation
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractForm, setContractForm] = useState<Partial<Contract>>({});

  // Derived data
  const ownerProperties = properties.filter(p =>
    p.owners?.some(o => o.ownerId === person.id)
  );
  const ownerContracts = contracts.filter(c =>
    c.ownerIds?.includes(person.id)
  );
  const pendingInvoices = invoices.filter(i =>
    ownerContracts.some(c => c.id === i.contractId) &&
    (i.status === 'Pendiente' || i.status === 'Vencido')
  );
  const totalRent = ownerContracts
    .filter(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer')
    .reduce((s, c) => s + c.currentRentAmount, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSavePerson = () => {
    if (!db || !userId) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', person.id);
    setDocumentNonBlocking(ref, { ...personForm }, { merge: true });
    setIsEditingPerson(false);
    toast({ title: 'Datos actualizados correctamente.' });
  };

  const openPropDialog = () => {
    setPropForm({
      name: '', address: '', type: 'Departamento', usage: 'Vivienda',
      status: 'Disponible', squareMeters: undefined, rooms: undefined,
      amenities: [], photos: [],
      owners: [{ name: person.fullName, email: person.email ?? '', percentage: 100, ownerId: person.id }],
    });
    setIsPropDialogOpen(true);
  };

  const handleSaveProperty = () => {
    if (!db || !userId) return;
    if (!propForm.name?.trim() || !propForm.address?.trim()) {
      toast({ title: 'Completá nombre y dirección', variant: 'destructive' });
      return;
    }
    const docId = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', docId);
    setDocumentNonBlocking(ref, {
      ...propForm,
      id: docId,
      ownerId: userId,
      amenities: propForm.amenities ?? [],
      photos: propForm.photos ?? [],
    }, { merge: false });
    setIsPropDialogOpen(false);
    toast({ title: 'Inmueble creado', description: propForm.name });
  };

  const openContractDialog = () => {
    const firstProp = ownerProperties[0];
    setContractForm({
      tenantId: '',
      propertyId: firstProp?.id ?? '',
      propertyName: firstProp?.name ?? '',
      ownerIds: [person.id],
      guarantorIds: [],
      startDate: '',
      endDate: '',
      baseRentAmount: 0,
      currentRentAmount: 0,
      currency: 'ARS',
      adjustmentType: 'Index',
      adjustmentMechanism: 'ICL',
      adjustmentFrequencyMonths: 4,
      depositAmount: 0,
      depositCurrency: 'ARS',
      commissionAmount: 0,
      paymentPeriodDays: 10,
      status: 'Vigente',
      documents: { mainContractUrl: '', versions: [], annexes: [] },
    });
    setIsContractDialogOpen(true);
  };

  const handleSaveContract = () => {
    if (!db || !userId) return;
    if (!contractForm.tenantId || !contractForm.propertyId || !contractForm.startDate || !contractForm.endDate) {
      toast({ title: 'Completá inquilino, inmueble y fechas', variant: 'destructive' });
      return;
    }
    const tenant = people.find(p => p.id === contractForm.tenantId);
    const property = properties.find(p => p.id === contractForm.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', docId);
    setDocumentNonBlocking(ref, {
      ...contractForm,
      id: docId,
      ownerId: userId,
      tenantName: tenant?.fullName ?? '',
      tenantEmail: tenant?.email ?? '',
      propertyName: property?.name ?? '',
    }, { merge: false });
    setIsContractDialogOpen(false);
    toast({ title: 'Contrato creado', description: `${tenant?.fullName} · ${property?.name}` });
  };

  // ── Sub-components ─────────────────────────────────────────────────────────

  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  );

  const contractStatusColor: Record<string, string> = {
    'Vigente': 'bg-green-50 text-green-700 border-green-200',
    'Próximo a Vencer': 'bg-amber-50 text-amber-700 border-amber-200',
    'Finalizado': 'bg-slate-50 text-slate-500 border-slate-200',
    'Borrador': 'bg-blue-50 text-blue-700 border-blue-200',
    'Rescindido': 'bg-red-50 text-red-700 border-red-200',
  };
  const propertyStatusColor: Record<string, string> = {
    'Disponible': 'bg-green-50 text-green-700 border-green-200',
    'Alquilada': 'bg-blue-50 text-blue-700 border-blue-200',
    'Reservada': 'bg-amber-50 text-amber-700 border-amber-200',
    'En Mantenimiento': 'bg-orange-50 text-orange-700 border-orange-200',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="p-6 border-b bg-muted/5 shrink-0">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center font-black text-primary text-xl shrink-0">
                {person.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black">{person.fullName}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {person.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{person.email}</span>
                  )}
                  {person.phone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{person.phone}</span>
                  )}
                  {person.taxId && (
                    <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />CUIT: {person.taxId}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-background border p-3 text-center">
                <p className="text-2xl font-black">{ownerProperties.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Inmuebles</p>
              </div>
              <div className="rounded-xl bg-background border p-3 text-center">
                <p className="text-2xl font-black">{ownerContracts.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Contratos</p>
              </div>
              <div className="rounded-xl bg-background border p-3 text-center">
                <p className="text-lg font-black text-primary">
                  {totalRent > 0 ? `$${(totalRent / 1000).toFixed(0)}k` : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Renta/mes</p>
              </div>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────────── */}
          <Tabs defaultValue="datos" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 w-auto justify-start h-9 bg-muted/50 shrink-0">
              <TabsTrigger value="datos" className="text-xs gap-1.5">
                <User className="h-3.5 w-3.5" />Datos
              </TabsTrigger>
              <TabsTrigger value="inmuebles" className="text-xs gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Inmuebles{ownerProperties.length > 0 ? ` (${ownerProperties.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="contratos" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Contratos{ownerContracts.length > 0 ? ` (${ownerContracts.length})` : ''}
              </TabsTrigger>
            </TabsList>

            {/* ── DATOS ─────────────────────────────────────────────────── */}
            <TabsContent value="datos" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm">Datos personales</h3>
                {!isEditingPerson ? (
                  <Button variant="outline" size="sm" onClick={() => { setPersonForm({ ...person }); setIsEditingPerson(true); }}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" />Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingPerson(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSavePerson}>
                      <Save className="h-3.5 w-3.5 mr-1.5" />Guardar
                    </Button>
                  </div>
                )}
              </div>

              {isEditingPerson ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Nombre completo *</Label>
                      <Input className="mt-1" value={personForm.fullName ?? ''} onChange={e => setPersonForm(p => ({ ...p, fullName: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">CUIT / CUIL</Label>
                      <Input className="mt-1" value={personForm.taxId ?? ''} onChange={e => setPersonForm(p => ({ ...p, taxId: e.target.value }))} placeholder="20-XXXXXXXX-X" />
                    </div>
                    <div>
                      <Label className="text-xs">Teléfono</Label>
                      <Input className="mt-1" value={personForm.phone ?? ''} onChange={e => setPersonForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Email</Label>
                      <Input className="mt-1" type="email" value={personForm.email ?? ''} onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Domicilio</Label>
                      <Input className="mt-1" value={personForm.address ?? ''} onChange={e => setPersonForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-xs font-bold mb-3">Datos bancarios</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Banco</Label>
                        <Input
                          className="mt-1"
                          value={personForm.bankDetails?.bank ?? ''}
                          onChange={e => setPersonForm(p => ({
                            ...p,
                            bankDetails: { bank: e.target.value, cbu: p.bankDetails?.cbu ?? '', alias: p.bankDetails?.alias ?? '' },
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CBU</Label>
                        <Input
                          className="mt-1"
                          value={personForm.bankDetails?.cbu ?? ''}
                          onChange={e => setPersonForm(p => ({
                            ...p,
                            bankDetails: { bank: p.bankDetails?.bank ?? '', cbu: e.target.value, alias: p.bankDetails?.alias ?? '' },
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Alias</Label>
                        <Input
                          className="mt-1"
                          value={personForm.bankDetails?.alias ?? ''}
                          onChange={e => setPersonForm(p => ({
                            ...p,
                            bankDetails: { bank: p.bankDetails?.bank ?? '', cbu: p.bankDetails?.cbu ?? '', alias: e.target.value },
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <InfoRow icon={CreditCard} label="CUIT / CUIL" value={person.taxId} />
                  <InfoRow icon={Mail} label="Email" value={person.email} />
                  <InfoRow icon={Phone} label="Teléfono" value={person.phone} />
                  <InfoRow icon={MapPin} label="Domicilio" value={person.address} />
                  {(person.bankDetails?.cbu || person.bankDetails?.bank) && (
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground">Datos bancarios</p>
                      </div>
                      <div className="text-sm space-y-0.5">
                        {person.bankDetails.bank && <p className="font-medium">{person.bankDetails.bank}</p>}
                        {person.bankDetails.cbu && <p className="text-xs text-muted-foreground">CBU: {person.bankDetails.cbu}</p>}
                        {person.bankDetails.alias && <p className="text-xs text-muted-foreground">Alias: {person.bankDetails.alias}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── INMUEBLES ─────────────────────────────────────────────── */}
            <TabsContent value="inmuebles" className="flex-1 overflow-y-auto mt-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm">Inmuebles vinculados</h3>
                  <Button size="sm" onClick={openPropDialog}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar inmueble
                  </Button>
                </div>

                {ownerProperties.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Home className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-semibold">Sin inmuebles vinculados</p>
                    <p className="text-xs mt-1">
                      Agregá un inmueble nuevo o vinculá uno existente desde<br />
                      "Inmuebles" asignando este propietario.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ownerProperties.map(p => {
                      const propContracts = ownerContracts.filter(c => c.propertyId === p.id);
                      return (
                        <div key={p.id} className="border rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm">{p.name}</p>
                                <Badge className={cn('border text-[9px] font-bold', propertyStatusColor[p.status] ?? 'bg-muted')}>
                                  {p.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.address}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {p.type}
                                {p.rooms ? ` · ${p.rooms} amb.` : ''}
                                {p.squareMeters ? ` · ${p.squareMeters}m²` : ''}
                              </p>
                              {propContracts.length > 0 && (
                                <p className="text-[10px] text-primary font-bold mt-1">
                                  {propContracts.length} contrato{propContracts.length !== 1 ? 's' : ''} vinculado{propContracts.length !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── CONTRATOS ─────────────────────────────────────────────── */}
            <TabsContent value="contratos" className="flex-1 overflow-y-auto mt-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm">Contratos vinculados</h3>
                  <div className="flex items-center gap-2">
                    {pendingInvoices.length > 0 && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 font-bold">
                        {pendingInvoices.length} fact. pendientes
                      </span>
                    )}
                    <Button size="sm" onClick={openContractDialog}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Nuevo contrato
                    </Button>
                  </div>
                </div>

                {ownerContracts.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-semibold">Sin contratos vinculados</p>
                    <p className="text-xs mt-1">
                      Creá un contrato nuevo o asigná este propietario<br />
                      en un contrato existente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ownerContracts.map(c => {
                      const cInvoices = invoices.filter(i => i.contractId === c.id);
                      const cPending = cInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
                      const daysLeft = Math.round(
                        (new Date(c.endDate).getTime() - Date.now()) / 86_400_000
                      );
                      return (
                        <button
                          key={c.id}
                          className="w-full border rounded-xl p-4 hover:bg-muted/10 transition-colors text-left"
                          onClick={() => setSelectedContract(c)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm">{c.tenantName ?? '—'}</p>
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wide">
                                  {c.propertyName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                <span>{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}/mes</span>
                                <span>·</span>
                                <span>Vence: {new Date(c.endDate).toLocaleDateString('es-AR')}</span>
                                {daysLeft >= 0 && daysLeft <= 60 && (
                                  <span className={cn('font-black', daysLeft <= 30 ? 'text-red-600' : 'text-amber-600')}>
                                    ({daysLeft}d restantes)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {cPending.length > 0 && (
                                <span className="h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black flex items-center border border-amber-200">
                                  {cPending.length} pend.
                                </span>
                              )}
                              <Badge className={cn('border text-[9px] font-bold', contractStatusColor[c.status] ?? 'bg-muted text-muted-foreground border-border')}>
                                {c.status}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: nuevo inmueble ──────────────────────────────────────────── */}
      <Dialog open={isPropDialogOpen} onOpenChange={setIsPropDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo inmueble — {person.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nombre del inmueble *</Label>
              <Input
                className="mt-1"
                placeholder="Ej: Depto. Palermo 2B"
                value={propForm.name ?? ''}
                onChange={e => setPropForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Dirección *</Label>
              <AddressAutocomplete
                value={propForm.address ?? ''}
                onChange={v => setPropForm(p => ({ ...p, address: v }))}
                placeholder="Calle y número, ciudad"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={propForm.type ?? 'Departamento'} onValueChange={v => setPropForm(p => ({ ...p, type: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Departamento', 'Casa', 'Local', 'Cochera', 'Oficina', 'Depósito', 'Terreno'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Uso</Label>
                <Select value={propForm.usage ?? 'Vivienda'} onValueChange={v => setPropForm(p => ({ ...p, usage: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Vivienda', 'Comercial', 'Profesional', 'Industrial'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={propForm.status ?? 'Disponible'} onValueChange={v => setPropForm(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Disponible', 'Reservada', 'Alquilada', 'En Mantenimiento'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ambientes</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={propForm.rooms ?? ''}
                  onChange={e => setPropForm(p => ({ ...p, rooms: Number(e.target.value) || undefined }))}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Superficie (m²)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={propForm.squareMeters ?? ''}
                  onChange={e => setPropForm(p => ({ ...p, squareMeters: Number(e.target.value) || undefined }))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPropDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProperty}>Crear inmueble</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: nuevo contrato ─────────────────────────────────────────── */}
      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo contrato — {person.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Inquilino *</Label>
              <Select value={contractForm.tenantId ?? ''} onValueChange={v => {
                const t = people.find(p => p.id === v);
                setContractForm(f => ({ ...f, tenantId: v, tenantName: t?.fullName, tenantEmail: t?.email }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar inquilino" /></SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.type === 'Inquilino').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Inmueble *</Label>
              <Select value={contractForm.propertyId ?? ''} onValueChange={v => {
                const prop = properties.find(p => p.id === v);
                setContractForm(f => ({ ...f, propertyId: v, propertyName: prop?.name }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar inmueble" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fecha inicio *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={contractForm.startDate ?? ''}
                  onChange={e => setContractForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Fecha fin *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={contractForm.endDate ?? ''}
                  onChange={e => setContractForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Moneda</Label>
                <Select value={contractForm.currency ?? 'ARS'} onValueChange={v => setContractForm(f => ({ ...f, currency: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="UVA">UVA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Alquiler base</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={contractForm.baseRentAmount ?? ''}
                  onChange={e => setContractForm(f => ({
                    ...f,
                    baseRentAmount: Number(e.target.value),
                    currentRentAmount: Number(e.target.value),
                  }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Ajuste</Label>
                <Select value={contractForm.adjustmentMechanism ?? 'ICL'} onValueChange={v => setContractForm(f => ({ ...f, adjustmentMechanism: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICL">ICL (BCRA)</SelectItem>
                    <SelectItem value="IPC">IPC (INDEC)</SelectItem>
                    <SelectItem value="CER">CER</SelectItem>
                    <SelectItem value="Fixed">Fijo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Frecuencia (meses)</Label>
                <Select
                  value={String(contractForm.adjustmentFrequencyMonths ?? 4)}
                  onValueChange={v => setContractForm(f => ({ ...f, adjustmentFrequencyMonths: Number(v) }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'mes' : 'meses'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Depósito</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={contractForm.depositAmount ?? ''}
                  onChange={e => setContractForm(f => ({ ...f, depositAmount: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={contractForm.status ?? 'Vigente'} onValueChange={v => setContractForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vigente">Vigente</SelectItem>
                    <SelectItem value="Borrador">Borrador</SelectItem>
                    <SelectItem value="Próximo a Vencer">Próximo a Vencer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveContract}>Crear contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ContractDetailPanel anidado ──────────────────────────────────────── */}
      {selectedContract && (
        <ContractDetailPanel
          contract={selectedContract}
          people={people}
          properties={properties}
          invoices={invoices}
          liquidations={liquidations}
          tasks={tasks}
          legalCases={legalCases}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </>
  );
}
