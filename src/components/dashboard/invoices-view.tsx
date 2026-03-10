
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  CreditCard,
  Send,
  Sparkles,
  Loader2,
  Upload,
  DollarSign
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, Contract, ChargeType, ChargePayer, ChargeItem } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface InvoicesViewProps {
  invoices: Invoice[];
  userId?: string;
  contracts: Contract[];
}

const APP_ID = "alquilagestion-pro";

export function InvoicesView({ invoices, userId, contracts }: InvoicesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractInvoiceDataOutput | null>(null);
  const [imputedTo, setImputedTo] = useState<ChargePayer>('Inquilino');
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  const [manualCharge, setManualCharge] = useState({
    contractId: '',
    type: 'Otros' as ChargeType,
    description: '',
    amount: 0,
    imputedTo: 'Inquilino' as ChargePayer,
    period: '',
    dueDate: '2026-05-10'
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
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

    const periodStr = aiResult.period || "Actual 2026";
    const charge: ChargeItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: aiResult.serviceType as ChargeType,
      description: `IA: ${aiResult.serviceType}`,
      amount: aiResult.amount,
      imputedTo: imputedTo,
      isPaid: false
    };

    saveToFirestore(contract, charge, periodStr, aiResult.dueDate || '2026-05-10');
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
      description: manualCharge.description || `${manualCharge.type} - ${manualCharge.period}`,
      amount: manualCharge.amount,
      imputedTo: manualCharge.imputedTo,
      isPaid: false
    };

    saveToFirestore(contract, charge, manualCharge.period, manualCharge.dueDate);
    setIsManualDialogOpen(false);
  };

  const saveToFirestore = (contract: Contract, charge: ChargeItem, period: string, dueDate: string) => {
    if (!userId || !db) return;
    
    // Buscamos si ya existe una factura para este contrato y periodo en el estado local de la lista actual
    // para replicar el comportamiento de agrupación.
    const existing = invoices.find(i => i.contractId === contract.id && i.period === period);
    
    const docId = existing?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);

    const updatedCharges = existing ? [...existing.charges, charge] : [charge];
    const total = updatedCharges.reduce((acc, c) => acc + (c.imputedTo === 'Inquilino' ? c.amount : -c.amount), 0);

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
    toast({ title: "Factura Guardada", description: "Registro sincronizado con la nube." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtrar facturas..." className="pl-9 bg-white" />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary"><Sparkles className="h-4 w-4" /> IA Factura</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Análisis con IA</DialogTitle></DialogHeader>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed p-8 text-center cursor-pointer">
                {isAiProcessing ? <Loader2 className="animate-spin mx-auto" /> : <p>Subir Factura</p>}
              </div>
              {aiResult && (
                <div className="space-y-4 pt-4">
                  <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                    <SelectTrigger><SelectValue placeholder="Contrato..." /></SelectTrigger>
                    <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button className="w-full" onClick={handleApplyAiService}>Guardar</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2"><Plus className="h-4 w-4" /> Cargo Manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Cargo Manual</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Select value={manualCharge.contractId} onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}>
                  <SelectTrigger><SelectValue placeholder="Contrato..." /></SelectTrigger>
                  <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="Monto" onChange={(e) => setManualCharge({...manualCharge, amount: parseFloat(e.target.value)})} />
                <Input placeholder="Periodo (Mayo 2026)" onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} />
                <Button className="w-full" onClick={handleSaveManualCharge}>Generar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Periodo</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total Final</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-bold">{i.tenantName}</span><br/>
                  <span className="text-[10px] text-muted-foreground">{i.propertyName} • {i.period}</span>
                </TableCell>
                <TableCell className="text-xs">{i.dueDate}</TableCell>
                <TableCell className="text-right font-black text-primary">$ {i.totalAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8">No hay facturas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
