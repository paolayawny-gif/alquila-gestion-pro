'use client';

import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Download, Shield, FileText, Clock, AlertTriangle, Wrench, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types (minimal, from Firestore raw data)
// ─────────────────────────────────────────────────────────────────────────────

interface Signature {
  signerName: string;
  signerRole: string;
  signerEmail: string;
  signedAt: string;
  ipAddress?: string;
  userAgent?: string;
  documentHash: string;
}

interface LegajoClientProps {
  txHash: string;
  scanUrl: string;
  documentHash: string;
  notarizedAt: string;
  contract: Record<string, any>;
  invoices: Record<string, any>[];
  tickets: Record<string, any>[];
  notifications: Record<string, any>[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
    .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(amount: number, currency = 'ARS') {
  return `${currency === 'USD' ? 'U$D' : '$'}${Number(amount ?? 0).toLocaleString('es-AR')}`;
}

const INV_COLOR: Record<string, string> = {
  Pagado: 'bg-green-100 text-green-700 border-green-200',
  'Pago Informado': 'bg-blue-100 text-blue-700 border-blue-200',
  Pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  Vencido: 'bg-red-100 text-red-700 border-red-200',
  Anulado: 'bg-slate-100 text-slate-500 border-slate-200',
};

const TICKET_COLOR: Record<string, string> = {
  Resuelto: 'bg-green-100 text-green-700 border-green-200',
  'En proceso': 'bg-blue-100 text-blue-700 border-blue-200',
  Pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation
// ─────────────────────────────────────────────────────────────────────────────

async function downloadLegajoPDF(props: LegajoClientProps) {
  const { jsPDF } = await import('jspdf');
  const autoTable  = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 14;
  const COL_W  = PAGE_W - MARGIN * 2;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(29, 158, 117); // brand green
  doc.rect(0, 0, PAGE_W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AlquilaGestion Pro', MARGIN, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('LEGAJO JUDICIAL — VERIFICACIÓN DE CONTRATO', MARGIN, 18);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, MARGIN, 23);
  doc.setTextColor(0, 0, 0);

  let y = 36;

  // ── Blockchain proof ────────────────────────────────────────────────────────
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(MARGIN, y, COL_W, 30, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text('✓ PRUEBA BLOCKCHAIN — POLYGON NETWORK', MARGIN + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.text(`Hash del documento: ${props.documentHash}`, MARGIN + 3, y + 12);
  doc.text(`TX Hash (Polygon): ${props.txHash}`, MARGIN + 3, y + 17);
  doc.text(`Verificar en: https://polygonscan.com/tx/${props.txHash}`, MARGIN + 3, y + 22);
  doc.text(`Fecha de notarización: ${fmtDate(props.notarizedAt)}`, MARGIN + 3, y + 27);
  y += 36;

  // ── Datos del contrato ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DATOS DEL CONTRATO', MARGIN, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 158, 117], textColor: 255 },
    head: [['Campo', 'Valor']],
    body: [
      ['Propiedad',      props.contract.propertyName ?? '—'],
      ['Inquilino',      props.contract.tenantName   ?? '—'],
      ['Email inquilino',props.contract.tenantEmail  ?? '—'],
      ['Estado',         props.contract.status       ?? '—'],
      ['Inicio',         props.contract.startDate?.split('-').reverse().join('/') ?? '—'],
      ['Vencimiento',    props.contract.endDate?.split('-').reverse().join('/')   ?? '—'],
      ['Canon mensual',  fmtMoney(props.contract.currentRentAmount, props.contract.currency)],
      ['Depósito',       fmtMoney(props.contract.depositAmount, props.contract.depositCurrency)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Firmas electrónicas ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FIRMAS ELECTRÓNICAS (Ley 25.506)', MARGIN, y);
  y += 4;

  const signatures: Signature[] = props.contract.signatures ?? [];

  if (signatures.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('Sin firmas registradas.', MARGIN, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [29, 158, 117], textColor: 255 },
      head: [['Firmante', 'Rol', 'Fecha y hora', 'IP', 'Hash verificado']],
      body: signatures.map(s => [
        s.signerName,
        s.signerRole,
        fmtDate(s.signedAt),
        s.ipAddress ?? '—',
        s.documentHash === props.documentHash ? '✓ Coincide' : '✗ Distinto',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Historial de pagos ──────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('HISTORIAL DE PAGOS', MARGIN, y);
  y += 4;

  if (props.invoices.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('Sin facturas registradas.', MARGIN, y + 4);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [29, 158, 117], textColor: 255 },
      head: [['Período', 'Vencimiento', 'Importe', 'Estado', 'Pagado el']],
      body: props.invoices.map(i => [
        i.period ?? '—',
        i.dueDate?.split('-').reverse().join('/') ?? '—',
        fmtMoney(i.totalAmount, props.contract.currency),
        i.status ?? '—',
        i.paidAt ? fmtDate(i.paidAt) : '—',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Tickets de mantenimiento ─────────────────────────────────────────────────
  if (props.tickets.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SOLICITUDES DE MANTENIMIENTO', MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [29, 158, 117], textColor: 255 },
      head: [['Fecha', 'Título', 'Estado', 'Prioridad']],
      body: props.tickets.map(t => [
        t.createdAt?.slice(0, 10).split('-').reverse().join('/') ?? '—',
        t.title ?? '—',
        t.status ?? '—',
        t.priority ?? '—',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Notificaciones de mora ───────────────────────────────────────────────────
  if (props.notifications.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('NOTIFICACIONES DE MORA ENVIADAS', MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      head: [['Fecha', 'Días vencidos', 'Deuda', 'Notas']],
      body: props.notifications.map(n => [
        fmtDate(n.sentAt),
        `${n.daysOverdue ?? 0} días`,
        fmtMoney(n.totalOverdue ?? 0, props.contract.currency),
        n.notes || '—',
      ]),
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Legajo verificable en: ${typeof window !== 'undefined' ? window.location.href : ''} | Pág. ${i} de ${pageCount}`,
      MARGIN,
      290,
    );
  }

  const propName = (props.contract.propertyName ?? 'contrato').replace(/\s+/g, '-');
  doc.save(`legajo-judicial-${propName}-${props.txHash.slice(0, 8)}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LegajoClient(props: LegajoClientProps) {
  const { txHash, scanUrl, documentHash, notarizedAt, contract, invoices, tickets, notifications } = props;
  const [pdfLoading, setPdfLoading] = useState(false);

  const signatures: Signature[] = contract.signatures ?? [];
  const overdueCount = invoices.filter(i => i.status === 'Vencido').length;

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try { await downloadLegajoPDF(props); } finally { setPdfLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">AlquilaGestion Pro</p>
            <h1 className="text-2xl font-black text-foreground">Legajo Judicial</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contract.propertyName} · {contract.tenantName}
            </p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="gap-2 font-bold"
          >
            <Download className="h-4 w-4" />
            {pdfLoading ? 'Generando…' : 'Descargar PDF'}
          </Button>
        </div>

        {/* Blockchain proof */}
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-700" />
            <p className="font-black text-green-900 text-sm">Prueba Blockchain — Red Polygon</p>
          </div>
          <div className="space-y-1.5 text-xs text-green-900 font-mono break-all">
            <p><span className="font-bold not-italic font-sans">Hash del documento:</span> {documentHash}</p>
            <p><span className="font-bold not-italic font-sans">TX Hash:</span> {txHash}</p>
            <p className="font-sans not-italic"><span className="font-bold">Notarizado el:</span> {fmtDate(notarizedAt)}</p>
          </div>
          <a
            href={scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-green-800 underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Verificar independientemente en PolygonScan
          </a>
          <p className="text-[10px] text-green-700 leading-snug">
            Cualquier persona puede verificar la existencia e inmutabilidad de este documento
            ingresando el TX hash en PolygonScan, sin depender de AlquilaGestion Pro.
          </p>
        </div>

        {/* Contract summary */}
        <Section title="Datos del Contrato" icon={<FileText className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ['Propiedad',      contract.propertyName ?? '—'],
              ['Inquilino',      contract.tenantName ?? '—'],
              ['Email',          contract.tenantEmail ?? '—'],
              ['Estado',         contract.status ?? '—'],
              ['Inicio',         contract.startDate?.split('-').reverse().join('/') ?? '—'],
              ['Vencimiento',    contract.endDate?.split('-').reverse().join('/')   ?? '—'],
              ['Canon mensual',  fmtMoney(contract.currentRentAmount, contract.currency)],
              ['Depósito',       fmtMoney(contract.depositAmount, contract.depositCurrency)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Signatures */}
        <Section title="Firmas Electrónicas (Ley 25.506)" icon={<CheckCircle2 className="h-4 w-4" />}>
          {signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin firmas registradas.</p>
          ) : (
            <div className="space-y-3">
              {signatures.map((s, i) => (
                <div key={i} className="p-3 rounded-xl border bg-muted/20 text-sm space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-black">{s.signerName}</p>
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {s.signerRole}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.signerEmail}</p>
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground mt-1">
                    <span><Clock className="h-3 w-3 inline mr-0.5" />{fmtDate(s.signedAt)}</span>
                    {s.ipAddress && <span>IP: {s.ipAddress}</span>}
                    {s.userAgent && <span className="truncate max-w-[200px]">{s.userAgent}</span>}
                  </div>
                  <p className={cn('text-[10px] mt-1 font-bold',
                    s.documentHash === documentHash ? 'text-green-700' : 'text-red-600',
                  )}>
                    {s.documentHash === documentHash ? '✓ Hash del documento coincide' : '✗ Hash no coincide'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payment history */}
        <Section
          title="Historial de Pagos"
          icon={<Clock className="h-4 w-4" />}
          badge={overdueCount > 0 ? (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">
              <AlertTriangle className="h-3 w-3 mr-1" /> {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
            </Badge>
          ) : undefined}
        >
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin facturas registradas.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 text-sm">
                  <div>
                    <p className="font-bold">{inv.period ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vence: {inv.dueDate?.split('-').reverse().join('/') ?? '—'}
                      {inv.paidAt ? ` · Pagado: ${fmtDate(inv.paidAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-black">{fmtMoney(inv.totalAmount, contract.currency)}</p>
                    <Badge className={cn('text-[10px] font-bold border', INV_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Maintenance tickets */}
        {tickets.length > 0 && (
          <Section title="Solicitudes de Mantenimiento" icon={<Wrench className="h-4 w-4" />}>
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 text-sm">
                  <div>
                    <p className="font-bold">{t.title ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.createdAt?.slice(0, 10).split('-').reverse().join('/')} · {t.priority ?? '—'}
                    </p>
                  </div>
                  <Badge className={cn('text-[10px] font-bold border shrink-0', TICKET_COLOR[t.status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Mora notifications */}
        {notifications.length > 0 && (
          <Section title="Notificaciones de Mora Enviadas" icon={<Bell className="h-4 w-4 text-red-600" />}>
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="p-3 rounded-xl border border-red-200 bg-red-50/50 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-red-900">{fmtDate(n.sentAt)}</p>
                    <p className="text-xs font-bold text-red-700">{n.daysOverdue ?? 0} días vencidos</p>
                  </div>
                  <p className="text-xs text-red-800">
                    Deuda: {fmtMoney(n.totalOverdue ?? 0, contract.currency)}
                    {n.penalty ? ` + recargo estimado ${fmtMoney(n.penalty, contract.currency)}` : ''}
                  </p>
                  {n.notes && <p className="text-[10px] text-red-700 italic">"{n.notes}"</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Legal footer */}
        <div className="rounded-xl bg-muted/40 border p-4 text-[10px] text-muted-foreground space-y-1 leading-relaxed">
          <p className="font-bold text-xs text-foreground">Nota legal</p>
          <p>
            Este legajo es generado por AlquilaGestion Pro y contiene la información registrada en el sistema al momento de su consulta.
            Las firmas electrónicas tienen validez legal conforme a la <strong>Ley 25.506 (Argentina) — Firma Electrónica Simple</strong>.
            La notarización en blockchain provee evidencia adicional de fecha cierta e inmutabilidad del hash del documento.
          </p>
          <p>
            Para verificación independiente, el hash del documento y el TX hash pueden ser consultados en PolygonScan
            sin necesidad de acceso a este sistema.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, icon, badge, children }: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-sm flex items-center gap-2 text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </div>
  );
}
