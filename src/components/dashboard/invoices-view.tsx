
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreHorizontal,
  ArrowUpRight,
  Download,
  CreditCard,
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, PaymentMethod } from '@/lib/types';
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

const MOCK_INVOICES: Invoice[] = [
  { 
    id: '1', 
    contractId: 'c1',
    tenantName: 'Carlos Sosa',
    propertyName: 'Las Heras 4B',
    concept: 'Alquiler Marzo 2024', 
    baseAmount: 185000, 
    lateFees: 0,
    totalAmount: 185000,
    currency: 'ARS',
    dueDate: '2024-03-10', 
    status: 'Pagado', 
    paymentDate: '2024-03-08',
    paymentMethod: 'Transferencia',
    reference: 'OP-998231',
    hasFile: true 
  },
  { 
    id: '2', 
    contractId: 'c1',
    tenantName: 'Carlos Sosa',
    propertyName: 'Las Heras 4B',
    concept: 'Alquiler Abril 2024', 
    baseAmount: 185000, 
    lateFees: 3700, // 2% por mora
    totalAmount: 188700,
    currency: 'ARS',
    dueDate: '2024-04-10', 
    status: 'Vencido', 
    hasFile: false 
  },
];

export function InvoicesView() {
  const [invoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por inquilino o propiedad..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2">
            <History className="h-4 w-4" /> Historial
          </Button>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button className="bg-primary hover:bg-primary/90 text-white gap-2 flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Generar Cuotas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-black text-orange-600">Total Pendiente</CardDescription>
            <CardTitle className="text-3xl font-black">$ 342.100</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> 12 cuotas sin cobrar
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-black text-green-600">Cobrado este mes</CardDescription>
            <CardTitle className="text-3xl font-black">$ 1.250.000</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> 85% de la recaudación proyectada
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-black text-red-600">Mora Acumulada</CardDescription>
            <CardTitle className="text-3xl font-black">$ 45.200</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> 4 inquilinos con atraso
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Concepto</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Básico</TableHead>
              <TableHead className="text-right">Punitorios</TableHead>
              <TableHead className="text-right">Total</TableHead>
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
                    <span className="text-[10px] text-muted-foreground uppercase">{i.concept} • {i.propertyName}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col text-xs">
                    <span>{i.dueDate}</span>
                    {i.paymentDate && <span className="text-[9px] text-green-600 font-bold">Pago: {i.paymentDate}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">$ {i.baseAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-xs font-bold text-red-600">
                  {i.lateFees > 0 ? `+ $ ${i.lateFees.toLocaleString('es-AR')}` : '-'}
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
                      <Download className="h-4 w-4" />
                    </Button>
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

      {/* DIALOGO DE REGISTRO DE PAGO MANUAL */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago Recibido</DialogTitle>
            <DialogDescription>
              Conciliación manual para <strong>{selectedInvoice?.tenantName}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground uppercase font-bold">Total a Cobrar</span>
                <span className="font-black text-primary">$ {selectedInvoice?.totalAmount.toLocaleString('es-AR')}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Incluye capital más punitorios calculados al día de hoy.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Medio de Pago</Label>
                <Select defaultValue="Transferencia">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
                    <SelectItem value="Depósito">Depósito Bancario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de Cobro</Label>
                <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Referencia / Nro. Operación</Label>
              <Input placeholder="Ej: 99823123 o CBU Origen" />
            </div>

            <div className="flex items-center space-x-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] text-blue-700 font-medium">Se generará un recibo X provisorio y se enviará por mail.</span>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirmar Cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
