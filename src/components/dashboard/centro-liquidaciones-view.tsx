import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send, CheckCircle2, Loader2, Eye, User2, Building2,
  ChevronRight, MailCheck, MailX, CalendarClock, ListChecks,
  AlertTriangle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice, Contract, Property, Person } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { sendEmail } from '@/services/email-service';
import { useOrgPermissions } from '@/contexts/org-permissions-context';


// ── Prose email templates ─────────────────────────────────────────────────────

function buildTenantHtml({ tenantName, propertyName, period, rentAmount, prevInterest, dueDate, currency, cbuLine }: {
  tenantName: string; propertyName: string; period: string;
  rentAmount: number; prevInterest: number; dueDate: string;
  currency: 'ARS' | 'USD'; cbuLine: string | null;
}): string {
  const sym = currency === 'USD' ? 'U$D' : '$';
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR')}`;
  const total = rentAmount + prevInterest;
  const overdueBlock = prevInterest > 0
    ? `<p style="margin:12px 0;">Asimismo, registramos intereses por mora de períodos anteriores por un total de <strong>${fmt(prevInterest)}</strong>, los cuales deberán abonarse junto con el presente período.</p>`
    : '';
  const cbuBlock = cbuLine
    ? `<p style="margin:12px 0;">Para realizar el pago por transferencia bancaria, le informamos los siguientes datos:</p><p style="background:#f5f5f5;padding:10px 14px;border-radius:6px;font-family:monospace;font-size:13px;margin:8px 0;">${cbuLine}</p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="color:#1a1a2e;margin-bottom:4px;">Liquidación de alquiler — ${period}</h2>
  <p style="color:#666;font-size:13px;margin-top:0;margin-bottom:20px;">${propertyName}</p>
  <p>Estimado/a <strong>${tenantName}</strong>:</p>
  <p>Le escribimos para informarle la liquidación de alquiler correspondiente al período <strong>${period}</strong>, con vencimiento el día <strong>${dueDate}</strong>.</p>
  <p>El ${prevInterest > 0 ? 'total a abonar (alquiler + mora)' : 'importe a abonar'} es de <strong style="font-size:16px;color:#2e7d32;">${fmt(total)}</strong>.</p>
  ${overdueBlock}${cbuBlock}
  <div style="background:#e3f2fd;border-left:4px solid #90caf9;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;">
    <p style="margin:0;font-size:12px;color:#1565c0;"><strong>Nota fiscal:</strong> Conforme a la RG AFIP N° 1415/03, la factura fiscal será emitida al percibirse su pago o al vencimiento del plazo (${dueDate}), lo que ocurra primero.</p>
  </div>
  <p>Ante cualquier consulta, no dude en comunicarse con nuestra administración.</p>
  <p>Atentamente,<br/><strong>Administración</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:10px;color:#aaa;">Aviso automático. Por favor no responda a este correo.</p>
</div>`;
}

