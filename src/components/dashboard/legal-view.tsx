
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Edit2, Trash2, FileCheck, Upload, Search, UserCheck, Plus } from 'lucide-react';
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

interface LegalViewProps {
  legalCases: LegalCase[];
  setLegalCases: React.Dispatch<React.SetStateAction<LegalCase[]>>;
  properties: Property[];
}

export function LegalView({ legalCases, setLegalCases, properties }: LegalViewProps) {
  const { toast } = useToast();
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState<Partial<LegalCase>>({
    type: '',
    propertyId: '',
    startDate: new Date().toISOString().split('T')[0],
    attorney: '',
    status: 'En proceso'
  });

  const handleCreateCase = () => {
    if (!newCase.type || !newCase.propertyId || !newCase.attorney) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }

    const property = properties.find(p => p.id === newCase.propertyId);
    
    const caseData: LegalCase = {
      id: Math.random().toString(36).substr(2, 9),
      type: newCase.type!,
      propertyId: newCase.propertyId!,
      propertyName: property?.name || 'Propiedad no encontrada',
      startDate: newCase.startDate!,
      attorney: newCase.attorney!,
      status: (newCase.status as any) || 'En proceso',
      hasFile: false,
      ownerId: 'user1'
    };

    setLegalCases([caseData, ...legalCases]);
    setIsNewCaseOpen(false);
    setNewCase({
      type: '',
      propertyId: '',
      startDate: new Date().toISOString().split('T')[0],
      attorney: '',
      status: 'En proceso'
    });

    toast({
      title: "Trámite Registrado",
      description: `Se ha iniciado el trámite legal para ${caseData.propertyName}.`
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar trámite..." className="pl-9 bg-white" />
        </div>
        
        <Dialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-white gap-2">
              <Scale className="h-4 w-4" />
              Nuevo Trámite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Iniciar Nuevo Trámite Legal</DialogTitle>
              <DialogDescription>Registre mediaciones, desalojos o reclamos judiciales.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Proceso</Label>
                <Select 
                  value={newCase.type} 
                  onValueChange={(v) => setNewCase({...newCase, type: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione tipo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Desalojo por Falta de Pago">Desalojo por Falta de Pago</SelectItem>
                    <SelectItem value="Mediación por Daños">Mediación por Daños</SelectItem>
                    <SelectItem value="Ejecución de Garantía">Ejecución de Garantía</SelectItem>
                    <SelectItem value="Reclamo de Expensas">Reclamo de Expensas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Propiedad Vinculada</Label>
                <Select 
                  value={newCase.propertyId} 
                  onValueChange={(v) => setNewCase({...newCase, propertyId: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione propiedad..." /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Abogado / Estudio Jurídico</Label>
                <Input 
                  placeholder="Ej: Dr. Pérez" 
                  value={newCase.attorney}
                  onChange={(e) => setNewCase({...newCase, attorney: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input 
                    type="date" 
                    value={newCase.startDate}
                    onChange={(e) => setNewCase({...newCase, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado Inicial</Label>
                  <Select 
                    value={newCase.status} 
                    onValueChange={(v: any) => setNewCase({...newCase, status: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="En proceso">En proceso</SelectItem>
                      <SelectItem value="Acuerdo firmado">Acuerdo firmado</SelectItem>
                      <SelectItem value="Resuelto">Resuelto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsNewCaseOpen(false)}>Cancelar</Button>
              <Button className="bg-accent text-white" onClick={handleCreateCase}>Registrar Trámite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Tipo de Trámite</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Abogado/a</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Archivo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legalCases.length > 0 ? legalCases.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.propertyName}</TableCell>
                <TableCell className="text-sm">{c.startDate}</TableCell>
                <TableCell className="text-sm">
                   <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    {c.attorney}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    "border-none",
                    c.status === 'Acuerdo firmado' || c.status === 'Resuelto' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                    c.status === 'En proceso' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" : "bg-muted text-muted-foreground"
                  )}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {c.hasFile ? (
                    <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50 gap-1 h-8">
                      <FileCheck className="h-4 w-4" /> PDF
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 gap-1 h-8">
                      <Upload className="h-4 w-4" /> Subir
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setLegalCases(legalCases.filter(lc => lc.id !== c.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay trámites legales registrados.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
