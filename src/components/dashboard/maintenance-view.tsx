
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
  User,
  History,
  HardHat,
  Camera,
  CheckCircle2,
  XCircle,
  DollarSign
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
import { useToast } from '@/hooks/use-toast';

const INITIAL_TASKS: MaintenanceTask[] = [
  { 
    id: '1', 
    propertyId: 'p1',
    propertyName: 'Edificio Las Heras 4B',
    tenantName: 'Carlos Sosa',
    contractId: 'c1',
    concept: 'Pérdida de agua en termotanque', 
    description: 'El inquilino reporta goteo constante desde la base del equipo.',
    priority: 'Alta',
    status: 'En curso', 
    providerName: 'Plomería Rodríguez',
    estimatedCost: 85000,
    actualCost: 0,
    photos: ['https://picsum.photos/seed/leak1/400/300'],
    createdAt: '2024-03-20',
    updatedAt: '2024-03-22',
    hasFile: true 
  },
  { 
    id: '2', 
    propertyId: 'p2',
    propertyName: 'Quinta del Sol',
    tenantName: 'Marta Rodriguez',
    concept: 'Pintura Fachada Exterior', 
    description: 'Trabajo preventivo aprobado por propietarios.',
    priority: 'Baja',
    status: 'Presupuestado', 
    estimatedCost: 450000,
    photos: [],
    createdAt: '2024-03-15',
    updatedAt: '2024-03-15',
    hasFile: false 
  },
];

export function MaintenanceView() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<MaintenanceTask[]>(INITIAL_TASKS);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const getStatusBadge = (status: MaintenanceTask['status']) => {
    const styles = {
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Presupuestado': 'bg-blue-100 text-blue-700 border-blue-200',
      'En curso': 'bg-purple-100 text-purple-700 border-purple-200',
      'Completado': 'bg-green-100 text-green-700 border-green-200',
      'Cerrado': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: MaintenanceTask['priority']) => {
    const styles = {
      'Baja': 'bg-slate-100 text-slate-700',
      'Media': 'bg-blue-100 text-blue-700',
      'Alta': 'bg-orange-100 text-orange-700',
      'Crítica': 'bg-red-100 text-red-700 animate-pulse'
    };
    return <Badge className={cn("border-none", styles[priority])}>{priority}</Badge>;
  };

  const handleCloseTicket = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'Cerrado', closedAt: new Date().toISOString().split('T')[0] } : t));
    toast({ title: "Ticket Cerrado", description: "El reclamo ha sido finalizado y archivado en el historial." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por propiedad o tarea..." className="pl-9 bg-white" />
          </div>
          <Button variant="outline" className="gap-2">
            <History className="h-4 w-4" /> Ver Historial Completo
          </Button>
        </div>
        
        <Dialog open={isNewClaimOpen} onOpenChange={setIsNewClaimOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Reclamo de Inquilino
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Reclamo / Incidencia</DialogTitle>
              <DialogDescription>Cargue el pedido de mantenimiento para iniciar el flujo de gestión.</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Propiedad / Unidad</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">Las Heras 4B (Carlos Sosa)</SelectItem>
                    <SelectItem value="p2">Quinta del Sol (Marta Rodriguez)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select defaultValue="Media">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">Baja (Mantenimiento General)</SelectItem>
                    <SelectItem value="Media">Media (Reparación Necesaria)</SelectItem>
                    <SelectItem value="Alta">Alta (Urgente / Habitabilidad)</SelectItem>
                    <SelectItem value="Crítica">Crítica (Emergencia Edilicia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Concepto / Título</Label>
                <Input placeholder="Ej: Filtración en baño principal" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Descripción del Reclamo</Label>
                <Textarea placeholder="Detalle lo reportado por el inquilino..." className="h-24" />
              </div>
              <div className="md:col-span-2 border-2 border-dashed rounded-lg p-6 text-center space-y-2 hover:bg-muted/50 cursor-pointer transition-colors">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Adjuntar Fotos del Reclamo</p>
                <p className="text-xs text-muted-foreground">PDF, JPG o PNG (Máx 5MB)</p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsNewClaimOpen(false)}>Cancelar</Button>
              <Button className="bg-primary text-white">Generar Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Tickets Abiertos</span>
          <span className="text-xl font-black">12</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Urgencias / Críticos</span>
          <span className="text-xl font-black text-red-700">3</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-primary block">En Reparación</span>
          <span className="text-xl font-black text-primary">5</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-green-600 block">Cerrados este mes</span>
          <span className="text-xl font-black text-green-700">24</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[300px]">Concepto / Reclamo</TableHead>
              <TableHead>Propiedad e Inquilino</TableHead>
              <TableHead>Prioridad / Estado</TableHead>
              <TableHead>Proveedor Asignado</TableHead>
              <TableHead className="text-right">Costo Est.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground flex items-center gap-2">
                      {t.concept}
                      {t.photos.length > 0 && <Camera className="h-3 w-3 text-primary" />}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">{t.description}</span>
                    <span className="text-[9px] text-muted-foreground">Iniciado: {t.createdAt}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs">
                    <span className="font-semibold">{t.propertyName}</span>
                    <span className="text-muted-foreground">{t.tenantName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    {getPriorityBadge(t.priority)}
                    {getStatusBadge(t.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <HardHat className="h-4 w-4 text-muted-foreground" />
                    <span className={t.providerName ? "font-medium" : "italic text-muted-foreground"}>
                      {t.providerName || "Sin asignar"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                   <div className="flex flex-col items-end">
                    <span className="font-bold text-primary">$ {t.estimatedCost.toLocaleString('es-AR')}</span>
                    {t.actualCost && t.actualCost > 0 && (
                      <span className="text-[9px] text-muted-foreground">Real: $ {t.actualCost.toLocaleString('es-AR')}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {t.status !== 'Cerrado' && (
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setSelectedTask(t);
                          setIsAssignOpen(true);
                        }}
                      >
                        <HardHat className="h-4 w-4" />
                      </Button>
                    )}
                    {t.status === 'Completado' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-green-600 hover:bg-green-50"
                        onClick={() => handleCloseTicket(t.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* DIALOGO DE ASIGNACIÓN A PROVEEDOR */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Proveedor y Presupuesto</DialogTitle>
            <DialogDescription>
              Gestión para el ticket: <strong>{selectedTask?.concept}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Proveedor / Profesional</Label>
              <Select defaultValue="p1">
                <SelectTrigger><SelectValue placeholder="Seleccione proveedor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">Plomería Rodríguez (Gasista Mat.)</SelectItem>
                  <SelectItem value="p2">Electricidad Norte (Electricista)</SelectItem>
                  <SelectItem value="p3">Multiservicios AR (Pintor/Albañil)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Presupuesto Est. ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha Estimada</Label>
                <Input type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instrucciones para el Proveedor</Label>
              <Textarea placeholder="Ej: Llamar antes de ir al 11..." />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white gap-2">
              <Wrench className="h-4 w-4" /> Confirmar Asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
