
"use client";

import React, { useState, useMemo } from 'react';
import { CurrencyInput } from '@/components/ui/currency-input';
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
  AlertTriangle,
  Scale,
  ThumbsUp,
  ClipboardList,
  Zap,
  Clock,
  CheckSquare,
  BookUser,
  Phone,
  Mail,
  Star,
  Edit2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaintenanceTask, Property, Person, Provider } from '@/lib/types';
import { SelectWithOther } from '@/components/ui/select-with-other';
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
import { useFirestore, useCollection } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, getDoc, collection, query as fsQuery, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { createNotification } from '@/lib/notifications';
import { OwnerRegistryEntry } from '@/components/owner/owner-portal';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { EmptyState } from '@/components/ui/empty-state';
import { aiCommunicationAssistant, AiCommunicationAssistantOutput } from '@/ai/flows/ai-communication-assistant-flow';
import { sendEmail } from '@/services/email-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { TenantTicketsAdminView } from './tenant-tickets-admin-view';

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
  const { canWrite, canDelete } = useOrgPermissions();

  const [mainTab, setMainTab] = useState<'tasks' | 'tickets' | 'providers'>('tasks');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'inprogress' | 'resolved'>('all');
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  
  // Rating de proveedor
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [ratingTaskId, setRatingTaskId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<1|2|3|4|5>(5);
  const [ratingComment, setRatingComment] = useState('');

  // Directorio de proveedores
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState<Partial<Provider>>({});
  const [providerSearch, setProviderSearch] = useState('');

  // Estado para notificación al propietario
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
    actualCost: 0,
    chargedTo: 'N/A',
    isApprovedByOwner: false
  });

  const providersQuery = useMemo(() => {
    if (!db || !userId) return null;
    return fsQuery(collection(db, 'artifacts', APP_ID, 'users', userId, 'proveedores'), orderBy('name'));
  }, [db, userId]);
  const { data: providersRaw } = useCollection<Provider>(providersQuery);
  const providers = providersRaw ?? [];

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const s = providerSearch.toLowerCase();
    return providers.filter(p => p.name.toLowerCase().includes(s) || p.specialty.toLowerCase().includes(s));
  }, [providers, providerSearch]);

  const handleSaveProvider = () => {
    if (!providerForm.name || !providerForm.specialty || !userId || !db) return;
    const docId = editingProvider?.id ?? Math.random().toString(36).slice(2, 11);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'proveedores', docId);
    const provider: Provider = {
      id: docId,
      name: providerForm.name,
      specialty: providerForm.specialty,
      phone: providerForm.phone,
      email: providerForm.email,
      notes: providerForm.notes,
      averageRating: editingProvider?.averageRating ?? 0,
      totalRatings: editingProvider?.totalRatings ?? 0,
      ownerId: userId,
      createdAt: editingProvider?.createdAt ?? new Date().toLocaleDateString('es-AR'),
    };
    setDocumentNonBlocking(docRef, provider, { merge: true });
    setIsProviderDialogOpen(false);
    setEditingProvider(null);
    setProviderForm({});
    toast({ title: editingProvider ? 'Proveedor actualizado' : 'Proveedor agregado' });
  };

  const handleDeleteProvider = (id: string) => {
    if (!userId || !db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'proveedores', id));
    toast({ title: 'Proveedor eliminado' });
  };

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

  const PRIORITY_PHASE: Record<string, { sla: string; slaDays: number; color: string; bg: string; bar: string }> = {
    'Urgente': { sla: '24-48 hs',   slaDays: 2,  color: 'text-red-700',    bg: 'bg-red-50',    bar: 'bg-red-500' },
    'Alta':    { sla: '1 semana',   slaDays: 7,  color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-400' },
    'Media':   { sla: '2 semanas',  slaDays: 14, color: 'text-yellow-700', bg: 'bg-yellow-50', bar: 'bg-yellow-400' },
    'Baja':    { sla: 'Preventivo', slaDays: 90, color: 'text-slate-600',  bg: 'bg-slate-50',  bar: 'bg-slate-400' },
  };

  const getPriorityCell = (task: MaintenanceTask) => {
    const phase = PRIORITY_PHASE[task.priority] ?? PRIORITY_PHASE['Baja'];
    const isOpen = task.status !== 'Completado' && task.status !== 'Cerrado';
    let ageLabel = '';
    let overSla = false;
    if (isOpen && task.createdAt) {
      const parts = task.createdAt.split('/');
      const created = parts.length === 3 ? new Date(+parts[2], +parts[1]-1, +parts[0]) : new Date(task.createdAt);
      const ageDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
      if (!isNaN(ageDays)) {
        overSla = ageDays > phase.slaDays;
        ageLabel = ageDays === 0 ? 'hoy' : `${ageDays}d`;
      }
    }
    return (
      <div className="flex flex-col gap-1 min-w-[90px]">
        <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black', phase.bg, phase.color)}>
          {task.priority === 'Urgente' && <Zap className="h-2.5 w-2.5" />}
          {task.priority}
        </div>
        <div className="flex items-center gap-1">
          <span className={cn('text-[9px] font-bold', overSla ? 'text-red-600' : 'text-muted-foreground')}>
            SLA: {phase.sla}
          </span>
          {ageLabel && (
            <span className={cn('text-[9px] font-black px-1 rounded', overSla ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground')}>
              {overSla ? '⚠ ' : ''}{ageLabel}
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleCreateTicket = () => {
    if (!newTicket.propertyId || !newTicket.concept || !userId || !db) return;

    const property = properties.find(p => p.id === newTicket.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', docId);
    
    // If charged to owner, populate ownerEmail from property.owners[0]
    const ownerEmail = property?.owners?.[0]?.email ?? '';

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
      chargedTo: 'N/A',
      isApprovedByOwner: false,
      ownerEmail: ownerEmail,
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

    // Keep ownerEmail in sync: set it from property.owners[0] whenever chargedTo is Propietario
    const property = properties.find(p => p.id === selectedTask.propertyId);
    const ownerEmail =
      selectedTask.chargedTo === 'Propietario'
        ? (property?.owners?.[0]?.email ?? selectedTask.ownerEmail ?? '')
        : (selectedTask.ownerEmail ?? '');

    const wasChargedToOwner = selectedTask.chargedTo === 'Propietario';

    setDocumentNonBlocking(docRef, {
      ...selectedTask,
      ownerEmail,
      updatedAt: new Date().toLocaleDateString('es-AR')
    }, { merge: true });

    // Notificar al propietario si se le asignó la tarea para aprobación
    if (wasChargedToOwner && ownerEmail && db) {
      const regDocId = ownerEmail.toLowerCase().replace(/[@.+]/g, '_');
      getDoc(doc(db, 'artifacts', APP_ID, 'ownerRegistry', regDocId)).then(snap => {
        const regEntry = snap.data() as OwnerRegistryEntry | undefined;
        if (regEntry?.ownerUid) {
          createNotification(db, regEntry.ownerUid, {
            type: 'maintenance_approved',
            title: 'Tarea de mantenimiento pendiente',
            message: `"${selectedTask.concept}" en ${property?.name ?? selectedTask.propertyName} requiere tu aprobación.`,
            refId: selectedTask.id,
            link: 'Aprobaciones',
          });
        }
      });
    }

    setIsManageDialogOpen(false);
    toast({ title: "Cambios Guardados", description: "La gestión del reclamo ha sido actualizada." });

    // Si se cerró el ticket y hay proveedor asignado, pedir calificación
    if (selectedTask.status === 'Cerrado' && selectedTask.contractorName && !selectedTask.contractorRating) {
      setRatingTaskId(selectedTask.id);
      setRatingValue(5);
      setRatingComment('');
      setIsRatingOpen(true);
    }
  };

  const handleSaveRating = () => {
    if (!ratingTaskId || !userId || !db) return;
    const task = tasks.find(t => t.id === ratingTaskId);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento', ratingTaskId);
    setDocumentNonBlocking(docRef, {
      contractorRating: ratingValue,
      contractorRatingComment: ratingComment || undefined,
    }, { merge: true });

    // Update provider average rating if task references a provider
    if (task?.providerId) {
      const providerDoc = providers.find(p => p.id === task.providerId);
      if (providerDoc) {
        const prevTotal = providerDoc.totalRatings ?? 0;
        const prevAvg = providerDoc.averageRating ?? 0;
        const newTotal = prevTotal + 1;
        const newAvg = (prevAvg * prevTotal + ratingValue) / newTotal;
        const pRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'proveedores', task.providerId);
        setDocumentNonBlocking(pRef, { averageRating: Math.round(newAvg * 10) / 10, totalRatings: newTotal }, { merge: true });
      }
    }

    setIsRatingOpen(false);
    toast({ title: 'Calificación guardada', description: `Proveedor calificado con ${ratingValue} estrella${ratingValue !== 1 ? 's' : ''}.` });
  };

  const handleDraftNotification = async () => {
    if (!selectedTask) return;
    setIsDrafting(true);
    setDraft(null);
    try {
      const property = properties.find(p => p.id === selectedTask.propertyId);
      const ownerName = property?.owners?.[0]?.name || 'Propietario';
      
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
    const ownerEmail = property?.owners?.[0]?.email;
    
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

  const openTasks = tasks.filter(t => t.status !== 'Completado' && t.status !== 'Cerrado');
  const urgentHighTasks = tasks.filter(t => (t.priority === 'Urgente' || t.priority === 'Alta') && t.status !== 'Cerrado');
  const inProgressTasks = tasks.filter(t => t.status === 'En curso' || t.status === 'Presupuestado');
  const resolvedLast7 = tasks.filter(t => t.status === 'Completado' || t.status === 'Cerrado');

  const filteredTasks = useMemo(() => {
    let base = tasks;
    if (filterStatus === 'open') base = tasks.filter(t => t.status === 'Pendiente');
    if (filterStatus === 'inprogress') base = tasks.filter(t => t.status === 'En curso' || t.status === 'Presupuestado');
    if (filterStatus === 'resolved') base = tasks.filter(t => t.status === 'Completado' || t.status === 'Cerrado');
    if (searchTerm) base = base.filter(t => t.concept.toLowerCase().includes(searchTerm.toLowerCase()) || t.propertyName.toLowerCase().includes(searchTerm.toLowerCase()));
    return base.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tasks, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Tab switcher ── */}
      <div className="flex gap-2 border-b pb-3">
        <button
          onClick={() => setMainTab('tasks')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2',
            mainTab === 'tasks'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Wrench className="h-4 w-4" /> Tareas Internas
        </button>
        <button
          onClick={() => setMainTab('tickets')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2',
            mainTab === 'tickets'
              ? 'bg-amber-50 text-amber-700'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <ClipboardList className="h-4 w-4" /> Reclamos de Inquilinos
        </button>
        <button
          onClick={() => setMainTab('providers')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2',
            mainTab === 'providers'
              ? 'bg-green-50 text-green-700'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <BookUser className="h-4 w-4" /> Directorio de Proveedores
          {providers.length > 0 && (
            <span className="ml-0.5 text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-black">{providers.length}</span>
          )}
        </button>
      </div>

      {/* ── Tenant tickets tab ── */}
      {mainTab === 'tickets' && (
        <TenantTicketsAdminView userId={userId} properties={properties} />
      )}

      {/* ── Providers tab ── */}
      {mainTab === 'providers' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor o especialidad..."
                className="pl-9 bg-white"
                value={providerSearch}
                onChange={e => setProviderSearch(e.target.value)}
              />
            </div>
            {canWrite && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-2 font-bold shadow-md"
                onClick={() => { setEditingProvider(null); setProviderForm({}); setIsProviderDialogOpen(true); }}
              >
                <Plus className="h-4 w-4" /> Agregar Proveedor
              </Button>
            )}
          </div>

          {filteredProviders.length === 0 ? (
            <EmptyState
              icon={BookUser}
              title="Sin proveedores registrados"
              description="Agregá plomeros, electricistas y otros prestadores para asignarlos a las tareas y gestionar sus calificaciones."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map(p => (
                <Card key={p.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-foreground truncate">{p.name}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5 text-green-700 border-green-200 bg-green-50">
                          {p.specialty}
                        </Badge>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {canWrite && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-primary"
                            onClick={() => { setEditingProvider(p); setProviderForm(p); setIsProviderDialogOpen(true); }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmDeleteButton
                            trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                            title="Eliminar proveedor"
                            itemName={p.name}
                            onConfirm={() => handleDeleteProvider(p.id)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {p.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{p.phone}</span>
                        </div>
                      )}
                      {p.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                      )}
                    </div>

                    {(p.totalRatings ?? 0) > 0 ? (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-dashed border-muted">
                        <div className="flex">
                          {([1,2,3,4,5] as const).map(s => (
                            <Star
                              key={s}
                              className={cn('h-3 w-3', s <= Math.round(p.averageRating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20')}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-amber-600">{p.averageRating?.toFixed(1)}</span>
                        <span className="text-[10px] text-muted-foreground">({p.totalRatings} {(p.totalRatings ?? 0) === 1 ? 'calificación' : 'calificaciones'})</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/60 italic pt-1 border-t border-dashed border-muted">Sin calificaciones aún</p>
                    )}

                    {p.notes && (
                      <p className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2 leading-tight">{p.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Provider add/edit dialog ── */}
      <Dialog open={isProviderDialogOpen} onOpenChange={setIsProviderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookUser className="h-5 w-5 text-green-600" />
              {editingProvider ? 'Editar proveedor' : 'Nuevo proveedor'}
            </DialogTitle>
            <DialogDescription>
              Registrá al prestador para asignarlo a tareas y llevar un historial de calificaciones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Juan Pérez Plomería"
                value={providerForm.name ?? ''}
                onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidad *</Label>
              <SelectWithOther
                options={['Plomería', 'Electricidad', 'Gas', 'Albañilería', 'Pintura', 'Carpintería', 'Cerrajería', 'Climatización / HVAC', 'Jardinería', 'Limpieza', 'Fumigación']}
                value={providerForm.specialty ?? ''}
                onValueChange={v => setProviderForm(f => ({ ...f, specialty: v }))}
                placeholder="Seleccioná o escribí especialidad..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="11 1234-5678"
                  value={providerForm.phone ?? ''}
                  onChange={e => setProviderForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="proveedor@mail.com"
                  value={providerForm.email ?? ''}
                  onChange={e => setProviderForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea
                placeholder="Disponibilidad, zona de cobertura, condiciones de pago..."
                rows={2}
                value={providerForm.notes ?? ''}
                onChange={e => setProviderForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setIsProviderDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white font-black px-8"
              onClick={handleSaveProvider}
              disabled={!providerForm.name || !providerForm.specialty}
            >
              {editingProvider ? 'Guardar cambios' : 'Agregar proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Internal tasks tab ── */}
      {mainTab === 'tasks' && <>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className={cn("border-none shadow-sm bg-white cursor-pointer transition-colors", filterStatus === 'all' && "ring-2 ring-primary")}
          onClick={() => setFilterStatus('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total Abiertos</p>
              <p className="text-2xl font-black">{openTasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("border-none shadow-sm bg-white cursor-pointer transition-colors border-l-4 border-l-red-400", filterStatus === 'open' && "ring-2 ring-red-400")}
          onClick={() => setFilterStatus('open')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-[10px] text-red-600 font-bold">Urgente / Alto</p>
              <p className="text-2xl font-black text-red-600">{urgentHighTasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("border-none shadow-sm bg-white cursor-pointer transition-colors border-l-4 border-l-blue-400", filterStatus === 'inprogress' && "ring-2 ring-blue-400")}
          onClick={() => setFilterStatus('inprogress')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-600 font-bold">En Progreso</p>
              <p className="text-2xl font-black text-blue-600">{inProgressTasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("border-none shadow-sm bg-white cursor-pointer transition-colors border-l-4 border-l-green-400", filterStatus === 'resolved' && "ring-2 ring-green-400")}
          onClick={() => setFilterStatus('resolved')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-[10px] text-green-600 font-bold">Resueltos (7d)</p>
              <p className="text-2xl font-black text-green-600">{resolvedLast7.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por concepto o unidad..."
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <Dialog open={isNewClaimOpen} onOpenChange={setIsNewClaimOpen}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2 font-bold shadow-md">
                <Plus className="h-4 w-4" /> Nuevo Reclamo
              </Button>
            </DialogTrigger>
          )}
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
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Concepto / Unidad</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{t.concept}</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">{t.propertyName} • {t.createdAt}</span>
                  </div>
                </TableCell>
                <TableCell>{getPriorityCell(t)}</TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {t.chargedTo === 'Propietario' ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-orange-600 border-orange-200">Propietario</Badge>
                        {t.isApprovedByOwner ? <ThumbsUp className="h-3 w-3 text-green-600" /> : <AlertTriangle className="h-3 w-3 text-orange-400" />}
                      </div>
                    ) : t.chargedTo === 'Inquilino' ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-200">Inquilino</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">No definido</span>
                    )}
                    {t.contractorRating && (
                      <div className="flex items-center gap-0.5" title={t.contractorRatingComment || `${t.contractorRating} estrellas`}>
                        {([1,2,3,4,5] as const).map(s => (
                          <span key={s} className={cn('text-xs', s <= t.contractorRating! ? 'text-amber-400' : 'text-muted-foreground/20')}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
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
                    {canDelete && (
                      <ConfirmDeleteButton
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Eliminar tarea de mantenimiento"
                        itemName={t.concept}
                        description={<p>Si esta tarea fue aprobada por el propietario y ya se descontó en una liquidación, eliminarla puede romper auditorías.</p>}
                        blockedReason={t.isApprovedByOwner && t.status === 'Cerrado' ? 'Esta tarea ya fue aprobada y cerrada (puede haber sido deducida en liquidación). No se recomienda eliminar.' : null}
                        onConfirm={() => handleDeleteTicket(t.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Wrench}
                    title="Sin tareas en esta categoría"
                    description="No hay reclamos ni tareas registradas. Podés crear una tarea interna o esperar solicitudes de inquilinos."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Diálogo de Gestión Detallada */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          {selectedTask && (
            <>
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <Badge className="bg-white/20 text-white border-none mb-2 uppercase text-[9px] font-black">Ficha de Seguimiento y Costos</Badge>
                  <DialogTitle className="text-2xl font-black">{selectedTask.concept}</DialogTitle>
                  <p className="text-white/80 text-sm font-medium">{selectedTask.propertyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-white/60 mb-1">Estado Operativo</p>
                  <Badge className="bg-white text-primary font-black px-4 py-1">{selectedTask.status}</Badge>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="p-4 bg-muted/30 rounded-xl border space-y-4">
                      <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configuración de Obra</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Estado del Reclamo</Label>
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
                          {providers.length > 0 ? (
                            <Select
                              value={selectedTask.providerId ?? '__manual__'}
                              onValueChange={v => {
                                if (v === '__manual__') {
                                  setSelectedTask({ ...selectedTask, providerId: undefined, contractorName: '' });
                                } else {
                                  const prov = providers.find(p => p.id === v);
                                  setSelectedTask({ ...selectedTask, providerId: v, contractorName: prov?.name ?? '' });
                                }
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__manual__">— Ingresar manualmente —</SelectItem>
                                {providers.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} · {p.specialty}
                                    {(p.totalRatings ?? 0) > 0 && ` ★${p.averageRating?.toFixed(1)}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          {(!selectedTask.providerId || providers.length === 0) && (
                            <Input
                              placeholder="Nombre del técnico..."
                              value={selectedTask.contractorName || ''}
                              onChange={e => setSelectedTask({ ...selectedTask, contractorName: e.target.value, providerId: undefined })}
                            />
                          )}
                          {providers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">
                              Agregá proveedores en el tab "Directorio" para seleccionarlos aquí y llevar calificaciones.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
                      <h4 className="text-xs font-black uppercase text-blue-700 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Definición de Gastos</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black">Asignar Responsable</Label>
                          <Select 
                            value={selectedTask.chargedTo || 'N/A'} 
                            onValueChange={(v: any) => setSelectedTask({...selectedTask, chargedTo: v})}
                          >
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="N/A">Sin definir / Sin costo</SelectItem>
                              <SelectItem value="Inquilino">Cargo a Inquilino</SelectItem>
                              <SelectItem value="Propietario">Deducción Propietario</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black">Costo Final (ARS)</Label>
                          <CurrencyInput
                            className="bg-white font-bold"
                            value={selectedTask.actualCost || 0}
                            onChange={v => setSelectedTask({...selectedTask, actualCost: v})}
                          />
                        </div>
                      </div>

                      {selectedTask.chargedTo === 'Propietario' && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-black text-orange-700 flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" /> ¿Aprobado por el dueño?
                            </Label>
                            <p className="text-[9px] text-muted-foreground italic">Debe marcarse para habilitar el descuento en liquidación.</p>
                          </div>
                          <Switch 
                            checked={selectedTask.isApprovedByOwner} 
                            onCheckedChange={(checked) => setSelectedTask({...selectedTask, isApprovedByOwner: checked})} 
                          />
                        </div>
                      )}

                      {selectedTask.chargedTo === 'Inquilino' && (
                        <div className="p-3 bg-blue-100/50 rounded-lg border border-blue-200 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0" />
                          <p className="text-[9px] text-blue-800 leading-tight">
                            <strong>Recordatorio:</strong> Al ser cargo del inquilino, deberá cargarlo como "Otros" en la próxima factura mensual del mismo.
                          </p>
                        </div>
                      )}
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

                  <div className="lg:col-span-5 space-y-6">
                    <Card className="border-none shadow-sm bg-primary/5 border border-primary/10 overflow-hidden">
                      <CardHeader className="bg-primary/10 pb-4">
                        <CardTitle className="text-sm font-black uppercase text-primary flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Informe al Propietario
                        </CardTitle>
                        <CardDescription className="text-[10px]">Utilice la IA para notificar al dueño sobre la reparación y solicitar su aprobación si corresponde.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {!draft && !isDrafting ? (
                          <div className="text-center py-4 space-y-4">
                            <p className="text-xs text-muted-foreground italic leading-relaxed">Se redactará un mensaje profesional informando el presupuesto y justificando la mejora del inmueble.</p>
                            <Button className="w-full bg-primary text-white font-bold h-11 gap-2" onClick={handleDraftNotification}>
                              <Sparkles className="h-4 w-4" /> Redactar Informe / Pedido
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
                      <Scale className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-orange-700">Criterio de Liquidación</p>
                        <p className="text-[9px] text-orange-800 leading-tight">
                          Solo los gastos marcados como "Deducción Propietario" y con el switch de "Aprobado" activo se restarán en la próxima liquidación mensual.
                        </p>
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

      {/* Close tasks tab fragment */}
      </>}

      {/* ── Dialog calificación proveedor ── */}
      <Dialog open={isRatingOpen} onOpenChange={setIsRatingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              Calificar al proveedor
            </DialogTitle>
            <DialogDescription>
              ¿Cómo fue el trabajo de <strong>{tasks.find(t => t.id === ratingTaskId)?.contractorName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center gap-2">
              {([1,2,3,4,5] as const).map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className={cn(
                    'text-3xl transition-transform hover:scale-110',
                    star <= ratingValue ? 'text-amber-400' : 'text-muted-foreground/30'
                  )}
                  aria-label={`${star} estrella${star !== 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-bold text-muted-foreground">
              {ratingValue === 5 ? 'Excelente' : ratingValue === 4 ? 'Muy bueno' : ratingValue === 3 ? 'Regular' : ratingValue === 2 ? 'Malo' : 'Muy malo'}
            </p>
            <Textarea
              placeholder="Comentario opcional (puntualidad, calidad del trabajo…)"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRatingOpen(false)}>Omitir</Button>
            <Button className="bg-primary font-black" onClick={handleSaveRating}>Guardar calificación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
