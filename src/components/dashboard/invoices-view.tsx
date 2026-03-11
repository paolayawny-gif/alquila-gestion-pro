
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
  TrendingUp
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
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { queryContract } from '@/ai/flows/query-contract-flow';
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
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isGeneratingRent, setIsGeneratingRent] = useState(false);
  const [analyzingInvId, setAnalyzingInvId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { payer: ChargePayer, reason: string }>>({});

  const peopleQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos'));
  }, [db, userId]);
  const { data: people } = useCollection<Person>(peopleQuery);

  const informedPayments = invoices.filter(i => i.status === 'Pago Informado');
  const ownerSubmissions = invoices.filter(i => i.isFromOwner);

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
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleGenerateMonthlyRent = async () => {
    if (!userId || !db) return;
    setIsGeneratingRent(true);
    const currentMonth = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const dueDate = new Date(new Date().getFullYear(), new Date().getMonth(), 10).toLocaleDateString('es-AR');

    let count = 0;
    contracts.filter(c => c.status === 'Vigente').forEach(contract => {
      // Evitar duplicados para el mismo mes
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
      description: `Se han generado ${count} facturas de alquiler para ${currentMonth}.` 
    });
  };

  const handleAnalyzeWithAI = async (inv: Invoice) => {
    if (!userId || !db) return;
    setAnalyzingInvId(inv.id);
    
    try {
      const contract = contracts.find(c => c.propertyName === inv.propertyName && c.status === 'Vigente');
      if (!contract || !contract.fullTranscription) {
        toast({ title: "Sin datos", description: "No hay contrato transcrito para analizar responsabilidades.", variant: "destructive" });
        return;
      }

      const chargeType = inv.charges[0]?.type || 'servicio';
      const prompt = `Según el contrato, ¿quién debe pagar el concepto de "${chargeType}"? Responde solo con una palabra: "Inquilino" o "Propietario".`;
      
      const result = await queryContract({
        contractTranscription: contract.fullTranscription,
        question: prompt
      });

      const suggestion = result.answer.includes('Inquilino') ? 'Inquilino' : 'Propietario';
      setAiSuggestions(prev => ({ ...prev, [inv.id]: { payer: suggestion as ChargePayer, reason: result.sourceQuote || '' } }));
      
      toast({ title: "Análisis IA", description: `Sugerencia: Imputar a ${suggestion}.` });
    } catch (e) {
      toast({ title: "Error", description: "La IA no pudo determinar la responsabilidad.", variant: "destructive" });
    } finally {
      setAnalyzingInvId(null);
    }
  };

  const handleProcessOwnerBill = async (inv: Invoice, manualPayer?: ChargePayer) => {
    if (!userId || !db) return;
    const contract = contracts.find(c => c.propertyName === inv.propertyName && c.status === 'Vigente');
    if (!contract) {
      toast({ title: "Error", description: "No hay contrato vigente para esta propiedad.", variant: "destructive" });
      return;
    }

    const payer = manualPayer || aiSuggestions[inv.id]?.payer || 'Inquilino';
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
    
    const updatedCharges = inv.charges.map(c => ({ ...c, imputedTo: payer }));
    const total = payer === 'Inquilino' ? inv.totalAmount : 0;

    setDocumentNonBlocking(docRef, { 
      contractId: contract.id, 
      tenantName: contract.tenantName,
      charges: updatedCharges,
      totalAmount: total,
      isFromOwner: false,
      status: 'Pendiente'
    }, { merge: true });

    if (payer === 'Inquilino') {
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
          html: `<div style="text-align: justify;">${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
        });
      }
    }

    toast({ title: "Factura Procesada", description: `Imputada a ${payer} correctamente.` });
  };

  const handleValidatePayment = (inv: Invoice) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
    setDocumentNonBlocking(docRef, { status: 'Pagado' }, { merge: true });
    toast({ title: "Pago Validado", description: "La cuenta ha sido actualizada." });
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

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);
    
    const invoiceData: Invoice = {
      id: docId,
      contractId: contract.id,
      tenantName: contract.tenantName || 'Inquilino',
      propertyName: contract.propertyName || 'Propiedad',
      period: manualCharge.period,
      charges: [charge],
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {informedPayments.length > 0 && (
          <Card className="bg-blue-50 border-blue-200 border shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><p className="text-xs font-black text-blue-700 uppercase tracking-tight">Pagos Informados por Inquilinos</p></div>
              {informedPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-bold">{p.tenantName}</span>
                    <span className="text-[9px] text-muted-foreground">{p.period} • $ {p.totalAmount.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => window.open(p.paymentReceiptUrl)} title="Ver Comprobante"><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" className="h-7 bg-blue-600 text-white text-[10px] px-3 font-bold" onClick={() => handleValidatePayment(p)}>Validar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {ownerSubmissions.length > 0 && (
          <Card className="bg-orange-50 border-orange-200 border shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-orange-600" /><p className="text-xs font-black text-orange-700 uppercase tracking-tight">Facturas Entrantes de Dueños</p></div>
              {ownerSubmissions.map(p => (
                <div key={p.id} className="flex flex-col bg-white p-3 rounded-lg border shadow-sm gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-foreground">{p.propertyName}</span>
                      <span className="text-[10px] text-muted-foreground">{p.charges[0]?.type} • $ {p.totalAmount.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" onClick={() => window.open(p.paymentReceiptUrl)}><Eye className="h-4 w-4" /></Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className={cn("h-7 w-7", aiSuggestions[p.id] ? "text-primary bg-primary/10" : "text-muted-foreground")}
                        onClick={() => handleAnalyzeWithAI(p)}
                        disabled={analyzingInvId === p.id}
                      >
                        {analyzingInvId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  {aiSuggestions[p.id] && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/10 flex items-start gap-2">
                      <Zap className="h-3 w-3 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[9px] font-bold text-primary">Sugerencia IA: Imputar a {aiSuggestions[p.id].payer}</p>
                        <p className="text-[8px] text-muted-foreground leading-tight italic line-clamp-1">"{aiSuggestions[p.id].reason}"</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] gap-1 font-bold border-muted-foreground/20" onClick={() => handleProcessOwnerBill(p, 'Propietario')}><UserMinus className="h-3 w-3" /> Dueño</Button>
                    <Button size="sm" className="flex-1 h-7 text-[10px] gap-1 font-bold bg-primary" onClick={() => handleProcessOwnerBill(p, 'Inquilino')}><UserCheck className="h-3 w-3" /> Inquilino</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 h-10 border-none bg-muted/50" />
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary/5 gap-2 font-bold"
            onClick={handleGenerateMonthlyRent}
            disabled={isGeneratingRent}
          >
            {isGeneratingRent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Generar Alquileres Mes
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
              <TableHead className="text-right">Total a Cobrar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.filter(i => !i.isFromOwner).map((i) => (
              <TableRow key={i.id} className="group hover:bg-muted/30">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-black text-foreground">{i.tenantName}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{i.propertyName} • {i.period}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 max-w-[300px]">
                    {i.charges.map((c, idx) => (
                      <div key={idx} className={cn(
                        "flex justify-between text-[10px] py-0.5 border-b border-dashed px-1",
                        c.imputedTo === 'Propietario' ? "text-orange-600 bg-orange-50/50" : "text-foreground"
                      )}>
                        <span className="flex items-center gap-1">
                          {c.type === 'Alquiler' ? <FileText className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                          {c.type} {c.imputedTo === 'Propietario' && "(Deducción)"}
                        </span>
                        <span className="font-bold">$ {c.amount.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-black text-primary text-base">$ {i.totalAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Eye className="h-4 w-4" /></Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive" 
                      onClick={() => {
                        if (userId && db) deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', i.id));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {invoices.filter(i => !i.isFromOwner).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-24">
                  <div className="flex flex-col items-center justify-center text-muted-foreground opacity-40 space-y-2">
                    <TrendingUp className="h-12 w-12" />
                    <p className="text-sm font-bold">No hay facturas generadas. Pulsa "Generar Alquileres" para comenzar.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
