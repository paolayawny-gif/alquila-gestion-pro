"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  Phone, 
  Mail, 
  ShieldCheck,
  Upload,
  Plus,
  FileDown,
  Landmark,
  FileText,
  Calculator,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
  MessageSquareShare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, PersonType, Currency, AdjustmentMechanism } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';
import { extractContractData, ExtractContractDataOutput } from '@/ai/flows/extract-contract-data-flow';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { useFirestore } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface TenantsViewProps {
  people: Person[];
  userId?: string;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

export function TenantsView({ people, userId, contracts, setContracts, properties }: TenantsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'contracts' | 'people'>('contracts');
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [invitingPerson, setInvitingPerson] = useState<Person | null>(null);

  // AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isDraftingInvite, setIsDraftingInvite] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractContractDataOutput | null>(null);
  const [invitationDraft, setInvitationDraft] = useState<AiCommunicationAssistantOutput | null>(null);

  // ESTADO PARA NUEVA PERSONA
  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    type: 'Inquilino',
    email: '',
    phone: '',
    bankDetails: { bank: '', cbu: '', alias: '' }
  });

  // ESTADO PARA NUEVO CONTRATO
  const [contractFormData, setContractFormData] = useState<Partial<Contract>>({
    tenantId: '',
    propertyId: '',
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
    lateFeeType: 'DailyPercentage',
    lateFeeValue: 0.5,
    status: 'Vigente',
    guarantorIds: [],
    ownerIds: [],
    documents: { mainContractUrl: '', versions: [], annexes: [] }
  });

  const getStatusBadge = (status: Contract['status']) => {
    const styles = {
      'Vigente': 'bg-green-100 text-green-700 border-green-200',
      'Próximo a Vencer': 'bg-orange-100 text-orange-700 border-orange-200',
      'Finalizado': 'bg-gray-100 text-gray-700 border-gray-200',
      'Rescindido': 'bg-red-100 text-red-700 border-red-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleOpenPersonDialog = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setPersonFormData(person);
    } else {
      setEditingPerson(null);
      setPersonFormData({
        fullName: '',
        taxId: '',
        type: 'Inquilino',
        email: '',
        phone: '',
        bankDetails: { bank: '', cbu: '', alias: '' }
      });
    }
    setIsPersonDialogOpen(true);
  };

  const handleOpenInviteDialog = async (person: Person) => {
    setInvitingPerson(person);
    setIsInviteDialogOpen(true);
    setInvitationDraft(null);
    setIsDraftingInvite(true);
    
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const draft = await aiCommunicationAssistant({
        communicationType: 'portalInvitation',
        tenantName: person.fullName,
        role: person.type,
        portalUrl: origin,
        additionalContext: `Es ${person.type} de una unidad. Debe registrarse con este email: ${person.email}`
      });
      setInvitationDraft(draft);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo redactar la invitación.", variant: "destructive" });
    } finally {
      setIsDraftingInvite(false);
    }
  };

  const handleSendInvitation = () => {
    if (!invitingPerson || !userId || !db) return;
    
    // Simular envío de email
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', invitingPerson.id);
    setDocumentNonBlocking(docRef, { lastInvitationSent: new Date().toLocaleDateString('es-AR') }, { merge: true });
    
    toast({ title: "Invitación Enviada", description: `Se ha enviado el acceso a ${invitingPerson.email}` });
    setIsInviteDialogOpen(false);
  };

  const handleSavePerson = () => {
    if (!personFormData.fullName || !personFormData.taxId || !userId || !db) {
      toast({ title: "Error", description: "Nombre y CUIT/DNI son obligatorios", variant: "destructive" });
      return;
    }

    const docId = editingPerson?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', docId);

    const personData: Person = {
      ...personFormData,
      id: docId,
      ownerId: userId,
      documents: personFormData.documents || []
    } as Person;

    setDocumentNonBlocking(docRef, personData, { merge: true });
    
    toast({ 
      title: editingPerson ? "Persona actualizada" : "Persona creada", 
      description: `${personFormData.fullName} se ha guardado.` 
    });
    
    setIsPersonDialogOpen(false);
  };

  const handleSaveContract = () => {
    if (!contractFormData.tenantId || !contractFormData.propertyId || !contractFormData.baseRentAmount || !userId) {
      toast({ title: "Error", description: "Complete los campos obligatorios.", variant: "destructive" });
      return;
    }

    const tenant = people.find(p => p.id === contractFormData.tenantId);
    const property = properties.find(p => p.id === contractFormData.propertyId);

    const newContract = {
      ...contractFormData,
      id: editingContract?.id || Math.random().toString(36).substr(2, 9),
      tenantName: tenant?.fullName,
      propertyName: property?.name,
      currentRentAmount: contractFormData.baseRentAmount,
      ownerId: userId,
      documents: contractFormData.documents || { mainContractUrl: '', versions: [], annexes: [] }
    } as Contract;

    if (editingContract) {
      setContracts(contracts.map(c => c.id === editingContract.id ? newContract : c));
    } else {
      setContracts([...contracts, newContract]);
    }
    
    toast({ title: "Contrato Guardado", description: "Registro actualizado exitosamente." });
    setIsContractDialogOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result as string;
      setIsAiProcessing(true);
      try {
        const result = await extractContractData({ documentDataUri: dataUri });
        setAiResult(result);
        toast({ title: "Análisis Completo", description: "La IA ha extraído las cláusulas del archivo." });
      } catch (error) {
        toast({ title: "Error de Análisis", description: "No se pudieron extraer los datos.", variant: "destructive" });
      } finally {
        setIsAiProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const normalizeText = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]/g, '');
  };

  const applyAiData = () => {
    if (!aiResult) return;

    setContractFormData(prev => {
      const updated = { ...prev };
      updated.baseRentAmount = aiResult.baseRentAmount;
      updated.currency = aiResult.currency;
      updated.adjustmentFrequencyMonths = aiResult.adjustmentFrequencyMonths;
      updated.adjustmentMechanism = aiResult.adjustmentMechanism;
      updated.currentRentAmount = aiResult.baseRentAmount;
      if (aiResult.startDate) updated.startDate = aiResult.startDate;
      if (aiResult.endDate) updated.endDate = aiResult.endDate;

      if (aiResult.tenantName) {
        const norm = normalizeText(aiResult.tenantName);
        const match = people.find(p => p.type === 'Inquilino' && normalizeText(p.fullName).includes(norm));
        if (match) updated.tenantId = match.id;
      }

      if (aiResult.propertyAddress) {
        const norm = normalizeText(aiResult.propertyAddress);
        const match = properties.find(p => normalizeText(p.address).includes(norm));
        if (match) updated.propertyId = match.id;
      }

      updated.documents = { ...prev.documents!, mainContractUrl: 'ai_processed' };
      return updated;
    });

    setAiResult(null);
    toast({ title: "Autocompletado", description: "Datos aplicados correctamente." });
  };

  const handleDeletePerson = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Persona eliminada", description: "El registro ha sido removido de la nube." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="bg-white border shadow-sm p-1 rounded-lg">
          <TabsList className="bg-transparent">
            <TabsTrigger value="contracts" className="data-[state=active]:bg-primary data-[state=active]:text-white">Contratos</TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-primary data-[state=active]:text-white">Personas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 bg-white" />
          </div>
          
          {activeTab === 'contracts' ? (
            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenContractDialog()}>
                  <Plus className="h-4 w-4" /> Nuevo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContract ? 'Editar Contrato' : 'Alta de Contrato'}</DialogTitle>
                  <DialogDescription>Configure los términos de la locación.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                    <TabsTrigger value="general">Datos Generales</TabsTrigger>
                    <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
                    <TabsTrigger value="documents">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Propiedad</Label>
                        <Select value={contractFormData.propertyId || ""} onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}>
                          <SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger>
                          <SelectContent>
                            {properties.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.address})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Inquilino Principal</Label>
                        <Select value={contractFormData.tenantId || ""} onValueChange={(v) => setContractFormData({...contractFormData, tenantId: v})}>
                          <SelectTrigger><SelectValue placeholder="Seleccione persona..." /></SelectTrigger>
                          <SelectContent>
                            {people.filter(p => p.type === 'Inquilino').map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Inicio</Label>
                        <Input type="date" value={contractFormData.startDate || ""} onChange={(e) => setContractFormData({...contractFormData, startDate: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Fin</Label>
                        <Input type="date" value={contractFormData.endDate || ""} onChange={(e) => setContractFormData({...contractFormData, endDate: e.target.value})} />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="economic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Monto Alquiler Inicial</Label>
                        <Input type="number" value={contractFormData.baseRentAmount} onChange={(e) => setContractFormData({...contractFormData, baseRentAmount: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={contractFormData.currency} onValueChange={(v: Currency) => setContractFormData({...contractFormData, currency: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                            <SelectItem value="USD">Dólares (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frecuencia Ajuste (Meses)</Label>
                        <Input type="number" value={contractFormData.adjustmentFrequencyMonths} onChange={(e) => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6 pt-4">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                    {!aiResult && !isAiProcessing && (
                      <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-lg p-8 text-center space-y-3 hover:bg-muted/50 cursor-pointer border-muted-foreground/20">
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="text-sm font-bold">Subir Contrato y Analizar con IA</p>
                      </div>
                    )}
                    {isAiProcessing && <Loader2 className="h-10 w-10 mx-auto animate-spin" />}
                    {aiResult && (
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                        <p className="text-sm font-bold">Datos Detectados por IA:</p>
                        <p className="text-xs">{aiResult.summary}</p>
                        <Button className="w-full" onClick={applyAiData}>Confirmar y Autocompletar</Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-8 border-t pt-4">
                  <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-primary text-white" onClick={handleSaveContract}>Guardar Contrato</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenPersonDialog()}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isPersonDialogOpen} onOpenChange={setIsPersonDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Editar Persona' : 'Alta de Persona'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={personFormData.fullName} onChange={e => setPersonFormData({...personFormData, fullName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>CUIT / DNI</Label>
              <Input value={personFormData.taxId} onChange={e => setPersonFormData({...personFormData, taxId: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input value={personFormData.email} onChange={e => setPersonFormData({...personFormData, email: e.target.value})} placeholder="ejemplo@correo.com" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={personFormData.phone} onChange={e => setPersonFormData({...personFormData, phone: e.target.value})} placeholder="+54 9 11..." />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Rol</Label>
              <Select value={personFormData.type} onValueChange={(v: PersonType) => setPersonFormData({...personFormData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inquilino">Inquilino</SelectItem>
                  <SelectItem value="Propietario">Propietario</SelectItem>
                  <SelectItem value="Garante">Garante</SelectItem>
                  <SelectItem value="Proveedor">Proveedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsPersonDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white" onClick={handleSavePerson}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Enviar Invitación al Portal
            </DialogTitle>
            <DialogDescription>
              La IA redactará una invitación personalizada para {invitingPerson?.fullName}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            {isDraftingInvite ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Redactando invitación profesional...</p>
              </div>
            ) : invitationDraft ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Asunto</Label>
                  <p className="font-bold text-sm">{invitationDraft.subjectLine}</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm whitespace-pre-wrap leading-relaxed min-h-[200px]">
                  {invitationDraft.draftedMessage}
                </div>
                <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3 border border-blue-100">
                  <Mail className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-[10px] text-blue-700 font-medium">
                    El correo se enviará a <strong>{invitingPerson?.email}</strong>. 
                    Asegúrate de que esta sea la dirección que el usuario usará para registrarse.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No se pudo generar el borrador.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-primary text-white gap-2 font-bold px-8" 
              onClick={handleSendInvitation}
              disabled={isDraftingInvite || !invitationDraft}
            >
              <Send className="h-4 w-4" /> Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
           <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Contrato e Inquilino</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Alquiler Actual</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.tenantName}</TableCell>
                  <TableCell className="text-sm">{c.propertyName}</TableCell>
                  <TableCell className="text-xs">{c.startDate} al {c.endDate}</TableCell>
                  <TableCell>{getStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right font-black text-primary">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenContractDialog(c)}><Edit2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8">No hay contratos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nombre y CUIT</TableHead>
                <TableHead>Rol / Acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.fullName}<br/><span className="text-[10px] text-muted-foreground font-normal">{p.taxId}</span></TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">{p.type}</Badge>
                      {p.email && <span className="text-[9px] text-muted-foreground">{p.email}</span>}
                      {(p as any).lastInvitationSent && (
                        <span className="text-[8px] text-green-600 font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="h-2 w-2" /> Invitado: {(p as any).lastInvitationSent}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.email && p.type !== 'Garante' && p.type !== 'Proveedor' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-primary hover:bg-primary/10" 
                          title="Invitar al Portal"
                          onClick={() => handleOpenInviteDialog(p)}
                        >
                          <MessageSquareShare className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPersonDialog(p)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePerson(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {people.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8">No hay personas cargadas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

