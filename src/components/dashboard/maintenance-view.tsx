
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Wrench, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MessageSquare,
  Building,
  User
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaintenanceTask } from '@/lib/types';
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

const INITIAL_TASKS: MaintenanceTask[] = [
  { 
    id: '1', 
    propertyId: 'p1',
    propertyName: 'Edificio Las Heras 4B',
    tenantName: 'Carlos Sosa',
    concept: 'Pérdida de agua en termotanque', 
    description: 'El inquilino reporta goteo constante desde la base del equipo.',
    amount: 85000, 
    dueDate: '2024-03-25', 
    priority: 'Alta',
    status: 'En curso', 
    hasFile: true 
  },
  { 
    id: '2', 
    propertyId: 'p2',
    propertyName: 'Quinta del Sol',
    tenantName: 'Marta Rodriguez',
    concept: 'Pintura Fachada Exterior', 
    description: 'Trabajo preventivo aprobado por propietarios.',
    amount: 450000, 
    dueDate: '2024-04-15', 
    priority: 'Baja',
    status: 'Presupuestado', 
    hasFile: false 
  },
];

export function MaintenanceView() {
  const [tasks] = useState<MaintenanceTask[]>(INITIAL_TASKS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getStatusBadge = (status: MaintenanceTask['status']) => {
    const styles = {
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Presupuestado': 'bg-blue-100 text-blue-700 border-blue-200',
      'En curso': 'bg-purple-100 text-purple-700 border-purple-200',
      'Completado': 'bg-green-100 text-green-700 border-green-200'
    };
    return <Badge variant="outline" className={cn("border", styles[status])}>{status}</Badge>;
  };

  const getPriorityIcon = (priority: MaintenanceTask['priority']) => {
    switch (priority) {
      case 'Crítica': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'Alta': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'Media': return <Clock className="h-4 w-4 text-blue-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por propiedad o tarea..." className="pl-9 bg-white shadow-sm" />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Nuevo Reclamo / Tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Tarea de Mantenimiento</DialogTitle>
              <DialogDescription>Gestione reclamos técnicos y reparaciones preventivas.</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Propiedad Afectada</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">Las Heras 4B</SelectItem>
                    <SelectItem value="p2">Quinta del Sol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select defaultValue="Media">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">Baja (Mantenimiento)</SelectItem>
                    <SelectItem value="Media">Media (Reparación)</SelectItem>
                    <SelectItem value="Alta">Alta (Urgencia)</SelectItem>
                    <SelectItem value="Crítica">Crítica (Emergencia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Concepto / Título</Label>
                <Input placeholder="Ej: Fuga de gas en cocina" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Descripción del Reclamo</Label>
                <Textarea placeholder="Detalle el problema reportado por el inquilino o detectado..." />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-primary text-white">Registrar Reclamo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[300px]">Tarea / Reclamo</TableHead>
                  <TableHead>Propiedad e Inquilino</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Costo Est.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{t.concept}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">{t.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {t.propertyName}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {t.tenantName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(t.priority)}
                        <span className="text-xs">{t.priority}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      $ {t.amount.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