function buildOwnerHtml({ ownerName, propertyName, tenantName, period, rentAmount, prevInterest, dueDate, currency }: {
  ownerName: string; propertyName: string; tenantName: string; period: string;
  rentAmount: number; prevInterest: number; dueDate: string; currency: 'ARS' | 'USD';
}): string {
  const sym = currency === 'USD' ? 'U$D' : '$';
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR')}`;
  const total = rentAmount + prevInterest;
  const overdueBlock = prevInterest > 0
    ? `<p style="margin:12px 0;">Se registran además intereses por mora de períodos anteriores por <strong>${fmt(prevInterest)}</strong>, que se suman al total a cobrar.</p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="color:#1a1a2e;margin-bottom:4px;">Liquidación mensual — ${period}</h2>
  <p style="color:#666;font-size:13px;margin-top:0;margin-bottom:20px;">${propertyName}</p>
  <p>Estimado/a <strong>${ownerName}</strong>:</p>
  <p>Le informamos que se ha generado la liquidación del período <strong>${period}</strong> para su propiedad <strong>${propertyName}</strong>. El inquilino <strong>${tenantName}</strong> cuenta con plazo hasta el <strong>${dueDate}</strong> para efectuar el pago.</p>
  <p>El ${prevInterest > 0 ? 'total a cobrar (alquiler + mora)' : 'importe del alquiler'} asciende a <strong style="font-size:16px;color:#2e7d32;">${fmt(total)}</strong>.</p>
  ${overdueBlock}
  <div style="background:#fef9ec;border-left:4px solid #f5c842;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;">
    <p style="margin:0 0 8px;font-size:12px;color:#856404;"><strong>Recordatorio — RG AFIP N° 1415/03:</strong></p>
    <p style="margin:0;font-size:12px;color:#856404;">Deberá emitir la factura ARCA al percibir el pago <strong>o</strong> al vencimiento (${dueDate}), lo que ocurra primero. Recibirá un aviso automático en ambas instancias.</p>
  </div>
  <p>Ante cualquier consulta, comuníquese con nuestra administración.</p>
  <p>Atentamente,<br/><strong>Administración</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:10px;color:#aaa;">Aviso automático. Por favor no responda a este correo.</p>
</div>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CentroLiquidacionesViewProps {
  invoices: Invoice[];
  contracts: Contract[];
  properties: Property[];
  people: Person[];
  userId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CentroLiquidacionesView({ invoices, contracts, properties, people, userId }: CentroLiquidacionesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite } = useOrgPermissions();

  // ── Period selector (last 6 months + next 2) ──────────────────────────────
  const periods = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
      return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    }).reverse();
  }, []);

  const nextMonthLabel = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState(nextMonthLabel);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'tenant' | 'owner'>('tenant');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  // ── Invoices for the selected period ─────────────────────────────────────
  const periodInvoices = useMemo(() =>
    invoices
      .filter(i => i.period === selectedPeriod && i.charges?.some(c => c.type === 'Alquiler'))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
    [invoices, selectedPeriod]
  );

  const selectedInv = periodInvoices.find(i => i.id === selectedInvId) ?? null;

  // ── Send-tracking helpers ─────────────────────────────────────────────────
  const tenantSent = (inv: Invoice) =>
    !!(inv.sendLog?.some(l => l.type === 'tenant') || (inv.liquidacionEnviadaAt && !inv.pendingApproval));
  const ownerSent = (inv: Invoice) =>
    !!(inv.sendLog?.some(l => l.type === 'owner') || (inv.liquidacionEnviadaAt && !inv.pendingApproval));

  const pendingCount = periodInvoices.filter(i => !tenantSent(i) && i.status !== 'Pagado').length;

  const stats = useMemo(() => {
    const tSent = periodInvoices.filter(tenantSent).length;
    const oSent = periodInvoices.filter(ownerSent).length;
    const pagados = periodInvoices.filter(i => i.status === 'Pagado').length;
    const totalAmount = periodInvoices.reduce((acc, i) => acc + (i.totalAmount ?? 0), 0);
    return { total: periodInvoices.length, tSent, oSent, pagados, totalAmount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodInvoices]);

  // ── Status label for list rows ────────────────────────────────────────────
  const getRowStatus = (inv: Invoice) => {
    if (inv.status === 'Pagado') return { label: 'Cobrado', color: 'bg-green-100 text-green-700' };
    if (inv.status === 'Vencido') return { label: 'Vencido', color: 'bg-red-100 text-red-700' };
    if (inv.pendingApproval) return { label: 'Sin aprobar', color: 'bg-yellow-100 text-yellow-700' };
    if (tenantSent(inv)) return { label: 'Enviado', color: 'bg-teal-100 text-teal-700' };
    return { label: 'Sin enviar', color: 'bg-gray-100 text-gray-500' };
  };

  // ── Data helpers for email building ───────────────────────────────────────
  const getEmailData = (inv: Invoice) => {
    const property = properties.find(p => p.id === inv.propertyId);
    const ownerName = property?.owners?.[0]?.name ?? 'Propietario';
    const ownerPerson = people.find(p => p.email === inv.ownerEmail);
    const bankInfo = ownerPerson?.bankDetails ?? (inv.ownerCbu ? { cbu: inv.ownerCbu, alias: inv.ownerAlias ?? '', bank: inv.ownerBank ?? '' } : null);
    const cbuLine = bankInfo?.cbu
      ? `CBU: ${bankInfo.cbu}${bankInfo.alias ? ` · Alias: ${bankInfo.alias}` : ''}${bankInfo.bank ? ` (${bankInfo.bank})` : ''}`
      : null;
    const prevInterest = invoices
      .filter(i => i.contractId === inv.contractId && i.status !== 'Pagado' && i.status !== 'Anulado' && i.period !== inv.period)
      .reduce((acc, i) => acc + (i.lateFees ?? 0), 0);
    const rentAmount = inv.charges?.find(c => c.type === 'Alquiler')?.amount ?? inv.totalAmount;
    return { ownerName, cbuLine, prevInterest, rentAmount, bankInfo };
  };

  // ── Individual send ───────────────────────────────────────────────────────
  const doSend = async (inv: Invoice, type: 'tenant' | 'owner') => {
    if (!db || !userId) return;
    const email = type === 'tenant' ? inv.tenantEmail : inv.ownerEmail;
    if (!email) {
      toast({ title: 'Sin email', description: `No hay email de ${type === 'tenant' ? 'inquilino' : 'propietario'} registrado.`, variant: 'destructive' });
      return;
    }
    setSendingId(`${type}_${inv.id}`);
    const { ownerName, cbuLine, prevInterest, rentAmount } = getEmailData(inv);
    const cur = (inv.currency ?? 'ARS') as 'ARS' | 'USD';
    const now = new Date().toISOString();
    try {
      const html = type === 'tenant'
        ? buildTenantHtml({ tenantName: inv.tenantName, propertyName: inv.propertyName, period: inv.period, rentAmount, prevInterest, dueDate: inv.dueDate, currency: cur, cbuLine })
        : buildOwnerHtml({ ownerName, propertyName: inv.propertyName, tenantName: inv.tenantName, period: inv.period, rentAmount, prevInterest, dueDate: inv.dueDate, currency: cur });
      const subject = type === 'tenant'
        ? `Liquidación de alquiler ${inv.period} — ${inv.propertyName}`
        : `Liquidación ${inv.period} — ${inv.propertyName}`;
      await sendEmail({ to: email, subject, html });
      const newLog = [...(inv.sendLog ?? []), { ts: now, to: email, type }];
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
      setDocumentNonBlocking(docRef, { liquidacionEnviadaAt: now, sendLog: newLog, pendingApproval: false }, { merge: true });
      toast({ title: '✓ Enviado', description: `Correo enviado a ${email}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar el correo.', variant: 'destructive' });
    }
    setSendingId(null);
  };

  // ── Bulk send (all without tenant email sent) ─────────────────────────────
  const handleBulkSend = async () => {
    if (!db || !userId) return;
    setBulkSending(true);
    const pending = periodInvoices.filter(i => !tenantSent(i) && i.status !== 'Pagado');
    const now = new Date().toISOString();
    const promises: Promise<unknown>[] = [];

    for (const inv of pending) {
      const { ownerName, cbuLine, prevInterest, rentAmount } = getEmailData(inv);
      const cur = (inv.currency ?? 'ARS') as 'ARS' | 'USD';
      const newLog = [...(inv.sendLog ?? [])];

      if (inv.tenantEmail && !inv.sendLog?.some(l => l.type === 'tenant')) {
        newLog.push({ ts: now, to: inv.tenantEmail, type: 'tenant' });
        promises.push(sendEmail({
          to: inv.tenantEmail,
          subject: `Liquidación de alquiler ${inv.period} — ${inv.propertyName}`,
          html: buildTenantHtml({ tenantName: inv.tenantName, propertyName: inv.propertyName, period: inv.period, rentAmount, prevInterest, dueDate: inv.dueDate, currency: cur, cbuLine }),
        }).catch(() => {}));
      }
      if (inv.ownerEmail && !inv.sendLog?.some(l => l.type === 'owner')) {
        newLog.push({ ts: now, to: inv.ownerEmail, type: 'owner' });
        promises.push(sendEmail({
          to: inv.ownerEmail,
          subject: `Liquidación ${inv.period} — ${inv.propertyName}`,
          html: buildOwnerHtml({ ownerName, propertyName: inv.propertyName, tenantName: inv.tenantName, period: inv.period, rentAmount, prevInterest, dueDate: inv.dueDate, currency: cur }),
        }).catch(() => {}));
      }
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
      setDocumentNonBlocking(docRef, { liquidacionEnviadaAt: now, sendLog: newLog, pendingApproval: false }, { merge: true });
    }

    await Promise.allSettled(promises);
    setBulkSending(false);
    toast({ title: 'Liquidaciones enviadas', description: `${pending.length} factura${pending.length !== 1 ? 's' : ''} notificadas.` });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Operaciones Mensuales</p>
            <h1 className="text-2xl font-black">Centro de Liquidaciones</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Seguimiento de envíos y cobros por inquilino y propietario.
            </p>
          </div>
          {canWrite && pendingCount > 0 && (
            <Button
              className="bg-primary font-black gap-2 shrink-0"
              onClick={handleBulkSend}
              disabled={bulkSending}
            >
              {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar pendientes ({pendingCount})
            </Button>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {periods.map(p => {
            const count = invoices.filter(i => i.period === p && i.charges?.some(c => c.type === 'Alquiler')).length;
            return (
              <button
                key={p}
                onClick={() => { setSelectedPeriod(p); setSelectedInvId(null); }}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5',
                  selectedPeriod === p
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted-foreground border-border hover:border-primary hover:text-primary'
                )}
              >
                <span className="capitalize">{p}</span>
                {count > 0 && (
                  <span className={cn('text-[9px] px-1 rounded-full font-black', selectedPeriod === p ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                    {count}
                  </span>
                )}
                {p === nextMonthLabel && <span className={cn('text-[9px]', selectedPeriod === p ? 'opacity-70' : 'text-muted-foreground')}>→</span>}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En período', value: stats.total, icon: ListChecks, color: 'text-foreground' },
            { label: 'Enviados a inquilino', value: `${stats.tSent}/${stats.total}`, icon: MailCheck, color: stats.tSent === stats.total && stats.total > 0 ? 'text-teal-600' : 'text-amber-600' },
            { label: 'Enviados a propietario', value: `${stats.oSent}/${stats.total}`, icon: MailCheck, color: stats.oSent === stats.total && stats.total > 0 ? 'text-blue-600' : 'text-amber-600' },
            { label: 'Cobrados', value: stats.pagados, icon: CheckCircle2, color: 'text-green-600' },
          ].map(s => (
            <Card key={s.label} className="border-none shadow-sm bg-white">
              <CardContent className="p-3 flex items-center gap-3">
                <s.icon className={cn('h-5 w-5 shrink-0', s.color)} />
                <div>
                  <p className={cn('text-lg font-black leading-none', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Body: split layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-4 px-6 pb-6">

        {/* Left: invoice list */}
        <div className="flex flex-col w-[440px] min-w-[260px] bg-white rounded-xl border shadow-sm overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b bg-muted/20 flex-shrink-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              {periodInvoices.length} liquidacion{periodInvoices.length !== 1 ? 'es' : ''} — <span className="capitalize">{selectedPeriod}</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {periodInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-6 text-center">
                <CalendarClock className="h-10 w-10 mb-3 opacity-15" />
                <p className="text-sm font-semibold">Sin liquidaciones para este período</p>
                <p className="text-xs mt-1">Generá las liquidaciones desde Facturas → Generar Mensuales</p>
              </div>
            ) : (
              periodInvoices.map(inv => {
                const tSnt = tenantSent(inv);
                const oSnt = ownerSent(inv);
                const { label, color } = getRowStatus(inv);
                const isSelected = selectedInvId === inv.id;

                return (
                  <button
                    key={inv.id}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors flex items-center gap-3',
                      isSelected && 'bg-primary/5 border-l-2 border-primary'
                    )}
                    onClick={() => { setSelectedInvId(inv.id); setPreviewMode('tenant'); }}
                  >
                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                      {inv.tenantName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate">{inv.tenantName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{inv.propertyName}</p>
                    </div>

                    {/* Email tracking icons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <div className={cn('flex items-center gap-1 text-[9px] font-bold', tSnt ? 'text-teal-600' : 'text-gray-300')}>
                        {tSnt ? <MailCheck className="h-3 w-3" /> : <MailX className="h-3 w-3" />}
                        <span>Inq.</span>
                      </div>
                      <div className={cn('flex items-center gap-1 text-[9px] font-bold', oSnt ? 'text-blue-600' : 'text-gray-300')}>
                        {oSnt ? <MailCheck className="h-3 w-3" /> : <MailX className="h-3 w-3" />}
                        <span>Prop.</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-xs font-black">
                        {(inv.currency === 'USD' ? 'U$D ' : '$ ')}{(inv.totalAmount ?? 0).toLocaleString('es-AR')}
                      </p>
                      <Badge className={cn('text-[8px] font-bold border-0 px-1.5 h-4', color)}>
                        {label}
                      </Badge>
                    </div>

                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: detail + email preview */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
          {!selectedInv ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border shadow-sm min-h-[300px]">
              <Eye className="h-12 w-12 mb-3 opacity-10" />
              <p className="text-sm font-semibold">Seleccioná una liquidación</p>
              <p className="text-xs mt-1">Hacé clic en una fila para ver el detalle y el correo</p>
            </div>
          ) : (() => {
            const { ownerName, cbuLine, prevInterest, rentAmount } = getEmailData(selectedInv);
            const cur = (selectedInv.currency ?? 'ARS') as 'ARS' | 'USD';
            const sym = cur === 'USD' ? 'U$D' : '$';
            const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR')}`;
            const total = rentAmount + prevInterest;
            const property = properties.find(p => p.id === selectedInv.propertyId);
            const recipientEmail = previewMode === 'tenant' ? selectedInv.tenantEmail : selectedInv.ownerEmail;
            const recipientName = previewMode === 'tenant' ? selectedInv.tenantName : ownerName;
            const alreadySent = previewMode === 'tenant' ? tenantSent(selectedInv) : ownerSent(selectedInv);
            const isSendingThis = sendingId === `${previewMode}_${selectedInv.id}`;

            return (
              <>
                {/* Invoice header card */}
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{selectedInv.tenantName}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="capitalize">{selectedInv.propertyName}</span> · <span className="capitalize">{selectedInv.period}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-primary">{fmt(total)}</p>
                        <p className="text-[11px] text-muted-foreground">Vence: {selectedInv.dueDate}</p>
                      </div>
                    </div>

                    {/* Breakdown grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-muted/20 rounded-lg space-y-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <User2 className="h-3 w-3" /> Inquilino
                        </p>
                        <p className="font-semibold truncate">{selectedInv.tenantName}</p>
                        <p className={cn('truncate', selectedInv.tenantEmail ? 'text-muted-foreground' : 'text-red-500 italic')}>
                          {selectedInv.tenantEmail || 'Sin email registrado'}
                        </p>
                        {tenantSent(selectedInv) && (
                          <p className="text-[9px] text-teal-600 font-bold flex items-center gap-1">
                            <MailCheck className="h-3 w-3" /> Email enviado
                          </p>
                        )}
                      </div>
                      <div className="p-3 bg-muted/20 rounded-lg space-y-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Propietario
                        </p>
                        <p className="font-semibold truncate">{property?.owners?.[0]?.name ?? '—'}</p>
                        <p className={cn('truncate', selectedInv.ownerEmail ? 'text-muted-foreground' : 'text-red-500 italic')}>
                          {selectedInv.ownerEmail || 'Sin email registrado'}
                        </p>
                        {ownerSent(selectedInv) && (
                          <p className="text-[9px] text-blue-600 font-bold flex items-center gap-1">
                            <MailCheck className="h-3 w-3" /> Email enviado
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Charge detail */}
                    <div className="space-y-1 text-xs">
                      {selectedInv.charges?.filter(c => c.imputedTo === 'Inquilino').map(c => (
                        <div key={c.id} className="flex justify-between text-muted-foreground">
                          <span>{c.description || c.type}</span>
                          <span className="font-bold">{fmt(c.amount)}</span>
                        </div>
                      ))}
                      {prevInterest > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>Intereses mora períodos anteriores</span>
                          <span className="font-bold">{fmt(prevInterest)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black pt-1 border-t border-border/40 text-sm">
                        <span>Total</span>
                        <span className="text-primary">{fmt(total)}</span>
                      </div>
                    </div>

                    {/* Send log */}
                    {selectedInv.sendLog && selectedInv.sendLog.length > 0 && (
                      <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg">
                        <p className="text-[9px] font-black text-teal-700 uppercase tracking-wide mb-1.5">
                          Historial de envíos
                        </p>
                        <div className="space-y-1">
                          {selectedInv.sendLog.map((log, idx) => (
                            <p key={idx} className="text-[10px] text-teal-700 flex items-center gap-1.5">
                              <MailCheck className="h-3 w-3 shrink-0" />
                              <span className="font-bold">{log.type === 'tenant' ? 'Inquilino' : 'Propietario'}:</span>
                              <span className="truncate">{log.to}</span>
                              <span className="shrink-0 text-teal-500">
                                · {new Date(log.ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Email preview + send */}
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-5 space-y-4">
                    {/* Recipient toggle */}
                    <div className="flex gap-2">
                      {(['tenant', 'owner'] as const).map(mode => {
                        const label = mode === 'tenant' ? 'Correo al Inquilino' : 'Correo al Propietario';
                        const sent = mode === 'tenant' ? tenantSent(selectedInv) : ownerSent(selectedInv);
                        return (
                          <button
                            key={mode}
                            onClick={() => setPreviewMode(mode)}
                            className={cn(
                              'flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5',
                              previewMode === mode
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-muted-foreground border-border hover:border-primary hover:text-primary'
                            )}
                          >
                            {mode === 'tenant' ? <User2 className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                            {label}
                            {sent && <MailCheck className={cn('h-3 w-3 ml-1', previewMode === mode ? 'text-white/70' : 'text-teal-500')} />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Email header */}
                    <div className="p-3 bg-gray-50 rounded-lg border space-y-1 text-xs">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-12 shrink-0">Para:</span>
                        <span className={cn('font-medium', recipientEmail ? '' : 'text-red-500 italic')}>
                          {recipientName}{recipientEmail ? ` <${recipientEmail}>` : ' — sin email registrado'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-12 shrink-0">Asunto:</span>
                        <span className="font-medium">
                          {previewMode === 'tenant'
                            ? `Liquidación de alquiler ${selectedInv.period} — ${selectedInv.propertyName}`
                            : `Liquidación ${selectedInv.period} — ${selectedInv.propertyName}`}
                        </span>
                      </div>
                    </div>

                    {/* Email body preview */}
                    <div className="p-4 border rounded-lg space-y-3 text-sm bg-white text-gray-800 leading-relaxed">
                      <p>Estimado/a <strong>{recipientName}</strong>:</p>

                      {previewMode === 'tenant' ? (
                        <>
                          <p>
                            Le escribimos para informarle la liquidación de alquiler correspondiente al período{' '}
                            <strong className="capitalize">{selectedInv.period}</strong>, con vencimiento el día{' '}
                            <strong>{selectedInv.dueDate}</strong>.
                          </p>
                          <p>
                            El {prevInterest > 0 ? 'total a abonar (alquiler + mora)' : 'importe a abonar'} es de{' '}
                            <strong className="text-green-700 text-base">{fmt(total)}</strong>.
                          </p>
                          {prevInterest > 0 && (
                            <div className="text-xs bg-amber-50 text-amber-700 p-2 rounded border-l-2 border-amber-300">
                              Incluye intereses por mora de períodos anteriores: <strong>{fmt(prevInterest)}</strong>
                            </div>
                          )}
                          {cbuLine && (
                            <div className="bg-gray-100 p-2.5 rounded font-mono text-xs text-gray-800">
                              {cbuLine}
                            </div>
                          )}
                          <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300">
                            <strong>Nota fiscal:</strong> Conforme a la RG AFIP N° 1415/03, la factura fiscal será emitida al percibirse su pago o al vencimiento ({selectedInv.dueDate}).
                          </div>
                        </>
                      ) : (
                        <>
                          <p>
                            Le informamos que se ha generado la liquidación del período{' '}
                            <strong className="capitalize">{selectedInv.period}</strong> para su propiedad{' '}
                            <strong>{selectedInv.propertyName}</strong>. El inquilino{' '}
                            <strong>{selectedInv.tenantName}</strong> cuenta con plazo hasta el{' '}
                            <strong>{selectedInv.dueDate}</strong> para efectuar el pago.
                          </p>
                          <p>
                            El {prevInterest > 0 ? 'total a cobrar (alquiler + mora)' : 'importe del alquiler'} asciende a{' '}
                            <strong className="text-green-700 text-base">{fmt(total)}</strong>.
                          </p>
                          {prevInterest > 0 && (
                            <div className="text-xs bg-amber-50 text-amber-700 p-2 rounded border-l-2 border-amber-300">
                              Incluye intereses por mora de períodos anteriores: <strong>{fmt(prevInterest)}</strong>
                            </div>
                          )}
                          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border-l-2 border-yellow-400">
                            <strong>RG AFIP N° 1415/03:</strong> Deberá emitir la factura ARCA al percibir el pago o al vencimiento ({selectedInv.dueDate}), lo que ocurra primero.
                          </div>
                        </>
                      )}

                      <p className="text-muted-foreground text-xs border-t border-border/30 pt-2">
                        Atentamente, <strong>Administración</strong>
                      </p>
                    </div>

                    {/* Send action */}
                    {canWrite && (
                      <div className="flex items-center gap-3">
                        <Button
                          className={cn('flex-1 font-bold gap-2', alreadySent ? 'bg-teal-600 hover:bg-teal-700' : 'bg-primary')}
                          onClick={() => doSend(selectedInv, previewMode)}
                          disabled={!!sendingId || !recipientEmail}
                          title={!recipientEmail ? 'No hay email registrado' : undefined}
                        >
                          {isSendingThis
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : alreadySent
                              ? <MailCheck className="h-4 w-4" />
                              : <Send className="h-4 w-4" />}
                          {alreadySent ? 'Reenviar correo' : 'Enviar ahora'}
                        </Button>
                        {alreadySent && (
                          <p className="text-[10px] text-teal-600 font-bold whitespace-nowrap">✓ Ya enviado</p>
                        )}
                        {!recipientEmail && (
                          <p className="text-[10px] text-red-500 font-bold whitespace-nowrap flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Sin email
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
