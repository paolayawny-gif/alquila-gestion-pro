
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
import { Contract, Person, Property, PersonType, Currency, AdjustmentMechanism, IndexRecord } from '@/lib/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
    status: 'Vigente',
    guarantorIds: [],
    ownerIds: [],
    documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
  });

  const handleAutoCalculate = () => {
    if (!selectedAdjContract || !selectedAdjContract.adjustmentMechanism) return;
    
    if (selectedAdjContract.adjustmentMechanism === 'Fixed') {
      toast({ title: "Contrato Fijo", description: "Este contrato no se ajusta por índice. Ingrese el monto manualmente." });
      return;
    }

    setIsCalculatingIndex(true);
    
    // Lógica real: (Monto * Indice_Actual / Indice_Inicial)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startMonth = selectedAdjContract.startDate.slice(0, 7);
    
    const indexActual = indexRecords.find(r => r.month === currentMonth && r.type === selectedAdjContract.adjustmentMechanism);
    const indexInicial = indexRecords.find(r => r.month === startMonth && r.type === selectedAdjContract.adjustmentMechanism);

    if (indexActual && indexInicial) {
      const coef = indexActual.value / indexInicial.value;
      const calculated = Math.round(selectedAdjContract.currentRentAmount * coef);
      setNewRentValueInput(calculated.toString());
      toast({ title: "Cálculo Realizado", description: `Se aplicó el coeficiente real (${coef.toFixed(4)}) basado en tus datos cargados.` });
    } else {
      toast({ 
        title: "Datos Faltantes", 
        description: `No hay registros de ${selectedAdjContract.adjustmentMechanism} para ${startMonth} o ${currentMonth} en el historial.`,
        variant: "destructive" 
      });
    }
    setIsCalculatingIndex(false);
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
        currentRentAmount: `${selectedAdjContract.currency} ${selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}`,
        newRentAmount: `${selectedAdjContract.currency} ${parseFloat(newRentValueInput).toLocaleString('es-AR')}`,
        adjustmentIndex: selectedAdjContract.adjustmentMechanism || 'Fijo',
        currentLeaseStartDate: selectedAdjContract.startDate,
        currentLeaseEndDate: selectedAdjContract.endDate,
        additionalContext: selectedAdjContract.adjustmentMechanism === 'Fixed' 
          ? "El ajuste corresponde a lo pactado de forma fija en el contrato."
          : `El ajuste corresponde al ciclo de ${selectedAdjContract.adjustmentFrequencyMonths} meses pactado, basado en el índice ${selectedAdjContract.adjustmentMechanism}.`
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
      toast({ title: "Notificación Enviada", description: `Enviado a ${tenant.fullName}.` });
      setIsAdjNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar el correo.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
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
            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingContract ? 'Editar Contrato' : 'Alta de Contrato'}</DialogTitle></DialogHeader>
                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                    <TabsTrigger value="general">Datos Generales</TabsTrigger>
                    <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
                    <TabsTrigger value="documents">Transcripción</TabsTrigger>
                    <TabsTrigger value="ai-query" className="flex gap-2 items-center text-primary font-bold"><MessageCircleQuestion className="h-4 w-4" /> Consultas IA</TabsTrigger>
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
                      <div className="space-y-2"><Label>Fecha de Inicio</Label><Input type="date" value={contractFormData.startDate} onChange={e => setContractFormData({...contractFormData, startDate: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Fecha de Finalización</Label><Input type="date" value={contractFormData.endDate} onChange={e => setContractFormData({...contractFormData, endDate: e.target.value})} /></div>
                    </div>
                  </TabsContent>
                  <TabsContent value="economic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Monto Base Alquiler</Label><Input type="number" value={contractFormData.baseRentAmount} onChange={e => setContractFormData({...contractFormData, baseRentAmount: parseFloat(e.target.value) || 0})} /></div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={contractFormData.currency} onValueChange={(v: Currency) => setContractFormData({...contractFormData, currency: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
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
                            <SelectItem value="Fixed">Fijo / Escalón Pactado</SelectItem>
                            <SelectItem value="CasaPropia">Casa Propia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Frecuencia (Meses)</Label><Input type="number" value={contractFormData.adjustmentFrequencyMonths} onChange={e => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} /></div>
                      <div className="space-y-2"><Label>Depósito Garantía</Label><Input type="number" value={contractFormData.depositAmount} onChange={e => setContractFormData({...contractFormData, depositAmount: parseFloat(e.target.value) || 0})} /></div>
                    </div>
                  </TabsContent>
                  <TabsContent value="documents" className="pt-4 space-y-6">
                    <ScrollArea className="h-[300px] border rounded-lg p-4 bg-white font-mono text-[10px]">{contractFormData.fullTranscription || "Sin transcripción"}</ScrollArea>
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6 border-t pt-4"><Button onClick={handleSaveContract}>Guardar Contrato</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => setIsPersonDialogOpen(true)}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isAdjNotifOpen} onOpenChange={setIsAdjNotifOpen}>
        <DialogContent className={cn("transition-all duration-500", adjDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><TrendingUp className="h-5 w-5" /> Notificar Ajuste de Alquiler</DialogTitle>
            <DialogDescription>{adjDraft ? "Revise el borrador antes de enviarlo." : "Prepare la comunicación para " + selectedAdjContract?.tenantName}</DialogDescription>
          </DialogHeader>
          {selectedAdjContract && !adjDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold uppercase">Mecanismo:</span>
                  <Badge variant="outline" className="border-primary text-primary font-black">{selectedAdjContract.adjustmentMechanism}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Actual:</span>
                  <span className="text-lg font-black">{selectedAdjContract.currency} {selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label className="text-xs font-black uppercase text-primary">Nuevo Monto</Label>
                  {selectedAdjContract.adjustmentMechanism !== 'Fixed' && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-black uppercase flex gap-1 items-center text-blue-600" onClick={handleAutoCalculate} disabled={isCalculatingIndex}>
                      {isCalculatingIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Calcular con Mi Historial
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">{selectedAdjContract.currency}</span>
                  <Input type="number" className="pl-12 h-12 text-lg font-black" value={newRentValueInput} onChange={(e) => setNewRentValueInput(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {adjDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Asunto</Label>
                <p className="font-bold text-sm">{adjDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap">{adjDraft.draftedMessage}</ScrollArea>
            </div>
          )}
          <DialogFooter className="gap-2">
            {adjDraft ? (
              <><Button variant="outline" onClick={() => setAdjDraft(null)} disabled={isSendingEmail}>Atrás</Button><Button className="bg-primary text-white font-black gap-2 h-11 px-8 shadow-md" onClick={handleSendAdjEmail} disabled={isSendingEmail}>{isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar y Enviar</Button></>
            ) : (
              <><Button variant="ghost" onClick={() => setIsAdjNotifOpen(false)}>Cancelar</Button><Button className="bg-primary text-white font-black gap-2 h-11 px-6 shadow-md" disabled={!newRentValueInput || isCalculatingIndex} onClick={handleGenerateAdjDraft}>Generar Previsualización</Button></>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
           <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino</TableHead><TableHead>Propiedad</TableHead><TableHead>Vigencia</TableHead><TableHead>Ajuste</TableHead><TableHead className="text-right">Alquiler</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.tenantName}</TableCell>
                  <TableCell className="text-sm">{c.propertyName}</TableCell>
                  <TableCell className="text-xs">{c.startDate} al {c.endDate}</TableCell>
                  <TableCell><Badge variant="outline">{c.adjustmentMechanism}</Badge></TableCell>
                  <TableCell className="text-right font-black text-primary">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10" onClick={() => { setSelectedAdjContract(c); setNewRentValueInput(''); setAdjDraft(null); setIsAdjNotifOpen(true); }}><TrendingUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingContract(c); setContractFormData(c); setIsContractDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(userId && db) deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', c.id)); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Nombre y CUIT</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">{p.fullName}<br/><span className="text-[10px] font-normal">{p.taxId}</span></TableCell>
                  <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingPerson(p); setPersonFormData(p); setIsPersonDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(userId && db) deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', p.id)); }}><Trash2 className="h-4 w-4" /></Button>
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
