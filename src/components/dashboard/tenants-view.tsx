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
  TrendingUp,
  Landmark,
  Calculator,
  Calendar,
  FileText,
  Download,
  FileSearch,
  MessageCircleQuestion,
  ArrowRight,
  RefreshCw,
  Eye
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { extractContractData, ExtractContractDataOutput } from '@/ai/flows/extract-contract-data-flow';
import { queryContract } from '@/ai/flows/query-contract-flow';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { sendEmail } from '@/services/email-service';
import { fetchCurrentIndexCoefficient } from '@/services/index-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface TenantsViewProps {
  people: Person[];
  userId?: string;
  contracts: Contract[];
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

export function TenantsView({ people, userId, contracts, properties }: TenantsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'contracts' | 'people'>('contracts');
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAdjNotifOpen, setIsAdjNotifOpen] = useState(false);
  
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [invitingPerson, setInvitingPerson] = useState<Person | null>(null);
  const [selectedAdjContract, setSelectedAdjContract] = useState<Contract | null>(null);

  // AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiQuerying, setIsAiQuerying] = useState(false);
  const [isDraftingInvite, setIsDraftingInvite] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isNotifyingAdjustment, setIsNotifyingAdjustment] = useState<string | null>(null);
  const [isCalculatingIndex, setIsCalculatingIndex] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractContractDataOutput | null>(null);
  const [invitationDraft, setInvitationDraft] = useState<AiCommunicationAssistantOutput | null>(null);
  const [adjDraft, setAdjDraft] = useState<AiCommunicationAssistantOutput | null>(null);
  const [aiAnswer, setAiAnswer] = useState<{answer: string, sourceQuote?: string} | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  
  // Adjustment state
  const [newRentValueInput, setNewRentValueInput] = useState<string>('');

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
    documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
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

  const handleOpenAdjDialog = (contract: Contract) => {
    setSelectedAdjContract(contract);
    setNewRentValueInput('');
    setAdjDraft(null);
    setIsAdjNotifOpen(true);
  };

  const handleAutoCalculate = async () => {
    if (!selectedAdjContract) return;
    
    setIsCalculatingIndex(true);
    try {
      const coef = await fetchCurrentIndexCoefficient(
        (selectedAdjContract.adjustmentMechanism as any) || 'ICL', 
        selectedAdjContract.adjustmentFrequencyMonths
      );
      const calculated = Math.round(selectedAdjContract.currentRentAmount * coef);
      setNewRentValueInput(calculated.toString());
      toast({ title: "Cálculo Realizado", description: `Se aplicó el coeficiente proyectado para ${selectedAdjContract.adjustmentMechanism}.` });
    } catch (e) {
      toast({ title: "Error de Cálculo", description: "No se pudieron obtener los índices oficiales.", variant: "destructive" });
    } finally {
      setIsCalculatingIndex(false);
    }
  };

  const handleGenerateAdjDraft = async () => {
    if (!selectedAdjContract || !newRentValueInput) return;
    
    const tenant = people.find(p => p.id === selectedAdjContract.tenantId);
    setIsNotifyingAdjustment(selectedAdjContract.id);
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseAdjustment',
        tenantName: tenant?.fullName || 'Inquilino',
        propertyName: selectedAdjContract.propertyName,
        currentRentAmount: `$ ${selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}`,
        newRentAmount: `$ ${parseFloat(newRentValueInput).toLocaleString('es-AR')}`,
        adjustmentIndex: selectedAdjContract.adjustmentMechanism || 'ICL',
        currentLeaseStartDate: selectedAdjContract.startDate,
        currentLeaseEndDate: selectedAdjContract.endDate,
        additionalContext: `El ajuste corresponde al ciclo de ${selectedAdjContract.adjustmentFrequencyMonths} meses pactado en el contrato original firmado el ${selectedAdjContract.startDate}.`
      });
      setAdjDraft(draft);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo redactar el borrador.", variant: "destructive" });
    } finally {
      setIsNotifyingAdjustment(null);
    }
  };

  const handleSendAdjEmail = async () => {
    if (!selectedAdjContract || !adjDraft) return;
    
    const tenant = people.find(p => p.id === selectedAdjContract.tenantId);
    if (!tenant?.email) {
      toast({ title: "Sin Email", description: "El inquilino no tiene correo registrado.", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: adjDraft.subjectLine,
        html: `<div style="text-align: justify; line-height: 1.6; font-family: Arial, sans-serif; color: #333;">${adjDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });

      toast({ title: "Pre-aviso Enviado", description: `Notificación enviada a ${tenant.fullName}.` });
      setIsAdjNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar el correo.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
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
        html: `<div style="text-align: justify; line-height: 1.6; font-family: Arial, sans-serif; color: #333;">${invitationDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
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
    setAiAnswer(null);
    setUserQuestion('');
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
        documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
      });
    }
    setIsContractDialogOpen(true);
  };

  const handleSaveContract = () => {
    if (!contractFormData.tenantId || !contractFormData.propertyId || !contractFormData.baseRentAmount || !userId || !db) {
      toast({ title: "Error", description: "Complete los campos obligatorios.", variant: "destructive" });
      return;
    }

    const tenant = people.find(p => p.id === contractFormData.tenantId);
    const property = properties.find(p => p.id === contractFormData.propertyId);

    const docId = editingContract?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', docId);

    const newContract: Contract = {
      ...contractFormData,
      id: docId,
      tenantName: tenant?.fullName,
      propertyName: property?.name,
      currentRentAmount: contractFormData.currentRentAmount || contractFormData.baseRentAmount || 0,
      ownerId: userId,
      documents: contractFormData.documents || { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
    } as Contract;

    setDocumentNonBlocking(docRef, newContract, { merge: true });
    
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
        
        setContractFormData(prev => ({
          ...prev,
          documents: {
            ...prev.documents!,
            mainContractUrl: dataUri,
            mainContractName: file.name
          }
        }));

        toast({ title: "Análisis Completo", description: "La IA ha extraído las cláusulas y el texto completo." });
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
      currency: aiResult.currency as Currency,
      adjustmentFrequencyMonths: aiResult.adjustmentFrequencyMonths,
      adjustmentMechanism: aiResult.adjustmentMechanism as AdjustmentMechanism,
      currentRentAmount: aiResult.baseRentAmount,
      startDate: aiResult.startDate || prev.startDate,
      endDate: aiResult.endDate || prev.endDate,
      fullTranscription: aiResult.fullTranscription,
    }));
    setAiResult(null);
    toast({ title: "Autocompletado", description: "Datos y transcripción aplicados correctamente." });
  };

  const handleAskAI = async () => {
    if (!userQuestion || !contractFormData.fullTranscription) {
      toast({ title: "Atención", description: "Debe escribir una pregunta y tener la transcripción del contrato.", variant: "destructive" });
      return;
    }

    setIsAiQuerying(true);
    try {
      const result = await queryContract({
        contractTranscription: contractFormData.fullTranscription,
        question: userQuestion
      });
      setAiAnswer(result);
    } catch (e) {
      toast({ title: "Error de consulta", description: "La IA no pudo procesar tu pregunta.", variant: "destructive" });
    } finally {
      setIsAiQuerying(false);
    }
  };

  const handleDownloadContract = () => {
    if (!contractFormData.documents?.mainContractUrl) return;
    
    const link = document.createElement('a');
    link.href = contractFormData.documents.mainContractUrl;
    link.download = contractFormData.documents.mainContractName || `contrato_${contractFormData.tenantName?.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Descarga Iniciada", description: "El archivo se está guardando en su dispositivo." });
  };

  const handleDeletePerson = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
  };

  const handleDeleteContract = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Contrato eliminado", description: "El registro ha sido removido." });
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
              <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContract ? 'Editar Contrato' : 'Alta de Contrato'}</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                    <TabsTrigger value="general">Datos Generales</TabsTrigger>
                    <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
                    <TabsTrigger value="documents">Transcripción</TabsTrigger>
                    <TabsTrigger value="ai-query" className="flex gap-2 items-center text-primary font-bold">
                      <MessageCircleQuestion className="h-4 w-4" /> Consultas IA
                    </TabsTrigger>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha de Inicio</Label>
                        <Input type="date" value={contractFormData.startDate} onChange={e => setContractFormData({...contractFormData, startDate: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha de Finalización</Label>
                        <Input type="date" value={contractFormData.endDate} onChange={e => setContractFormData({...contractFormData, endDate: e.target.value})} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="economic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Monto Base Alquiler</Label>
                        <Input 
                          type="number" 
                          value={contractFormData.baseRentAmount} 
                          onChange={e => setContractFormData({...contractFormData, baseRentAmount: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={contractFormData.currency} onValueChange={(v: Currency) => setContractFormData({...contractFormData, currency: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem>
                            <SelectItem value="USD">Dólares (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Mecanismo Ajuste</Label>
                        <Select value={contractFormData.adjustmentMechanism} onValueChange={(v: AdjustmentMechanism) => setContractFormData({...contractFormData, adjustmentMechanism: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ICL">ICL (Banco Central)</SelectItem>
                            <SelectItem value="IPC">IPC (INDEC)</SelectItem>
                            <SelectItem value="Fixed">Escalonado Fijo</SelectItem>
                            <SelectItem value="CasaPropia">Casa Propia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frecuencia (Meses)</Label>
                        <Input 
                          type="number" 
                          value={contractFormData.adjustmentFrequencyMonths} 
                          onChange={e => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Depósito Garantía</Label>
                        <Input 
                          type="number" 
                          value={contractFormData.depositAmount} 
                          onChange={e => setContractFormData({...contractFormData, depositAmount: parseFloat(e.target.value) || 0})} 
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                        
                        {!contractFormData.documents?.mainContractUrl && !isAiProcessing && (
                          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-all border-primary/20 bg-primary/5">
                            <Upload className="h-10 w-10 mx-auto text-primary mb-3" />
                            <p className="text-sm font-bold text-primary">Subir Contrato para Transcripción IA</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Soporta PDF, JPG, PNG</p>
                          </div>
                        )}

                        {isAiProcessing && (
                          <div className="flex flex-col items-center py-12 space-y-4 bg-muted/30 rounded-lg border border-dashed">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-xs font-black uppercase text-primary animate-pulse">La IA está transcribiendo el documento...</p>
                          </div>
                        )}

                        {contractFormData.documents?.mainContractUrl && (
                          <Card className="border-primary/20 bg-white">
                            <CardHeader className="p-4 pb-2">
                              <CardTitle className="text-xs uppercase font-black text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" /> Documento Original
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-4">
                              <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                                <span className="text-[11px] font-bold truncate max-w-[150px]">
                                  {contractFormData.documents.mainContractName || 'Archivo_Contrato.pdf'}
                                </span>
                                <div className="flex gap-2">
                                   <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={handleDownloadContract} title="Descargar Archivo">
                                      <Download className="h-4 w-4" />
                                   </Button>
                                   <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setContractFormData({...contractFormData, documents: {...contractFormData.documents!, mainContractUrl: ''}})}>
                                      <Trash2 className="h-4 w-4" />
                                   </Button>
                                </div>
                              </div>
                              
                              {aiResult && (
                                <Button className="w-full bg-primary text-white font-black h-10 gap-2 shadow-md animate-bounce" onClick={applyAiData}>
                                  <Sparkles className="h-4 w-4" /> Aplicar Transcripción IA
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
                          <FileSearch className="h-4 w-4" /> Transcripción del Texto
                        </Label>
                        <ScrollArea className="h-[250px] w-full border rounded-lg p-4 bg-white font-mono text-[10px] leading-relaxed">
                          {contractFormData.fullTranscription ? (
                            <div className="whitespace-pre-wrap">{contractFormData.fullTranscription}</div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 text-center px-4">
                              <FileSearch className="h-8 w-8 mb-2" />
                              <p>Suba un documento y use la IA para ver la transcripción completa aquí.</p>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ai-query" className="pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      <div className="md:col-span-5 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                          <h4 className="text-sm font-black text-primary mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" /> Consultor Inteligente
                          </h4>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Pregunte cualquier cosa sobre las cláusulas de este contrato. La IA responderá <strong>exclusivamente</strong> basándose en el texto transcrito.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">¿Qué desea saber?</Label>
                          <Textarea 
                            placeholder="Ej: ¿Quién debe pagar el impuesto inmobiliario según este contrato?"
                            value={userQuestion}
                            onChange={e => setUserQuestion(e.target.value)}
                            className="min-h-[100px] text-sm"
                          />
                          <Button 
                            className="w-full bg-primary text-white font-black gap-2 h-11 shadow-md"
                            disabled={isAiQuerying || !contractFormData.fullTranscription}
                            onClick={handleAskAI}
                          >
                            {isAiQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />}
                            Consultar Contrato
                          </Button>
                        </div>
                      </div>

                      <div className="md:col-span-7">
                        <Card className="border-none shadow-none bg-muted/20 h-full min-h-[300px]">
                          <CardContent className="p-6">
                            {!aiAnswer && !isAiQuerying && (
                              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4 py-12">
                                <FileSearch className="h-12 w-12" />
                                <p className="text-sm">Realice una pregunta a la izquierda para ver la respuesta aquí.</p>
                              </div>
                            )}

                            {isAiQuerying && (
                              <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-xs font-bold text-primary animate-pulse uppercase">Analizando cláusulas...</p>
                              </div>
                            )}

                            {aiAnswer && !isAiQuerying && (
                              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="space-y-2">
                                  <Badge className="bg-primary text-white">Respuesta IA</Badge>
                                  <p className="text-sm leading-relaxed font-medium text-foreground bg-white p-4 rounded-lg border shadow-sm">
                                    {aiAnswer.answer}
                                  </p>
                                </div>

                                {aiAnswer.sourceQuote && (
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Evidencia en el texto:</Label>
                                    <div className="p-3 bg-white/50 rounded border border-dashed border-muted-foreground/30 italic text-[11px] text-muted-foreground">
                                      "{aiAnswer.sourceQuote}"
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6 border-t pt-4">
                  <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cerrar</Button>
                  <Button onClick={handleSaveContract}>Guardar Contrato</Button>
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
          <DialogFooter className="mt-6 border-t pt-4"><Button onClick={handleSavePerson}>Guardar Persona</Button></DialogFooter>
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
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-sm whitespace-pre-wrap min-h-[150px] text-justify">
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

      {/* DIÁLOGO DE NOTIFICACIÓN DE AUMENTO CON PREVISUALIZACIÓN */}
      <Dialog open={isAdjNotifOpen} onOpenChange={setIsAdjNotifOpen}>
        <DialogContent className={cn("transition-all duration-500", adjDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" /> Notificar Ajuste de Alquiler
            </DialogTitle>
            <DialogDescription>
              {adjDraft ? "Revise el borrador antes de enviarlo por correo electrónico." : "Prepare la comunicación de aumento para " + selectedAdjContract?.tenantName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAdjContract && !adjDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold uppercase">Mecanismo Pactado:</span>
                  <Badge variant="outline" className="border-primary text-primary font-black">{selectedAdjContract.adjustmentMechanism}</Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold uppercase">Frecuencia:</span>
                  <span className="font-black">CADA {selectedAdjContract.adjustmentFrequencyMonths} MESES</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Monto Actual:</span>
                  <span className="text-lg font-black text-foreground">{selectedAdjContract.currency} {selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label className="text-xs font-black uppercase text-primary">Nuevo Monto Calculado</Label>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-[10px] font-black uppercase flex gap-1 items-center text-blue-600 hover:text-blue-800"
                    onClick={handleAutoCalculate}
                    disabled={isCalculatingIndex}
                  >
                    {isCalculatingIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Calcular con Índices Oficiales
                  </Button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">{selectedAdjContract.currency}</span>
                  <Input 
                    type="number" 
                    placeholder="Ingrese el nuevo valor..." 
                    className="pl-12 h-12 text-lg font-black"
                    value={newRentValueInput}
                    onChange={(e) => setNewRentValueInput(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic leading-tight">
                  La IA redactará el mensaje basándose en este número. Usted podrá revisar el texto antes de enviarlo.
                </p>
              </div>
            </div>
          )}

          {adjDraft && (
            <div className="space-y-4 py-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Asunto del Correo</Label>
                <p className="font-bold text-sm">{adjDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner">
                <div className="text-sm leading-relaxed text-foreground text-justify whitespace-pre-wrap font-body">
                  {adjDraft.draftedMessage}
                </div>
              </ScrollArea>
              <p className="text-[10px] text-center text-muted-foreground">
                <Sparkles className="h-3 w-3 inline mr-1" /> Mensaje redactado según Ley 24.240 y reglas de puntuación estrictas.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {adjDraft ? (
              <>
                <Button variant="outline" onClick={() => setAdjDraft(null)} disabled={isSendingEmail}>Atrás</Button>
                <Button 
                  className="bg-primary text-white font-black gap-2 h-11 px-8 shadow-md"
                  onClick={handleSendAdjEmail}
                  disabled={isSendingEmail}
                >
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSendingEmail ? "Enviando Correo..." : "Enviar Correo Real"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setIsAdjNotifOpen(false)}>Cancelar</Button>
                <Button 
                  className="bg-primary text-white font-black gap-2 h-11 px-6 shadow-md"
                  disabled={!newRentValueInput || isNotifyingAdjustment !== null || isCalculatingIndex}
                  onClick={handleGenerateAdjDraft}
                >
                  {isNotifyingAdjustment !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Generar Previsualización
                </Button>
              </>
            )}
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
                        onClick={() => handleOpenAdjDialog(c)}
                      >
                        {isNotifyingAdjustment === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenContractDialog(c)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteContract(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No hay contratos registrados aún.</TableCell>
                </TableRow>
              )}
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
              {people.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">No hay personas registradas aún.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
