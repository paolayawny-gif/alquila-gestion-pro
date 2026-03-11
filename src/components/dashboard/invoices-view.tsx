
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
  ArrowRightLeft,
  CheckCircle2,
  Eye,
  FileSearch,
  Send
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

const CHARGE_TYPES: ChargeType[] = ['Alquiler', 'Expensa Ordinaria', 'Expensa Extraordinaria', 'TGI/ABL', 'Aguas', 'Luz/Gas', 'Otros'];

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

  const informedPayments = invoices.filter(i => i.status === 'Pago Informado');
  const ownerSubmissions = invoices.filter(i => i.isFromOwner);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Pago Informado': 'bg-blue-100 text-blue-700 border-blue-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleValidatePayment = (inv: Invoice) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
    setDocumentNonBlocking(docRef, { status: 'Pagado' }, { merge: true });
    toast({ title: "Pago Validado", description: "La cuenta del inquilino ha sido actualizada." });
  };

  const handleProcessOwnerBill = async (inv: Invoice) => {
    if (!userId || !db) return;
    const contract = contracts.find(c => c.propertyName === inv.propertyName && c.status === 'Vigente');
    if (!contract) {
      toast({ title: "Error", description: "No se encontró un contrato vigente para esta propiedad.", variant: "destructive" });
      return;
    }

    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
    setDocumentNonBlocking(docRef, { 
      contractId: contract.id, 
      tenantName: contract.tenantName,
      isFromOwner: false,
      status: 'Pendiente'
    }, { merge: true });

    // Notificar al inquilino por IA
    const draft = await aiCommunicationAssistant({
      communicationType: 'generalMessage',
      tenantName: contract.tenantName,
      propertyName: inv.propertyName,
      additionalContext: `Se adjunta nueva factura de ${inv.charges[0]?.type || 'servicio'} por un valor de $ ${inv.totalAmount.toLocaleString('es-AR')} con vencimiento el ${inv.dueDate}.`
    });

    const tenant = people?.find(p => p.id === contract.tenantId);
    if (tenant?.email) {
      await sendEmail({
        to: tenant.email,
        subject: draft.subjectLine,
        html: `<div>${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Factura Imputada", description: "Se notificó al inquilino vía IA." });
    }
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {informedPayments.length > 0 && (
          <Card className="bg-blue-50 border-blue-200 border shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><p className="text-xs font-black text-blue-700 uppercase">Pagos Informados por Inquilinos</p></div>
              {informedPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs">
                  <span>{p.tenantName} - {p.period}</span>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => window.open(p.paymentReceiptUrl)}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" className="h-7 bg-blue-600 text-white text-[10px]" onClick={() => handleValidatePayment(p)}>Validar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {ownerSubmissions.length > 0 && (
          <Card className="bg-orange-50 border-orange-200 border shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-orange-600" /><p className="text-xs font-black text-orange-700 uppercase">Facturas Recibidas de Dueños</p></div>
              {ownerSubmissions.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs">
                  <div className="flex flex-col">
                    <span className="font-bold">{p.propertyName}</span>
                    <span className="text-[9px] text-muted-foreground">{p.charges[0]?.type} • $ {p.totalAmount.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" onClick={() => window.open(p.paymentReceiptUrl)}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" className="h-7 bg-orange-600 text-white text-[10px]" onClick={() => handleProcessOwnerBill(p)}>Imputar a Inquilino</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 bg-white" /></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild><Button className="bg-primary text-white gap-2 shadow-sm"><Plus className="h-4 w-4" /> Cargo Manual</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo Cargo Directo</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Contrato / Unidad</Label><Select onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Tipo de Concepto</Label><Select value={manualCharge.type} onValueChange={(v: any) => setManualCharge({...manualCharge, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHARGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Monto</Label><Input type="number" onChange={(e) => setManualCharge({...manualCharge, amount: parseFloat(e.target.value)})} /></div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Período (Mes/Año)</Label><Input placeholder="Ej: Mayo 2026" onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Responsable del Pago</Label><Select value={manualCharge.imputedTo} onValueChange={(v: any) => setManualCharge({...manualCharge, imputedTo: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Inquilino">Inquilino</SelectItem><SelectItem value="Propietario">Propietario</SelectItem></SelectContent></Select></div>
                </div>
              </div>
              <DialogFooter className="mt-4"><Button className="w-full" onClick={handleSaveManualCharge}>Generar Cargo</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino / Unidad</TableHead><TableHead>Cargos</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {invoices.filter(i => !i.isFromOwner).map((i) => (
              <TableRow key={i.id} className="group">
                <TableCell><span className="font-bold">{i.tenantName}</span><br/><span className="text-[10px] text-muted-foreground">{i.propertyName} • {i.period}</span></TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {i.charges.map((c, idx) => (<div key={idx} className="flex justify-between text-[10px] border-b border-dashed"><span>{c.type}</span><span>$ {c.amount.toLocaleString('es-AR')}</span></div>))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-black text-primary">$ {i.totalAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId!, 'facturas', i.id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
