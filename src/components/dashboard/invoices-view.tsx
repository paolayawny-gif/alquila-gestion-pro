
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  Sparkles,
  Loader2,
  MailCheck,
  AlertTriangle,
  BellRing,
  FileText,
  Trash2,
  ArrowRightLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, Contract, ChargeType, ChargePayer, ChargeItem, Person } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data-flow';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, query, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from '@/components/ui/separator';

interface InvoicesViewProps {
  invoices: Invoice[];
  userId?: string;
  contracts: Contract[];
}

const APP_ID = "alquilagestion-pro";

const CHARGE_TYPES: ChargeType[] = [
  'Alquiler', 
  'Expensa Ordinaria', 
  'Expensa Extraordinaria', 
  'TGI/ABL', 
  'Aguas', 
  'Luz/Gas', 
  'Otros'
];

export function InvoicesView({ invoices, userId, contracts }: InvoicesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractInvoiceDataOutput | null>(null);
  const [imputedTo, setImputedTo] = useState<ChargePayer>('Inquilino');
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  const [manualCharge, setManualCharge] = useState({
    contractId: '',
    type: 'Expensa Ordinaria' as ChargeType,
    description: '',
    amount: 0,
    imputedTo: 'Inquilino' as ChargePayer,
    period: '',
    dueDate: '2026-05-10'
  });

  const peopleQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos'));
  }, [db, userId]);
  const { data: people } = useCollection<Person>(peopleQuery);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleBulkReminders = async (type: 'initial' | 'overdue') => {
    if (!userId || !db || !people) return;
    setIsBulkLoading(true);
    let sentCount = 0;
    try {
      const targets = invoices.filter(inv => {
        if (type === 'initial') return inv.status === 'Pendiente';
        if (type === 'overdue') return inv.status === 'Vencido';
        return false;
      });
      if (targets.length === 0) {
        toast({ title: "Sin facturas", description: "No hay documentos que requieran este aviso." });
        setIsBulkLoading(false);
        return;
      }
      for (const inv of targets) {
        const contract = contracts.find(c => c.id === inv.contractId);
        const tenant = people.find(p => p.id === contract?.tenantId);
        if (tenant?.email) {
          const draft = await aiCommunicationAssistant({
            communicationType: type === 'initial' ? 'rentReminder' : 'rentOverdue',
            tenantName: tenant.fullName,
            propertyName: inv.propertyName,
            amountDue: `$ ${inv.totalAmount.toLocaleString('es-AR')}`,
            dueDate: inv.dueDate,
          });
          await sendEmail({
            to: tenant.email,
            subject: draft.subjectLine,
            html: `<div>${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
          });
          const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
          setDocumentNonBlocking(docRef, { 
            lastReminderSent: new Date().toLocaleDateString('es-AR'),
            reminderType: type
          }, { merge: true });
          sentCount++;
        }
      }
      toast({ title: "Proceso Completado", description: `Se enviaron ${sentCount} correos.` });
    } catch (error) {
      toast({ title: "Error", description: "Fallo en el proceso masivo.", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result as string;
      setIsAiProcessing(true);
      try {
        const result = await extractInvoiceData({ documentDataUri: dataUri });
        setAiResult(result);
        toast({ title: "Factura Analizada", description: "Datos detectados por IA." });
      } catch (error) {
        toast({ title: "Error", description: "No se pudo leer el archivo.", variant: "destructive" });
      } finally {
        setIsAiProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyAiService = () => {
    if (!aiResult || !selectedContractId || !userId || !db) return;
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return;
    const charge: ChargeItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: aiResult.serviceType as ChargeType,
      description: `IA: ${aiResult.serviceType} - ${aiResult.period || 'Período actual'}`,
      amount: aiResult.amount,
      imputedTo: imputedTo,
      isPaid: false
    };
    saveToFirestore(contract, charge, aiResult.period || 'Actual 2026', aiResult.dueDate || '2026-05-10');
    setAiResult(null);
    setIsAiDialogOpen(false);
  };

  const handleSaveManualCharge = () => {
    if (!manualCharge.contractId || !userId || !db) return;
    const contract = contracts.find(c => c.id === manualCharge.contractId);
    if (!contract) return;
    const charge: ChargeItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: manualCharge.type,
      description: manualCharge.description || `${manualCharge.type}`,
      amount: manualCharge.amount,
      imputedTo: manualCharge.imputedTo,
      isPaid: false
    };
    saveToFirestore(contract, charge, manualCharge.period || 'General 2026', manualCharge.dueDate);
    setIsManualDialogOpen(false);
  };

  const saveToFirestore = (contract: Contract, charge: ChargeItem, period: string, dueDate: string) => {
    if (!userId || !db) return;
    const existing = invoices.find(i => i.contractId === contract.id && i.period === period);
    const docId = existing?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);
    const updatedCharges = existing ? [...existing.charges, charge] : [charge];
    const total = updatedCharges.reduce((acc, c) => acc + (c.imputedTo === 'Inquilino' ? c.amount : 0), 0);
    const invoiceData: Invoice = {
      id: docId,
      contractId: contract.id,
      tenantName: contract.tenantName || 'Sin Nombre',
      propertyName: contract.propertyName || 'Sin Propiedad',
      period: period,
      charges: updatedCharges,
      lateFees: existing?.lateFees || 0,
      totalAmount: total,
      currency: contract.currency,
      dueDate: dueDate,
      status: existing?.status || 'Pendiente',
      hasFile: true
    };
    setDocumentNonBlocking(docRef, invoiceData, { merge: true });
    toast({ title: "Registro Guardado", description: "Concepto imputado correctamente." });
  };

  const handleDeleteInvoice = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="bg-primary/5 border-primary/20 border shadow-none">
        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full"><BellRing className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm font-black text-primary uppercase">Cobranzas Inteligentes</p>
              <p className="text-xs text-muted-foreground">Automatice avisos e intimaciones por email.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button disabled={isBulkLoading} onClick={() => handleBulkReminders('initial')} className="flex-1 md:flex-none bg-white border-primary text-primary hover:bg-primary/10 text-xs font-bold h-9" variant="outline">
              {isBulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MailCheck className="h-3 w-3" />}
              Avisos (Día 1)
            </Button>
            <Button disabled={isBulkLoading} onClick={() => handleBulkReminders('overdue')} className="flex-1 md:flex-none bg-red-600 text-white hover:bg-red-700 text-xs font-bold h-9">
              {isBulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              Intimar Mora
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por inquilino o unidad..." className="pl-9 bg-white" />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary"><Sparkles className="h-4 w-4" /> Carga IA</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Análisis de Expensa/Servicio</DialogTitle></DialogHeader>
              <div className="space-y-6 pt-4">
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  {isAiProcessing ? (
                    <div className="space-y-2"><Loader2 className="animate-spin mx-auto text-primary" /><p className="text-xs">Extrayendo datos...</p></div>
                  ) : (
                    <div className="space-y-2"><Plus className="mx-auto h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">Subir PDF o Imagen</p></div>
                  )}
                </div>
                {aiResult && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Tipo Detectado</Label><Badge className="w-full justify-center">{aiResult.serviceType}</Badge></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Monto</Label><p className="font-black text-primary">$ {aiResult.amount.toLocaleString('es-AR')}</p></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Imputar cargo a:</Label>
                      <Select value={imputedTo} onValueChange={(v: ChargePayer) => setImputedTo(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Inquilino">Inquilino (Suma al total)</SelectItem><SelectItem value="Propietario">Propietario (Deduce de liquidación)</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Asignar a Contrato/Unidad</Label>
                      <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                        <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                        <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName} - {c.tenantName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={handleApplyAiService}>Confirmar Imputación</Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2 shadow-sm"><Plus className="h-4 w-4" /> Cargo Manual</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo Cargo Directo</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contrato / Unidad</Label>
                    <Select value={manualCharge.contractId} onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                      <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Concepto</Label>
                    <Select value={manualCharge.type} onValueChange={(v: ChargeType) => setManualCharge({...manualCharge, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input type="number" placeholder="ARS" onChange={(e) => setManualCharge({...manualCharge, amount: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Período (Mes/Año)</Label>
                    <Input placeholder="Ej: Mayo 2026" onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsable del Pago</Label>
                    <Select value={manualCharge.imputedTo} onValueChange={(v: ChargePayer) => setManualCharge({...manualCharge, imputedTo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Inquilino">Inquilino</SelectItem><SelectItem value="Propietario">Propietario</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción Breve</Label>
                    <Input placeholder="Opcional..." onChange={(e) => setManualCharge({...manualCharge, description: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4"><Button className="w-full" onClick={handleSaveManualCharge}>Generar Cargo</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Unidad / Período</TableHead>
              <TableHead>Composición de Cargos</TableHead>
              <TableHead className="text-right">Total Inquilino</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{i.tenantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black">{i.propertyName} • {i.period}</span>
                    <span className="text-[9px] text-muted-foreground">Vence: {i.dueDate}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {i.charges.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 text-[10px] border-b border-dashed last:border-none pb-1">
                        <span className="flex items-center gap-1">
                          <Badge variant="ghost" className={cn("h-4 p-0 text-[8px] font-black uppercase", c.imputedTo === 'Inquilino' ? "text-blue-600" : "text-orange-600")}>
                            {c.imputedTo[0]}
                          </Badge>
                          {c.type}
                        </span>
                        <span className="font-mono">$ {c.amount.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-black text-primary text-base">$ {i.totalAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(i.status)}
                    {i.lastReminderSent && (
                      <span className="text-[8px] text-blue-600 font-bold flex items-center gap-1"><MailCheck className="h-3 w-3" /> {i.lastReminderSent}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteInvoice(i.id)}><Trash2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay registros para este período.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

