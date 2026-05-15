'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CreditCard, Clock, CheckCircle2, XCircle, DollarSign,
  AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { TenantRegistryEntry } from './tenant-portal';
import { LegalCase, PaymentPlan } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

const PLAN_CFG: Record<PaymentPlan['status'], { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente',  color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock        },
  aceptado:  { label: 'Aceptado',   color: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle2 },
  rechazado: { label: 'Rechazado',  color: 'bg-red-50   text-red-700   border-red-200',    icon: XCircle      },
};

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

interface TenantPaymentPlansProps {
  tenantEntry: TenantRegistryEntry;
}

interface PlanWithCase extends PaymentPlan {
  caseId: string;
  propertyName: string;
}

export function TenantPaymentPlans({ tenantEntry }: TenantPaymentPlansProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<{ plan: PlanWithCase; newStatus: 'aceptado' | 'rechazado' } | null>(null);

  // Query legal cases where tenantEmail matches
  const legalesQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'legales'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.adminId, tenantEntry.tenantEmail]);
  const { data: casesRaw } = useCollection<LegalCase>(legalesQ);
  const cases = casesRaw ?? [];

  // Flatten all plans across cases
  const plans: PlanWithCase[] = cases.flatMap(c =>
    (c.paymentPlans ?? []).map(p => ({
      ...p,
      caseId: c.id,
      propertyName: c.propertyName,
    })),
  ).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const handleRespond = async () => {
    if (!confirmPlan || !db) return;
    const { plan, newStatus } = confirmPlan;
    const caseObj = cases.find(c => c.id === plan.caseId);
    if (!caseObj) return;

    const updatedPlans = (caseObj.paymentPlans ?? []).map(p =>
      p.id === plan.id ? { ...p, status: newStatus } : p,
    );
    const ref = doc(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'legales', plan.caseId);
    setDocumentNonBlocking(ref, { paymentPlans: updatedPlans }, { merge: true });

    toast({
      title: newStatus === 'aceptado' ? '✅ Plan aceptado' : '❌ Plan rechazado',
      description: 'Tu respuesta fue registrada. La administración fue notificada.',
    });
    setConfirmPlan(null);
  };

  const pendingPlans = plans.filter(p => p.status === 'pendiente').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Planes de Pago</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Propuestas de la administración para regularizar deudas pendientes.
        </p>
      </div>

      {pendingPlans > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-800">
              Tenés {pendingPlans} plan{pendingPlans > 1 ? 'es' : ''} pendiente{pendingPlans > 1 ? 's' : ''} de respuesta
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Revisá y respondé a cada propuesta de pago para regularizar tu situación.
            </p>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Sin planes de pago</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Si la administración te propone un plan de cuotas para regularizar deuda, aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const cfg = PLAN_CFG[plan.status];
            const Icon = cfg.icon;
            const isOpen = expanded === plan.id;
            const cuotaAmount = plan.installments > 0
              ? Math.round(plan.totalAmount / plan.installments)
              : plan.totalAmount;

            return (
              <Card key={plan.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : plan.id)}
                  >
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', cfg.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate">
                            {plan.installments} cuota{plan.installments > 1 ? 's' : ''} de {fmt(cuotaAmount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{plan.propertyName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="text-sm font-black">{fmt(plan.totalAmount)}</p>
                          <Badge className={cn('text-[10px] font-bold border', cfg.color)}>
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Propuesto el {plan.createdAt?.slice(0, 10).split('-').reverse().join('/')}
                      </p>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/40">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Total deuda', value: fmt(plan.totalAmount) },
                          { label: 'Cuotas',       value: `${plan.installments}x ${fmt(cuotaAmount)}` },
                        ].map(r => (
                          <div key={r.label} className="p-3 bg-muted/20 rounded-xl">
                            <p className="text-[10px] text-muted-foreground">{r.label}</p>
                            <p className="text-sm font-black">{r.value}</p>
                          </div>
                        ))}
                      </div>

                      {plan.note && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-wide mb-1">
                            Nota de la administración
                          </p>
                          <p className="text-sm text-blue-800">{plan.note}</p>
                        </div>
                      )}

                      {plan.status === 'pendiente' && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 font-bold bg-green-600 hover:bg-green-700"
                            onClick={() => setConfirmPlan({ plan, newStatus: 'aceptado' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aceptar
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 font-bold text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setConfirmPlan({ plan, newStatus: 'rechazado' })}
                          >
                            <XCircle className="h-4 w-4 mr-1.5" /> Rechazar
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

      {/* Confirm dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={v => !v && setConfirmPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmPlan?.newStatus === 'aceptado' ? '¿Aceptar este plan?' : '¿Rechazar este plan?'}
            </DialogTitle>
            <DialogDescription>
              {confirmPlan?.newStatus === 'aceptado'
                ? 'Al aceptar, la administración tomará este acuerdo como definitivo y coordinará los pagos.'
                : 'Al rechazar, la administración será notificada para proponer nuevas condiciones.'}
            </DialogDescription>
          </DialogHeader>
          {confirmPlan && (
            <div className="p-3 bg-muted/20 rounded-xl text-sm">
              <p><span className="text-muted-foreground">Total: </span><strong>{fmt(confirmPlan.plan.totalAmount)}</strong></p>
              <p><span className="text-muted-foreground">Cuotas: </span><strong>{confirmPlan.plan.installments}</strong></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlan(null)}>Cancelar</Button>
            <Button
              className={cn('font-bold px-8', confirmPlan?.newStatus === 'aceptado' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}
              onClick={handleRespond}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
