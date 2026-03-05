
"use client";

import React, { useState } from 'react';
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
  Table as TableIcon,
  RefreshCcw,
  Send,
  Bell
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice } from '@/lib/types';
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

const MOCK_INVOICES: Invoice[] = [
  { 
    id: '1', 
    contractId: 'c1',
    tenantName: 'Carlos Sosa',
    propertyName: 'Las Heras 4B',
    period: 'Marzo 2024',
    charges: [
      { id: 'ch1', type: 'Alquiler', description: 'Alquiler mensual', amount: 185000, imputedTo: 'Inquilino', isPaid: true },
      { id: 'ch2', type: 'Expensa Ordinaria', description: 'Expensas Marzo', amount: 45000, imputedTo: 'Inquilino', isPaid: true },
    ],
    lateFees: 0,
    totalAmount: 230000,
    currency: 'ARS',
    dueDate: '2024-03-10', 
    status: 'Pagado', 
    paymentDate: '2024-03-08',
    paymentMethod: 'Transferencia',
    hasFile: true 
  },
  { 
    id: '2', 
    contractId: 'c1',
    tenantName: 'Carlos Sosa',
    propertyName: 'Las Heras 4B',
    period: 'Abril 2024',
    charges: [
      { id: 'ch4', type: 'Alquiler', description: 'Alquiler mensual', amount: 185000, imputedTo: 'Inquilino', isPaid: false },
    ],
    lateFees: 3700,
    totalAmount: 188700,
    currency: 'ARS',
    dueDate: '2024-04-10', 
    status: 'Vencido', 
    hasFile: false 
  },
];

export function InvoicesView() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [processingAutomation, setProcessingAutomation] = useState(false);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleAutomatedBilling = () => {
    setProcessingAutomation(true);
    // Simulación de proceso masivo
    setTimeout(() => {
      setProcessingAutomation(false);
      toast({
        title: "Facturación Automatizada Exitosa",
        description: "Se han generado 12 nuevas cuotas para el periodo Mayo 2024 aplicando índices ICL/IPC.",
      });
    }, 2000);
  };

  const handleSendReminders = () => {
    toast({
      title: "Recordatorios Enviados",
      description: "Se han enviado 5 emails y 8 WhatsApps con el estado de cuenta y avisos de vencimiento.",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filtrar morosos o por propiedad..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2" onClick={handleSendReminders}>
            <Send className="h-4 w-4" /> Notificar Mora
          </Button>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="gap-2 border-primary text-primary hover:bg-primary/5"
            onClick={handleAutomatedBilling}
            disabled={processingAutomation}
          >
            {processingAutomation ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Procesar Facturación Mayo
          </Button>

          <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> Cargo Manual
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recaudación Proyectada</span>
          <span className="text-xl font-black">$ 475.200</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-blue-600 block">Recordatorios Enviados</span>
          <span className="text-xl font-black text-blue-700">13 <span className="text-xs font-normal">hoy</span></span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">Facturas Vencidas</span>
          <span className="text-xl font-black text-orange-700">2</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-red-500">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Punitorios Calculados</span>
          <span className="text-xl font-black text-red-700">$ 12.400</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Periodo</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Monto Base</TableHead>
              <TableHead className="text-right">Punitorios</TableHead>
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
                    {i.isAutomated && <Badge className="w-fit text-[8px] h-3 bg-blue-50 text-blue-700 border-blue-100 mt-1">Automática</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col text-xs">
                    <span className={cn(i.status === 'Vencido' && "text-red-600 font-bold")}>{i.dueDate}</span>
                    {i.paymentDate && <span className="text-[9px] text-green-600 font-bold">Cobrado el {i.paymentDate}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">
                  $ {(i.totalAmount - i.lateFees).toLocaleString('es-AR')}
                </TableCell>
                <TableCell className="text-right text-xs font-bold text-red-600">
                  {i.lateFees > 0 ? `+ $ ${i.lateFees.toLocaleString('es-AR')}` : '-'}
                </TableCell>
                <TableCell className="text-right font-black text-primary">
                  $ {i.totalAmount.toLocaleString('es-AR')}
                </TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {i.status === 'Vencido' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:bg-orange-50">
                        <Bell className="h-4 w-4" />
                      </Button>
                    )}
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
          </TableBody>
        </Table>
      </Card>

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
              <p className="text-[10px] text-muted-foreground">Incluye capital e intereses por mora.</p>
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
