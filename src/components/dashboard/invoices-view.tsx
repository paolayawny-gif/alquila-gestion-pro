
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreHorizontal,
  Download,
  CreditCard,
  History,
  FileText,
  Building2,
  Table as TableIcon,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, ChargeItem, ChargeType, ChargePayer } from '@/lib/types';
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
      { id: 'ch3', type: 'TGI/ABL', description: 'ABL Cuota 3', amount: 8500, imputedTo: 'Inquilino', isPaid: true },
    ],
    lateFees: 0,
    totalAmount: 238500,
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
    period: 'Abril 2024',
    charges: [
      { id: 'ch4', type: 'Alquiler', description: 'Alquiler mensual', amount: 185000, imputedTo: 'Inquilino', isPaid: false },
      { id: 'ch5', type: 'Expensa Ordinaria', description: 'Expensas Abril', amount: 48000, imputedTo: 'Inquilino', isPaid: false },
      { id: 'ch6', type: 'Expensa Extraordinaria', description: 'Fondo de reserva', amount: 12000, imputedTo: 'Propietario', isPaid: false },
    ],
    lateFees: 3700,
    totalAmount: 236700,
    currency: 'ARS',
    dueDate: '2024-04-10', 
    status: 'Vencido', 
    hasFile: false 
  },
];

export function InvoicesView() {
  const { toast } = useToast();
  const [invoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleExportAFIP = () => {
    // Simulación de exportación RG 3645
    const csvContent = "CUIT,Periodo,Concepto,Monto,Imputacion\n" + 
      invoices.flatMap(i => i.charges.map(c => 
        `20-34567890-9,${i.period},${c.type},${c.amount},${c.imputedTo}`
      )).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afip-rg3645-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast({
      title: "Exportación exitosa",
      description: "Se ha generado el archivo CSV con el formato requerido por AFIP (RG 3645).",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar inquilino o propiedad..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportAFIP}>
            <TableIcon className="h-4 w-4" /> Exportar AFIP
          </Button>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <Building2 className="h-4 w-4" /> Cargar Expensas/Servicios
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cargar Conceptos Adicionales</DialogTitle>
                <DialogDescription>Impute expensas, impuestos o servicios a una unidad.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Unidad / Propiedad</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent><SelectItem value="1">Las Heras 4B</SelectItem></SelectContent></Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Concepto</Label>
                    <Select defaultValue="Expensa Ordinaria">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Expensa Ordinaria">Exp. Ordinaria</SelectItem>
                        <SelectItem value="Expensa Extraordinaria">Exp. Extraord.</SelectItem>
                        <SelectItem value="TGI/ABL">ABL/TGI</SelectItem>
                        <SelectItem value="Luz/Gas">Servicios</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Imputar a</Label>
                    <Select defaultValue="Inquilino">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inquilino">Inquilino</SelectItem>
                        <SelectItem value="Propietario">Propietario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monto ($)</Label>
                    <Input type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Periodo</Label>
                    <Input placeholder="MM/AAAA" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary text-white">Cargar Concepto</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> Generar Cuotas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recaudación Total</span>
          <span className="text-xl font-black">$ 475.200</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-blue-600 block">Expensas (Total)</span>
          <span className="text-xl font-black text-blue-700">$ 93.000</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">Vencido Inquilinos</span>
          <span className="text-xl font-black text-orange-700">$ 236.700</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Mora Proyectada</span>
          <span className="text-xl font-black text-red-700">$ 12.400</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Periodo</TableHead>
              <TableHead>Desglose de Cargos</TableHead>
              <TableHead>Vencimiento</TableHead>
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
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {i.charges.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-4 text-[10px]">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-sm font-medium",
                          c.type === 'Alquiler' ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-700"
                        )}>
                          {c.type}
                        </span>
                        <span className="font-medium">$ {c.amount.toLocaleString('es-AR')}</span>
                        <span className={cn(
                          "text-[8px] font-black uppercase",
                          c.imputedTo === 'Inquilino' ? "text-blue-500" : "text-orange-500"
                        )}>
                          ({c.imputedTo[0]})
                        </span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col text-xs">
                    <span>{i.dueDate}</span>
                    {i.paymentDate && <span className="text-[9px] text-green-600 font-bold">Pago: {i.paymentDate}</span>}
                  </div>
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
              <p className="text-[10px] text-muted-foreground">Incluye capital, expensas y punitorios calculados.</p>
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
