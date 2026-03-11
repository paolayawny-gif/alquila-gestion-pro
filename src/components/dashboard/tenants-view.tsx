"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  Mail, 
  Upload,
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
  MessageSquareShare,
  UserCheck,
  TrendingUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, PersonType, Currency } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { extractContractData, ExtractContractDataOutput } from '@/ai/flows/extract-contract-data-flow';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { sendEmail } from '@/services/email-service';

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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isNotifyingAdjustment, setIsNotifyingAdjustment] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ExtractContractDataOutput | null>(null);
  const [invitationDraft, setInvitationDraft] = useState<AiCommunicationAssistantOutput | null>(null);

  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    type: 'Inquilino',
    email: '',
    phone: '',
    bankDetails: { bank: '', cbu: '', alias: '' }
  });

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

  const handleNotifyAdjustment = async (contract: Contract) => {
    const tenant = people.find(p => p.id === contract.tenantId);
    if (!tenant?.email) {
      toast({ title: "Sin Email", description: "El inquilino no tiene correo registrado.", variant: "destructive" });
      return;
    }

    setIsNotifyingAdjustment(contract.id);
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseAdjustment',
        tenantName: tenant.fullName,
        propertyName: contract.propertyName,
        currentRentAmount: `$ ${contract.currentRentAmount.toLocaleString('es-AR')}`,
        newRentAmount: `$ ${(contract.currentRentAmount * 1.5).toLocaleString('es-AR')}`, // Simulación
        adjustmentIndex: contract.adjustmentMechanism || 'ICL',
        additionalContext: "Informar al inquilino sobre el aumento pactado para el mes próximo."
      });

      await sendEmail({
        to: tenant.email,
        subject: draft.subjectLine,
        html: `<div>${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });

      toast({ title: "Pre-aviso Enviado", description: `Notificación de aumento enviada a ${tenant.fullName}.` });
    } catch (e) {
      toast({ title: "Error", description: "No se pudo redactar o enviar el aviso.", variant: "destructive" });
    } finally {
      setIsNotifyingAdjustment(null);
    }
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
      console.error(e);
      toast({ title: "Error", description: "No se pudo redactar la invitación.", variant: "destructive" });
    } finally {
      setIsDraftingInvite(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!invitingPerson || !invitationDraft || !userId || !db) return;
    
    setIsSendingEmail(true);
    try {
      const emailResult = await sendEmail({
        to: invitingPerson.email,
        subject: invitationDraft.subjectLine,
        html: `<div>${invitationDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });

      if (emailResult.success) {
        const docId = invitingPerson.id;
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', docId);
        
        setDocumentNonBlocking(docRef, { 
          lastInvitationSent: new Date().toLocaleDateString('es-AR'),
          invitationStatus: 'Enviada'
        }, { merge: true });
        
        toast({ 
          title: "Invitación Despachada", 
          description: `El correo ha sido enviado exitosamente a ${invitingPerson.email}.`
        });
        setIsInviteDialogOpen(false);
      } else {
        toast({ title: "Error de envío", description: emailResult.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Ocurrió un error al intentar enviar el email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleQuickAddNicolas = () => {
    if (!userId || !db) return;
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', docId);
    
    const nicolasData: Person = {
      id: docId,
      fullName: 'Nicolas Morcillo',
      email: 'nicolasmmorcillo@gmail.com',
      taxId: '20-35000000-9',
      type: 'Inquilino',
      phone: '+54 9 11 1234-5678',
      ownerId: userId,
      documents: []
    };

    setDocumentNonBlocking(docRef, nicolasData, { merge: true });
    setActiveTab('people');
    toast({ title: "Test: Usuario Añadido", description: "Nicolas ha sido agregado a tu lista de personas." });
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
    setIsPersonDialogOpen(false);
    toast({ title: editingPerson ? "Persona actualizada" : "Persona creada", description: `${personFormData.fullName} se ha guardado.` });
  };

  const handleOpenContractDialog = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      setContractFormData(contract);
    } else {
      setEditingContract(null);
      setContractFormData({
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
    }
    setIsContractDialogOpen(true);
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

  const applyAiData = () => {
    if (!aiResult) return;
    setContractFormData(prev => ({
      ...prev,
      baseRentAmount: aiResult.baseRentAmount,
      currency: aiResult.currency,
      adjustmentFrequencyMonths: aiResult.adjustmentFrequencyMonths,
      adjustmentMechanism: aiResult.adjustmentMechanism,
      currentRentAmount: aiResult.baseRentAmount,
      startDate: aiResult.startDate || prev.startDate,
      endDate: aiResult.endDate || prev.endDate,
      documents: { ...prev.documents!, mainContractUrl: 'ai_processed' }
    }));
    setAiResult(null);
    toast({ title: "Autocompletado", description: "Datos aplicados correctamente." });
  };

  const handleDeletePerson = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
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
          <Button variant="outline" className="text-xs gap-2 border-primary text-primary" onClick={handleQuickAddNicolas}>
            <UserCheck className="h-4 w-4" /> Test: Añadir Nicolas
          </Button>
          
          {activeTab === 'contracts' ? (
            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContract ? 'Editar Contrato' : 'Alta de Contrato'}</DialogTitle>
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
                        <Select value={contractFormData.propertyId} onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}>
                          <SelectTrigger><SelectValue placeholder="Unidad..." /></SelectTrigger>
                          <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Inquilino</Label>
                        <Select value={contractFormData.tenantId} onValueChange={(v) => setContractFormData({...contractFormData, tenantId: v})}>
                          <SelectTrigger><SelectValue placeholder="Persona..." /></SelectTrigger>
                          <SelectContent>{people.filter(p => p.type === 'Inquilino').map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="documents" className="pt-4">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                    {!aiResult && !isAiProcessing && (
                      <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm">Analizar Contrato con IA</p>
                      </div>
                    )}
                    {isAiProcessing && <Loader2 className="h-8 w-8 mx-auto animate-spin" />}
                    {aiResult && (
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                        <p className="text-xs font-bold">{aiResult.summary}</p>
                        <Button className="w-full" onClick={applyAiData}>Confirmar y Autocompletar</Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6"><Button onClick={handleSaveContract}>Guardar</Button></DialogFooter>
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
          <DialogHeader><DialogTitle>{editingPerson ? 'Editar Persona' : 'Alta de Persona'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2"><Label>Nombre Completo</Label><Input value={personFormData.fullName} onChange={e => setPersonFormData({...personFormData, fullName: e.target.value})} /></div>
            <div className="space-y-2"><Label>CUIT / DNI</Label><Input value={personFormData.taxId} onChange={e => setPersonFormData({...personFormData, taxId: e.target.value})} /></div>
            <div className="space-y-2"><Label>Correo Electrónico</Label><Input value={personFormData.email} onChange={e => setPersonFormData({...personFormData, email: e.target.value})} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={personFormData.phone} onChange={e => setPersonFormData({...personFormData, phone: e.target.value})} /></div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={personFormData.type} onValueChange={(v: PersonType) => setPersonFormData({...personFormData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inquilino">Inquilino</SelectItem>
                  <SelectItem value="Propietario">Propietario</SelectItem>
                  <SelectItem value="Garante">Garante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6"><Button onClick={handleSavePerson}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Invitación con IA</DialogTitle>
            <DialogDescription>Redacción personalizada para {invitingPerson?.fullName}.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            {isDraftingInvite ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Redactando invitación...</p>
              </div>
            ) : invitationDraft ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Asunto</Label>
                  <p className="font-bold text-sm">{invitationDraft.subjectLine}</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm whitespace-pre-wrap min-h-[150px]">
                  {invitationDraft.draftedMessage}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-primary text-white gap-2 font-bold px-8" 
              onClick={handleSendInvitation} 
              disabled={isDraftingInvite || !invitationDraft || isSendingEmail}
            >
              {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSendingEmail ? "Enviando..." : "Confirmar y Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
           <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino</TableHead><TableHead>Propiedad</TableHead><TableHead>Vigencia</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Alquiler</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.tenantName}</TableCell>
                  <TableCell className="text-sm">{c.propertyName}</TableCell>
                  <TableCell className="text-xs">{c.startDate} al {c.endDate}</TableCell>
                  <TableCell>{getStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right font-black text-primary">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Notificar Próximo Ajuste"
                        className="text-primary hover:bg-primary/10"
                        disabled={isNotifyingAdjustment === c.id}
                        onClick={() => handleNotifyAdjustment(c)}
                      >
                        {isNotifyingAdjustment === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenContractDialog(c)}><Edit2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Nombre y CUIT</TableHead><TableHead>Rol / Acceso</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.fullName}<br/><span className="text-[10px] font-normal">{p.taxId}</span></TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">{p.type}</Badge>
                      <span className="text-[9px] text-muted-foreground">{p.email}</span>
                      {(p as any).lastInvitationSent && (
                        <span className="text-[8px] text-green-600 font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="h-2 w-2" /> Invitado el: {(p as any).lastInvitationSent}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.email && p.type !== 'Garante' && (
                        <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleOpenInviteDialog(p)}><MessageSquareShare className="h-4 w-4" /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPersonDialog(p)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePerson(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
