'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Wrench, Plus, Clock, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { TenantRegistryEntry } from './tenant-portal';

const APP_ID = 'alquilagestion-pro';

type TicketStatus   = 'Abierto' | 'En proceso' | 'Resuelto';
type TicketCategory = 'Plomería' | 'Electricidad' | 'Gas' | 'Carpintería' | 'Pintura' | 'Limpieza' | 'Acceso / Llave' | 'Climatización' | 'Otro';
type TicketPriority = 'Urgente' | 'Normal' | 'Baja';

export interface MaintenanceTicket {
  id: string;
  adminId: string;
  tenantEmail: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CFG: Record<TicketStatus, { color: string; icon: React.ElementType }> = {
  'Abierto':    { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock        },
  'En proceso': { color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Loader2      },
  'Resuelto':   { color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
};

const CATEGORIES: TicketCategory[] = [
  'Plomería', 'Electricidad', 'Gas', 'Carpintería',
  'Pintura', 'Limpieza', 'Acceso / Llave', 'Climatización', 'Otro',
];

interface TenantMaintenanceProps { tenantEntry: TenantRegistryEntry }

export function TenantMaintenance({ tenantEntry }: TenantMaintenanceProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [showNew,    setShowNew]    = useState(false);
  const [title,      setTitle]      = useState('');
  const [description,setDescription] = useState('');
  const [category,   setCategory]   = useState<TicketCategory>('Otro');
  const [priority,   setPriority]   = useState<TicketPriority>('Normal');
  const [detail,     setDetail]     = useState<MaintenanceTicket | null>(null);

  const ticketsQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'maintenanceTickets'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.tenantEmail]);
  const { data: ticketsRaw } = useCollection<MaintenanceTicket>(ticketsQ);
  const tickets = [...(ticketsRaw ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleCreate = () => {
    if (!title.trim() || !db || !user) {
      toast({ title: 'Ingresá un título', variant: 'destructive' }); return;
    }
    const id  = Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const ref = doc(db, 'artifacts', APP_ID, 'maintenanceTickets', id);
    const ticket: MaintenanceTicket = {
      id, adminId: tenantEntry.adminId,
      tenantEmail: tenantEntry.tenantEmail,
      tenantName: tenantEntry.tenantName,
      propertyId: tenantEntry.propertyId,
      propertyName: tenantEntry.propertyName,
      title: title.trim(), description: description.trim(),
      category, priority, status: 'Abierto',
      createdAt: now, updatedAt: now,
    };
    setDocumentNonBlocking(ref, ticket, {});
    toast({ title: '✅ Solicitud enviada', description: 'La administración fue notificada.' });
    setTitle(''); setDescription(''); setCategory('Otro'); setPriority('Normal');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Mantenimiento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reportá problemas o solicitá reparaciones en tu unidad.
          </p>
        </div>
        <Button className="gap-2 font-bold bg-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Nueva solicitud
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {(['Abierto', 'En proceso', 'Resuelto'] as TicketStatus[]).map(s => {
          const count = tickets.filter(t => t.status === s).length;
          const cfg   = STATUS_CFG[s];
          const Icon  = cfg.icon;
          return (
            <Card key={s} className="border-none shadow-sm bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', cfg.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">{count}</p>
                  <p className="text-[11px] text-muted-foreground">{s}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tickets */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Mis Solicitudes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {tickets.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">Sin solicitudes aún</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2 font-bold" onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5" /> Crear primera solicitud
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => {
                const cfg  = STATUS_CFG[t.status];
                const Icon = cfg.icon;
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-border/50 hover:bg-muted/10 cursor-pointer transition-colors group"
                    onClick={() => setDetail(t)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-foreground">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {t.category} · {t.createdAt.slice(0, 10).split('-').reverse().join('/')}
                        </p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>
                        )}
                        {t.adminResponse && (
                          <div className="mt-2 flex items-start gap-1.5 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-700 line-clamp-2 font-medium">{t.adminResponse}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge className={cn('border text-[10px] font-bold gap-1', cfg.color)}>
                          <Icon className="h-2.5 w-2.5" />
                          {t.status}
                        </Badge>
                        <Badge variant="outline" className={cn(
                          'text-[9px] font-bold border',
                          t.priority === 'Urgente' ? 'border-red-200 text-red-600' : 'border-muted text-muted-foreground',
                        )}>
                          {t.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New ticket dialog */}
      <Dialog open={showNew} onOpenChange={v => { setShowNew(v); if (!v) { setTitle(''); setDescription(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Mantenimiento</DialogTitle>
            <DialogDescription>Describí el problema para que la administración pueda gestionarlo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ej: Pérdida de agua en cocina" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={v => setCategory(v as TicketCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Urgente">🔴 Urgente</SelectItem>
                    <SelectItem value="Normal">🟡 Normal</SelectItem>
                    <SelectItem value="Baja">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Contá más detalles del problema…"
                className="min-h-[80px]"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button className="font-bold px-8 bg-primary" onClick={handleCreate}>Enviar solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={v => !v && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.category} · {detail?.createdAt?.slice(0, 10).split('-').reverse().join('/')}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                <Badge className={cn('border text-[10px] font-bold', STATUS_CFG[detail.status].color)}>
                  {detail.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold">{detail.priority}</Badge>
              </div>
              {detail.description && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-bold text-muted-foreground mb-1">Tu mensaje</p>
                  <p className="text-sm">{detail.description}</p>
                </div>
              )}
              {detail.adminResponse ? (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-[10px] font-black text-blue-600 uppercase mb-1 tracking-wide">Respuesta de la administración</p>
                  <p className="text-sm text-blue-800">{detail.adminResponse}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  La administración aún no respondió. Te notificaremos cuando haya novedades.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
