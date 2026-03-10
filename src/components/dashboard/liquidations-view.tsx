
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2,
  Search,
  Download,
  Send
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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
  const [newLiq, setNewLiq] = useState<Partial<Liquidation>>({
    propertyId: '',
    period: 'Mayo 2026',
    ingresoAlquiler: 0,
    adminFeeDeduction: 0,
    maintenanceDeductions: 0,
    expenseDeductions: 0,
    status: 'Pendiente'
  });

  const handleCreateLiq = () => {
    if (!newLiq.propertyId || !newLiq.ingresoAlquiler || !userId || !db) return;

    const property = properties.find(p => p.id === newLiq.propertyId);
    const owner = people.find(p => p.id === property?.owners[0]?.ownerId);
    const net = (newLiq.ingresoAlquiler || 0) - (newLiq.adminFeeDeduction || 0) - (newLiq.maintenanceDeductions || 0);

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', docId);

    const liqData: Liquidation = {
      id: docId,
      propertyId: newLiq.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      ownerId: owner?.id || 'unknown',
      ownerName: owner?.fullName || property?.owners[0]?.name || 'Dueño',
      period: newLiq.period!,
      ingresoAlquiler: newLiq.ingresoAlquiler!,
      adminFeeDeduction: newLiq.adminFeeDeduction || 0,
      maintenanceDeductions: newLiq.maintenanceDeductions || 0,
      expenseDeductions: newLiq.expenseDeductions || 0,
      netAmount: net,
      status: 'Pendiente',
      dateCreated: '2026-05-15'
    };

    setDocumentNonBlocking(docRef, liqData, { merge: true });
    setIsNewLiqOpen(false);
    toast({ title: "Liquidación Generada", description: "Guardada en la nube." });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input placeholder="Buscar..." className="pl-9" /></div>
        <Dialog open={isNewLiqOpen} onOpenChange={setIsNewLiqOpen}>
          <DialogTrigger asChild><Button className="bg-primary text-white gap-2"><Plus className="h-4 w-4" /> Nueva Liquidación</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generar Liquidación</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <Select value={newLiq.propertyId} onValueChange={(v) => setNewLiq({...newLiq, propertyId: v})}>
                <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Alquiler Bruto" onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                setNewLiq({...newLiq, ingresoAlquiler: val, adminFeeDeduction: val * 0.1});
              }} />
              <Button className="w-full" onClick={handleCreateLiq}>Confirmar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Dueño / Unidad</TableHead>
              <TableHead className="text-right">Neto a Transferir</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id}>
                <TableCell><span className="font-bold">{l.ownerName}</span><br/><span className="text-[10px]">{l.propertyName}</span></TableCell>
                <TableCell className="text-right font-black text-green-700">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell><Badge>{l.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
