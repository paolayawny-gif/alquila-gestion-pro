
"use client";

import React, { useState } from 'react';
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
  Eye,
  Percent,
  MessageSquare,
  Scale,
  Phone,
  User,
  History,
  Clock,
  CalendarClock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, IndexRecord } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { queryContract } from '@/ai/flows/query-contract-flow';
import { extractContractData } from '@/ai/flows/extract-contract-data-flow';
import { sendEmail } from '@/services/email-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyInput } from '@/components/ui/currency-input';

interface TenantsViewProps {
  people: Person[];
  userId?: string;
  contracts: Contract[];
  properties: Property[];
  indexRecords: IndexRecord[];
}

const APP_ID = "alquilagestion-pro";

export function TenantsView({ people, userId, contracts, properties, indexRecords }: TenantsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<'contracts' | 'people'>('contracts');
  const contractFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isAdjNotifOpen, setIsAdjNotifOpen] = useState(false);
  const [isRenewalNotifOpen, setIsRenewalNotifOpen] = useState(false);
  const [isQAOpen, setIsQAOpen] = useState(false);
  
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  
  const [selectedAdjContract, setSelectedAdjContract] = useState<Contract | null>(null);
  const [selectedRenewalContract, setSelectedRenewalContract] = useState<Contract | null>(null);
  const [selectedQAContract, setSelectedQAContract] = useState<Contract | null>(null);
  
  const [qaQuestion, setQAQuestion] = useState('');
  const [qaAnswer, setQAAnswer] = useState<{answer: string, sourceQuote?: string} | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isCalculatingIndex, setIsCalculatingIndex] = useState(false);
  const [adjDraft, setAdjDraft] = useState<any>(null);
  const [renewalDraft, setRenewalDraft] = useState<any>(null);
  const [newRentValueInput, setNewRentValueInput] = useState<number>(0);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleOpenPersonDialog = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setPersonFormData(person);
    } else {
      setEditingPerson(null);
      setPersonFormData({
        fullName: '',
        taxId: '',
        email: '',
        phone: '',
        type: 'Inquilino',
        documents: []
      });
    }
    setIsPersonDialogOpen(true);
  };

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
    lateFeePercentage: 0.5,
    depositAmount: 0,
    status: 'Vigente',
    documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
  });

  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    email: '',
    phone: '',
    type: 'Inquilino',
    documents: []
  });

  const handleSavePerson = () => {
    if (!personFormData.fullName || !userId || !db) {
      toast({ title: "Error", description: "Complete los datos obligatorios.", variant: "destructive" });
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
    toast({ 
      title: editingPerson ? "Persona actualizada" : "Persona creada", 
      description: `${personFormData.fullName} se ha guardado correctamente.` 
    });
  };

  const handleDeletePerson = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
  };

  const handleAskContract = async () => {
    if (!selectedQAContract || !qaQuestion) return;
    if (!selectedQAContract.fullTranscription) {
      toast({
        title: "Sin transcripción",
        description: "Este contrato no tiene texto cargado. Subí el archivo y usá \"Analizar con IA\" en la pestaña Documentos, o pegá el texto manualmente.",
        variant: "destructive"
      });
      return;
    }
    setIsAsking(true);
    setQAAnswer(null);
    const result = await queryContract({
      contractTranscription: selectedQAContract.fullTranscription,
      question: qaQuestion
    });
    setIsAsking(false);
    if (!result.ok) {
      toast({ title: "Error del asistente", description: result.error, variant: "destructive" });
      return;
    }
    setQAAnswer(result.data);
  };

  const handleExtractContract = async () => {
    const url = (contractFormData.documents as any)?.mainContractUrl;
    if (!url) {
      toast({ title: "Sin archivo", description: "Primero cargá el archivo del contrato.", variant: "destructive" });
      return;
    }
    setIsExtracting(true);
    const result = await extractContractData({ documentDataUri: url });
    setIsExtracting(false);
    if (!result.ok) {
      toast({ title: "Error al analizar", description: result.error, variant: "destructive" });
      return;
    }
    const d = result.data;
    setContractFormData(prev => ({
      ...prev,
      fullTranscription: d.fullTranscription,
      baseRentAmount: d.baseRentAmount || prev.baseRentAmount,
      currentRentAmount: d.baseRentAmount || prev.currentRentAmount,
      currency: d.currency || prev.currency,
      adjustmentMechanism: d.adjustmentMechanism || prev.adjustmentMechanism,
      adjustmentFrequencyMonths: d.adjustmentFrequencyMonths || prev.adjustmentFrequencyMonths,
      startDate: d.startDate || prev.startDate,
      endDate: d.endDate || prev.endDate,
    }));
    toast({
      title: "Análisis completado",
      description: `Confianza: ${Math.round((d.confidenceScore ?? 0) * 100)}%. Transcripción y datos cargados. Revisá y guardá el contrato.`,
    });
  };

  const handleAutoCalculate = () => {
    if (!selectedAdjContract || !selectedAdjContract.adjustmentMechanism) return;
    setIsCalculatingIndex(true);
    const mechanism = selectedAdjContract.adjustmentMechanism;

    if (mechanism === 'CER') {
      // CER: ratio between daily index at adjustment date and at contract start date
      const startDate = selectedAdjContract.startDate.slice(0, 10);
      const cerRecords = [...indexRecords]
        .filter(r => r.type === 'CER')
        .sort((a, b) => b.month.localeCompare(a.month));

      const cerLatest = cerRecords[0];
      // Find CER closest to start date
      const cerStart = indexRecords
        .filter(r => r.type === 'CER' && r.month >= startDate)
        .sort((a, b) => a.month.localeCompare(b.month))[0]
        ?? indexRecords.filter(r => r.type === 'CER').sort((a, b) => b.month.localeCompare(a.month))[0];

      if (cerLatest && cerStart && cerStart.value > 0) {
        const coef = cerLatest.value / cerStart.value;
        const calculated = Math.round(selectedAdjContract.baseRentAmount * coef);
        setNewRentValueInput(calculated);
        toast({ title: "Cálculo CER", description: `CER inicio: ${cerStart.value.toFixed(4)} (${cerStart.month}) → CER actual: ${cerLatest.value.toFixed(4)} (${cerLatest.month}) · Coef: ${coef.toFixed(4)}` });
      } else {
        toast({ title: "Datos Faltantes", description: "No hay suficientes registros CER. Cargalos en la sección Índices Oficiales.", variant: "destructive" });
      }
    } else {
      // ICL / IPC / CasaPropia: monthly percentage records
      const currentMonth = new Date().toISOString().slice(0, 7);
      const startMonth = selectedAdjContract.startDate.slice(0, 7);
      const indexActual = indexRecords.find(r => r.month === currentMonth && r.type === mechanism);
      const indexInicial = indexRecords.find(r => r.month === startMonth && r.type === mechanism);

      if (indexActual && indexInicial && indexInicial.value > 0) {
        const coef = indexActual.value / indexInicial.value;
        const calculated = Math.round(selectedAdjContract.currentRentAmount * coef);
        setNewRentValueInput(calculated);
        toast({ title: "Cálculo Realizado", description: `Coeficiente ${mechanism} aplicado: ${coef.toFixed(4)}.` });
      } else {
        toast({ title: "Datos Faltantes", description: "No hay registros suficientes en el historial para calcular el ajuste.", variant: "destructive" });
      }
    }
    setIsCalculatingIndex(false);
  };

  const handleGenerateAdjDraft = async () => {
    if (!selectedAdjContract || !newRentValueInput) return;
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseAdjustment',
        tenantName: selectedAdjContract.tenantName,
        propertyName: selectedAdjContract.propertyName,
        currentRentAmount: `${selectedAdjContract.currency} ${selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}`,
        newRentAmount: `${selectedAdjContract.currency} ${newRentValueInput.toLocaleString('es-AR')}`,
        adjustmentIndex: selectedAdjContract.adjustmentMechanism || 'Fijo',
        currentLeaseStartDate: selectedAdjContract.startDate,
        currentLeaseEndDate: selectedAdjContract.endDate,
        additionalContext: "Informar al inquilino que debido a la actualización por índice prevista en el contrato, el valor del alquiler mensual subirá a partir del próximo mes."
      });
      setAdjDraft(draft);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el borrador de aumento.", variant: "destructive" });
    }
  };

  const handleGenerateRenewalDraft = async () => {
    if (!selectedRenewalContract) return;
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseRenewal',
        tenantName: selectedRenewalContract.tenantName,
        propertyName: selectedRenewalContract.propertyName,
        currentLeaseEndDate: selectedRenewalContract.endDate,
        additionalContext: "Informar que el contrato vence pronto y debemos coordinar la renovación o la entrega de llaves."
      });
      setRenewalDraft(draft);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el borrador de renovación.", variant: "destructive" });
    }
  };

  const handleSendAdjEmail = async () => {
    if (!selectedAdjContract || !adjDraft) return;
    const tenant = people.find(p => p.id === selectedAdjContract.tenantId);
    if (!tenant?.email) {
      toast({ title: "Email Faltante", description: "El inquilino no tiene correo registrado.", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: adjDraft.subjectLine,
        html: `<div style="text-align: justify;">${adjDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Aviso de Aumento Enviado", description: "El inquilino ha sido notificado formalmente del nuevo valor." });
      setIsAdjNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Fallo el envío de email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendRenewalEmail = async () => {
    if (!selectedRenewalContract || !renewalDraft) return;
    const tenant = people.find(p => p.id === selectedRenewalContract.tenantId);
    if (!tenant?.email) return;
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: renewalDraft.subjectLine,
        html: `<div style="text-align: justify;">${renewalDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Aviso de Vencimiento Enviado", description: "El inquilino ha sido notificado formalmente." });
      setIsRenewalNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Fallo el envío de email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingContract(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContractFormData(prev => ({
        ...prev,
        documents: {
          ...((prev.documents as any) || {}),
          mainContractUrl: event.target?.result as string,
          mainContractName: file.name,
        }
      }));
      toast({ title: "Archivo cargado", description: `"${file.name}" listo para guardar con el contrato.` });
      setIsUploadingContract(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveContract = () => {
    if (!contractFormData.tenantId || !contractFormData.propertyId || !userId || !db) return;
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
    } as Contract;
    setDocumentNonBlocking(docRef, newContract, { merge: true });
    setIsContractDialogOpen(false);
    toast({ title: "Contrato Guardado", description: "Los términos han sido actualizados." });
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
          {activeTab === 'contracts' ? (
            <Button className="bg-primary text-white gap-2 font-bold" onClick={() => { setEditingContract(null); setIsContractDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Contrato
            </Button>
          ) : (
            <Button className="bg-primary text-white gap-2 font-bold" onClick={() => handleOpenPersonDialog()}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      {/* DIÁLOGO DE CONTRATO */}
      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ficha Técnica del Contrato</DialogTitle></DialogHeader>
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="general">Datos Generales</TabsTrigger>
              <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
              <TabsTrigger value="documents">Transcripción Legal</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidad / Propiedad</Label>
                  <Select value={contractFormData.propertyId} onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}>
                    <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                    <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Inquilino (Locatario)</Label>
                  <Select value={contractFormData.tenantId} onValueChange={(v) => setContractFormData({...contractFormData, tenantId: v})}>
                    <SelectTrigger><SelectValue placeholder="Persona..." /></SelectTrigger>
                    <SelectContent>{people.filter(p => p.type === 'Inquilino').map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Fecha de Inicio</Label><Input type="date" value={contractFormData.startDate} onChange={e => setContractFormData({...contractFormData, startDate: e.target.value})} /></div>
                <div className="space-y-2"><Label>Fecha de Finalización</Label><Input type="date" value={contractFormData.endDate} onChange={e => setContractFormData({...contractFormData, endDate: e.target.value})} /></div>
              </div>
            </TabsContent>
            <TabsContent value="economic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Monto Base Alquiler</Label><CurrencyInput value={contractFormData.baseRentAmount || 0} onChange={v => setContractFormData({...contractFormData, baseRentAmount: v, currentRentAmount: v})} placeholder="Ej: 150.000" /></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={contractFormData.currency} onValueChange={(v: any) => setContractFormData({...contractFormData, currency: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Mecanismo de Ajuste</Label><Select value={contractFormData.adjustmentMechanism} onValueChange={(v: any) => setContractFormData({...contractFormData, adjustmentMechanism: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CER">CER (BCRA - Diario)</SelectItem><SelectItem value="ICL">ICL (Alquileres)</SelectItem><SelectItem value="IPC">IPC (Inflación)</SelectItem><SelectItem value="Fixed">Monto Fijo</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Mora Diaria (%)</Label><Input type="number" step="0.1" value={contractFormData.lateFeePercentage} onChange={e => setContractFormData({...contractFormData, lateFeePercentage: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Frecuencia (Meses)</Label><Input type="number" value={contractFormData.adjustmentFrequencyMonths} onChange={e => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} /></div>
              </div>
            </TabsContent>
            <TabsContent value="documents" className="pt-4 space-y-4">
              {/* File upload */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3 hover:border-primary/50 transition-colors">
                {(contractFormData.documents as any)?.mainContractName ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-700">{(contractFormData.documents as any).mainContractName}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                      onClick={() => setContractFormData(prev => ({ ...prev, documents: { ...(prev.documents as any), mainContractUrl: '', mainContractName: '' } }))}>
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                    <p className="text-sm font-bold text-foreground">Cargar archivo del contrato</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG — máx. 5MB</p>
                  </>
                )}
                <Button variant="outline" size="sm" className="gap-2 font-bold"
                  onClick={() => contractFileInputRef.current?.click()}
                  disabled={isUploadingContract}>
                  {isUploadingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {(contractFormData.documents as any)?.mainContractName ? 'Reemplazar archivo' : 'Seleccionar archivo'}
                </Button>
                <input ref={contractFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleContractFileChange} />
              </div>

              {/* Botón de análisis con IA */}
              {(contractFormData.documents as any)?.mainContractUrl && (
                <Button
                  variant="outline"
                  className="w-full gap-2 font-bold border-primary/30 text-primary hover:bg-primary/5"
                  onClick={handleExtractContract}
                  disabled={isExtracting}
                >
                  {isExtracting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando documento con IA...</>
                    : <><Sparkles className="h-4 w-4" /> Analizar con IA y extraer datos</>}
                </Button>
              )}

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground italic font-bold uppercase">
                  Transcripción del contrato (necesaria para el Asistente Legal)
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Se completa automáticamente al usar "Analizar con IA", o podés pegar el texto manualmente.
                </p>
              </div>
              <Textarea
                placeholder="El texto del contrato aparecerá aquí después de usar 'Analizar con IA', o podés pegarlo manualmente..."
                className="h-[200px] font-mono text-[10px] bg-muted/10"
                value={contractFormData.fullTranscription ?? ''}
                onChange={e => setContractFormData({...contractFormData, fullTranscription: e.target.value})}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6 pt-4 border-t"><Button onClick={handleSaveContract} className="font-black px-12">Guardar Contrato</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO PERSONA */}
      <Dialog open={isPersonDialogOpen} onOpenChange={setIsPersonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Editar Persona' : 'Alta de Persona'}</DialogTitle>
            <DialogDescription>Complete los datos de contacto y fiscales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input 
                placeholder="Ej: Juan Pérez" 
                value={personFormData.fullName} 
                onChange={e => setPersonFormData({...personFormData, fullName: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CUIT / DNI</Label>
                <Input 
                  placeholder="20-XXXXXXXX-0" 
                  value={personFormData.taxId} 
                  onChange={e => setPersonFormData({...personFormData, taxId: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select 
                  value={personFormData.type} 
                  onValueChange={(v: any) => setPersonFormData({...personFormData, type: v})}
                >
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
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="correo@ejemplo.com" 
                value={personFormData.email} 
                onChange={e => setPersonFormData({...personFormData, email: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input 
                placeholder="+54 9 ..." 
                value={personFormData.phone} 
                onChange={e => setPersonFormData({...personFormData, phone: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPersonDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-bold px-8" onClick={handleSavePerson}>Guardar Persona</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO Q&A LEGAL */}
      <Dialog open={isQAOpen} onOpenChange={setIsQAOpen}>
        <DialogContent className="max-w-2xl bg-white border-none shadow-2xl">
          <DialogHeader>
            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-2">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-black">Asistente Legal de Cláusulas</DialogTitle>
            <DialogDescription>Consulte cualquier duda sobre los términos del contrato de {selectedQAContract?.tenantName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Warning si no hay transcripción */}
            {!selectedQAContract?.fullTranscription && (
              <div className="flex gap-3 items-start p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-800">Este contrato no tiene texto cargado</p>
                  <p className="text-xs text-amber-700">
                    Para usar el Asistente Legal, necesitás cargar el texto del contrato. Hay dos formas:
                  </p>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                    <li>Editá el contrato → pestaña <strong>Documentos</strong> → subí el PDF/imagen → botón <strong>"Analizar con IA"</strong></li>
                    <li>O pegá el texto del contrato manualmente en el campo de transcripción</li>
                  </ul>
                </div>
              </div>
            )}

            {selectedQAContract?.fullTranscription && (
              <div className="flex gap-2 items-center p-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  Contrato con transcripción cargada — {selectedQAContract.fullTranscription.length.toLocaleString('es-AR')} caracteres
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Tu pregunta al contrato</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: ¿Quién paga el impuesto inmobiliario? ¿Cuál es la multa por rescisión?"
                  value={qaQuestion}
                  onChange={e => setQAQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAskContract()}
                  className="h-12"
                  disabled={!selectedQAContract?.fullTranscription}
                />
                <Button
                  onClick={handleAskContract}
                  disabled={isAsking || !qaQuestion || !selectedQAContract?.fullTranscription}
                  className="bg-primary h-12 px-6"
                >
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {qaAnswer && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                  <p className="text-sm leading-relaxed text-foreground font-medium">{qaAnswer.answer}</p>
                  {qaAnswer.sourceQuote && (
                    <div className="p-3 bg-white/50 border-l-4 border-primary rounded text-[11px] italic text-muted-foreground">
                      "{qaAnswer.sourceQuote}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO NOTIFICACIÓN AUMENTO (Aviso de suba de alquiler) */}
      <Dialog open={isAdjNotifOpen} onOpenChange={setIsAdjNotifOpen}>
        <DialogContent className={cn("transition-all duration-500", adjDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" /> Aviso de Aumento de Alquiler
            </DialogTitle>
            <DialogDescription>Notificar formalmente al inquilino sobre la suba del valor mensual.</DialogDescription>
          </DialogHeader>
          {selectedAdjContract && !adjDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Mensual Actual</p>
                <p className="text-2xl font-black text-primary">{selectedAdjContract.currency} {selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label className="text-[10px] font-black uppercase text-orange-600">Nuevo Valor a Notificar</Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-black flex gap-1 text-primary" onClick={handleAutoCalculate} disabled={isCalculatingIndex}>
                    {isCalculatingIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Autocalcular con {selectedAdjContract.adjustmentMechanism}
                  </Button>
                </div>
                <CurrencyInput className="h-12 text-lg font-black border-orange-200 focus:border-orange-500" value={newRentValueInput} onChange={setNewRentValueInput} placeholder="0" />
              </div>
              <Button className="w-full h-11 font-black bg-orange-600 hover:bg-orange-700 text-white" onClick={handleGenerateAdjDraft} disabled={!newRentValueInput}>
                Generar Notificación de Aumento
              </Button>
            </div>
          )}
          {adjDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <Label className="text-[10px] font-black block mb-1 uppercase text-orange-700">Asunto de Notificación</Label>
                <p className="font-bold text-sm text-orange-900">{adjDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap">
                {adjDraft.draftedMessage}
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAdjDraft(null)}>Atrás</Button>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white font-black gap-2 h-11 px-8" onClick={handleSendAdjEmail} disabled={isSendingEmail}>
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar Aviso de Aumento Real
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO NOTIFICACIÓN VENCIMIENTO (Renovación) */}
      <Dialog open={isRenewalNotifOpen} onOpenChange={setIsRenewalNotifOpen}>
        <DialogContent className={cn("transition-all duration-500", renewalDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" /> Aviso de Vencimiento de Contrato
            </DialogTitle>
            <DialogDescription>Informar sobre el fin del contrato y próximos pasos.</DialogDescription>
          </DialogHeader>
          {selectedRenewalContract && !renewalDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl space-y-2">
                <p className="text-xs font-bold text-accent uppercase">Fecha de Finalización</p>
                <p className="text-2xl font-black text-accent">{selectedRenewalContract.endDate}</p>
                <p className="text-[10px] text-muted-foreground italic">Se redactará un mensaje profesional para coordinar renovación o entrega de llaves.</p>
              </div>
              <Button className="w-full h-11 font-black bg-accent hover:bg-accent/90 text-white" onClick={handleGenerateRenewalDraft}>
                Generar Borrador de Vencimiento
              </Button>
            </div>
          )}
          {renewalDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-[10px] font-black block mb-1 uppercase">Asunto de Vencimiento</Label>
                <p className="font-bold text-sm">{renewalDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap italic">
                {renewalDraft.draftedMessage}
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRenewalDraft(null)}>Atrás</Button>
                <Button className="bg-accent font-black gap-2 h-11 px-8 text-white" onClick={handleSendRenewalEmail} disabled={isSendingEmail}>
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar Aviso de Vencimiento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino / Unidad</TableHead><TableHead>Fin Contrato</TableHead><TableHead>Ajuste</TableHead><TableHead className="text-right">Alquiler Actual</TableHead><TableHead className="text-right">Notificaciones e IA</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{c.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{c.propertyName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{c.endDate}</span>
                      <Badge variant="ghost" className="text-[8px] p-0 h-auto font-black uppercase text-muted-foreground">Estado: {c.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase"><Calendar className="h-3 w-3" /> {c.adjustmentMechanism}</div>
                      <span className="text-[9px] text-muted-foreground">Ciclo: {c.adjustmentFrequencyMonths} meses</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary text-base">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-primary hover:bg-primary/10" 
                        title="Asistente Legal (Preguntar al Contrato)"
                        onClick={() => { setSelectedQAContract(c); setQAAnswer(null); setQAQuestion(''); setIsQAOpen(true); }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-orange-600 hover:bg-orange-50" 
                        title="Notificar Aumento de Alquiler (Próxima Suba)"
                        onClick={() => { setSelectedAdjContract(c); setAdjDraft(null); setNewRentValueInput(0); setIsAdjNotifOpen(true); }}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-accent hover:bg-accent/5" 
                        title="Notificar Vencimiento / Renovación"
                        onClick={() => { setSelectedRenewalContract(c); setRenewalDraft(null); setIsRenewalNotifOpen(true); }}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>

                      <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => { setEditingContract(c); setContractFormData(c); setIsContractDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay contratos activos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Nombre Completo</TableHead><TableHead>CUIT / DNI</TableHead><TableHead>Rol en Sistema</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.fullName}</TableCell>
                  <TableCell>{p.taxId}</TableCell>
                  <TableCell><Badge variant="outline" className="border-primary/30 text-primary">{p.type}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPersonDialog(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePerson(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {people.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No hay personas registradas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
