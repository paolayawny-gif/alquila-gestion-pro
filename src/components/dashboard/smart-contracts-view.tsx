'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText,
  Bell, ChevronRight, Zap, Scale, RefreshCw, FilePen, ExternalLink, Info,
  Calendar, DollarSign, User, Building2, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, Invoice, Person, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';

interface SmartContractsViewProps {
  contracts: Contract[];
  invoices: Invoice[];
  people: Person[];
  properties: Property[];
  userId?: string;
}

type StageStatus = 'completed' | 'active' | 'pending';

function getWorkflowStages(contract: Contract) {
  const today = new Date();
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  const hasDoc = !!contract.documents?.mainContractName;
  const isActiveDate = today >= start && today <= end;
  const isClosed = contract.status === 'Finalizado' || contract.status === 'Rescindido' || today > end;
  const isVigente = contract.status === 'Vigente';

  return [
    {
      id: 'firma',
      label: 'Firma Digital',
      sublabel: 'Completado',
      status: 'completed' as StageStatus,
    },
    {
      id: 'validacion',
      label: 'Registro Documental',
      sublabel: hasDoc ? 'Completado' : 'Pendiente documentación',
      status: (hasDoc ? 'completed' : 'active') as StageStatus,
    },
    {
      id: 'ejecucion',
      label: 'Ejecución Activa',
      sublabel: isActiveDate && isVigente ? 'En curso' : isClosed ? 'Finalizado' : 'Próximo',
      status: (isActiveDate && isVigente ? 'active' : isClosed ? 'completed' : 'pending') as StageStatus,
    },
    {
      id: 'cierre',
      label: 'Cierre / Vencimiento',
      sublabel: isClosed ? 'Completado' : `Vence ${new Date(contract.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      status: (isClosed ? 'completed' : 'pending') as StageStatus,
    },
  ];
}

function calcMora(contract: Contract, contractInvoices: Invoice[]) {
  const today = new Date();
  const overdueInvoices = contractInvoices.filter(inv => {
    if (inv.status === 'Pagado' || inv.status === 'Anulado') return false;
    const due = new Date(inv.dueDate);
    return due < today;
  });

  if (overdueInvoices.length === 0) return null;

  const totalOverdue = overdueInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const oldestDue = overdueInvoices.reduce((oldest, i) =>
    new Date(i.dueDate) < new Date(oldest.dueDate) ? i : oldest
  , overdueInvoices[0]);

  const daysOverdue = Math.floor((today.getTime() - new Date(oldestDue.dueDate).getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = (contract.lateFeePercentage ?? 2) / 100;
  const penalty = Math.round(totalOverdue * dailyRate * daysOverdue);

  return { overdueInvoices, totalOverdue, daysOverdue, penalty, dailyRate: contract.lateFeePercentage ?? 2 };
}

const STATUS_COLORS: Record<string, string> = {
  'Vigente': 'bg-green-500',
  'Próximo a Vencer': 'bg-amber-400',
  'Finalizado': 'bg-slate-400',
  'Rescindido': 'bg-red-500',
};

export function SmartContractsView({ contracts, invoices, people, properties, userId }: SmartContractsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { canWrite } = useOrgPermissions();

  const [selectedContractId, setSelectedContractId] = useState<string>(contracts[0]?.id ?? '');
  const [showNotifDialog, setShowNotifDialog] = useState(false);
  const [notifNote, setNotifNote] = useState('');
  const [sentNotifications, setSentNotifications] = useState<Set<string>>(new Set());

  const contract = contracts.find(c => c.id === selectedContractId);
  const contractInvoices = useMemo(() =>
    invoices.filter(i => i.contractId === selectedContractId),
    [invoices, selectedContractId]
  );

  const mora = useMemo(() =>
    contract ? calcMora(contract, contractInvoices) : null,
    [contract, contractInvoices]
  );

  const stages = useMemo(() =>
    contract ? getWorkflowStages(contract) : [],
    [contract]
  );

  // Per-contract mora summary for the list
  const contractMoraMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calcMora>> = {};
    contracts.forEach(c => {
      const cInvoices = invoices.filter(i => i.contractId === c.id);
      map[c.id] = calcMora(c, cInvoices);
    });
    return map;
  }, [contracts, invoices]);

  const handleSendNotification = () => {
    if (!db || !user || !contract) return;
    const id = `notif_${Date.now()}`;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notificaciones'), id);
    setDocumentNonBlocking(ref, {
      id,
      contractId: contract.id,
      tenantName: contract.tenantName,
      propertyName: contract.propertyName,
      type: 'mora',
      daysOverdue: mora?.daysOverdue ?? 0,
      totalOverdue: mora?.totalOverdue ?? 0,
      penalty: mora?.penalty ?? 0,
      notes: notifNote,
      sentAt: new Date().toISOString(),
      ownerId: user.uid,
    }, {});
    setSentNotifications(prev => new Set([...prev, contract.id]));
    setShowNotifDialog(false);
    setNotifNote('');
    toast({
      title: '✅ Notificación registrada',
      description: `Se registró la notificación de mora para ${contract.tenantName}. Enviá el mensaje manualmente al inquilino.`,
    });
  };

  const tenant = people.find(p => p.id === contract?.tenantId);
  const property = properties.find(p => p.id === contract?.propertyId);

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground opacity-20" />
        <h3 className="text-lg font-bold text-foreground">Sin contratos cargados</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Cargá contratos desde el módulo "Personas y Contratos" para ver el seguimiento aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Contratos Smart
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seguimiento de estado, mora automática y alertas por contrato.
          </p>
        </div>
        {mora && (
          <Badge className="bg-red-100 text-red-700 border-red-200 font-bold px-3 py-1.5 flex items-center gap-1.5 animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" /> {Object.values(contractMoraMap).filter(Boolean).length} contrato(s) en mora
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Lista de contratos ── */}
        <div className="xl:col-span-1 space-y-2">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide px-1">Contratos activos</p>
          {contracts.map(c => {
            const cMora = contractMoraMap[c.id];
            const isSelected = c.id === selectedContractId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedContractId(c.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-white",
                  cMora && "border-l-4 border-l-red-400"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_COLORS[c.status] ?? 'bg-slate-300')} />
                  <p className="text-[11px] font-black text-foreground truncate flex-1">{c.propertyName || 'Sin propiedad'}</p>
                  {cMora && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground truncate pl-4">{c.tenantName || 'Sin inquilino'}</p>
                <div className="flex items-center justify-between mt-1.5 pl-4">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 h-4",
                    c.status === 'Vigente' ? "text-green-700 border-green-200 bg-green-50" :
                    c.status === 'Próximo a Vencer' ? "text-amber-700 border-amber-200 bg-amber-50" :
                    "text-muted-foreground"
                  )}>{c.status}</Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Panel derecho ── */}
        <div className="xl:col-span-2 space-y-4">
          {!contract ? (
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Seleccioná un contrato para ver el detalle.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header del contrato */}
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-black text-foreground text-base leading-tight">{contract.propertyName || property?.address || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">ID: CT-{contract.id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground font-bold">Inquilino</p>
                          <p className="font-black mt-0.5">{contract.tenantName || tenant?.fullName || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-bold">Vencimiento</p>
                          <p className="font-black mt-0.5">{new Date(contract.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-bold">Canon mensual</p>
                          <p className="font-black text-primary text-base mt-0.5">
                            {contract.currency} {contract.currentRentAmount.toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge className={cn("font-bold px-3 py-1.5 flex items-center gap-1.5 shrink-0",
                      contract.status === 'Vigente' ? "bg-green-100 text-green-800 border-green-200" :
                      contract.status === 'Próximo a Vencer' ? "bg-amber-100 text-amber-800 border-amber-200" :
                      "bg-slate-100 text-slate-700 border-slate-200"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[contract.status])} />
                      Registrado en AlquilaGestión
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Flujo del contrato */}
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Flujo del Contrato
                    </CardTitle>
                    {contract.documents?.mainContractName && (
                      <button className="text-[11px] text-primary font-bold flex items-center gap-1 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Ver Documento
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex items-start gap-0 overflow-x-auto pb-2">
                    {stages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center flex-1 min-w-[80px]">
                        <div className="flex flex-col items-center flex-1 px-1">
                          {/* Circle */}
                          <div className={cn(
                            "h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all",
                            stage.status === 'completed' ? "bg-primary border-primary" :
                            stage.status === 'active' ? "bg-primary/10 border-primary" :
                            "bg-muted border-muted-foreground/20"
                          )}>
                            {stage.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            ) : stage.status === 'active' ? (
                              <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </div>
                          {/* Labels */}
                          <p className={cn("text-[10px] font-black mt-2 text-center leading-tight",
                            stage.status === 'pending' ? "text-muted-foreground/50" : "text-foreground"
                          )}>{stage.label}</p>
                          <p className={cn("text-[9px] mt-0.5 text-center",
                            stage.status === 'completed' ? "text-green-600 font-bold" :
                            stage.status === 'active' ? "text-primary font-bold" :
                            "text-muted-foreground"
                          )}>{stage.sublabel}</p>
                        </div>
                        {/* Connector */}
                        {idx < stages.length - 1 && (
                          <div className={cn("h-0.5 flex-1 max-w-[40px] mt-[-20px]",
                            stages[idx + 1].status !== 'pending' ? "bg-primary" : "bg-muted-foreground/20"
                          )} />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cláusulas de desempeño */}
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground tracking-wide mb-3">Cláusulas de Desempeño Activas</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  {/* ── Mora ── */}
                  <div className={cn(
                    "p-4 rounded-xl border space-y-3",
                    mora ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className={cn("p-2 rounded-lg", mora ? "bg-red-100" : "bg-green-100")}>
                        <AlertTriangle className={cn("h-4 w-4", mora ? "text-red-600" : "text-green-600")} />
                      </div>
                      <Badge className={cn("text-[9px] font-black border-none",
                        mora ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>{mora ? 'EN MORA' : 'AL DÍA'}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">Recargo por Mora</p>
                      {mora ? (
                        <>
                          <p className="text-xs text-red-700 mt-1 leading-snug">
                            {mora.overdueInvoices.length} factura(s) vencida(s). {mora.daysOverdue} días de atraso.
                          </p>
                          <p className="text-xs font-black text-red-700 mt-1.5">
                            Recargo: {contract.currency} {mora.penalty.toLocaleString('es-AR')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Tasa: {mora.dailyRate}% diario</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Sin facturas vencidas. Monitoreando.</p>
                      )}
                    </div>
                    {mora && (
                      <div className="text-[10px] text-muted-foreground border-t border-red-200 pt-2">
                        Última revisión: hoy {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* ── Notificación Legal ── */}
                  <div className={cn(
                    "p-4 rounded-xl border space-y-3",
                    mora && mora.daysOverdue >= 15 ? "border-orange-300 bg-orange-50" : "border-border bg-white"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className={cn("p-2 rounded-lg", mora && mora.daysOverdue >= 15 ? "bg-orange-100" : "bg-muted")}>
                        <Scale className={cn("h-4 w-4", mora && mora.daysOverdue >= 15 ? "text-orange-600" : "text-muted-foreground")} />
                      </div>
                      <Badge className={cn("text-[9px] font-black border-none",
                        mora && mora.daysOverdue >= 15 ? "bg-orange-100 text-orange-700" :
                        mora ? "bg-amber-100 text-amber-700" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {mora && mora.daysOverdue >= 15 ? 'ACCIONAR' : mora ? 'EN ESPERA' : 'OK'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">Notificación Legal</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {mora && mora.daysOverdue >= 15
                          ? `Superado el umbral de 15 días. Corresponde notificar formalmente al inquilino.`
                          : mora
                          ? `Atraso de ${mora.daysOverdue} días. Se activa a partir de los 15 días.`
                          : 'Sin deuda. Se activa si el atraso supera 15 días.'}
                      </p>
                      {mora && mora.daysOverdue >= 15 && (
                        <p className="text-[10px] font-bold text-orange-700 mt-1.5">
                          Día disparador: Día {mora.daysOverdue} impago
                        </p>
                      )}
                    </div>
                    {mora && mora.daysOverdue >= 15 && (
                      sentNotifications.has(contract.id) ? (
                        <Badge className="bg-green-100 text-green-700 border-none font-bold w-full justify-center">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Notificación registrada
                        </Badge>
                      ) : canWrite ? (
                        <Button size="sm" className="w-full h-7 text-xs font-bold bg-orange-500 hover:bg-orange-600"
                          onClick={() => setShowNotifDialog(true)}>
                          <Bell className="h-3 w-3 mr-1" /> Registrar notificación
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin permisos</span>
                      )
                    )}
                  </div>

                  {/* ── Ajuste de Canon ── */}
                  <div className="p-4 rounded-xl border border-border bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <RefreshCw className="h-4 w-4 text-primary" />
                      </div>
                      <Badge className="text-[9px] font-black border-none bg-primary/10 text-primary">ACTIVO</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">Ajuste de Canon</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        Índice: <strong>{contract.adjustmentMechanism ?? 'Libre'}</strong> · Cada {contract.adjustmentFrequencyMonths} mes(es).
                      </p>
                      {contract.startDate && (() => {
                        const start = new Date(contract.startDate);
                        const monthsPassed = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                        const nextAdjustmentMonth = Math.ceil((monthsPassed + 1) / contract.adjustmentFrequencyMonths) * contract.adjustmentFrequencyMonths;
                        const nextDate = new Date(start);
                        nextDate.setMonth(nextDate.getMonth() + nextAdjustmentMonth);
                        return (
                          <p className="text-[10px] font-bold text-primary mt-1.5">
                            Próximo ajuste: {nextDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                          </p>
                        );
                      })()}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Canon actual: {contract.currency} {contract.currentRentAmount.toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facturas del contrato */}
              {contractInvoices.length > 0 && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Facturas del contrato
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {contractInvoices.slice(0, 6).map(inv => {
                        const isOverdue = inv.status !== 'Pagado' && inv.status !== 'Anulado' && new Date(inv.dueDate) < new Date();
                        return (
                          <div key={inv.id} className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg text-xs",
                            isOverdue ? "bg-red-50 border border-red-100" : "bg-muted/30"
                          )}>
                            <div className="flex items-center gap-2">
                              {isOverdue
                                ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                : inv.status === 'Pagado'
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                : <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                              <span className="font-medium">{inv.period}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn("font-black", isOverdue ? "text-red-600" : "text-foreground")}>
                                {inv.currency} {inv.totalAmount.toLocaleString('es-AR')}
                              </span>
                              <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 h-4",
                                inv.status === 'Pagado' ? "text-green-700 border-green-200" :
                                isOverdue ? "text-red-700 border-red-200" :
                                "text-amber-700 border-amber-200"
                              )}>{isOverdue ? 'VENCIDO' : inv.status}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog: Registrar notificación */}
      <Dialog open={showNotifDialog} onOpenChange={setShowNotifDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" /> Registrar Notificación de Mora
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta acción registra en el sistema que notificaste al inquilino por mora.
              Enviá el mensaje correspondiente por fuera (WhatsApp, email, carta documento).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs space-y-1">
              <p><strong>Inquilino:</strong> {contract?.tenantName}</p>
              <p><strong>Deuda:</strong> {contract?.currency} {mora?.totalOverdue.toLocaleString('es-AR') ?? 0}</p>
              <p><strong>Recargo estimado:</strong> {contract?.currency} {mora?.penalty.toLocaleString('es-AR') ?? 0}</p>
              <p><strong>Días vencidos:</strong> {mora?.daysOverdue ?? 0} días</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notas adicionales (opcional)</Label>
              <Textarea
                className="text-sm h-20 resize-none"
                placeholder="Ej: Se envió WhatsApp el día 15/04. Prometió pagar el viernes..."
                value={notifNote}
                onChange={e => setNotifNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNotifDialog(false)}>Cancelar</Button>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 font-bold" onClick={handleSendNotification} disabled={!canWrite}>
              <Bell className="h-4 w-4" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
