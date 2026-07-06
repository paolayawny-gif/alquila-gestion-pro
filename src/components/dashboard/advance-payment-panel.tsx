import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where } from 'firebase/firestore';
import { Contract, Invoice, AdvancePayment, AdvancePaymentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Loader2, CreditCard, Check, X, Settings } from 'lucide-react';
import { useOrgPermissions } from '@/contexts/org-permissions-context';


function generateCoveredPeriods(startFromNow: number, count: number): string[] {
  const periods: string[] = [];
  const date = new Date();
  date.setMonth(date.getMonth() + startFromNow);
  for (let i = 0; i < count; i++) {
    periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    date.setMonth(date.getMonth() + 1);
  }
  return periods;
}

const STATUS_BADGE: Record<AdvancePaymentStatus, string> = {
  Solicitado: 'bg-amber-50 text-amber-700 border-amber-200',
  Aprobado:   'bg-blue-50 text-blue-700 border-blue-200',
  Pagado:     'bg-green-50 text-green-700 border-green-200',
  Cancelado:  'bg-slate-50 text-slate-600 border-slate-200',
};

interface AdvancePaymentPanelProps {
  contract: Contract;
  userId: string;
  db: any;
  invoices: Invoice[];
}

export function AdvancePaymentPanel({ contract, userId, db, invoices: _invoices }: AdvancePaymentPanelProps) {
  const { toast } = useToast();
  const { canWrite } = useOrgPermissions();

  // ── Config form state (initialize from contract) ──────────────────────────
  const [active, setActive]       = useState<boolean>(contract.advancePaymentActive ?? false);
  const [discountPct, setDiscountPct]     = useState<string>(String(contract.advancePaymentDiscountPct ?? 3));
  const [commissionPct, setCommissionPct] = useState<string>(String(contract.advancePaymentCommissionPct ?? 1));
  const [maxMonths, setMaxMonths]         = useState<string>(String(contract.advancePaymentMaxMonths ?? 6));
  const [saving, setSaving] = useState(false);

  // ── Solicitudes ───────────────────────────────────────────────────────────
  const requestsQ = useMemoFirebase(() => {
    if (!db || !userId || !contract.id) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'advancePaymentRequests'),
      where('adminId', '==', userId),
      where('contractId', '==', contract.id),
    );
  }, [db, userId, contract.id]);

  const { data: requestsRaw } = useCollection<AdvancePayment>(requestsQ);
  const requests = requestsRaw ?? [];

  // ── Guardar configuración ─────────────────────────────────────────────────
  async function handleSaveConfig() {
    if (!db || !userId || !contract.id) return;
    setSaving(true);
    try {
      const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', contract.id);
      await updateDoc(ref, {
        advancePaymentActive:        active,
        advancePaymentDiscountPct:   Number(discountPct) || 0,
        advancePaymentCommissionPct: Number(commissionPct) || 0,
        advancePaymentMaxMonths:     Number(maxMonths) || 6,
      });
      toast({ title: '✅ Configuración guardada', description: 'La oferta de pago anticipado fue actualizada.' });
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    }
    setSaving(false);
  }

  // ── Aprobar ───────────────────────────────────────────────────────────────
  async function handleApprove(req: AdvancePayment) {
    if (!db) return;
    try {
      const ref = doc(db, 'artifacts', APP_ID, 'advancePaymentRequests', req.id);
      await updateDoc(ref, { status: 'Aprobado', approvedAt: new Date().toISOString() });
      toast({ title: '✅ Solicitud aprobada' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  // ── Marcar como pagado ────────────────────────────────────────────────────
  async function handleMarkPaid(req: AdvancePayment) {
    if (!db) return;
    try {
      const ref = doc(db, 'artifacts', APP_ID, 'advancePaymentRequests', req.id);
      const periods = generateCoveredPeriods(0, req.monthsAdvanced);
      await updateDoc(ref, {
        status: 'Pagado',
        paidAt: new Date().toISOString(),
        coveredPeriods: periods,
      });
      toast({ title: '✅ Marcado como pagado', description: `Cubre: ${periods.join(', ')}` });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────
  async function handleCancel(req: AdvancePayment) {
    if (!db) return;
    try {
      const ref = doc(db, 'artifacts', APP_ID, 'advancePaymentRequests', req.id);
      await updateDoc(ref, { status: 'Cancelado' });
      toast({ title: 'Solicitud cancelada' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  const fmtMoney = (n: number) =>
    `${contract.currency === 'USD' ? 'U$D' : '$'}${n.toLocaleString('es-AR')}`;

  return (
    <div className="space-y-4">
      {/* ── Sección 1: Configurar oferta ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Pago Anticipado — Configurar oferta
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Toggle activo */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
            <div>
              <p className="text-sm font-bold text-foreground">Oferta activa</p>
              <p className="text-[11px] text-muted-foreground">El inquilino verá la opción en su portal</p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              disabled={!canWrite}
            />
          </div>

          {/* Campos numéricos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="advance-discount-pct" className="text-xs font-bold">Descuento al inquilino (%)</Label>
              <Input
                id="advance-discount-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPct}
                onChange={e => setDiscountPct(e.target.value)}
                disabled={!canWrite}
                className="h-9 text-sm"
                placeholder="ej: 3"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="advance-commission-pct" className="text-xs font-bold">Comisión del admin (%)</Label>
              <Input
                id="advance-commission-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionPct}
                onChange={e => setCommissionPct(e.target.value)}
                disabled={!canWrite}
                className="h-9 text-sm"
                placeholder="ej: 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label id="advance-max-months-label" className="text-xs font-bold">Máximo meses a adelantar</Label>
              <Select
                value={maxMonths}
                onValueChange={setMaxMonths}
                disabled={!canWrite}
              >
                <SelectTrigger className="h-9 text-sm" aria-labelledby="advance-max-months-label">
                  <SelectValue placeholder="Seleccioná" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'mes' : 'meses'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canWrite && (
            <Button
              size="sm"
              className="gap-2 font-bold text-xs"
              onClick={handleSaveConfig}
              disabled={saving}
            >
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                : <><Check className="h-3.5 w-3.5" /> Guardar configuración</>
              }
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Sección 2: Solicitudes recibidas ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Solicitudes de Pago Anticipado
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin solicitudes de adelanto para este contrato.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3"
                >
                  {/* Encabezado */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-black text-foreground">{req.tenantName}</p>
                      <p className="text-[11px] text-muted-foreground">{req.tenantEmail}</p>
                    </div>
                    <Badge className={cn('border text-[10px] font-bold', STATUS_BADGE[req.status])}>
                      {req.status}
                    </Badge>
                  </div>

                  {/* Detalle financiero */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground font-medium">Meses</p>
                      <p className="font-black text-foreground">{req.monthsAdvanced}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Bruto</p>
                      <p className="font-black text-foreground">{fmtMoney(req.grossAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Inquilino paga</p>
                      <p className="font-black text-green-700">{fmtMoney(req.tenantPays)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Propietario recibe</p>
                      <p className="font-black text-blue-700">{fmtMoney(req.netToOwner)}</p>
                    </div>
                  </div>

                  {req.coveredPeriods && req.coveredPeriods.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Cubre: {req.coveredPeriods.join(', ')}
                    </p>
                  )}

                  {/* Acciones */}
                  {canWrite && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {req.status === 'Solicitado' && (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] font-bold gap-1 bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleApprove(req)}
                        >
                          <Check className="h-3 w-3" /> Aprobar
                        </Button>
                      )}
                      {req.status === 'Aprobado' && (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] font-bold gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleMarkPaid(req)}
                        >
                          <Check className="h-3 w-3" /> Marcar como Pagado
                        </Button>
                      )}
                      {(req.status === 'Solicitado' || req.status === 'Aprobado') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] font-bold gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleCancel(req)}
                        >
                          <X className="h-3 w-3" /> Cancelar
                        </Button>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Solicitado: {new Date(req.requestedAt).toLocaleDateString('es-AR')}
                    {req.approvedAt && ` · Aprobado: ${new Date(req.approvedAt).toLocaleDateString('es-AR')}`}
                    {req.paidAt && ` · Pagado: ${new Date(req.paidAt).toLocaleDateString('es-AR')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
