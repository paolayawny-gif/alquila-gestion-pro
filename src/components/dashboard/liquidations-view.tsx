
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
  FileCheck,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person, Invoice, MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  
  const [isNewLiqOpen, setIsNewLiqOpen] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [period, setPeriod] = useState(new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));

  const facturasQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'facturas'));
  }, [db, userId]);
  const { data: invoicesData } = useCollection<Invoice>(facturasQuery);
  const invoices = invoicesData || [];

  const mantenimientoQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento'));
  }, [db, userId]);
  const { data: maintenanceData } = useCollection<MaintenanceTask>(mantenimientoQuery);
  const tasks = maintenanceData || [];

  const handleCreateLiq = () => {
    if (!selectedPropId || !userId || !db) return;

    const property = properties.find(p => p.id === selectedPropId);
    if (!property) return;
    
    const owner = people.find(p => p.id === property.owners?.[0]?.ownerId) || { id: 'dueño-ext', fullName: property.owners?.[0]?.name || 'Propietario' };

    const propInvoices = invoices.filter(i => i.propertyName === property.name && i.period === period);
    
    let rentIncome = 0;
    let serviceDeductions = 0;

    propInvoices.forEach(inv => {
      inv.charges.forEach(charge => {
        if (charge.type === 'Alquiler') rentIncome += charge.amount;
        if (charge.imputedTo === 'Propietario') serviceDeductions += charge.amount;
      });
    });

    const approvedRepairs = tasks.filter(t => 
      t.propertyId === selectedPropId && 
      t.chargedTo === 'Propietario' && 
      t.isApprovedByOwner === true &&
      t.status === 'Cerrado'
    );

    const maintenanceDeductions = approvedRepairs.reduce((acc, t) => acc + (t.actualCost || 0), 0);

    const adminFee = rentIncome * 0.1;
    const net = rentIncome - adminFee - serviceDeductions - maintenanceDeductions;

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', docId);

    const liqData: Liquidation = {
      id: docId,
      propertyId: selectedPropId,
      propertyName: property.name,
      ownerId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: property.owners?.[0]?.email,
      period: period,
      ingresoAlquiler: rentIncome,
      adminFeeDeduction: adminFee,
      maintenanceDeductions: maintenanceDeductions,
      expenseDeductions: serviceDeductions,
      netAmount: net,
      status: 'Pendiente',
      dateCreated: new Date().toLocaleDateString('es-AR')
    };

    setDocumentNonBlocking(docRef, liqData, { merge: true });
    setIsNewLiqOpen(false);
    toast({ 
      title: "Liquidación Generada", 
      description: `Deducciones aplicadas: $${(serviceDeductions + maintenanceDeductions).toLocaleString('es-AR')}.` 
    });
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
              <DialogDescription>El sistema aplicará deducciones bajo reglas estrictas de responsabilidad.</DialogDescription>
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
              
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-[10px] space-y-1 border border-blue-100">
                  <p className="font-bold text-blue-700 flex items-center gap-1.5"><ArrowDownCircle className="h-3 w-3" /> Deducciones Fiscales/Servicios</p>
                  <p className="text-blue-600 leading-tight">Se restarán automáticamente las facturas cargadas con la marca "Imputar a Propietario".</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg text-[10px] space-y-1 border border-orange-100">
                  <p className="font-bold text-orange-700 flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Deducciones Mantenimiento</p>
                  <p className="text-orange-600 leading-tight">SOLO se restarán reparaciones cerradas, marcadas como "Cargo Propietario" y con aprobación explícita tildada.</p>
                </div>
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
                <TableCell className="text-right text-orange-600 font-medium text-xs">
                  <div className="flex flex-col items-end">
                    <span>$ {(l.maintenanceDeductions + l.expenseDeductions + l.adminFeeDeduction).toLocaleString('es-AR')}</span>
                    {l.maintenanceDeductions > 0 && <span className="text-[8px] flex items-center gap-0.5"><Wrench className="h-2 w-2" /> Reparaciones incl.</span>}
                  </div>
                </TableCell>
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
