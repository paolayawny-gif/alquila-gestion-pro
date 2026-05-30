import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Wrench, Clock, CheckCircle2, Loader2, Bell, BellOff,
  Building2, User, Image, ExternalLink, Search, AlertTriangle,
  BellRing,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/lib/types';
import { MaintenanceTicket } from '@/components/tenant/tenant-maintenance';


const STATUS_COLOR: Record<string, string> = {
  'Abierto':    'bg-amber-50 text-amber-700 border-amber-200',
  'En proceso': 'bg-blue-50  text-blue-700  border-blue-200',
  'Resuelto':   'bg-green-50 text-green-700 border-green-200',
};

const PRIORITY_COLOR: Record<string, string> = {
  'Urgente': 'bg-red-50   text-red-700   border-red-200',
  'Normal':  'bg-slate-50 text-slate-600  border-slate-200',
  'Baja':    'bg-gray-50  text-gray-500   border-gray-200',
};

const CATEGORY_ICON: Record<string, string> = {
  'Plomería': '🔧', 'Electricidad': '⚡', 'Gas': '🔥', 'Carpintería': '🪵',
  'Pintura': '🎨', 'Limpieza': '🧹', 'Acceso / Llave': '🔑',
  'Climatización': '❄️', 'Otro': '📋',
};

interface TenantTicketsAdminViewProps {
  userId?: string;
  properties: Property[];
}

