
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Edit2, Trash2, Search, UserCheck, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LegalCase, Property } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface LegalViewProps {
  legalCases: LegalCase[];
  userId?: string;
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

export function LegalView({ legalCases, userId, properties }: LegalViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState<Partial<LegalCase>>({
    type: '',
    propertyId: '',
    startDate: '2026-01-01',
    attorney: '',
    status: 'En proceso'
  });

  const handleCreateCase = () => {
    if (!newCase.type || !newCase.propertyId || !userId || !db) return;

    const property = properties.find(p => p.id === newCase.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', docId);
    
    const caseData: LegalCase = {
      id: docId,
      type: newCase.type!,
      propertyId: newCase.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      startDate: newCase.startDate!,
      attorney: newCase.attorney!,
      status: (newCase.status as any) || 'En proceso',
      hasFile: false,
      ownerId: userId
    };

    setDocumentNonBlocking(docRef, caseData, { merge: true });
    setIsNewCaseOpen(false);
    toast({ title: "Caso Registrado", description: "Sincronizado con la nube." });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'legalCases', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input placeholder="Buscar..." className="pl-9" /></div>
        <Dialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen}>
          <DialogTrigger asChild><Button className="bg-accent text-white gap-2"><Scale className="h-4 w-4" /> Nuevo Trámite</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Caso Legal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <Input placeholder="Tipo (Desalojo, etc)" onChange={e => setNewCase({...newCase, type: e.target.value})} />
              <Select value={newCase.propertyId} onValueChange={(v) => setNewCase({...newCase, propertyId: v})}>
                <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Abogado" onChange={e => setNewCase({...newCase, attorney: e.target.value})} />
              <Button className="w-full" onClick={handleCreateCase}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Trámite / Propiedad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legalCases.map((c) => (
              <TableRow key={c.id}>
                <TableCell><span className="font-bold">{c.type}</span><br/><span className="text-[10px]">{c.propertyName}</span></TableCell>
                <TableCell><Badge>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
