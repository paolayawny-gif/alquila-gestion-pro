"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  MoreHorizontal,
  Download,
  CreditCard,
  RefreshCcw,
  Send,
  Bell,
  FileText,
  Sparkles,
  Loader2,
  Upload,
  Building2,
  DollarSign,
  Calendar
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

interface InvoicesViewProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  contracts: Contract[];
}

export function InvoicesView({ invoices, setInvoices, contracts }: InvoicesViewProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI States
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractInvoiceDataOutput | null>(null);
  const [imputedTo, setImputedTo] = useState<ChargePayer>('Inquilino');
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  // Manual Charge State
  const [manualCharge, setManualCharge] = useState({
    contractId: '',
    type: 'Otros' as ChargeType,
    description: '',
    amount: 0,
    imputedTo: 'Inquilino' as ChargePayer,
    period: '',
    dueDate: new Date().toISOString().split('T')[0]
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
        toast({ title: "Análisis de Factura Completo", description: "Se detectaron los cargos y el vencimiento." });
      } catch (error) {
        toast({ title: "Error de Análisis", description: "No se pudo leer la factura de servicio.", variant: "destructive" });
      } finally {
        setIsAiProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyAiService = () => {
    if (!aiResult || !selectedContractId) {
      toast({ title: "Error", description: "Seleccione un contrato para imputar el gasto.", variant: "destructive" });
      return;
    }

    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return;

    const periodStr = aiResult.period || "Actual";
    saveChargeToInvoice(contract, {
      id: Math.random().toString(36).substr(2, 9),
      type: aiResult.serviceType as ChargeType,
      description: `Gasto de ${aiResult.serviceType} - ${periodStr}`,
      amount: aiResult.amount,
      imputedTo: imputedTo,
      isPaid: false
    }, periodStr, aiResult.dueDate || new Date().toISOString().split('T')[0]);

    setAiResult(null);
    setIsAiDialogOpen(false);
    toast({ title: "Servicio Cargado", description: `Se ha agregado el cargo de ${aiResult.serviceType} exitosamente.` });
  };

  const handleSaveManualCharge = () => {
    if (!manualCharge.contractId || !manualCharge.amount || !manualCharge.period) {
      toast({ title: "Error", description: "Complete todos los campos obligatorios.", variant: "destructive" });
      return;
    }

    const contract = contracts.find(c => c.id === manualCharge.contractId);
    if (!contract) return;

    saveChargeToInvoice(contract, {
      id: Math.random().toString(36).substr(2, 9),
      type: manualCharge.type,
      description: manualCharge.description || `${manualCharge.type} - ${manualCharge.period}`,
      amount: manualCharge.amount,
      imputedTo: manualCharge.imputedTo,
      isPaid: false
    }, manualCharge.period, manualCharge.dueDate);

    setIsManualDialogOpen(false);
    setManualCharge({
      contractId: '',
      type: 'Otros',
      description: '',
      amount: 0,
      imputedTo: 'Inquilino',
      period: '',
      dueDate: new Date().toISOString().split('T')[0]
    });
    
    toast({ title: "Cargo Registrado", description: "Se ha guardado el nuevo cargo manual." });
  };

  const saveChargeToInvoice = (contract: Contract, charge: ChargeItem, period: string, dueDate: string) => {
    const existingInvoiceIndex = invoices.findIndex(i => i.contractId === contract.id && i.period === period);

    if (existingInvoiceIndex > -1) {
      const updatedInvoices = [...invoices];
      updatedInvoices[existingInvoiceIndex].charges.push(charge);
      updatedInvoices[existingInvoiceIndex].totalAmount += charge.amount;
      setInvoices(updatedInvoices);
    } else {
      const newInvoice: Invoice = {
        id: Math.random().toString(36).substr(2, 9),
        contractId: contract.id,
        tenantName: contract.tenantName || 'Inquilino',
        propertyName: contract.propertyName || 'Propiedad',
        period: period,
        charges: [charge],
        lateFees: 0,
        totalAmount: charge.amount,
        currency: contract.currency,
        dueDate: dueDate,
        status: 'Pendiente',
        hasFile: false
      };
      setInvoices([newInvoice, ...invoices]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filtrar facturas..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2">
            <Send className="h-4 w-4" /> Notificar Mora
          </Button>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {/* AI INVOICE LOADING */}
          <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="gap-2 border-primary text-primary hover:bg-primary/5"
              >
                <Sparkles className="h-4 w-4" />
                Cargar Factura de Servicio (IA)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cargar Gasto de Servicio con IA</DialogTitle>
                <DialogDescription>Suba el PDF de Luz, Gas o Aguas para extraer los datos automáticamente.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                {!aiResult && !isAiProcessing && (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-lg p-10 text-center space-y-4 hover:bg-muted/50 cursor-pointer transition-colors border-primary/20">
                    <Upload className="h-10 w-10 mx-auto text-primary" />
                    <div className="space-y-1">
                      <p className="font-bold">Haga clic para subir la factura</p>
                      <p className="text-xs text-muted-foreground">Soportamos PDF y fotos de comprobantes.</p>
                    </div>
                  </div>
                )}
                {isAiProcessing && (
                  <div className="p-10 text-center space-y-4">
                    <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                    <p className="text-sm font-bold">La IA está leyendo el comprobante...</p>
                  </div>
                )}
                {aiResult && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-primary/20 bg-primary/5 shadow-none">
                      <CardContent className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Servicio</Label>
                          <p className="text-sm font-bold">{aiResult.serviceType}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Monto Total</Label>
                          <p className="text-sm font-black text-primary">$ {aiResult.amount.toLocaleString('es-AR')}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Vencimiento</Label>
                          <p className="text-sm font-bold">{aiResult.dueDate || 'No detectado'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Periodo</Label>
                          <p className="text-sm font-bold">{aiResult.period || 'No detectado'}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contrato / Propiedad</Label>
                        <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                          <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                          <SelectContent>
                            {contracts.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.propertyName} - {c.tenantName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>A cargo de:</Label>
                        <Select value={imputedTo} onValueChange={(v: any) => setImputedTo(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Inquilino">Inquilino</SelectItem>
                            <SelectItem value="Propietario">Propietario</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary text-white" disabled={!aiResult || !selectedContractId} onClick={handleApplyAiService}>Confirmar e Imputar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* MANUAL CHARGE LOADING */}
          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Plus className="h-4 w-4" /> Cargo Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Cargo Manual</DialogTitle>
                <DialogDescription>Cargue una cuota, servicio o ajuste manualmente.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Contrato / Propiedad</Label>
                  <Select value={manualCharge.contractId} onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleccione contrato..." /></SelectTrigger>
                    <SelectContent>
                      {contracts.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.propertyName} - {c.tenantName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Cargo</Label>
                    <Select value={manualCharge.type} onValueChange={(v: any) => setManualCharge({...manualCharge, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alquiler">Alquiler</SelectItem>
                        <SelectItem value="Expensa Ordinaria">Expensa Ordinaria</SelectItem>
                        <SelectItem value="Expensa Extraordinaria">Expensa Extraordinaria</SelectItem>
                        <SelectItem value="Luz/Gas">Luz/Gas</SelectItem>
                        <SelectItem value="Aguas">Aguas</SelectItem>
                        <SelectItem value="TGI/ABL">TGI/ABL</SelectItem>
                        <SelectItem value="Otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Periodo (Ej: Mayo 2024)</Label>
                    <Input value={manualCharge.period} onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} placeholder="Mes Año" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monto ($)</Label>
                    <Input type="number" value={manualCharge.amount} onChange={(e) => setManualCharge({...manualCharge, amount: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimiento</Label>
                    <Input type="date" value={manualCharge.dueDate} onChange={(e) => setManualCharge({...manualCharge, dueDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Imputar a:</Label>
                  <Select value={manualCharge.imputedTo} onValueChange={(v: any) => setManualCharge({...manualCharge, imputedTo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inquilino">Inquilino (Suma al total)</SelectItem>
                      <SelectItem value="Propietario">Propietario (Descuenta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripción (Opcional)</Label>
                  <Input value={manualCharge.description} onChange={(e) => setManualCharge({...manualCharge, description: e.target.value})} placeholder="Detalle del cargo..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsManualDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary text-white" onClick={handleSaveManualCharge}>Guardar Cargo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recaudación Proyectada</span>
          <span className="text-xl font-black">$ {invoices.reduce((acc, i) => acc + i.totalAmount, 0).toLocaleString('es-AR')}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-blue-600 block">Facturas Activas</span>
          <span className="text-xl font-black text-blue-700">{invoices.length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">Vencidas</span>
          <span className="text-xl font-black text-orange-700">{invoices.filter(i => i.status === 'Vencido').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-primary">
          <span className="text-[10px] uppercase font-bold text-primary block">Servicios Procesados</span>
          <span className="text-xl font-black text-primary">8</span>
        </Card>
      </div>

      {/* TABLE */}
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Periodo</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Conceptos</TableHead>
              <TableHead className="text-right">Total Final</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{i.tenantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{i.propertyName} • {i.period}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col text-xs">
                    <span className={cn(i.status === 'Vencido' && "text-red-600 font-bold")}>{i.dueDate}</span>
                    {i.paymentDate && <span className="text-[9px] text-green-600 font-bold">Cobrado el {i.paymentDate}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    {i.charges.map(c => (
                      <Badge key={c.id} variant="outline" className="text-[9px] font-normal px-1 h-4">
                        {c.type}: $ {c.amount.toLocaleString('es-AR')}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-black text-primary">
                  $ {i.totalAmount.toLocaleString('es-AR')}
                </TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {i.status !== 'Pagado' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-primary hover:bg-primary/10 gap-1 h-8 px-2"
                        onClick={() => {
                          setSelectedInvoice(i);
                          setIsPaymentDialogOpen(true);
                        }}
                      >
                        <CreditCard className="h-4 w-4" /> Cobrar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay facturas registradas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* PAYMENT DIALOG */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago Recibido</DialogTitle>
            <DialogDescription>Conciliación manual para <strong>{selectedInvoice?.tenantName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground uppercase font-bold">Total a Cobrar</span>
                <span className="font-black text-primary">$ {selectedInvoice?.totalAmount.toLocaleString('es-AR')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referencia / Nro. Operación Bancaria</Label>
              <Input placeholder="Ej: TRANSF-998231" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white gap-2">Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
