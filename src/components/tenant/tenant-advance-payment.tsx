import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDoc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { TenantRegistryEntry } from '@/components/tenant/tenant-portal';
import { Contract, AdvancePayment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Wallet, TrendingDown, CheckCircle2, Loader2 } from 'lucide-react';


interface TenantAdvancePaymentProps {
  contract: Contract;
  tenantEntry: TenantRegistryEntry;
  adminId: string;
}

function calcScore(contract: Contract): number {
  let score = 60;
  // +2 por cada mes vigente del contrato, máx +30
  const start = new Date(contract.startDate);
  const now = new Date();
  const monthsElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  score += Math.min(monthsElapsed * 2, 30);
  // +10 si estado = Vigente
  if (contract.status === 'Vigente') score += 10;
  return Math.min(score, 100);
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Muy Bajo', color: 'text-green-700' };
  if (score >= 75) return { label: 'Riesgo Bajo', color: 'text-green-600' };
  if (score >= 60) return { label: 'Moderado', color: 'text-amber-600' };
  return { label: 'Alto', color: 'text-red-600' };
}

export function TenantAdvancePayment({ contract, tenantEntry, adminId }: TenantAdvancePaymentProps) {
  const db = useFirestore();

  // Only render when offer is active
  if (!contract.advancePaymentActive) return null;

  const maxMonths = contract.advancePaymentMaxMonths ?? 6;
  const discountPct = contract.advancePaymentDiscountPct ?? 0;
  const commissionPct = contract.advancePaymentCommissionPct ?? 0;
  const monthlyRent = contract.currentRentAmount;
  const currency = contract.currency;

  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Derived calculations
  const grossAmount = monthlyRent * selectedMonths;
  const discountAmount = Math.round(grossAmount * discountPct / 100);
  const tenantPays = grossAmount - discountAmount;
  const adminCommissionAmount = Math.round(tenantPays * commissionPct / 100);
  const netToOwner = tenantPays - adminCommissionAmount;

  // Score
  const score = calcScore(contract);
  const { label: riskLabel, color: riskColor } = scoreLabel(score);

  // Format money
  const fmt = (n: number) => `${currency === 'USD' ? 'U$D' : '$'}${n.toLocaleString('es-AR')}`;

  // Check for active requests
  const activeRequestsQ = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'advancePaymentRequests'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
      where('contractId', '==', contract.id),
    );
  }, [db, tenantEntry.tenantEmail, contract.id]);

  const { data: activeRequestsRaw } = useCollection<AdvancePayment>(activeRequestsQ);
  const activeRequests = (activeRequestsRaw ?? []).filter(
    r => r.status === 'Solicitado' || r.status === 'Aprobado',
  );
  const hasActiveRequest = activeRequests.length > 0;

  async function handleSubmit() {
    if (!db || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'advancePaymentRequests'),
        {
          adminId,
          contractId: contract.id,
          propertyId: contract.propertyId,
          propertyName: contract.propertyName ?? '',
          tenantEmail: tenantEntry.tenantEmail,
          tenantName: tenantEntry.tenantName,
          monthsAdvanced: selectedMonths,
          monthlyRent,
          currency,
          grossAmount,
          discountPct,
          discountAmount,
          adminCommissionPct: commissionPct,
          adminCommissionAmount,
          tenantPays,
          netToOwner,
          status: 'Solicitado',
          requestedAt: new Date().toISOString(),
          coveredPeriods: [],
        } satisfies Omit<AdvancePayment, 'id'>,
      );
      setSubmitted(true);
    } catch {
      // silent — user can retry
    }
    setSubmitting(false);
    setConfirmOpen(false);
  }

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-black flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Pago Anticipado de Rentas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">

        {/* Score del inquilino */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-green-50 border-4 border-green-400 flex flex-col items-center justify-center shrink-0">
            <span className="text-xl font-black text-green-700">{score}</span>
          </div>
          <div>
            <p className={cn('text-sm font-black', riskColor)}>Riesgo {riskLabel}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Puntuación basada en el historial de tu contrato.
            </p>
          </div>
        </div>

        {/* Simulador */}
        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Meses a adelantar</p>
            <Badge className="bg-primary/10 text-primary border-none font-black px-3">
              {selectedMonths} {selectedMonths === 1 ? 'mes' : 'meses'}
            </Badge>
          </div>

          <Slider
            value={[selectedMonths]}
            onValueChange={([v]) => setSelectedMonths(v)}
            min={1}
            max={maxMonths}
            step={1}
            className="my-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 mes</span>
            <span>{maxMonths} meses</span>
          </div>

          {/* Detalle de montos */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Renta bruta ({selectedMonths} × {fmt(monthlyRent)})</span>
              <span className="font-bold">{fmt(grossAmount)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between text-xs text-green-700">
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Descuento ({discountPct}%)
                </span>
                <span className="font-bold">- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-border/40">
              <span className="text-sm font-black text-foreground">Lo que pagás</span>
              <span className="text-xl font-black text-green-700">{fmt(tenantPays)}</span>
            </div>
            {discountPct > 0 && (
              <p className="text-[11px] text-green-600 font-medium">
                Ahorrás {fmt(discountAmount)} pagando por adelantado.
              </p>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            El propietario recibe tu pago en forma adelantada.
          </p>
        </div>

        {/* Estado / CTA */}
        {submitted ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              Solicitud enviada. El administrador la revisará en breve.
            </p>
          </div>
        ) : hasActiveRequest ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Wallet className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">
              Ya tenés una solicitud en curso.
            </p>
          </div>
        ) : (
          <Button
            className="w-full gap-2 font-bold"
            onClick={() => setConfirmOpen(true)}
            disabled={hasActiveRequest || submitted}
          >
            <Wallet className="h-4 w-4" /> Solicitar adelanto de {selectedMonths} {selectedMonths === 1 ? 'mes' : 'meses'}
          </Button>
        )}
      </CardContent>

      {/* Dialog de confirmación */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Confirmar solicitud
            </DialogTitle>
            <DialogDescription className="text-xs">
              Estás por solicitar el adelanto de {selectedMonths} {selectedMonths === 1 ? 'mes' : 'meses'} de alquiler.
              El administrador revisará tu solicitud y te notificará.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meses</span>
              <span className="font-bold">{selectedMonths}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bruto</span>
              <span className="font-bold">{fmt(grossAmount)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Descuento ({discountPct}%)</span>
                <span className="font-bold">- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base pt-1 border-t">
              <span>Total a pagar</span>
              <span className="text-green-700">{fmt(tenantPays)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2 font-bold">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                : <><CheckCircle2 className="h-4 w-4" /> Confirmar solicitud</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
