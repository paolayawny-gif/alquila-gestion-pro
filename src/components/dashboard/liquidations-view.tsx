
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2,
  Search,
  Download,
  Calculator,
  ArrowDownCircle,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person, Invoice } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from '@/components/ui/separator';

interface LiquidationsViewProps {
  liquidations: Liquidation[];
  userId?: string;
  properties: Property[];
  people: Person[];
}

const APP_ID = "alquilagestion-pro";

export function LiquidationsView({ liquidations, userId, properties, people }: LiquidationsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  
  const [isNewLiqOpen, setIsNewLiqOpen] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [period, setPeriod] = useState('Junio 2026');

  // Necesitamos las facturas para calcular deducciones automáticas
  const facturasQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'facturas'));
  }, [db, userId]);
  const { data: invoicesData } = useCollection<Invoice>(facturasQuery);
  const invoices = invoicesData || [];

  const handleCreateLiq = () => {
    if (!selectedPropId || !userId || !db) return;

    const property = properties.find(p => p.id === selectedPropId);
    if (!property) return;
    
    const owner = people.find(p => p.id === property.owners[0]?.ownerId) || { id: 'dueño-ext', fullName: property.owners[0]?.name || 'Propietario' };

    // Buscar facturas de esta propiedad en este período para ver deducciones (Cargos imputados al dueño)
    const propInvoices = invoices.filter(i => i.propertyName === property.name && i.period === period);
    
    let rentIncome = 0;
    let ownerDeductions = 0;
    let maintenanceExpenses = 0;

    propInvoices.forEach(inv => {
      inv.charges.forEach(charge => {
        if (charge.type === 'Alquiler') rentIncome += charge.amount;
        if (charge.imputedTo === 'Propietario') ownerDeductions += charge.amount;
        if (charge.type === 'Luz/Gas' || charge.type === 'Otros') {
           // Si el dueño paga servicios, es una deducción
           if (charge.imputedTo === 'Propietario') maintenanceExpenses += charge.amount;
        }
      });
    });

    const adminFee = rentIncome * 0.1; // 10% honorarios admin
    const net = rentIncome - adminFee - ownerDeductions;

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', docId);

    const liqData: Liquidation = {
      id: docId,
      propertyId: selectedPropId,
      propertyName: property.name,
      ownerId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: property.owners[0]?.email,
      period: period,
      ingresoAlquiler: rentIncome,
      adminFeeDeduction: adminFee,
      maintenanceDeductions: ownerDeductions,
      expenseDeductions: 0,
      netAmount: net,
      status: 'Pendiente',
      dateCreated: new Date().toLocaleDateString('es-AR')
    };

    setDocumentNonBlocking(docRef, liqData, { merge: true });
    setIsNewLiqOpen(false);
    toast({ title: "Liquidación Generada", description: "Se han aplicado deducciones automáticas." });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar liquidación..." className="pl-9 bg-white" />
        </div>
        <Dialog open={isNewLiqOpen} onOpenChange={setIsNewLiqOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white gap-2 font-bold shadow-md">
              <Calculator className="h-4 w-4" /> Generar Periodo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Liquidación Mensual</DialogTitle>
              <DialogDescription>El sistema calculará deducciones de expensas imputadas al dueño.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Propiedad / Unidad</Label>
                <Select value={selectedPropId} onValueChange={setSelectedPropId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período de Liquidación</Label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ej: Junio 2026" />
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-[11px] space-y-2">
                <p className="font-bold uppercase text-primary flex items-center gap-2"><ArrowDownCircle className="h-3 w-3" /> Cálculo Automático</p>
                <p className="text-muted-foreground leading-relaxed">Se restarán honorarios de administración (10%) y todos los cargos marcados como "Imputar a Propietario" en las facturas de este período.</p>
              </div>
            </div>
            <DialogFooter className="mt-4"><Button className="w-full h-11 font-black" onClick={handleCreateLiq}>Cerrar y Generar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propietario / Unidad</TableHead>
              <TableHead className="text-right">Bruto (Alquiler)</TableHead>
              <TableHead className="text-right text-orange-600">Deducciones</TableHead>
              <TableHead className="text-right">Neto a Pagar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{l.ownerName}</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{l.propertyName} • {l.period}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-xs">$ {l.ingresoAlquiler.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-orange-600 font-medium text-xs">$ {(l.adminFeeDeduction + l.maintenanceDeductions).toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right font-black text-green-700 text-base">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>
                   <Badge className={cn("border-none", l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                    {l.status}
                   </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Descargar Recibo"><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {liquidations.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No se han generado liquidaciones en este período.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
