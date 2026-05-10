'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TrendingUp, CheckCircle2, XCircle, Info, Send, Clock } from 'lucide-react';
import { PendingRentAdjustment } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

interface PendingAdjustmentsViewProps {
  adjustments: PendingRentAdjustment[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onNotify: (id: string) => Promise<void>;
}

function StatusBadge({ status }: { status: PendingRentAdjustment['status'] }) {
  const map: Record<PendingRentAdjustment['status'], { label: string; className: string }> = {
    pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprobado: { label: 'Aprobado', className: 'bg-green-100 text-green-800 border-green-200' },
    rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={cn('text-xs', className)}>{label}</Badge>;
}

function AdjustmentCard({
  adj,
  onApprove,
  onReject,
  onNotify,
}: {
  adj: PendingRentAdjustment;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onNotify: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const handle = async (action: () => Promise<void>, key: string) => {
    setLoading(key);
    try { await action(); } finally { setLoading(null); }
  };

  const isPending = adj.status === 'pendiente';
  const isApproved = adj.status === 'aprobado';
  const diff = adj.proposedAmount - adj.currentAmount;

  return (
    <>
      <Card className="border rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{adj.propertyName}</p>
                <StatusBadge status={adj.status} />
              </div>
              <p className="text-xs text-muted-foreground">{adj.tenantName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Vencimiento ajuste</p>
              <p className="text-sm font-medium">{new Date(adj.dueDate).toLocaleDateString('es-AR')}</p>
            </div>
          </div>

          {/* Amounts */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Alquiler actual</p>
              <p className="font-semibold tabular-nums">{formatARS(adj.currentAmount)}</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Propuesto</p>
              <p className="font-bold text-primary tabular-nums">{formatARS(adj.proposedAmount)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Variación</p>
              <p className={cn('font-semibold tabular-nums', diff > 0 ? 'text-primary' : 'text-red-600')}>
                +{adj.variationPct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Index info */}
          {adj.indexUsed && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                Índice: <strong>{adj.indexUsed}</strong>
                {adj.indexValue !== undefined && adj.previousIndexValue !== undefined && (
                  <> — {adj.previousIndexValue.toFixed(2)} → {adj.indexValue.toFixed(2)}</>
                )}
              </span>
            </div>
          )}

          {/* Notification status */}
          {isApproved && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5">
                {adj.notifiedTenantAt
                  ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Notificados el {new Date(adj.notifiedTenantAt).toLocaleDateString('es-AR')}</>
                  : <><Clock className="h-3.5 w-3.5" /> Pendiente de notificación</>
                }
              </span>
              {!adj.notifiedTenantAt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={loading === 'notify'}
                  onClick={() => handle(() => onNotify(adj.id), 'notify')}
                >
                  <Send className="h-3 w-3" />
                  Notificar
                </Button>
              )}
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                disabled={loading !== null}
                onClick={() => handle(() => onApprove(adj.id), 'approve')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {loading === 'approve' ? 'Aprobando…' : 'Aprobar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                disabled={loading !== null}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Rechazar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar ajuste</DialogTitle>
            <DialogDescription>
              El ajuste de {adj.propertyName} no se aplicará. Podés indicar el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo (opcional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ej: Negociado directamente con el inquilino"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={loading === 'reject'}
              onClick={async () => {
                setLoading('reject');
                try {
                  await onReject(adj.id, reason);
                  setRejectOpen(false);
                } finally { setLoading(null); }
              }}
            >
              {loading === 'reject' ? 'Rechazando…' : 'Confirmar rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PendingAdjustmentsView({
  adjustments,
  onApprove,
  onReject,
  onNotify,
}: PendingAdjustmentsViewProps) {
  const [filter, setFilter] = useState<'pendiente' | 'aprobado' | 'rechazado' | 'todos'>('pendiente');

  const filtered = useMemo(
    () => filter === 'todos' ? adjustments : adjustments.filter(a => a.status === filter),
    [adjustments, filter],
  );

  const pendingCount = adjustments.filter(a => a.status === 'pendiente').length;

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'pendiente', label: `Pendientes (${pendingCount})` },
    { key: 'aprobado', label: 'Aprobados' },
    { key: 'rechazado', label: 'Rechazados' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" aria-hidden="true" />
          Ajustes de alquiler
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajustes pendientes de aprobación por contrato. Al aprobar, se actualiza el alquiler y se notifica a propietario e inquilino.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary/40 mb-3" aria-hidden="true" />
            <p className="font-medium text-muted-foreground">
              {filter === 'pendiente' ? 'No hay ajustes pendientes' : 'Sin resultados'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === 'pendiente' && 'Los ajustes se generan automáticamente según la frecuencia de cada contrato.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(adj => (
            <AdjustmentCard
              key={adj.id}
              adj={adj}
              onApprove={onApprove}
              onReject={onReject}
              onNotify={onNotify}
            />
          ))}
        </div>
      )}
    </div>
  );
}
