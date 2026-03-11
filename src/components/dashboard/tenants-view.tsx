
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
  Eye,
  Percent
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isAdjNotifOpen, setIsAdjNotifOpen] = useState(false);
  
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [selectedAdjContract, setSelectedAdjContract] = useState<Contract | null>(null);
  const [isCalculatingIndex, setIsCalculatingIndex] = useState(false);
  const [adjDraft, setAdjDraft] = useState<any>(null);
  const [newRentValueInput, setNewRentValueInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  const handleAutoCalculate = () => {
    if (!selectedAdjContract || !selectedAdjContract.adjustmentMechanism) return;
    setIsCalculatingIndex(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startMonth = selectedAdjContract.startDate.slice(0, 7);
    const indexActual = indexRecords.find(r => r.month === currentMonth && r.type === selectedAdjContract.adjustmentMechanism);
    const indexInicial = indexRecords.find(r => r.month === startMonth && r.type === selectedAdjContract.adjustmentMechanism);

    if (indexActual && indexInicial) {
      const coef = indexActual.value / indexInicial.value;
      const calculated = Math.round(selectedAdjContract.currentRentAmount * coef);
      setNewRentValueInput(calculated.toString());
      toast({ title: "Cálculo Realizado", description: `Coeficiente aplicado: ${coef.toFixed(4)}.` });
    } else {
      toast({ title: "Datos Faltantes", description: "No hay registros suficientes en el historial para calcular.", variant: "destructive" });
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
        newRentAmount: `${selectedAdjContract.currency} ${parseFloat(newRentValueInput).toLocaleString('es-AR')}`,
        adjustmentIndex: selectedAdjContract.adjustmentMechanism || 'Fijo',
        currentLeaseStartDate: selectedAdjContract.startDate,
        currentLeaseEndDate: selectedAdjContract.endDate
      });
      setAdjDraft(draft);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el borrador.", variant: "destructive" });
    }
  };

  const handleSendAdjEmail = async () => {
    if (!selectedAdjContract || !adjDraft) return;
    const tenant = people.find(p => p.id === selectedAdjContract.tenantId);
    if (!tenant?.email) return;
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: adjDraft.subjectLine,
        html: `<div style="text-align: justify;">${adjDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Notificación Enviada", description: "El inquilino ha sido avisado del nuevo monto." });
      setIsAdjNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Fallo el envío de email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
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
            <Button className="bg-primary text-white gap-2" onClick={() => { setEditingContract(null); setIsContractDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Contrato
            </Button>
          ) : (
            <Button className="bg-primary text-white gap-2" onClick={() => setIsPersonDialogOpen(true)}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ficha de Contrato</DialogTitle></DialogHeader>
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="general">Datos Generales</TabsTrigger>
              <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
              <TabsTrigger value="documents">Documentación</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Select value={contractFormData.propertyId} onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}>
                    <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Fecha Inicio</Label><Input type="date" value={contractFormData.startDate} onChange={e => setContractFormData({...contractFormData, startDate: e.target.value})} /></div>
                <div className="space-y-2"><Label>Fecha Fin</Label><Input type="date" value={contractFormData.endDate} onChange={e => setContractFormData({...contractFormData, endDate: e.target.value})} /></div>
              </div>
            </TabsContent>
            <TabsContent value="economic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Monto Base Alquiler</Label><Input type="number" value={contractFormData.baseRentAmount} onChange={e => setContractFormData({...contractFormData, baseRentAmount: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={contractFormData.currency} onValueChange={(v: any) => setContractFormData({...contractFormData, currency: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Mecanismo</Label><Select value={contractFormData.adjustmentMechanism} onValueChange={(v: any) => setContractFormData({...contractFormData, adjustmentMechanism: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ICL">ICL</SelectItem><SelectItem value="IPC">IPC</SelectItem><SelectItem value="Fixed">Fijo</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Punitorios Diarios (%)</Label><Input type="number" step="0.1" value={contractFormData.lateFeePercentage} onChange={e => setContractFormData({...contractFormData, lateFeePercentage: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Frecuencia (Meses)</Label><Input type="number" value={contractFormData.adjustmentFrequencyMonths} onChange={e => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} /></div>
              </div>
            </TabsContent>
            <TabsContent value="documents" className="pt-4 space-y-4">
              <ScrollArea className="h-[200px] border rounded p-4 font-mono text-[10px]">{contractFormData.fullTranscription || "Sin transcripción cargada"}</ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6 pt-4 border-t"><Button onClick={handleSaveContract}>Guardar Cambios</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjNotifOpen} onOpenChange={setIsAdjNotifOpen}>
        <DialogContent className={cn("transition-all duration-500", adjDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Notificar Próximo Mes</DialogTitle></DialogHeader>
          {selectedAdjContract && !adjDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Actual</p>
                <p className="text-2xl font-black text-primary">{selectedAdjContract.currency} {selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label className="text-[10px] font-black uppercase text-primary">Nuevo Valor Estimado</Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-black flex gap-1" onClick={handleAutoCalculate} disabled={isCalculatingIndex}>
                    {isCalculatingIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Calcular con Índices
                  </Button>
                </div>
                <Input type="number" className="h-12 text-lg font-black" value={newRentValueInput} onChange={e => setNewRentValueInput(e.target.value)} />
              </div>
              <Button className="w-full h-11 font-black" onClick={handleGenerateAdjDraft} disabled={!newRentValueInput}>Generar Previsualización</Button>
            </div>
          )}
          {adjDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/30 rounded-lg border"><Label className="text-[10px] font-black block mb-1 uppercase">Asunto</Label><p className="font-bold text-sm">{adjDraft.subjectLine}</p></div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap">{adjDraft.draftedMessage}</ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAdjDraft(null)}>Atrás</Button>
                <Button className="bg-primary font-black gap-2 h-11 px-8" onClick={handleSendAdjEmail} disabled={isSendingEmail}>{isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar Envío</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino</TableHead><TableHead>Mora Pactada</TableHead><TableHead>Próximo Ajuste</TableHead><TableHead className="text-right">Alquiler</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id}>
                  <TableCell><span className="font-bold">{c.tenantName}</span><br/><span className="text-[10px]">{c.propertyName}</span></TableCell>
                  <TableCell><Badge variant="outline" className="text-red-600 border-red-200">{c.lateFeePercentage || 0.5}% diario</Badge></TableCell>
                  <TableCell><div className="flex items-center gap-1 text-xs"><Calendar className="h-3 w-3" /> {c.adjustmentMechanism} - {c.adjustmentFrequencyMonths}m</div></TableCell>
                  <TableCell className="text-right font-black text-primary">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="text-primary" onClick={() => { setSelectedAdjContract(c); setAdjDraft(null); setNewRentValueInput(''); setIsAdjNotifOpen(true); }}><TrendingUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingContract(c); setContractFormData(c); setIsContractDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Nombre</TableHead><TableHead>CUIT/DNI</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.map(p => (
                <TableRow key={p.id}><TableCell className="font-bold">{p.fullName}</TableCell><TableCell>{p.taxId}</TableCell><TableCell><Badge variant="outline">{p.type}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