export function TenantTicketsAdminView({ userId, properties }: TenantTicketsAdminViewProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selected,       setSelected]       = useState<MaintenanceTicket | null>(null);
  const [adminResponse,  setAdminResponse]  = useState('');
  const [savingResponse, setSavingResponse] = useState(false);
  const [notifying,      setNotifying]      = useState(false);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterStatus,   setFilterStatus]   = useState<'Todas' | 'Abierto' | 'En proceso' | 'Resuelto'>('Todas');

  // ── Query all tenant tickets for this admin ──────────────────────────────
  const ticketsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'maintenanceTickets'),
      where('adminId', '==', userId),
    );
  }, [db, userId]);
  const { data: ticketsRaw } = useCollection<MaintenanceTicket>(ticketsQ);
  const allTickets = useMemo(() =>
    [...(ticketsRaw ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  [ticketsRaw]);

  const filtered = useMemo(() => {
    let base = filterStatus === 'Todas' ? allTickets : allTickets.filter(t => t.status === filterStatus);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      base = base.filter(t =>
        (t.title ?? '').toLowerCase().includes(s) ||
        (t.tenantName ?? '').toLowerCase().includes(s) ||
        (t.propertyName ?? '').toLowerCase().includes(s),
      );
    }
    return base;
  }, [allTickets, filterStatus, searchTerm]);

  // ── Save admin response + status update ─────────────────────────────────
  const handleSaveResponse = async (newStatus?: string) => {
    if (!selected || !db) return;
    setSavingResponse(true);
    const ref = doc(db, 'artifacts', APP_ID, 'maintenanceTickets', selected.id);
    const update: Partial<MaintenanceTicket> = {
      adminResponse: adminResponse || selected.adminResponse || '',
      updatedAt: new Date().toISOString(),
      ...(newStatus ? { status: newStatus as any } : {}),
    };
    setDocumentNonBlocking(ref, update, { merge: true });
    toast({ title: '✅ Respuesta guardada' });
    setSavingResponse(false);
    setSelected(prev => prev ? { ...prev, ...update } : null);
  };

  // ── Notify property owner ────────────────────────────────────────────────
  const handleNotifyOwner = async () => {
    if (!selected || !db) return;
    const property = properties.find(p => p.id === selected.propertyId);
    const owner = property?.owners?.[0];
    if (!owner?.email) {
      toast({
        title: 'Sin propietario',
        description: 'Esta propiedad no tiene un propietario con email configurado.',
        variant: 'destructive',
      });
      return;
    }
    setNotifying(true);
    const ref = doc(db, 'artifacts', APP_ID, 'maintenanceTickets', selected.id);
    const update: Partial<MaintenanceTicket> = {
      ownerEmail: owner.email.toLowerCase(),
      ownerVisible: true,
      ownerNotifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, update, { merge: true });
    toast({
      title: '✅ Propietario notificado',
      description: `${owner.name} puede ver este reclamo en su portal.`,
    });
    setNotifying(false);
    setSelected(prev => prev ? { ...prev, ...update } : null);
  };

  const openTickets    = allTickets.filter(t => t.status === 'Abierto').length;
  const inProcTickets  = allTickets.filter(t => t.status === 'En proceso').length;
  const resolvedTickets = allTickets.filter(t => t.status === 'Resuelto').length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Abiertos',    value: openTickets,     color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'En proceso',  value: inProcTickets,   color: 'text-blue-600',   bg: 'bg-blue-50'  },
          { label: 'Resueltos',   value: resolvedTickets, color: 'text-green-600',  bg: 'bg-green-50' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por título, inquilino o propiedad…"
            className="w-full pl-9 pr-4 h-9 rounded-lg bg-white border text-sm focus:outline-none focus:border-primary/40"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(['Todas', 'Abierto', 'En proceso', 'Resuelto'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                filterStatus === f ? 'bg-primary text-white' : 'bg-white border text-muted-foreground hover:bg-muted',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">
              {allTickets.length === 0
                ? 'Ningún inquilino ha enviado solicitudes aún'
                : 'No hay reclamos para el filtro seleccionado'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const property = properties.find(p => p.id === ticket.propertyId);
            const ownerName = property?.owners?.[0]?.name;
            return (
              <Card
                key={ticket.id}
                className="border-none shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setSelected(ticket); setAdminResponse(ticket.adminResponse ?? ''); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Category emoji */}
                    <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center text-lg shrink-0">
                      {CATEGORY_ICON[ticket.category] ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate">{ticket.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />{ticket.tenantName}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{ticket.propertyName}
                            </span>
                            {ticket.createdAt && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {ticket.createdAt.slice(0, 10).split('-').reverse().join('/')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={cn('text-[10px] font-bold border', STATUS_COLOR[ticket.status] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                            {ticket.status}
                          </Badge>
                          <Badge className={cn('text-[10px] font-bold border', PRIORITY_COLOR[ticket.priority] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                            {ticket.priority}
                          </Badge>
                        </div>
                      </div>
                      {ticket.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{ticket.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {ticket.photoUrl && (
                          <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                            <Image className="h-3 w-3" /> Foto adjunta
                          </span>
                        )}
                        {ticket.ownerVisible ? (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-medium">
                            <BellRing className="h-3 w-3" /> Prop. notificado
                            {ownerName ? ` (${ownerName})` : ''}
                          </span>
                        ) : ownerName ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <BellOff className="h-3 w-3" /> {ownerName} sin notificar
                          </span>
                        ) : null}
                        {ticket.adminResponse && (
                          <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Respondido
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail / management dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{CATEGORY_ICON[selected?.category ?? ''] ?? '📋'}</span>
              {selected?.title}
            </DialogTitle>
            <DialogDescription>
              {selected?.tenantName} · {selected?.propertyName} ·{' '}
              {selected?.createdAt?.slice(0, 10).split('-').reverse().join('/')}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-1">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn('border text-[10px] font-bold', STATUS_COLOR[selected.status])}>
                  {selected.status}
                </Badge>
                <Badge className={cn('border text-[10px] font-bold', PRIORITY_COLOR[selected.priority])}>
                  {selected.priority}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold">{selected.category}</Badge>
              </div>

              {/* Description */}
              {selected.description && (
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 tracking-wide">Descripción del inquilino</p>
                  <p className="text-sm">{selected.description}</p>
                </div>
              )}

              {/* Photo */}
              {selected.photoUrl && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[10px] font-black text-blue-700 uppercase mb-1.5 tracking-wide flex items-center gap-1">
                    <Image className="h-3 w-3" /> Foto adjunta por el inquilino
                  </p>
                  <a
                    href={selected.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selected.photoUrl}</span>
                  </a>
                </div>
              )}

              {/* Owner notification status */}
              {(() => {
                const property = properties.find(p => p.id === selected.propertyId);
                const owner    = property?.owners?.[0];
                return owner ? (
                  <div className={cn(
                    'p-3 rounded-xl border flex items-center justify-between gap-3',
                    selected.ownerVisible ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200',
                  )}>
                    <div>
                      <p className="text-xs font-black">
                        {selected.ownerVisible ? '✅ Propietario notificado' : 'Notificar al propietario'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {owner.name} · {owner.email}
                        {selected.ownerNotifiedAt && ` · ${selected.ownerNotifiedAt.slice(0, 10).split('-').reverse().join('/')}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selected.ownerVisible ? 'outline' : 'default'}
                      className={cn('gap-1.5 text-xs font-bold shrink-0', !selected.ownerVisible && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
                      onClick={handleNotifyOwner}
                      disabled={notifying}
                    >
                      {notifying
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Bell className="h-3.5 w-3.5" />
                      }
                      {selected.ownerVisible ? 'Renotificar' : 'Notificar propietario'}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Esta propiedad no tiene propietario registrado.
                    </p>
                  </div>
                );
              })()}

              {/* Status update */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black">Actualizar estado</Label>
                <Select
                  value={selected.status}
                  onValueChange={v => setSelected(s => s ? { ...s, status: v as any } : s)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abierto">Abierto</SelectItem>
                    <SelectItem value="En proceso">En proceso</SelectItem>
                    <SelectItem value="Resuelto">Resuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin response */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black">Respuesta al inquilino</Label>
                <Textarea
                  placeholder="Escribí una respuesta que verá el inquilino en su portal…"
                  className="min-h-[80px] text-sm"
                  value={adminResponse}
                  onChange={e => setAdminResponse(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
            <Button
              className="bg-primary text-white font-bold px-6 gap-1.5"
              onClick={() => handleSaveResponse(selected?.status)}
              disabled={savingResponse}
            >
              {savingResponse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
