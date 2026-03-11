
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Sparkles, 
  Loader2, 
  Trash2, 
  Eye, 
  FileSearch, 
  CreditCard,
  CalendarCheck,
  Zap,
  Info,
  UserCheck,
  UserMinus,
  CheckCircle2,
  FileText,
  TrendingUp,
  FileUp,
  Send,
  AlertCircle,
  UploadCloud,
  FileCheck,
  MessageSquare,
  Gavel
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, query, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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
  const arcaInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isGeneratingRent, setIsGeneratingRent] = useState(false);
  const [uploadingArcaFor, setUploadingArcaFor] = useState<string | null>(null);
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<string | null>(null);
  
  // Estado para punitorios manuales
  const [isLateFeeDialogOpen, setIsLateFeeDialogOpen] = useState(false);
  const [selectedInvForFee, setSelectedInvForFee] = useState<Invoice | null>(null);
  const [manualFeeInput, setManualFeeInput] = useState<string>('');

  // Estado para el diálogo de confirmación de pago con notas
  const [isReceiptConfirmDialogOpen, setIsReceiptConfirmDialogOpen] = useState(false);
  const [receiptNote, setReceiptNote] = useState('');
  const [tempReceiptFile, setTempReceiptFile] = useState<{ url: string, name: string } | null>(null);

  const peopleQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos'));
  }, [db, userId]);
  const { data: people } = useCollection<Person>(peopleQuery);

  const informedPayments = invoices.filter(i => i.status === 'Pago Informado');
  const ownerSubmissions = invoices.filter(i => i.isFromOwner && i.status === 'Esperando Factura ARCA');

  const [manualCharge, setManualCharge] = useState({
    contractId: '',
    type: 'Expensa Ordinaria' as ChargeType,
    description: '',
    amount: 0,
    imputedTo: 'Inquilino' as ChargePayer,
    period: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0]
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Pago Informado': 'bg-blue-100 text-blue-700 border-blue-200',
      'Esperando Factura ARCA': 'bg-purple-100 text-purple-700 border-purple-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const calculateInterest = (inv: Invoice) => {
    // Si ya hay un punitorio guardado manualmente, usamos ese
    if (inv.lateFees > 0) return inv.lateFees;

    const contract = contracts.find(c => c.id === inv.contractId);
    if (!contract || !contract.lateFeePercentage) return 0;

    const [day, month, year] = inv.dueDate.split('/');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();

    if (today > dueDate && inv.status !== 'Pagado') {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return (inv.totalAmount * (contract.lateFeePercentage / 100)) * diffDays;
    }
    return 0;
  };

  const handleSaveManualFee = () => {
    if (!selectedInvForFee || !userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', selectedInvForFee.id);
    setDocumentNonBlocking(docRef, { lateFees: parseFloat(manualFeeInput) || 0 }, { merge: true });
    setIsLateFeeDialogOpen(false);
    toast({ title: "Punitorio Actualizado", description: "Se ha registrado el monto manual de intereses." });
  };

  const handleGenerateMonthlyRent = async () => {
    if (!userId || !db) return;
    setIsGeneratingRent(true);
    const currentMonth = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const dueDate = new Date(new Date().getFullYear(), new Date().getMonth(), 10).toLocaleDateString('es-AR');

    let count = 0;
    contracts.filter(c => c.status === 'Vigente').forEach(contract => {
      const exists = invoices.find(i => i.contractId === contract.id && i.period === currentMonth && i.charges.some(ch => ch.type === 'Alquiler'));
      if (!exists) {
        const docId = Math.random().toString(36).substr(2, 9);
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);
        
        const invoiceData: Invoice = {
          id: docId,
          contractId: contract.id,
          tenantName: contract.tenantName || 'Inquilino',
          propertyName: contract.propertyName || 'Propiedad',
          period: currentMonth,
          charges: [{
            id: 'rent-charge',
            type: 'Alquiler',
            description: `Alquiler mensual - ${currentMonth}`,
            amount: contract.currentRentAmount,
            imputedTo: 'Inquilino'
          }],
          lateFees: 0,
          totalAmount: contract.currentRentAmount,
          currency: contract.currency,
          dueDate: dueDate,
          status: 'Pendiente'
        };
        setDocumentNonBlocking(docRef, invoiceData, { merge: true });
        count++;
      }
    });

    setIsGeneratingRent(false);
    toast({ 
      title: "Proceso Completado", 
      description: `Se han generado ${count} recordatorios de alquiler para ${currentMonth}.` 
    });
  };

  const handleUploadArca = (invId: string) => {
    setUploadingArcaFor(invId);
    arcaInputRef.current?.click();
  };

  const handleUploadReceipt = (invId: string) => {
    setUploadingReceiptFor(invId);
    receiptInputRef.current?.click();
  };

  const handleArcaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingArcaFor || !userId || !db) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', uploadingArcaFor);
      setDocumentNonBlocking(docRef, { 
        arcaInvoiceUrl: event.target?.result as string,
        arcaInvoiceName: file.name,
        status: 'Esperando Factura ARCA' 
      }, { merge: true });
      
      toast({ title: "Factura Cargada", description: "El documento legal ha sido vinculado." });
      setUploadingArcaFor(null);
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingReceiptFor) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setTempReceiptFile({
        url: event.target?.result as string,
        name: file.name
      });
      setIsReceiptConfirmDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmReceipt = () => {
    if (!tempReceiptFile || !uploadingReceiptFor || !userId || !db) return;

    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', uploadingReceiptFor);
    setDocumentNonBlocking(docRef, { 
      paymentReceiptUrl: tempReceiptFile.url,
      paymentReceiptName: tempReceiptFile.name,
      status: 'Pagado',
      paymentDate: new Date().toLocaleDateString('es-AR'),
      internalNotes: receiptNote
    }, { merge: true });
    
    toast({ title: "Pago Registrado", description: "Comprobante cargado exitosamente." });
    setIsReceiptConfirmDialogOpen(false);
    setTempReceiptFile(null);
    setUploadingReceiptFor(null);
    setReceiptNote('');
  };

  const handleSendFormalInvoice = async (inv: Invoice) => {
    if (!userId || !db) return;
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'generalMessage',
        tenantName: inv.tenantName,
        propertyName: inv.propertyName,
        additionalContext: `Se remite el comprobante fiscal formal por ${inv.period} ($ ${inv.totalAmount.toLocaleString('es-AR')}). El mismo ya se encuentra disponible en su portal.`
      });

      const tenant = people?.find(p => p.fullName === inv.tenantName);
      if (tenant?.email) {
        await sendEmail({
          to: tenant.email,
          subject: draft.subjectLine,
          html: `<div style="text-align: justify;">${draft.draftedMessage.replace(/\n/g, '<br/>')}</div><br/><p>Puede ver y descargar su factura desde su portal personal.</p>`
        });
        toast({ title: "Email Enviado", description: "El inquilino ha sido notificado formalmente." });
      }
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar el correo.", variant: "destructive" });
    }
  };

  const handleValidatePayment = (inv: Invoice) => {
    if (!userId || !db) return;
    setUploadingReceiptFor(inv.id);
    setIsReceiptConfirmDialogOpen(true);
  };

  const handleSaveManualCharge = () => {
    if (!manualCharge.contractId || !userId || !db) return;
    const contract = contracts.find(c => c.id === manualCharge.contractId);
    if (!contract) return;
    
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);
    
    const invoiceData: Invoice = {
      id: docId,
      contractId: contract.id,
      tenantName: contract.tenantName || 'Inquilino',
      propertyName: contract.propertyName || 'Propiedad',
      period: manualCharge.period,
      charges: [{
        id: Math.random().toString(36).substr(2, 9),
        type: manualCharge.type,
        description: manualCharge.description || `${manualCharge.type}`,
        amount: manualCharge.amount,
        imputedTo: manualCharge.imputedTo
      }],
      lateFees: 0,
      totalAmount: manualCharge.imputedTo === 'Inquilino' ? manualCharge.amount : 0,
      currency: contract.currency,
      dueDate: manualCharge.dueDate,
      status: 'Pendiente'
    };

    setDocumentNonBlocking(docRef, invoiceData, { merge: true });
    setIsManualDialogOpen(false);
    toast({ title: "Cargo Generado", description: "El concepto ha sido registrado." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <input type="file" ref={arcaInputRef} className="hidden" accept=".pdf,image/*" onChange={handleArcaFileChange} />
      <input type="file" ref={receiptInputRef} className="hidden" accept=".pdf,image/*" onChange={handleReceiptFileChange} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-200 border shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><p className="text-xs font-black text-blue-700 uppercase tracking-tight">Pagos Informados (Inquilinos)</p></div>
            {informedPayments.length === 0 && <p className="text-[10px] text-muted-foreground italic">Sin pagos nuevos.</p>}
            {informedPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm">
                <span className="font-bold truncate max-w-[100px]">{p.tenantName}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => window.open(p.paymentReceiptUrl)} title="Ver Transferencia"><Eye className="h-4 w-4" /></Button>
                  <Button size="sm" className="h-7 bg-blue-600 text-white text-[10px] px-3 font-bold" onClick={() => handleValidatePayment(p)}>Validar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200 border shadow-none md:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" /><p className="text-xs font-black text-purple-700 uppercase tracking-tight">Pendiente Digitalización (Dueños / Propios)</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownerSubmissions.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm border-l-4 border-l-purple-500">
                  <div className="flex flex-col">
                    <span className="font-bold truncate max-w-[120px]">{p.propertyName}</span>
                    <span className="text-[9px] text-muted-foreground">Cargado por Dueño</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-purple-600" onClick={() => window.open(p.arcaInvoiceUrl)} title="Ver Documento"><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" className="h-7 border-purple-600 text-purple-600 text-[10px] gap-1 font-bold" onClick={() => handleSendFormalInvoice(p)}>Notificar</Button>
                  </div>
                </div>
              ))}
              {invoices.filter(i => i.charges.some(c => c.type === 'Alquiler') && !i.arcaInvoiceUrl && i.status !== 'Pagado' && !i.isFromOwner).slice(0, 2).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm">
                  <span className="font-bold truncate max-w-[100px]">{p.tenantName}</span>
                  <Button size="sm" variant="outline" className="h-7 border-purple-600 text-purple-600 text-[10px] gap-1 font-bold" onClick={() => handleUploadArca(p.id)}><FileUp className="h-3 w-3" /> Subir ARCA</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar facturas..." className="pl-9 h-10 border-none bg-muted/50" />
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 gap-2 font-bold" onClick={handleGenerateMonthlyRent} disabled={isGeneratingRent}>
            {isGeneratingRent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Generar Mensuales
          </Button>

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2 font-bold shadow-sm px-6">
                <Plus className="h-4 w-4" /> Nuevo Cargo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Cargo / Concepto</DialogTitle>
                <DialogDescription>Cargue un gasto manual para un contrato específico.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contrato / Unidad</Label>
                    <Select onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                      <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Concepto</Label>
                    <Select value={manualCharge.type} onValueChange={(v: any) => setManualCharge({...manualCharge, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input type="number" placeholder="0.00" onChange={(e) => setManualCharge({...manualCharge, amount: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Período (Mes/Año)</Label>
                    <Input value={manualCharge.period} onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsable del Pago</Label>
                    <Select value={manualCharge.imputedTo} onValueChange={(v: any) => setManualCharge({...manualCharge, imputedTo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inquilino">Inquilino (Suma al total)</SelectItem>
                        <SelectItem value="Propietario">Propietario (Deducción p/dueño)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Vencimiento</Label>
                    <Input type="date" value={manualCharge.dueDate} onChange={e => setManualCharge({...manualCharge, dueDate: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="ghost" onClick={() => setIsManualDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary px-8 font-black" onClick={handleSaveManualCharge}>Generar Cargo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Inquilino / Unidad</TableHead>
              <TableHead>Detalle de Cargos</TableHead>
              <TableHead className="text-right">Total (con Mora)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => {
              const interest = calculateInterest(i);
              const contract = contracts.find(c => c.id === i.contractId);
              
              return (
                <TableRow key={i.id} className="group hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-black text-foreground">{i.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{i.propertyName} • {i.period}</span>
                      {i.isFromOwner && <Badge className="w-fit text-[8px] bg-purple-100 text-purple-700 h-4 px-1 mt-1">Enviado por Dueño</Badge>}
                      {i.internalNotes && (
                        <div className="flex items-center gap-1 text-[9px] text-blue-600 mt-1 italic font-medium">
                          <MessageSquare className="h-2.5 w-2.5" /> {i.internalNotes}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[300px]">
                      {i.charges.map((c, idx) => (
                        <div key={idx} className={cn(
                          "flex justify-between text-[10px] py-0.5 border-b border-dashed px-1",
                          c.imputedTo === 'Propietario' ? "text-orange-600 bg-orange-50/50" : "text-foreground"
                        )}>
                          <span>{c.type}</span>
                          <span className="font-bold">$ {c.amount.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                      {interest > 0 && (
                        <div className="flex justify-between text-[10px] py-0.5 text-red-600 font-bold px-1 bg-red-50 group/fee relative">
                          <span>Intereses (Mora)</span>
                          <div className="flex items-center gap-1">
                            <span>$ {interest.toLocaleString('es-AR')}</span>
                            <button 
                              onClick={() => { setSelectedInvForFee(i); setManualFeeInput(interest.toString()); setIsLateFeeDialogOpen(true); }}
                              className="text-primary hover:underline"
                              title="Ajustar manualmente"
                            >
                              <Gavel className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      {interest === 0 && i.status !== 'Pagado' && (
                        <button 
                          onClick={() => { setSelectedInvForFee(i); setManualFeeInput('0'); setIsLateFeeDialogOpen(true); }}
                          className="text-[9px] text-primary font-bold hover:underline w-fit"
                        >
                          + Cargar Punitorio Manual
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary text-base">
                    $ {(i.totalAmount + interest).toLocaleString('es-AR')}
                  </TableCell>
                  <TableCell>{getStatusBadge(i.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {i.status !== 'Pagado' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600" 
                          title="Cargar Pago (Manual/WhatsApp)"
                          onClick={() => handleUploadReceipt(i.id)}
                        >
                          <UploadCloud className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {i.paymentReceiptUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" title="Ver Comprobante de Pago" onClick={() => window.open(i.paymentReceiptUrl)}>
                          <FileCheck className="h-4 w-4" />
                        </Button>
                      )}

                      {i.arcaInvoiceUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Enviar Notificación" onClick={() => handleSendFormalInvoice(i)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {!i.arcaInvoiceUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" title="Subir Factura ARCA" onClick={() => handleUploadArca(i.id)}>
                          <FileUp className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (userId && db) deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', i.id)); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Diálogo de Punitorios Manuales */}
      <Dialog open={isLateFeeDialogOpen} onOpenChange={setIsLateFeeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Punitorios</DialogTitle>
            <DialogDescription>
              Fije un monto manual de intereses para esta factura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto de Intereses (ARS)</Label>
              <Input 
                type="number" 
                value={manualFeeInput} 
                onChange={e => setManualFeeInput(e.target.value)} 
                placeholder="0.00"
                className="h-12 text-lg font-black text-red-600"
              />
              <p className="text-[10px] text-muted-foreground">
                Este monto se sumará al total de la factura. Use 0 para anular punitorios calculados.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLateFeeDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black px-8" onClick={handleSaveManualFee}>Guardar Punitorio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Pago con Notas */}
      <Dialog open={isReceiptConfirmDialogOpen} onOpenChange={setIsReceiptConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Registro de Pago</DialogTitle>
            <DialogDescription>
              Complete los detalles del pago recibido. El estado de la factura pasará a "Pagado".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tempReceiptFile && (
              <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                <span className="text-xs font-bold truncate">{tempReceiptFile.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observaciones Internas</Label>
              <Textarea 
                placeholder="Ej: Enviado por WhatsApp - Confirmado Banco" 
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-[10px] text-muted-foreground italic">Esta nota solo es visible para la administración.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReceiptConfirmDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black px-8" onClick={handleConfirmReceipt}>Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
