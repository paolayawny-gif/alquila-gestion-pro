
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Wrench, 
  Search, 
  CheckCircle2,
  HardHat,
  Trash2,
  Settings2,
  DollarSign,
  User,
  Sparkles,
  Loader2,
  Send,
  Eye,
  Calendar,
  AlertTriangle
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
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  
  // Estado para notificación al propietario
  const [isNotifyingOwner, setIsNotifyingOwner] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState<AiCommunicationAssistantOutput | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [newTicket, setNewTicket] = useState<Partial<MaintenanceTask>>({
    propertyId: '',
    priority: 'Media',
    concept: '',
    description: '',
    status: 'Pendiente',
    estimatedCost: 0,
    actualCost: 0
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
      estimatedCost: newTicket.estimatedCost || 0,
      actualCost: 0,
      photos: [],
      createdAt: new Date().toLocaleDateString('es-AR'),
      updatedAt: new Date().toLocaleDateString('es-AR'),
      hasFile: false
    };

    setDocumentNonBlocking(docRef, task, { merge: true });
    setIsNewClaimOpen(false);
    toast({ title: "Ticket Creado", description: "Se ha registrado el nuevo reclamo." });
  };

  const handleUpdateTask = () => {
    if (!selectedTask || !userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', selectedTask.id);
    
    setDocumentNonBlocking(docRef, {
      ...selectedTask,
      updatedAt: new Date().toLocaleDateString('es-AR')
    }, { merge: true });
    
    setIsManageDialogOpen(false);
    toast({ title: "Cambios Guardados", description: "La gestión del reclamo ha sido actualizada." });
  };

  const handleDraftNotification = async () => {
    if (!selectedTask) return;
    setIsDrafting(true);
    setDraft(null);
    try {
      const property = properties.find(p => p.id === selectedTask.propertyId);
      const ownerName = property?.owners[0]?.name || 'Propietario';
      
      const res = await aiCommunicationAssistant({
        communicationType: 'maintenanceUpdate',
        ownerName: ownerName,
        propertyName: selectedTask.propertyName,
        maintenanceConcept: selectedTask.concept,
        maintenanceStatus: selectedTask.status,
        maintenanceCost: selectedTask.actualCost > 0 
          ? `$ ${selectedTask.actualCost.toLocaleString('es-AR')} (Final)` 
          : selectedTask.estimatedCost > 0 
            ? `$ ${selectedTask.estimatedCost.toLocaleString('es-AR')} (Estimado)`
            : "Pendiente de presupuesto",
        additionalContext: selectedTask.description
      });
      setDraft(res);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el informe.", variant: "destructive" });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!draft || !selectedTask) return;
    const property = properties.find(p => p.id === selectedTask.propertyId);
    const ownerEmail = property?.owners[0]?.email;
    
    if (!ownerEmail) {
      toast({ title: "Email no encontrado", description: "El propietario no tiene un email configurado.", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: ownerEmail,
        subject: draft.subjectLine,
        html: `<div style="text-align: justify;">${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Email Enviado", description: "El propietario ha sido notificado." });
      setDraft(null);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar el correo.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDeleteTicket = (taskId: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', taskId);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por concepto o unidad..." className="pl-9 bg-white" />
        </div>
        
        <Dialog open={isNewClaimOpen} onOpenChange={setIsNewClaimOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white gap-2 font-bold shadow-md">
              <Plus className="h-4 w-4" /> Nuevo Reclamo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Nueva Incidencia</DialogTitle>
              <DialogDescription>Cargue los datos iniciales reportados por el inquilino.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
               <div className="space-y-2">
                 <Label>Propiedad / Unidad</Label>
                 <Select onValueChange={(v) => setNewTicket({...newTicket, propertyId: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger>
                    <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Concepto del Reclamo</Label>
                 <Input placeholder="Ej: Filtración en baño principal" onChange={e => setNewTicket({...newTicket, concept: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <Label>Prioridad</Label>
                 <Select defaultValue="Media" onValueChange={(v: any) => setNewTicket({...newTicket, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baja">Baja</SelectItem>
                      <SelectItem value="Media">Media</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Descripción del Problema</Label>
                 <Textarea placeholder="Indique detalles recibidos del inquilino..." className="min-h-[100px]" onChange={e => setNewTicket({...newTicket, description: e.target.value})} />
               </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setIsNewClaimOpen(false)}>Cancelar</Button>
              <Button className="bg-primary px-8 font-black" onClick={handleCreateTicket}>Registrar Ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Concepto / Unidad</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Costo Est.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{t.concept}</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">{t.propertyName} • {t.createdAt}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="ghost" className={cn(
                    "text-[10px] font-bold uppercase",
                    t.priority === 'Urgente' ? "text-red-600 bg-red-50" : "text-muted-foreground"
                  )}>
                    {t.priority}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {t.estimatedCost > 0 ? `$ ${t.estimatedCost.toLocaleString('es-AR')}` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 border-primary text-primary font-bold gap-1 px-3"
                      onClick={() => { setSelectedTask(t); setIsManageDialogOpen(true); setDraft(null); }}
                    >
                      <Settings2 className="h-3.5 w-3.5" /> Gestionar
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTicket(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay reclamos de mantenimiento registrados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Diálogo de Gestión Detallada */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          {selectedTask && (
            <>
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <Badge className="bg-white/20 text-white border-none mb-2 uppercase text-[9px] font-black">Ficha de Seguimiento</Badge>
                  <DialogTitle className="text-2xl font-black">{selectedTask.concept}</DialogTitle>
                  <p className="text-white/80 text-sm font-medium">{selectedTask.propertyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-white/60 mb-1">Estado Operativo</p>
                  <Badge className="bg-white text-primary font-black px-4 py-1">{selectedTask.status}</Badge>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Columna Izquierda: Datos y Costos */}
                  <div className="md:col-span-7 space-y-6">
                    <div className="p-4 bg-muted/30 rounded-xl border space-y-4">
                      <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><Settings2 className="h-4 w-4" /> Actualizar Estado</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nuevo Estado</Label>
                          <Select 
                            value={selectedTask.status} 
                            onValueChange={(v: any) => setSelectedTask({...selectedTask, status: v})}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendiente">Pendiente</SelectItem>
                              <SelectItem value="Presupuestado">Presupuestado</SelectItem>
                              <SelectItem value="En curso">En curso</SelectItem>
                              <SelectItem value="Completado">Completado</SelectItem>
                              <SelectItem value="Cerrado">Cerrado (Finalizado)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Proveedor / Contratista</Label>
                          <Input 
                            placeholder="Nombre del técnico..."
                            value={selectedTask.contractorName || ''}
                            onChange={e => setSelectedTask({...selectedTask, contractorName: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                        <Label className="text-blue-700 font-bold flex items-center gap-1"><DollarSign className="h-3 w-3" /> Costo Estimado</Label>
                        <Input 
                          type="number" 
                          className="bg-white" 
                          value={selectedTask.estimatedCost} 
                          onChange={e => setSelectedTask({...selectedTask, estimatedCost: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-2">
                        <Label className="text-green-700 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Costo Final (Cierre)</Label>
                        <Input 
                          type="number" 
                          className="bg-white"
                          value={selectedTask.actualCost}
                          onChange={e => setSelectedTask({...selectedTask, actualCost: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Descripción Detallada y Notas Técnicas</Label>
                      <Textarea 
                        className="min-h-[120px] bg-muted/10"
                        value={selectedTask.description}
                        onChange={e => setSelectedTask({...selectedTask, description: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Columna Derecha: Comunicación IA */}
                  <div className="md:col-span-5 space-y-6">
                    <Card className="border-none shadow-sm bg-primary/5 border border-primary/10 overflow-hidden">
                      <CardHeader className="bg-primary/10 pb-4">
                        <CardTitle className="text-sm font-black uppercase text-primary flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Informe al Propietario
                        </CardTitle>
                        <CardDescription className="text-[10px]">Utilice la IA para notificar al dueño sobre la reparación y costos.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {!draft && !isDrafting ? (
                          <div className="text-center py-4 space-y-4">
                            <p className="text-xs text-muted-foreground italic leading-relaxed">Se redactará un mensaje profesional justificando el arreglo y el presupuesto.</p>
                            <Button className="w-full bg-primary text-white font-bold h-11 gap-2" onClick={handleDraftNotification}>
                              <Sparkles className="h-4 w-4" /> Redactar Informe IA
                            </Button>
                          </div>
                        ) : isDrafting ? (
                          <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs font-bold text-primary">IA analizando reparación...</p>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-3 bg-white rounded-lg border border-primary/20 shadow-inner">
                              <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Asunto Generado</p>
                              <p className="text-xs font-bold">{draft?.subjectLine}</p>
                            </div>
                            <ScrollArea className="h-[200px] bg-white p-4 rounded-lg border text-xs leading-relaxed text-justify whitespace-pre-wrap italic">
                              {draft?.draftedMessage}
                            </ScrollArea>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold" onClick={() => setDraft(null)}>Corregir</Button>
                              <Button 
                                className="flex-[2] bg-primary text-white text-[10px] font-black gap-2 h-9" 
                                onClick={handleSendEmail}
                                disabled={isSendingEmail}
                              >
                                {isSendingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Enviar Informe Real
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-orange-700">Importante Liquidación</p>
                        <p className="text-[9px] text-orange-800 leading-tight">Al cargar el "Costo Final", el sistema sugerirá descontar este monto en la próxima liquidación al propietario.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 bg-muted/30 border-t rounded-b-lg gap-4">
                <Button variant="ghost" className="font-bold" onClick={() => setIsManageDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary text-white font-black px-12 h-11" onClick={handleUpdateTask}>
                  Guardar Cambios de Gestión
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
