'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, RefreshCw, DollarSign, Users, AlertCircle, Clock,
  CheckCircle2, XCircle, MoreVertical, Search, Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import type { BillingState } from '@/lib/billing/types';
import type { BillingTier } from '@/lib/billing/tiers';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AdminRow {
  adminId: string;
  adminEmail: string | null;
  adminName: string | null;
  state: BillingState | null;
  tierLabel: string;
  tierPriceARS: number;
  activeContracts: number;
  registeredAt: string | null;
}

interface Metrics {
  totalAdmins: number;
  active: number;
  trial: number;
  pastDue: number;
  cancelled: number;
  mrrARS: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  trial:     { label: 'Trial',      cls: 'bg-blue-100 text-blue-700' },
  pending:   { label: 'Pendiente',  cls: 'bg-yellow-100 text-yellow-700' },
  active:    { label: 'Activa',     cls: 'bg-green-100 text-green-700' },
  past_due:  { label: 'Vencida',    cls: 'bg-orange-100 text-orange-700' },
  paused:    { label: 'Pausada',    cls: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelada',  cls: 'bg-gray-200 text-gray-700' },
};

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export function SuperAdminBillingPanel() {
  const { user } = useUser();
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tiers, setTiers] = useState<BillingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [dialogAction, setDialogAction] = useState<null | 'suspend' | 'extendTrial' | 'overrideTier' | 'note'>(null);
  const [actionInput, setActionInput] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/billing/list', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setRows(data.rows);
      setMetrics(data.metrics);
      setTiers(data.tiers);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo cargar', variant: 'destructive' });
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [user]);

  const callAdminApi = async (path: string, body: any) => {
    if (!user) return;
    setActionBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/billing/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      toast({ title: 'OK', description: 'Acción aplicada correctamente.' });
      setDialogAction(null);
      setActionInput('');
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo ejecutar', variant: 'destructive' });
    }
    setActionBusy(false);
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.state?.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.adminEmail?.toLowerCase().includes(q) ||
          r.adminName?.toLowerCase().includes(q) ||
          r.adminId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const exportCsv = () => {
    const headers = ['Email', 'Nombre', 'Tier', 'Precio ARS', 'Status', 'Contratos vigentes', 'Próximo cobro'];
    const lines = [headers.join(',')];
    filtered.forEach(r => {
      lines.push([
        r.adminEmail ?? '',
        r.adminName ?? '',
        r.tierLabel,
        r.tierPriceARS,
        r.state?.status ?? '',
        r.activeContracts,
        r.state?.nextChargeAt ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard icon={Users}        label="Total admins"   value={metrics?.totalAdmins ?? 0} cls="bg-slate-50 text-slate-700" />
        <MetricCard icon={CheckCircle2} label="Activos"        value={metrics?.active ?? 0}      cls="bg-green-50 text-green-700" />
        <MetricCard icon={Clock}        label="En trial"       value={metrics?.trial ?? 0}       cls="bg-blue-50 text-blue-700" />
        <MetricCard icon={AlertCircle}  label="Pago vencido"   value={metrics?.pastDue ?? 0}     cls="bg-orange-50 text-orange-700" />
        <MetricCard icon={DollarSign}   label="MRR (ARS/mes)"  value={formatARS(metrics?.mrrARS ?? 0)} cls="bg-primary/10 text-primary" small />
      </div>

      {/* Filtros + acciones */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-black">Clientes (Administradores)</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5"><Download className="h-3.5 w-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="trial">En trial</SelectItem>
                <SelectItem value="past_due">Pago vencido</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Admin</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Plan</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Contratos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Próximo cobro</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-xs">Sin resultados</TableCell></TableRow>
                ) : filtered.map(r => {
                  const status = r.state?.status ?? 'trial';
                  const sl = STATUS_LABELS[status];
                  return (
                    <TableRow key={r.adminId} className="text-xs">
                      <TableCell>
                        <div className="font-bold">{r.adminEmail ?? '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{r.adminName ?? r.adminId.slice(0, 12)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{r.tierLabel}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{formatARS(r.tierPriceARS)}/mes</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.cls}`}>
                          {sl.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.activeContracts}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {r.state?.nextChargeAt ? new Date(r.state.nextChargeAt).toLocaleDateString('es-AR') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelected(r); setDialogAction('extendTrial'); setActionInput('14'); }}>
                              Extender trial...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelected(r); setDialogAction('overrideTier'); setActionInput(r.state?.tierId ?? 'tier-1'); }}>
                              Cambiar tier...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelected(r); setDialogAction('note'); loadNote(r.adminId, user, setActionInput); }}>
                              Editar nota interna...
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(status === 'paused' || status === 'cancelled') ? (
                              <DropdownMenuItem onClick={() => callAdminApi('reactivate', { adminId: r.adminId })}>
                                Reactivar (volver a trial)
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { setSelected(r); setDialogAction('suspend'); setActionInput(''); }}
                              >
                                Suspender cuenta...
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogos de acción */}
      <Dialog open={!!dialogAction} onOpenChange={open => { if (!open) { setDialogAction(null); setActionInput(''); } }}>
        <DialogContent>
          {dialogAction === 'extendTrial' && (
            <>
              <DialogHeader>
                <DialogTitle>Extender trial</DialogTitle>
                <DialogDescription>
                  Suma {actionInput || '0'} días al período de prueba de <b>{selected?.adminEmail}</b>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Días a extender</Label>
                <Input type="number" value={actionInput} onChange={e => setActionInput(e.target.value)} min={1} max={365} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogAction(null)}>Cancelar</Button>
                <Button
                  onClick={() => selected && callAdminApi('extend-trial', { adminId: selected.adminId, days: Number(actionInput) || 0 })}
                  disabled={actionBusy || !Number(actionInput)}
                >
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extender'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogAction === 'overrideTier' && (
            <>
              <DialogHeader>
                <DialogTitle>Cambiar tier (override)</DialogTitle>
                <DialogDescription>
                  Forzar un tier específico para <b>{selected?.adminEmail}</b>. Si tiene suscripción activa,
                  el monto se actualiza también en MercadoPago.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Nuevo tier</Label>
                <Select value={actionInput} onValueChange={setActionInput}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label} — {formatARS(t.priceARS)}/mes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogAction(null)}>Cancelar</Button>
                <Button
                  onClick={() => selected && callAdminApi('override-tier', { adminId: selected.adminId, tierId: actionInput })}
                  disabled={actionBusy}
                >
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogAction === 'suspend' && (
            <>
              <DialogHeader>
                <DialogTitle>Suspender cuenta</DialogTitle>
                <DialogDescription>
                  La cuenta de <b>{selected?.adminEmail}</b> queda en estado <i>pausada</i>. Si tiene suscripción
                  en MercadoPago, también se cancela allí. Podés reactivar después.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Motivo (opcional, queda en log)</Label>
                <Textarea value={actionInput} onChange={e => setActionInput(e.target.value)} rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogAction(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => selected && callAdminApi('suspend', { adminId: selected.adminId, reason: actionInput })}
                  disabled={actionBusy}
                >
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suspender'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogAction === 'note' && (
            <>
              <DialogHeader>
                <DialogTitle>Nota interna</DialogTitle>
                <DialogDescription>
                  Notas privadas sobre <b>{selected?.adminEmail}</b>. No las ve el cliente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Textarea value={actionInput} onChange={e => setActionInput(e.target.value)} rows={6} placeholder="Ej: Cliente VIP, llamó por refund de marzo..." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogAction(null)}>Cancelar</Button>
                <Button
                  onClick={() => selected && callAdminApi('note', { adminId: selected.adminId, note: actionInput })}
                  disabled={actionBusy}
                >
                  {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, cls, small }: {
  icon: React.ElementType; label: string; value: number | string; cls: string; small?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className={small ? 'text-base font-black' : 'text-2xl font-black'}>{value}</div>
    </div>
  );
}

async function loadNote(adminId: string, user: any, setNote: (s: string) => void) {
  if (!user) return;
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/admin/billing/note?adminId=${adminId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    setNote(data.note?.note ?? '');
  } catch {
    setNote('');
  }
}
