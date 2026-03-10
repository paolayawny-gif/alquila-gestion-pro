
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Wrench, 
  Search, 
  CheckCircle2,
  HardHat,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaintenanceTask, Property, Person } from '@/lib/types';
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface MaintenanceViewProps {
  tasks: MaintenanceTask[];
  userId?: string;
  properties: Property[];
  people: Person[];
}

const APP_ID = "alquilagestion-pro";

export function MaintenanceView({ tasks, userId, properties, people }: MaintenanceViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);

  const [newTicket, setNewTicket] = useState<Partial<MaintenanceTask>>({
    propertyId: '',
    priority: 'Media',
    concept: '',
    description: '',
    status: 'Pendiente'
  });

  const getStatusBadge = (status: MaintenanceTask['status']) => {
    const styles = {
      'Pendiente': 'bg-orange-100 text-orange-700',
      'Presupuestado': 'bg-blue-100 text-blue-700',
      'En curso': 'bg-purple-100 text-purple-700',
      'Completado': 'bg-green-100 text-green-700',
      'Cerrado': 'bg-gray-100 text-gray-700'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleCreateTicket = () => {
    if (!newTicket.propertyId || !newTicket.concept || !userId || !db) return;

    const property = properties.find(p => p.id === newTicket.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', docId);
    
    const task: MaintenanceTask = {
      id: docId,
      propertyId: newTicket.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      concept: newTicket.concept!,
      description: newTicket.description!,
      priority: (newTicket.priority as any) || 'Media',
      status: 'Pendiente',
      estimatedCost: 0,
      photos: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      hasFile: false
    };

    setDocumentNonBlocking(docRef, task, { merge: true });
    setIsNewClaimOpen(false);
    toast({ title: "Ticket Creado", description: "Se ha sincronizado con la nube." });
  };

  const handleCloseTicket = (taskId: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', taskId);
    setDocumentNonBlocking(docRef, { status: 'Cerrado', closedAt: '2026-01-01' }, { merge: true });
  };

  const handleDeleteTicket = (taskId: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', taskId);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input placeholder="Buscar..." className="pl-9" /></div>
        <Dialog open={isNewClaimOpen} onOpenChange={setIsNewClaimOpen}>
          <DialogTrigger asChild><Button className="bg-primary text-white gap-2"><Plus className="h-4 w-4" /> Nuevo Reclamo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Reclamo</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
               <Select value={newTicket.propertyId} onValueChange={(v) => setNewTicket({...newTicket, propertyId: v})}>
                  <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
               </Select>
               <Input placeholder="Concepto" onChange={e => setNewTicket({...newTicket, concept: e.target.value})} />
               <Textarea placeholder="Descripción" onChange={e => setNewTicket({...newTicket, description: e.target.value})} />
               <Button className="w-full" onClick={handleCreateTicket}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Concepto / Propiedad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell><span className="font-bold">{t.concept}</span><br/><span className="text-[10px]">{t.propertyName}</span></TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                  {t.status !== 'Cerrado' && <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleCloseTicket(t.id)}><CheckCircle2 className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteTicket(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
