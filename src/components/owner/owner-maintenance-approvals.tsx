'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Wrench, CheckCircle2, XCircle, Clock, AlertTriangle,
  Building2, DollarSign, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { createNotification } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';
import { OwnerRegistryEntry } from './owner-portal';
import { MaintenanceTask } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

const PRIORITY_COLOR: Record<string, string> = {
  'Urgente': 'bg-red-50 text-red-700 border-red-200',
  'Alta':    'bg-orange-50 text-orange-700 border-orange-200',
  'Media':   'bg-amber-50 text-amber-700 border-amber-200',
  'Baja':    'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_COLOR: Record<string, string> = {
  'Pendiente':     'bg-amber-50 text-amber-700 border-amber-200',
  'Presupuestado': 'bg-blue-50 text-blue-700 border-blue-200',
  'En curso':      'bg-purple-50 text-purple-700 border-purple-200',
  'Completado':    'bg-green-50 text-green-700 border-green-200',
  'Cerrado':       'bg-gray-50 text-gray-500 border-gray-200',
};

import { fmtMoney as fmt } from '@/lib/format';

interface OwnerMaintenanceApprovalsProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerMaintenanceApprovals({ ownerEntry }: OwnerMaintenanceApprovalsProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [respondDialog, setRespondDialog] = useState<{ task: MaintenanceTask; approve: boolean } | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Query maintenance tasks charged to this owner
  const tasksQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'mantenimiento'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: tasksRaw } = useCollection<MaintenanceTask>(tasksQ);
  const tasks = [...(tasksRaw ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const pending   = tasks.filter(t => t.isApprovedByOwner == null).length;
  const approved  = tasks.filter(t => t.isApprovedByOwner === true).length;
  const total     = tasks.length;

  const handleRespond = async () => {
    if (!respondDialog || !db || saving) return;
    setSaving(true);
    const { task, approve } = respondDialog;
    const ref = doc(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'mantenimiento', task.id);
    setDocumentNonBlocking(ref, {
      isApprovedByOwner: approve,
      ownerComment: comment.trim() || '',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Notificar al admin que el propietario respondió
    createNotification(db, ownerEntry.adminId, {
      type: approve ? 'maintenance_approved' : 'maintenance_rejected',
      title: approve ? 'Mantenimiento aprobado' : 'Mantenimiento rechazado',
      message: `${ownerEntry.ownerName ?? 'Propietario'} ${approve ? 'aprobó' : 'rechazó'} la tarea "${task.concept}"${comment.trim() ? `: "${comment.trim().slice(0, 80)}"` : ''}.`,
      refId: task.id,
      link: 'Mantenimiento',
    });

    toast({
      title: approve ? '✅ Tarea aprobada' : '❌ Tarea rechazada',
      description: 'Tu respuesta fue registrada. La administración fue notificada.',
    });
    setRespondDialog(null);
    setComment('');
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Aprobación de Tareas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tareas de mantenimiento a tu cargo que requieren tu aprobación.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes',  value: pending,  color: pending > 0 ? 'text-amber-600' : 'text-muted-foreground' },
          { label: 'Aprobadas',   value: approved, color: 'text-green-600' },
          { label: 'Total',       value: total,    color: 'text-foreground' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {pending > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-800">
              {pending} tarea{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''} de aprobación
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Revisá cada presupuesto y aprobá o rechazá para que la administración pueda avanzar.
            </p>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Sin tareas asignadas</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Cuando la administración registre una tarea a tu cargo, aparecerá aquí para tu aprobación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isOpen = expanded === task.id;
            const needsApproval = task.isApprovedByOwner == null;
            const isApproved    = task.isApprovedByOwner === true;
            const isRejected    = task.isApprovedByOwner === false;
            const totalCost     = (task.estimatedCost ?? 0) || (task.actualCost ?? 0);

            return (
              <Card key={task.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : task.id)}
                  >
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                      isApproved ? 'bg-green-50' : isRejected ? 'bg-red-50' : 'bg-amber-50',
                    )}>
                      {isApproved
                        ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                        : isRejected
                        ? <XCircle className="h-5 w-5 text-red-500" />
                        : <Clock className="h-5 w-5 text-amber-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate">{task.concept}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{task.propertyName}
                            </span>
                            {task.contractorName && (
                              <span className="text-[10px] text-muted-foreground">
                                Contratista: {task.contractorName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="text-sm font-black">{fmt(totalCost)}</p>
                          <Badge className={cn('text-[10px] font-bold border', STATUS_COLOR[task.status] ?? '')}>
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={cn('text-[10px] font-bold border', PRIORITY_COLOR[task.priority] ?? '')}>
                          {task.priority}
                        </Badge>
                        {isApproved && (
                          <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> Aprobaste esta tarea
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                            <ThumbsDown className="h-3 w-3" /> Rechazada
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/40">

                      {task.description && (
                        <div className="p-3 bg-muted/20 rounded-xl">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-1">
                            Descripción
                          </p>
                          <p className="text-sm">{task.description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Costo estimado', value: fmt(task.estimatedCost ?? 0) },
                          { label: 'Costo real',     value: fmt(task.actualCost ?? 0) },
                        ].map(r => (
                          <div key={r.label} className="p-3 bg-muted/20 rounded-xl">
                            <p className="text-[10px] text-muted-foreground">{r.label}</p>
                            <p className="text-sm font-black">{r.value}</p>
                          </div>
                        ))}
                      </div>

                      {task.ownerComment && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1">
                            Tu comentario
                          </p>
                          <p className="text-sm text-emerald-800">{task.ownerComment}</p>
                        </div>
                      )}

                      {needsApproval && task.status !== 'Completado' && task.status !== 'Cerrado' && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 font-bold bg-green-600 hover:bg-green-700"
                            onClick={() => { setComment(''); setRespondDialog({ task, approve: true }); }}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1.5" /> Aprobar
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 font-bold text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setComment(''); setRespondDialog({ task, approve: false }); }}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1.5" /> Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Response dialog */}
      <Dialog open={!!respondDialog} onOpenChange={v => !v && setRespondDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {respondDialog?.approve ? '¿Aprobar esta tarea?' : '¿Rechazar esta tarea?'}
            </DialogTitle>
            <DialogDescription>
              {respondDialog?.task.concept} — {fmt((respondDialog?.task.estimatedCost ?? 0) || (respondDialog?.task.actualCost ?? 0))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Comentario (opcional)</Label>
              <Textarea
                placeholder={respondDialog?.approve
                  ? 'Ej: De acuerdo, procedan con el trabajo.'
                  : 'Ej: El presupuesto es demasiado elevado, soliciten otra cotización.'}
                className="min-h-[80px]"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialog(null)}>Cancelar</Button>
            <Button
              className={cn('font-bold px-8', respondDialog?.approve ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}
              onClick={handleRespond}
              disabled={saving}
            >
              {respondDialog?.approve ? 'Confirmar aprobación' : 'Confirmar rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
