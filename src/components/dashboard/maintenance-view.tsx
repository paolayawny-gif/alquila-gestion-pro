
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

interface MaintenanceViewProps {
  tasks: MaintenanceTask[];
  setTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>;
  properties: Property[];
  people: Person[];
}

export function MaintenanceView({ tasks, setTasks, properties, people }: MaintenanceViewProps) {
  const { toast } = useToast();
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  // Estado del formulario para nuevo ticket
  const [newTicket, setNewTicket] = useState<Partial<MaintenanceTask>>({
    propertyId: '',
    priority: 'Media',
    concept: '',
    description: '',
    status: 'Pendiente'
  });

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

  const handleCreateTicket = () => {
    if (!newTicket.propertyId || !newTicket.concept || !newTicket.description) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete la propiedad, el concepto y la descripción.",
        variant: "destructive"
      });
      return;
    }

    const property = properties.find(p => p.id === newTicket.propertyId);
    
    const task: MaintenanceTask = {
      id: Math.random().toString(36).substr(2, 9),
      propertyId: newTicket.propertyId!,
      propertyName: property?.name || 'Propiedad desconocida',
      concept: newTicket.concept!,
      description: newTicket.description!,
      priority: (newTicket.priority as any) || 'Media',
      status: 'Pendiente',
      estimatedCost: 0,
      photos: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      hasFile: false
    };

    setTasks([task, ...tasks]);
    setIsNewClaimOpen(false);
    setNewTicket({
      propertyId: '',
      priority: 'Media',
      concept: '',
      description: '',
      status: 'Pendiente'
    });

    toast({
      title: "Ticket Generado",
      description: `Se ha registrado el reclamo para ${task.propertyName}.`
    });
  };

  const handleCloseTicket = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'Cerrado', closedAt: new Date().toISOString().split('T')[0] } : t));
    toast({ title: "Ticket Cerrado", description: "El reclamo ha sido finalizado y archivado en el historial." });
  };

  const handleDeleteTicket = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    toast({ title: "Ticket Eliminado", description: "El reclamo ha sido removido del sistema." });
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
                <Select 
                  value={newTicket.propertyId} 
                  onValueChange={(v) => setNewTicket({...newTicket, propertyId: v})}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.address})</SelectItem>
                    ))}
                    {properties.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No hay propiedades cargadas.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select 
                  value={newTicket.priority} 
                  onValueChange={(v) => setNewTicket({...newTicket, priority: v as any})}
                >
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
                <Input 
                  placeholder="Ej: Filtración en baño principal" 
                  value={newTicket.concept}
                  onChange={(e) => setNewTicket({...newTicket, concept: e.target.value})}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Descripción del Reclamo</Label>
                <Textarea 
                  placeholder="Detalle lo reportado por el inquilino..." 
                  className="h-24" 
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                />
              </div>
              <div className="md:col-span-2 border-2 border-dashed rounded-lg p-6 text-center space-y-2 hover:bg-muted/50 cursor-pointer transition-colors">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Adjuntar Fotos del Reclamo</p>
                <p className="text-xs text-muted-foreground">PDF, JPG o PNG (Máx 5MB)</p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsNewClaimOpen(false)}>Cancelar</Button>
              <Button className="bg-primary text-white" onClick={handleCreateTicket}>Generar Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Tickets Abiertos</span>
          <span className="text-xl font-black">{tasks.filter(t => t.status !== 'Cerrado').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Urgencias / Críticos</span>
          <span className="text-xl font-black text-red-700">{tasks.filter(t => t.priority === 'Crítica' || t.priority === 'Alta').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-primary block">En Reparación</span>
          <span className="text-xl font-black text-primary">{tasks.filter(t => t.status === 'En curso').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-green-600 block">Cerrados este mes</span>
          <span className="text-xl font-black text-green-700">{tasks.filter(t => t.status === 'Cerrado').length}</span>
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
            {tasks.length > 0 ? tasks.map((t) => (
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
                    <span className="text-muted-foreground">{t.tenantName || 'Sin contrato activo'}</span>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTicket(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay reclamos de mantenimiento registrados.</TableCell>
              </TableRow>
            )}
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

