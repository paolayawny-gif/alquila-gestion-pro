
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calculator, 
  Search, 
  Download, 
  Send,
  ArrowUpRight,
  Plus,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person } from '@/lib/types';
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

interface LiquidationsViewProps {
  liquidations: Liquidation[];
  setLiquidations: React.Dispatch<React.SetStateAction<Liquidation[]>>;
  properties: Property[];
  people: Person[];
}

export function LiquidationsView({ liquidations, setLiquidations, properties, people }: LiquidationsViewProps) {
  const { toast } = useToast();
  const [isNewLiqOpen, setIsNewLiqOpen] = useState(false);
  const [newLiq, setNewLiq] = useState<Partial<Liquidation>>({
    propertyId: '',
    period: 'Mayo 2024',
    ingresoAlquiler: 0,
    adminFeeDeduction: 0,
    maintenanceDeductions: 0,
    expenseDeductions: 0,
    status: 'Pendiente'
  });

  const handleCreateLiq = () => {
    if (!newLiq.propertyId || !newLiq.ingresoAlquiler) {
      toast({
        title: "Error",
        description: "Complete la propiedad y el monto bruto.",
        variant: "destructive"
      });
      return;
    }

    const property = properties.find(p => p.id === newLiq.propertyId);
    const owner = people.find(p => p.id === property?.owners[0]?.ownerId);

    const net = (newLiq.ingresoAlquiler || 0) - (newLiq.adminFeeDeduction || 0) - (newLiq.maintenanceDeductions || 0) - (newLiq.expenseDeductions || 0);

    const liqData: Liquidation = {
      id: Math.random().toString(36).substr(2, 9),
      propertyId: newLiq.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      ownerId: owner?.id || property?.owners[0]?.ownerId || 'unknown',
      ownerName: owner?.fullName || property?.owners[0]?.name || 'Propietario no encontrado',
      period: newLiq.period!,
      ingresoAlquiler: newLiq.ingresoAlquiler!,
      adminFeeDeduction: newLiq.adminFeeDeduction || 0,
      maintenanceDeductions: newLiq.maintenanceDeductions || 0,
      expenseDeductions: newLiq.expenseDeductions || 0,
      netAmount: net,
      status: 'Pendiente',
      dateCreated: new Date().toISOString().split('T')[0]
    };

    setLiquidations([liqData, ...liquidations]);
    setIsNewLiqOpen(false);
    setNewLiq({
      propertyId: '',
      period: 'Mayo 2024',
      ingresoAlquiler: 0,
      adminFeeDeduction: 0,
      maintenanceDeductions: 0,
      expenseDeductions: 0,
      status: 'Pendiente'
    });

    toast({
      title: "Liquidación Generada",
      description: `Se ha procesado el pago para ${liqData.ownerName}.`
    });
  };

  const calculateAutoFees = (amount: number) => {
    setNewLiq(prev => ({ ...prev, ingresoAlquiler: amount, adminFeeDeduction: amount * 0.1 }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar liquidación o dueño..." className="pl-9 bg-white shadow-sm" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar Reporte
          </Button>
          
          <Dialog open={isNewLiqOpen} onOpenChange={setIsNewLiqOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Nueva Liquidación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva Liquidación a Propietario</DialogTitle>
                <DialogDescription>Calcule el neto a transferir deduciendo comisiones (10%) y gastos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Unidad a Liquidar</Label>
                  <Select 
                    value={newLiq.propertyId} 
                    onValueChange={(v) => setNewLiq({...newLiq, propertyId: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Periodo</Label>
                    <Input 
                      placeholder="Ej: Mayo 2024" 
                      value={newLiq.period}
                      onChange={(e) => setNewLiq({...newLiq, period: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alquiler Bruto ($)</Label>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={newLiq.ingresoAlquiler}
                      onChange={(e) => calculateAutoFees(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2 text-primary">
                    <Label>Comisión Adm. (10%) ($)</Label>
                    <Input 
                      type="number" 
                      value={newLiq.adminFeeDeduction}
                      onChange={(e) => setNewLiq({...newLiq, adminFeeDeduction: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2 text-red-600">
                    <Label>Mantenimiento ($)</Label>
                    <Input 
                      type="number" 
                      value={newLiq.maintenanceDeductions}
                      onChange={(e) => setNewLiq({...newLiq, maintenanceDeductions: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-green-700 uppercase">Neto Final a Pagar</span>
                    <span className="text-lg font-black text-green-800">
                      $ {((newLiq.ingresoAlquiler || 0) - (newLiq.adminFeeDeduction || 0) - (newLiq.maintenanceDeductions || 0)).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsNewLiqOpen(false)}>Cancelar</Button>
                <Button className="bg-primary text-white" onClick={handleCreateLiq}>Generar y Notificar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recaudado (Bruto)</span>
          <span className="text-xl font-black">$ {liquidations.reduce((acc, l) => acc + (l.ingresoAlquiler || 0), 0).toLocaleString('es-AR')}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-primary block">Comisiones Adm. (10%)</span>
          <span className="text-xl font-black text-primary">$ {liquidations.reduce((acc, l) => acc + (l.adminFeeDeduction || 0), 0).toLocaleString('es-AR')}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Deducciones</span>
          <span className="text-xl font-black text-red-600">$ {liquidations.reduce((acc, l) => acc + (l.maintenanceDeductions || 0) + (l.expenseDeductions || 0), 0).toLocaleString('es-AR')}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-green-500">
          <span className="text-[10px] uppercase font-bold text-green-700 block">Total a Liquidar</span>
          <span className="text-xl font-black text-green-700">$ {liquidations.reduce((acc, l) => acc + (l.netAmount || 0), 0).toLocaleString('es-AR')}</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propietario / Unidad</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Alquiler Bruto</TableHead>
              <TableHead className="text-right">Deducciones Totales</TableHead>
              <TableHead className="text-right">Neto a Transferir</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.length > 0 ? liquidations.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{l.ownerName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{l.propertyName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{l.period}</TableCell>
                <TableCell className="text-right text-xs font-medium">$ {(l.ingresoAlquiler || 0).toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end text-[10px]">
                    <span className="text-primary">Adm (10%): - $ {(l.adminFeeDeduction || 0).toLocaleString('es-AR')}</span>
                    {((l.maintenanceDeductions || 0) > 0 || (l.expenseDeductions || 0) > 0) && (
                      <span className="text-red-600">Gasto: - $ {((l.maintenanceDeductions || 0) + (l.expenseDeductions || 0)).toLocaleString('es-AR')}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 text-green-700 font-black text-sm">
                    $ {(l.netAmount || 0).toLocaleString('es-AR')}
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "border font-bold",
                    l.status === 'Pagada' ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"
                  )}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                      onClick={() => setLiquidations(liquidations.filter(liq => liq.id !== l.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay liquidaciones generadas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
