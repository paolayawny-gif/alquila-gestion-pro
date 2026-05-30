
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus,
  Search,
  Sparkles,
  Loader2,
  Trash2,
  Eye,
  FileSearch,
  CreditCard,
  CalendarCheck,
  Zap,
  Info,
  UserCheck,
  UserMinus,
  CheckCircle2,
  FileText,
  TrendingUp,
  FileUp,
  Send,
  AlertCircle,
  UploadCloud,
  FileCheck,
  MessageSquare,
  Gavel,
  Download,
  Sheet,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/export-utils';
import { formatCurrency } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, Contract, ChargeType, ChargePayer, ChargeItem, Person, Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { sendEmail } from '@/services/email-service';
import { useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { doc, query, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { writePropertyEvent } from '@/lib/property-events';
import { uploadReceiptToStorage } from '@/lib/upload-receipt';

// ── Prose email templates ─────────────────────────────────────────────────────

function buildTenantLiquidacionHtml({ tenantName, propertyName, period, rentAmount, prevInterest, dueDate, currency, cbuLine }: {
  tenantName: string; propertyName: string; period: string;
  rentAmount: number; prevInterest: number; dueDate: string;
  currency: 'ARS' | 'USD' | 'UVA'; cbuLine: string | null;
}): string {
  const sym = currency === 'USD' ? 'U$D' : currency === 'UVA' ? 'UVA' : '$';
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR')}`;
  const total = rentAmount + prevInterest;
  const overdueBlock = prevInterest > 0
    ? `<p style="margin:12px 0;">Asimismo, registramos intereses por mora de períodos anteriores por un total de <strong>${fmt(prevInterest)}</strong>, los cuales deberán abonarse junto con el presente período.</p>`
    : '';
  const cbuBlock = cbuLine
    ? `<p style="margin:12px 0;">Para realizar el pago por transferencia bancaria, le informamos los siguientes datos:</p><p style="background:#f5f5f5;padding:10px 14px;border-radius:6px;font-family:monospace;font-size:13px;margin:8px 0;">${cbuLine}</p>`
    : '';
  const totalLabel = prevInterest > 0 ? 'total a abonar (alquiler + mora)' : 'importe a abonar';
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="color:#1a1a2e;margin-bottom:4px;">Liquidación de alquiler — ${period}</h2>
  <p style="color:#666;font-size:13px;margin-top:0;margin-bottom:20px;">${propertyName}</p>
  <p>Estimado/a <strong>${tenantName}</strong>:</p>
  <p>Le escribimos para informarle la liquidación de alquiler correspondiente al período <strong>${period}</strong>, con vencimiento el día <strong>${dueDate}</strong>.</p>
  <p>El ${totalLabel} es de <strong style="font-size:16px;color:#2e7d32;">${fmt(total)}</strong>.</p>
  ${overdueBlock}
  ${cbuBlock}
  <div style="background:#e3f2fd;border-left:4px solid #90caf9;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;">
    <p style="margin:0;font-size:12px;color:#1565c0;"><strong>Nota fiscal:</strong> Conforme a la RG AFIP N° 1415/03, la factura fiscal será emitida en el momento en que se perciba su pago o al vencimiento del plazo (${dueDate}), lo que ocurra primero.</p>
  </div>
  <p>Ante cualquier consulta, no dude en comunicarse con nuestra administración.</p>
  <p>Atentamente,<br/><strong>Administración</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:10px;color:#aaa;">Aviso automático. Por favor no responda a este correo.</p>
</div>`;
}

function buildOwnerLiquidacionHtml({ ownerName, propertyName, tenantName, period, rentAmount, prevInterest, dueDate, currency }: {
  ownerName: string; propertyName: string; tenantName: string; period: string;
  rentAmount: number; prevInterest: number; dueDate: string; currency: 'ARS' | 'USD' | 'UVA';
}): string {
  const sym = currency === 'USD' ? 'U$D' : currency === 'UVA' ? 'UVA' : '$';
  const fmt = (n: number) => `${sym} ${n.toLocaleString('es-AR')}`;
  const total = rentAmount + prevInterest;
  const overdueBlock = prevInterest > 0
    ? `<p style="margin:12px 0;">Se registran además intereses por mora de períodos anteriores por <strong>${fmt(prevInterest)}</strong>, que se suman al total a cobrar.</p>`
    : '';
  const totalLabel = prevInterest > 0 ? 'total a cobrar (alquiler + mora)' : 'importe del alquiler';
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
  <h2 style="color:#1a1a2e;margin-bottom:4px;">Liquidación mensual — ${period}</h2>
  <p style="color:#666;font-size:13px;margin-top:0;margin-bottom:20px;">${propertyName}</p>
  <p>Estimado/a <strong>${ownerName}</strong>:</p>
  <p>Le informamos que se ha generado la liquidación del período <strong>${period}</strong> para su propiedad <strong>${propertyName}</strong>. El inquilino <strong>${tenantName}</strong> ha sido notificado y cuenta con plazo hasta el <strong>${dueDate}</strong> para efectuar el pago.</p>
  <p>El ${totalLabel} asciende a <strong style="font-size:16px;color:#2e7d32;">${fmt(total)}</strong>.</p>
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

interface InvoicesViewProps {
  invoices: Invoice[];
  userId?: string;
  contracts: Contract[];
  properties?: Property[];
  people?: Person[];
}

const CHARGE_TYPES: ChargeType[] = ['Alquiler', 'Expensa Ordinaria', 'Expensa Extraordinaria', 'TGI/ABL', 'Aguas', 'Luz/Gas', 'Otros'];

export function InvoicesView({ invoices, userId, contracts, properties = [], people = [] }: InvoicesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { canWrite, canDelete } = useOrgPermissions();
  const arcaInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isGeneratingRent, setIsGeneratingRent] = useState(false);
  const [uploadingArcaFor, setUploadingArcaFor] = useState<string | null>(null);
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<string | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvingInvoices, setApprovingInvoices] = useState(false);
  const [showGeneratePreview, setShowGeneratePreview] = useState(false);

  const [isLateFeeDialogOpen, setIsLateFeeDialogOpen] = useState(false);
  const [selectedInvForFee, setSelectedInvForFee] = useState<Invoice | null>(null);
  const [manualFeeInput, setManualFeeInput] = useState<number>(0);

  const [isReceiptConfirmDialogOpen, setIsReceiptConfirmDialogOpen] = useState(false);
  const [receiptNote, setReceiptNote] = useState('');
  const [tempReceiptFile, setTempReceiptFile] = useState<{ url: string, name: string } | null>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkMarkPaid = async () => {
    if (!userId || !db || selectedIds.size === 0) return;
    setBulkProcessing(true);
    const now = new Date().toLocaleDateString('es-AR');
    for (const id of selectedIds) {
      const inv = invoices.find(i => i.id === id);
      if (!inv || inv.status === 'Pagado') continue;
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', id);
      setDocumentNonBlocking(docRef, { status: 'Pagado', paymentDate: now }, { merge: true });
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    toast({ title: 'Pagos registrados', description: `${selectedIds.size} facturas marcadas como pagadas.` });
  };

  const handleBulkSendReminder = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const selected = invoices.filter(i => selectedIds.has(i.id) && i.tenantEmail && i.status !== 'Pagado');
    const emailPromises = selected.map(inv =>
      sendEmail({
        to: inv.tenantEmail!,
        subject: `Recordatorio de pago pendiente — ${inv.period ?? ''}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
          <h2 style="color:#1D9E75;">Recordatorio de pago</h2>
          <p>Estimado/a <strong>${inv.tenantName}</strong>,</p>
          <p>Le recordamos que tiene un pago pendiente correspondiente al período <strong>${inv.period ?? ''}</strong> de la propiedad <strong>${inv.propertyName}</strong> por un monto de <strong>${formatCurrency(inv.totalAmount, { currency: inv.currency ?? 'ARS' })}</strong> con vencimiento el <strong>${inv.dueDate}</strong>.</p>
          <p>Por favor regularice su situación a la brevedad posible.</p>
          <p>Atentamente,<br/><strong>Administración</strong></p>
        </div>`,
      }).catch(() => {})
    );
    await Promise.allSettled(emailPromises);
    setBulkProcessing(false);
    setSelectedIds(new Set());
    toast({ title: 'Recordatorios enviados', description: `${selected.length} email${selected.length !== 1 ? 's' : ''} enviado${selected.length !== 1 ? 's' : ''}.` });
  };

  const handleBulkExport = () => {
    const selected = filteredInvoices.filter(i => selectedIds.has(i.id));
    const cols = [
      { header: 'Inquilino',   key: 'tenantName', width: 24 },
      { header: 'Propiedad',   key: 'propertyName', width: 28 },
      { header: 'Período',     key: 'period', width: 18 },
      { header: 'Vencimiento', key: 'dueDate', width: 16 },
      { header: 'Moneda',      key: 'currency', width: 10 },
      { header: 'Total',       key: 'total', width: 14 },
      { header: 'Estado',      key: 'status', width: 18 },
    ];
    const rows = selected.map(i => ({
      tenantName: i.tenantName ?? '—', propertyName: i.propertyName ?? '—',
      period: i.period ?? '—', dueDate: i.dueDate ?? '—',
      currency: i.currency ?? 'ARS', total: i.totalAmount?.toLocaleString('es-AR') ?? '0',
      status: i.status ?? '—',
    }));
    exportToExcel('Facturas seleccionadas', cols, rows, `facturas_sel_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`);
    setSelectedIds(new Set());
  };

  // ── Filtros avanzados ──────────────────────────────────────────────────────
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus,   setFilterStatus]   = useState<Invoice['status'] | ''>('');

  const nextMonthLabel = React.useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, []);

  const nextMonthDueDate = React.useMemo(() => {
    const today = new Date();
    const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return new Date(nm.getFullYear(), nm.getMonth(), 10).toLocaleDateString('es-AR');
  }, []);

  const pendingApprovalInvoices = invoices.filter(i => i.pendingApproval === true);

  const contractsToProcess = React.useMemo(() =>
    contracts.filter(c => {
      if (c.status !== 'Vigente') return false;
      return !invoices.find(i => i.contractId === c.id && i.period === nextMonthLabel && i.charges.some(ch => ch.type === 'Alquiler'));
    }),
    [contracts, invoices, nextMonthLabel]
  );

  // Day-28/29 liquidación reminder
  const [showLiquidacionReminder, setShowLiquidacionReminder] = useState(false);
  useEffect(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysUntilMonthEnd = lastDayOfMonth - today.getDate();
    if (daysUntilMonthEnd <= 2) {
      const nextMonthAlreadyGenerated = invoices.some(i => i.period === nextMonthLabel && i.charges.some(c => c.type === 'Alquiler'));
      setShowLiquidacionReminder(!nextMonthAlreadyGenerated && contracts.some(c => c.status === 'Vigente'));
    }
  }, [invoices, contracts, nextMonthLabel]);

  // Auto-trigger ARCA request when invoice reaches due date unpaid
  useEffect(() => {
    if (!db || !userId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach(inv => {
      if (inv.status !== 'Pendiente' && inv.status !== 'Vencido') return;
      if (!inv.ownerEmail || inv.ownerNotifiedAt) return;
      if (!inv.charges?.some(c => c.type === 'Alquiler')) return;

      // Parse dueDate (dd/MM/yyyy)
      const parts = (inv.dueDate ?? '').split('/');
      if (parts.length !== 3) return;
      const due = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      due.setHours(0, 0, 0, 0);
      if (due > today) return;

      // Mark as Vencido and notify owner
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
      setDocumentNonBlocking(docRef, { status: 'Vencido', ownerNotifiedAt: new Date().toISOString() }, { merge: true });

      const totalAmt = (inv.totalAmount ?? 0) + (inv.lateFees ?? 0);
      const currency = inv.currency === 'USD' ? 'U$D' : '$';
      sendEmail({
        to: inv.ownerEmail,
        subject: `Vencimiento de alquiler — Emití tu factura ARCA (${inv.period ?? ''})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#c0392b;">Vencimiento del plazo de pago</h2>
            <p>Se cumplió el vencimiento pactado (<strong>${inv.dueDate}</strong>) para el alquiler del período <strong>${inv.period ?? ''}</strong> de la propiedad <strong>${inv.propertyName ?? ''}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Inquilino</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${inv.tenantName ?? ''}</td></tr>
              <tr><td style="padding:8px 12px;font-size:13px;">Monto total</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${currency} ${totalAmt.toLocaleString('es-AR')}</td></tr>
            </table>
            <div style="background:#fef9ec;border:1px solid #f5c842;border-radius:8px;padding:14px;margin:16px 0;">
              <p style="margin:0;font-size:12px;color:#856404;"><strong>📋 RG AFIP 1415/03:</strong> Habiéndose cumplido el vencimiento del plazo de pago sin recepción del importe, corresponde emitir la factura ARCA. Ingresá a <strong>arca.afip.gob.ar</strong>, emití el comprobante por ${currency} ${totalAmt.toLocaleString('es-AR')} (alquiler${inv.lateFees ? ' + intereses' : ''}), y subí el PDF desde tu Portal Propietario.</p>
            </div>
            <p style="font-size:11px;color:#aaa;margin-top:24px;">Aviso automático del sistema de administración. No respondas este correo.</p>
          </div>
        `,
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, db]);

  const informedPayments = invoices.filter(i => i.status === 'Pago Informado');
  const ownerSubmissions = invoices.filter(i => i.isFromOwner && i.status === 'Esperando Factura ARCA');

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter(i => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!(i.tenantName ?? '').toLowerCase().includes(q) && !(i.propertyName ?? '').toLowerCase().includes(q) && !(i.period ?? '').toLowerCase().includes(q)) return false;
      }
      if (filterProperty && i.propertyId !== filterProperty) return false;
      if (filterStatus && i.status !== filterStatus) return false;
      if (filterDateFrom && i.dueDate) {
        const due = new Date(i.dueDate);
        if (!isNaN(due.getTime()) && due < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo && i.dueDate) {
        const due = new Date(i.dueDate);
        if (!isNaN(due.getTime()) && due > new Date(filterDateTo)) return false;
      }
      return true;
    });
  }, [invoices, filterSearch, filterProperty, filterStatus, filterDateFrom, filterDateTo]);

  const [manualCharge, setManualCharge] = useState({
    contractId: '',
    type: 'Expensa Ordinaria' as ChargeType,
    description: '',
    amount: 0,
    imputedTo: 'Inquilino' as ChargePayer,
    period: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0]
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const styles: Record<string, string> = {
      'Pagado': 'bg-green-100 text-green-700 border-green-200',
      'Vencido': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
      'Pago Informado': 'bg-blue-100 text-blue-700 border-blue-200',
      'Esperando Factura ARCA': 'bg-purple-100 text-purple-700 border-purple-200',
      'En Verificación con Propietario': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Anulado': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>{status}</Badge>;
  };

  const calculateInterest = (inv: Invoice) => {
    if (inv.lateFees > 0) return inv.lateFees;

    const contract = contracts.find(c => c.id === inv.contractId);
    if (!contract || !contract.lateFeePercentage) return 0;

    const [day, month, year] = inv.dueDate.split('/');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();

    if (today > dueDate && inv.status !== 'Pagado') {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return (inv.totalAmount * (contract.lateFeePercentage / 100)) * diffDays;
    }
    return 0;
  };

  const handleSaveManualFee = () => {
    if (!selectedInvForFee || !userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', selectedInvForFee.id);
    setDocumentNonBlocking(docRef, { lateFees: manualFeeInput }, { merge: true });
    setIsLateFeeDialogOpen(false);
    toast({ title: "Punitorio Actualizado", description: "Se ha registrado el monto manual de intereses." });
  };

  const handleGenerateMonthlyRent = async () => {
    if (!userId || !db) return;
    setIsGeneratingRent(true);
    const now = new Date().toISOString();
    let count = 0;
    const emailPromises: Promise<any>[] = [];

    contractsToProcess.forEach(contract => {
      const docId = Math.random().toString(36).substr(2, 9);
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);

      const property = properties.find(p => p.id === contract.propertyId);
      const ownerEmail = property?.owners?.[0]?.email ?? '';
      const ownerName = property?.owners?.[0]?.name ?? 'Propietario';

      const ownerPerson = people?.find(p => p.email === ownerEmail);
      const bankInfo = ownerPerson?.bankDetails;
      const cbuLine = bankInfo?.cbu
        ? `CBU: ${bankInfo.cbu}${bankInfo.alias ? ` · Alias: ${bankInfo.alias}` : ''}${bankInfo.bank ? ` (${bankInfo.bank})` : ''}`
        : null;

      const prevInterest = invoices
        .filter(i => i.contractId === contract.id && i.status !== 'Pagado' && i.status !== 'Anulado' && i.period !== nextMonthLabel)
        .reduce((acc, i) => acc + (i.lateFees ?? 0), 0);

      const sendLog: Array<{ ts: string; to: string; type: string }> = [];

      const invoiceData: Invoice = {
        id: docId,
        contractId: contract.id,
        tenantName: contract.tenantName || 'Inquilino',
        tenantEmail: contract.tenantEmail ?? '',
        propertyName: contract.propertyName || 'Propiedad',
        propertyId: contract.propertyId,
        ownerEmail,
        ownerCbu: bankInfo?.cbu ?? '',
        ownerAlias: bankInfo?.alias ?? '',
        ownerBank: bankInfo?.bank ?? '',
        period: nextMonthLabel,
        charges: [{
          id: 'rent-charge',
          type: 'Alquiler',
          description: `Alquiler mensual - ${nextMonthLabel}`,
          amount: contract.currentRentAmount,
          imputedTo: 'Inquilino',
        }],
        lateFees: 0,
        totalAmount: contract.currentRentAmount,
        currency: contract.currency,
        dueDate: nextMonthDueDate,
        status: 'Pendiente',
        liquidacionEnviadaAt: now,
      };
      setDocumentNonBlocking(docRef, invoiceData, { merge: true });
      count++;

      if (contract.tenantEmail) {
        sendLog.push({ ts: now, to: contract.tenantEmail, type: 'tenant' });
        emailPromises.push(
          sendEmail({
            to: contract.tenantEmail,
            subject: `Liquidación de alquiler ${nextMonthLabel} — ${contract.propertyName ?? ''}`,
            html: buildTenantLiquidacionHtml({
              tenantName: contract.tenantName ?? 'Inquilino',
              propertyName: contract.propertyName ?? 'Propiedad',
              period: nextMonthLabel,
              rentAmount: contract.currentRentAmount,
              prevInterest,
              dueDate: nextMonthDueDate,
              currency: contract.currency,
              cbuLine,
            }),
          }).catch(() => {})
        );
      }

      if (ownerEmail) {
        sendLog.push({ ts: now, to: ownerEmail, type: 'owner' });
        emailPromises.push(
          sendEmail({
            to: ownerEmail,
            subject: `Liquidación ${nextMonthLabel} — ${contract.propertyName ?? ''}`,
            html: buildOwnerLiquidacionHtml({
              ownerName,
              propertyName: contract.propertyName ?? 'Propiedad',
              tenantName: contract.tenantName ?? 'Inquilino',
              period: nextMonthLabel,
              rentAmount: contract.currentRentAmount,
              prevInterest,
              dueDate: nextMonthDueDate,
              currency: contract.currency,
            }),
          }).catch(() => {})
        );
      }

      if (sendLog.length > 0) {
        setDocumentNonBlocking(docRef, { sendLog }, { merge: true });
      }
    });

    Promise.allSettled(emailPromises);
    setIsGeneratingRent(false);
    setShowGeneratePreview(false);
    setShowLiquidacionReminder(false);
    toast({
      title: 'Liquidaciones generadas',
      description: `${count} factura${count !== 1 ? 's' : ''} para ${nextMonthLabel}. Se notificó a inquilinos y propietarios por email.`,
    });
  };

  const handleApproveAndSend = async () => {
    if (!userId || !db) return;
    setApprovingInvoices(true);
    const now = new Date().toISOString();
    const emailPromises: Promise<any>[] = [];

    for (const inv of pendingApprovalInvoices) {
      const property = properties.find(p => p.id === inv.propertyId);
      const ownerName = property?.owners?.[0]?.name ?? 'Propietario';

      const ownerPerson = people?.find(p => p.email === inv.ownerEmail);
      const bankInfo = ownerPerson?.bankDetails;
      const cbuLine = bankInfo?.cbu
        ? `CBU: ${bankInfo.cbu}${bankInfo.alias ? ` · Alias: ${bankInfo.alias}` : ''}${bankInfo.bank ? ` (${bankInfo.bank})` : ''}`
        : null;

      const prevInterest = invoices
        .filter(i => i.contractId === inv.contractId && i.status !== 'Pagado' && i.status !== 'Anulado' && i.period !== inv.period)
        .reduce((acc, i) => acc + (i.lateFees ?? 0), 0);

      const rentAmount = inv.charges?.find(c => c.type === 'Alquiler')?.amount ?? inv.totalAmount;
      const currency = (inv.currency ?? 'ARS') as 'ARS' | 'USD';
      const sendLog: Array<{ ts: string; to: string; type: string }> = [];

      if (inv.tenantEmail) {
        sendLog.push({ ts: now, to: inv.tenantEmail, type: 'tenant' });
        emailPromises.push(
          sendEmail({
            to: inv.tenantEmail,
            subject: `Liquidación de alquiler ${inv.period} — ${inv.propertyName}`,
            html: buildTenantLiquidacionHtml({
              tenantName: inv.tenantName,
              propertyName: inv.propertyName,
              period: inv.period,
              rentAmount,
              prevInterest,
              dueDate: inv.dueDate,
              currency,
              cbuLine,
            }),
          }).catch(() => {})
        );
      }

      if (inv.ownerEmail) {
        sendLog.push({ ts: now, to: inv.ownerEmail, type: 'owner' });
        emailPromises.push(
          sendEmail({
            to: inv.ownerEmail,
            subject: `Liquidación ${inv.period} — ${inv.propertyName}`,
            html: buildOwnerLiquidacionHtml({
              ownerName,
              propertyName: inv.propertyName,
              tenantName: inv.tenantName,
              period: inv.period,
              rentAmount,
              prevInterest,
              dueDate: inv.dueDate,
              currency,
            }),
          }).catch(() => {})
        );
      }

      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', inv.id);
      setDocumentNonBlocking(docRef, {
        pendingApproval: false,
        liquidacionEnviadaAt: now,
        sendLog,
        ownerCbu: bankInfo?.cbu ?? '',
        ownerAlias: bankInfo?.alias ?? '',
        ownerBank: bankInfo?.bank ?? '',
      }, { merge: true });
    }

    await Promise.allSettled(emailPromises);
    setApprovingInvoices(false);
    setShowApprovalDialog(false);
    toast({
      title: 'Liquidaciones enviadas',
      description: `Se notificó a inquilinos y propietarios de ${pendingApprovalInvoices.length} factura${pendingApprovalInvoices.length !== 1 ? 's' : ''}.`,
    });
  };

  const handleUploadArca = (invId: string) => {
    setUploadingArcaFor(invId);
    arcaInputRef.current?.click();
  };

  const handleUploadReceipt = (invId: string) => {
    setUploadingReceiptFor(invId);
    receiptInputRef.current?.click();
  };

  const handleArcaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingArcaFor || !userId || !db) return;

    try {
      const result = await uploadReceiptToStorage(storage, file, userId, `arca_${uploadingArcaFor}`);
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', uploadingArcaFor);
      setDocumentNonBlocking(docRef, {
        arcaInvoiceUrl: result.url,
        arcaInvoiceName: file.name,
        status: 'Esperando Factura ARCA',
      }, { merge: true });
      toast({ title: "Factura Cargada", description: "El documento ARCA ha sido vinculado." });
    } catch {
      toast({ title: "Error al subir", description: "No se pudo cargar el archivo.", variant: "destructive" });
    }
    setUploadingArcaFor(null);
    if (arcaInputRef.current) arcaInputRef.current.value = '';
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingReceiptFor) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setTempReceiptFile({
        url: event.target?.result as string,
        name: file.name
      });
      setIsReceiptConfirmDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmReceipt = () => {
    if (!tempReceiptFile || !uploadingReceiptFor || !userId || !db) return;

    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', uploadingReceiptFor);
    setDocumentNonBlocking(docRef, {
      paymentReceiptUrl: tempReceiptFile.url,
      paymentReceiptName: tempReceiptFile.name,
      status: 'Pagado',
      paymentDate: new Date().toLocaleDateString('es-AR'),
      internalNotes: receiptNote,
    }, { merge: true });

    const paidInv = invoices.find(i => i.id === uploadingReceiptFor);
    if (paidInv?.propertyId) {
      writePropertyEvent(db, userId, {
        propertyId: paidInv.propertyId,
        propertyName: paidInv.propertyName,
        type: 'invoice_paid',
        title: `Pago registrado — ${paidInv.tenantName}`,
        detail: `Período: ${paidInv.period}${receiptNote ? ` · ${receiptNote}` : ''}`,
        actor: 'Administración',
        actorRole: 'admin',
        ts: Date.now(),
        metadata: { amount: paidInv.totalAmount, currency: paidInv.currency, period: paidInv.period, invoiceId: paidInv.id, contractId: paidInv.contractId },
      });
    }

    // Notify property owner to emit ARCA invoice for rent charges
    if (paidInv?.ownerEmail && paidInv.charges?.some(c => c.type === 'Alquiler')) {
      const amount = paidInv.totalAmount?.toLocaleString('es-AR') ?? '—';
      const currency = paidInv.currency === 'USD' ? 'U$D' : '$';
      sendEmail({
        to: paidInv.ownerEmail,
        subject: `Pago de alquiler confirmado — Emití tu factura ARCA`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1a1a2e;">Pago de alquiler confirmado ✓</h2>
            <p>Se registró el pago del período <strong>${paidInv.period ?? ''}</strong> de la propiedad <strong>${paidInv.propertyName ?? ''}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Inquilino</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${paidInv.tenantName ?? ''}</td></tr>
              <tr><td style="padding:8px 12px;font-size:13px;">Período</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${paidInv.period ?? ''}</td></tr>
              <tr style="background:#f5f5f5;"><td style="padding:8px 12px;font-size:13px;">Monto</td><td style="padding:8px 12px;font-size:13px;font-weight:bold;">${currency} ${amount}</td></tr>
            </table>
            <div style="background:#fef9ec;border:1px solid #f5c842;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0 0 8px;font-weight:bold;color:#856404;">📄 Acción requerida: emití tu factura ARCA</p>
              <ol style="margin:0;padding-left:20px;font-size:13px;color:#555;">
                <li>Ingresá a <strong>arca.afip.gob.ar</strong> con tu CUIL y clave fiscal.</li>
                <li>En <em>Comprobantes Online</em>, emití la factura por el alquiler de este período.</li>
                <li>Descargá el PDF de la factura.</li>
                <li>Subí el PDF desde tu <strong>Portal Propietario → Facturas</strong>.</li>
              </ol>
            </div>
            <p style="font-size:12px;color:#888;">Aviso automático del sistema de administración. No respondas este correo.</p>
          </div>
        `,
      }).catch(() => {}); // best-effort
    }

    toast({ title: "Pago Registrado", description: "Comprobante cargado exitosamente." });
    setIsReceiptConfirmDialogOpen(false);
    setTempReceiptFile(null);
    setUploadingReceiptFor(null);
    setReceiptNote('');
  };

  const handleSendFormalInvoice = async (inv: Invoice) => {
    if (!userId || !db) return;
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'generalMessage',
        tenantName: inv.tenantName,
        propertyName: inv.propertyName,
        additionalContext: `Se remite el comprobante fiscal formal por ${inv.period} (${formatCurrency(inv.totalAmount, { currency: inv.currency ?? 'ARS' })}). El mismo ya se encuentra disponible en su portal.`
      });

      const tenant = people?.find(p => p.fullName === inv.tenantName);
      if (tenant?.email) {
        await sendEmail({
          to: tenant.email,
          subject: draft.subjectLine,
          html: `<div style="text-align: justify;">${draft.draftedMessage.replace(/\n/g, '<br/>')}</div><br/><p>Puede ver y descargar su factura desde su portal personal.</p>`
        });
        toast({ title: "Email Enviado", description: "El inquilino ha sido notificado formalmente." });
      }
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar el correo.", variant: "destructive" });
    }
  };

  const handleValidatePayment = (inv: Invoice) => {
    if (!userId || !db) return;
    setUploadingReceiptFor(inv.id);
    setIsReceiptConfirmDialogOpen(true);
  };

  const handleSaveManualCharge = () => {
    if (!manualCharge.contractId || !userId || !db) return;
    const contract = contracts.find(c => c.id === manualCharge.contractId);
    if (!contract) return;

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', docId);

    // Resolve owner email from property owners list
    const property = properties.find(p => p.id === contract.propertyId);
    const ownerEmail = property?.owners?.[0]?.email ?? '';

    const invoiceData: Invoice = {
      id: docId,
      contractId: contract.id,
      tenantName: contract.tenantName || 'Inquilino',
      tenantEmail: contract.tenantEmail ?? '',
      propertyName: contract.propertyName || 'Propiedad',
      propertyId: contract.propertyId,
      ownerEmail,
      period: manualCharge.period,
      charges: [{
        id: Math.random().toString(36).substr(2, 9),
        type: manualCharge.type,
        description: manualCharge.description || `${manualCharge.type}`,
        amount: manualCharge.amount,
        imputedTo: manualCharge.imputedTo
      }],
      lateFees: 0,
      totalAmount: manualCharge.imputedTo === 'Inquilino' ? manualCharge.amount : 0,
      currency: contract.currency,
      dueDate: manualCharge.dueDate,
      status: 'Pendiente'
    };

    setDocumentNonBlocking(docRef, invoiceData, { merge: true });
    writePropertyEvent(db, userId, {
      propertyId: contract.propertyId,
      propertyName: contract.propertyName ?? '',
      type: 'invoice_created',
      title: `Factura emitida — ${contract.tenantName}`,
      detail: `${manualCharge.type}${manualCharge.description ? ` · ${manualCharge.description}` : ''} · Período: ${manualCharge.period}`,
      actor: 'Administración',
      actorRole: 'admin',
      ts: Date.now(),
      metadata: { amount: manualCharge.amount, currency: contract.currency, period: manualCharge.period, invoiceId: docId, contractId: contract.id },
    });
    setIsManualDialogOpen(false);
    toast({ title: "Cargo Generado", description: "El concepto ha sido registrado." });

    // Notify tenant by email if the charge is for them and we have their email
    if (manualCharge.imputedTo === 'Inquilino' && contract.tenantEmail) {
      aiCommunicationAssistant({
        communicationType: 'generalMessage',
        tenantName: contract.tenantName ?? 'Inquilino',
        propertyName: contract.propertyName ?? 'Propiedad',
        amountDue: `${contract.currency} ${manualCharge.amount.toLocaleString('es-AR')}`,
        dueDate: manualCharge.dueDate,
        additionalContext: `Se ha registrado un nuevo cargo en tu cuenta: ${manualCharge.type}${manualCharge.description ? ` — ${manualCharge.description}` : ''} por ${contract.currency} ${manualCharge.amount.toLocaleString('es-AR')}. Vencimiento: ${manualCharge.dueDate}. El detalle ya está disponible en tu portal.`,
      }).then(draft =>
        sendEmail({
          to: contract.tenantEmail!,
          subject: draft.subjectLine,
          html: `<div style="text-align:justify;">${draft.draftedMessage.replace(/\n/g, '<br/>')}</div>`,
        })
      ).catch(() => {}); // best-effort
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const cols = [
      { header: 'Inquilino',   key: 'tenantName', width: 24 },
      { header: 'Propiedad',   key: 'propertyName', width: 28 },
      { header: 'Período',     key: 'period', width: 18 },
      { header: 'Vencimiento', key: 'dueDate', width: 16 },
      { header: 'Moneda',      key: 'currency', width: 10 },
      { header: 'Total',       key: 'total', width: 14 },
      { header: 'Estado',      key: 'status', width: 18 },
    ];
    const rows = filteredInvoices.map(i => ({
      tenantName:   i.tenantName ?? '—',
      propertyName: i.propertyName ?? '—',
      period:       i.period ?? '—',
      dueDate:      i.dueDate ?? '—',
      currency:     i.currency ?? 'ARS',
      total:        i.totalAmount?.toLocaleString('es-AR') ?? '0',
      status:       i.status ?? '—',
    }));
    const filename = `facturas_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`;
    if (format === 'pdf') {
      exportToPDF('Facturas y Servicios', `${filteredInvoices.length} registros exportados`, cols, rows, filename);
    } else {
      exportToExcel('Facturas', cols, rows, filename);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <input type="file" ref={arcaInputRef} className="hidden" accept=".pdf,image/*" onChange={handleArcaFileChange} />
      <input type="file" ref={receiptInputRef} className="hidden" accept=".pdf,image/*" onChange={handleReceiptFileChange} />

      {/* Pending cron approval banner */}
      {pendingApprovalInvoices.length > 0 && canWrite && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-blue-800">
              {pendingApprovalInvoices.length} liquidación{pendingApprovalInvoices.length !== 1 ? 'es' : ''} esperando tu aprobación
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              El sistema generó las facturas del mes próximo. Revisalas y aprobá el envío de correos a inquilinos y propietarios.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0"
            onClick={() => setShowApprovalDialog(true)}
          >
            Revisar y enviar
          </Button>
        </div>
      )}

      {/* Day-28/29 liquidación reminder banner */}
      {showLiquidacionReminder && canWrite && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-amber-800">Es momento de generar las liquidaciones del próximo mes</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Faltan {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} días para fin de mes.
              Se enviarán correos al inquilino (con CBU y vencimiento) y al propietario (con nota sobre emisión ARCA).
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0"
            onClick={() => setShowGeneratePreview(true)}
            disabled={isGeneratingRent}
          >
            {isGeneratingRent ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generar y enviar'}
          </Button>
          <button onClick={() => setShowLiquidacionReminder(false)} className="text-amber-400 hover:text-amber-600 text-xs ml-1">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-200 border shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /><p className="text-xs font-black text-blue-700 uppercase tracking-tight">Pagos Informados (Inquilinos)</p></div>
            {informedPayments.length === 0 && <p className="text-[10px] text-muted-foreground italic">Sin pagos nuevos.</p>}
            {informedPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm">
                <span className="font-bold truncate max-w-[100px]">{p.tenantName}</span>
                <div className="flex gap-1">
                  {p.paymentReceiptUrl && <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => window.open(p.paymentReceiptUrl)} title="Ver Transferencia"><Eye className="h-4 w-4" /></Button>}
                  <Button size="sm" className="h-7 bg-blue-600 text-white text-[10px] px-3 font-bold" onClick={() => handleValidatePayment(p)}>Validar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200 border shadow-none md:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" /><p className="text-xs font-black text-purple-700 uppercase tracking-tight">Pendiente Digitalización (Dueños / Propios)</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownerSubmissions.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm border-l-4 border-l-purple-500">
                  <div className="flex flex-col">
                    <span className="font-bold truncate max-w-[120px]">{p.propertyName}</span>
                    <span className="text-[9px] text-muted-foreground">Cargado por Dueño</span>
                  </div>
                  <div className="flex gap-1">
                    {p.arcaInvoiceUrl && <Button size="icon" variant="ghost" className="h-7 w-7 text-purple-600" onClick={() => window.open(p.arcaInvoiceUrl)} title="Ver Documento"><Eye className="h-4 w-4" /></Button>}
                    <Button size="sm" variant="outline" className="h-7 border-purple-600 text-purple-600 text-[10px] gap-1 font-bold" onClick={() => handleSendFormalInvoice(p)}>Notificar</Button>
                  </div>
                </div>
              ))}
              {invoices.filter(i => i.charges.some(c => c.type === 'Alquiler') && !i.arcaInvoiceUrl && i.status !== 'Pagado' && !i.isFromOwner).slice(0, 2).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs shadow-sm">
                  <span className="font-bold truncate max-w-[100px]">{p.tenantName}</span>
                  <Button size="sm" variant="outline" className="h-7 border-purple-600 text-purple-600 text-[10px] gap-1 font-bold" onClick={() => handleUploadArca(p.id)}><FileUp className="h-3 w-3" /> Subir ARCA</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por inquilino, unidad o período…" aria-label="Buscar facturas" className="pl-9 h-9 border bg-muted/30 text-sm" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
          </div>
          <Select value={filterProperty || 'all'} onValueChange={v => setFilterProperty(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue placeholder="Todas las propiedades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las propiedades</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus || 'all'} onValueChange={(v: any) => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="Pendiente">Pendiente</SelectItem>
              <SelectItem value="Pagado">Pagado</SelectItem>
              <SelectItem value="Vencido">Vencido</SelectItem>
              <SelectItem value="Pago Informado">Pago Informado</SelectItem>
              <SelectItem value="En Verificación con Propietario">En Verificación</SelectItem>
              <SelectItem value="Anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input type="date" className="h-9 text-sm w-[140px]" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} aria-label="Vencimiento desde" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" className="h-9 text-sm w-[140px]" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} aria-label="Vencimiento hasta" />
          </div>
          {(filterSearch || filterProperty || filterStatus || filterDateFrom || filterDateTo) && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setFilterSearch(''); setFilterProperty(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
              Limpiar filtros
            </Button>
          )}
        </div>
        {filteredInvoices.length !== invoices.length && (
          <p className="text-[10px] text-muted-foreground">Mostrando {filteredInvoices.length} de {invoices.length} facturas</p>
        )}
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleExport('pdf')} disabled={filteredInvoices.length === 0} aria-label="Exportar PDF">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleExport('excel')} disabled={filteredInvoices.length === 0} aria-label="Exportar Excel">
              <Sheet className="h-3.5 w-3.5" aria-hidden="true" /> Excel
            </Button>
          </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {canWrite && (
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 gap-2 font-bold" onClick={() => setShowGeneratePreview(true)} disabled={isGeneratingRent}>
              {isGeneratingRent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Generar Mensuales
            </Button>
          )}

          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            {canWrite && (
              <DialogTrigger asChild>
                <Button className="bg-primary text-white gap-2 font-bold shadow-sm px-6">
                  <Plus className="h-4 w-4" /> Nuevo Cargo
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Cargo / Concepto</DialogTitle>
                <DialogDescription>Cargue un gasto manual para un contrato específico.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contrato / Unidad</Label>
                    <Select onValueChange={(v) => setManualCharge({...manualCharge, contractId: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                      <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.propertyName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Concepto</Label>
                    <Select value={manualCharge.type} onValueChange={(v: any) => setManualCharge({...manualCharge, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <CurrencyInput value={manualCharge.amount || 0} onChange={(v) => setManualCharge({...manualCharge, amount: v})} placeholder="0" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Período (Mes/Año)</Label>
                    <Input value={manualCharge.period} onChange={(e) => setManualCharge({...manualCharge, period: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsable del Pago</Label>
                    <Select value={manualCharge.imputedTo} onValueChange={(v: any) => setManualCharge({...manualCharge, imputedTo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inquilino">Inquilino (Suma al total)</SelectItem>
                        <SelectItem value="Propietario">Propietario (Deducción p/dueño)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Vencimiento</Label>
                    <Input type="date" value={manualCharge.dueDate} onChange={e => setManualCharge({...manualCharge, dueDate: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="ghost" onClick={() => setIsManualDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-primary px-8 font-black" onClick={handleSaveManualCharge}>Generar Cargo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </div>

      {/* ── Floating bulk-action bar ─────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-2xl shadow-xl border border-border/10">
          <span className="text-xs font-bold shrink-0">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className="w-px h-4 bg-background/20 mx-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-background hover:bg-background/20 gap-1.5 text-xs font-bold h-7"
            onClick={handleBulkMarkPaid}
            disabled={bulkProcessing}
          >
            {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Marcar pagadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-background hover:bg-background/20 gap-1.5 text-xs font-bold h-7"
            onClick={handleBulkSendReminder}
            disabled={bulkProcessing}
          >
            <Send className="h-3 w-3" /> Enviar recordatorio
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-background hover:bg-background/20 gap-1.5 text-xs font-bold h-7"
            onClick={handleBulkExport}
          >
            <Download className="h-3 w-3" /> Exportar
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-background/60 hover:text-background transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8">
                <button
                  onClick={() => {
                    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Seleccionar todas"
                >
                  {selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />}
                </button>
              </TableHead>
              <TableHead className="w-[250px]">Inquilino / Unidad</TableHead>
              <TableHead>Detalle de Cargos</TableHead>
              <TableHead className="text-right">Total (con Mora)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((i) => {
              const interest = calculateInterest(i);
              const isSelected = selectedIds.has(i.id);

              return (
                <TableRow key={i.id} className={cn("group hover:bg-muted/30", isSelected && "bg-primary/5")}>
                  <TableCell>
                    <button
                      onClick={() => toggleSelect(i.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Seleccionar fila"
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-black text-foreground">{i.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{i.propertyName} • {i.period}</span>
                      {i.isFromOwner && <Badge className="w-fit text-[8px] bg-purple-100 text-purple-700 h-4 px-1 mt-1">Enviado por Dueño</Badge>}
                      {!i.isFromOwner && i.charges?.some(c => c.type === 'Alquiler') && (
                        <Badge className="w-fit text-[8px] bg-orange-100 text-orange-700 h-4 px-1 mt-1">Propietario emite ARCA</Badge>
                      )}
                      {i.pendingApproval && (
                        <Badge className="w-fit text-[8px] bg-yellow-100 text-yellow-700 h-4 px-1 mt-1">Pendiente envío</Badge>
                      )}
                      {i.liquidacionEnviadaAt && !i.pendingApproval && (
                        <Badge className="w-fit text-[8px] bg-teal-100 text-teal-700 h-4 px-1 mt-1">Liquidación enviada</Badge>
                      )}
                      {!i.isFromOwner && !i.charges?.some(c => c.type === 'Alquiler') && (
                        <Badge className="w-fit text-[8px] bg-blue-100 text-blue-700 h-4 px-1 mt-1">Honorarios / Admin</Badge>
                      )}
                      {i.internalNotes && (
                        <div className="flex items-center gap-1 text-[9px] text-blue-600 mt-1 italic font-medium">
                          <MessageSquare className="h-2.5 w-2.5" /> {i.internalNotes}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[300px]">
                      {i.charges.map((c, idx) => (
                        <div key={idx} className={cn(
                          "flex justify-between text-[10px] py-0.5 border-b border-dashed px-1",
                          c.imputedTo === 'Propietario' ? "text-orange-600 bg-orange-50/50" : "text-foreground"
                        )}>
                          <span>{c.type}</span>
                          <span className="font-bold">{formatCurrency(c.amount, { currency: i.currency ?? 'ARS' })}</span>
                        </div>
                      ))}
                      {interest > 0 && (
                        <div className="flex justify-between text-[10px] py-0.5 text-red-600 font-bold px-1 bg-red-50 group/fee relative">
                          <span>Intereses (Mora)</span>
                          <div className="flex items-center gap-1">
                            <span>{formatCurrency(interest, { currency: i.currency ?? 'ARS' })}</span>
                            <button 
                              onClick={() => { setSelectedInvForFee(i); setManualFeeInput(interest); setIsLateFeeDialogOpen(true); }}
                              className="text-primary hover:underline"
                              title="Ajustar manualmente"
                            >
                              <Gavel className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      {interest === 0 && i.status !== 'Pagado' && (
                        <button 
                          onClick={() => { setSelectedInvForFee(i); setManualFeeInput(0); setIsLateFeeDialogOpen(true); }}
                          className="text-[9px] text-primary font-bold hover:underline w-fit"
                        >
                          + Cargar Punitorio Manual
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary text-base">
                    {formatCurrency(i.totalAmount + interest, { currency: i.currency ?? 'ARS' })}
                  </TableCell>
                  <TableCell>{getStatusBadge(i.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {i.status !== 'Pagado' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600" 
                          title="Cargar Pago (Manual/WhatsApp)"
                          onClick={() => handleUploadReceipt(i.id)}
                        >
                          <UploadCloud className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {i.paymentReceiptUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" title="Ver Comprobante de Pago" onClick={() => window.open(i.paymentReceiptUrl)}>
                          <FileCheck className="h-4 w-4" />
                        </Button>
                      )}

                      {i.arcaInvoiceUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Enviar Notificación" onClick={() => handleSendFormalInvoice(i)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {!i.arcaInvoiceUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" title="Subir Factura ARCA" onClick={() => handleUploadArca(i.id)}>
                          <FileUp className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {canDelete && (
                        <ConfirmDeleteButton
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          title="Eliminar factura"
                          itemName={`${i.tenantName} • ${i.period}`}
                          description={<p>Si esta factura ya fue cobrada, eliminarla romperá la trazabilidad fiscal.</p>}
                          blockedReason={i.status === 'Pagado' ? 'No se puede eliminar una factura ya pagada. Anulala en su lugar.' : null}
                          onConfirm={() => { if (userId && db) deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'facturas', i.id)); }}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={FileText}
                    title={filterSearch || filterProperty || filterStatus ? 'Sin resultados para ese filtro' : 'Sin facturas cargadas'}
                    description={filterSearch || filterProperty || filterStatus ? 'Probá ajustando los filtros de búsqueda.' : 'Generá las facturas mensuales o cargá un cargo manual.'}
                    action={!filterSearch && !filterProperty && !filterStatus ? { label: 'Generar Mensuales', onClick: () => setShowGeneratePreview(true), icon: CalendarCheck } : undefined}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={isLateFeeDialogOpen} onOpenChange={setIsLateFeeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Punitorios</DialogTitle>
            <DialogDescription>Fije un monto manual de intereses para esta factura.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto de Intereses (ARS)</Label>
              <CurrencyInput
                value={manualFeeInput}
                onChange={setManualFeeInput}
                placeholder="0"
                className="h-12 text-lg font-black text-red-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLateFeeDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black px-8" onClick={handleSaveManualFee}>Guardar Punitorio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate preview dialog */}
      <Dialog open={showGeneratePreview} onOpenChange={setShowGeneratePreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generar liquidaciones — {nextMonthLabel}</DialogTitle>
            <DialogDescription>
              Se crearán {contractsToProcess.length} factura{contractsToProcess.length !== 1 ? 's' : ''} y se enviarán correos a inquilinos y propietarios.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2 max-h-64 overflow-y-auto">
            {contractsToProcess.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay contratos vigentes sin liquidación para {nextMonthLabel}.
              </p>
            ) : (
              contractsToProcess.map(c => {
                const property = properties.find(p => p.id === c.propertyId);
                const ownerEmail = property?.owners?.[0]?.email;
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                    <div>
                      <p className="font-bold text-xs">{c.tenantName ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{c.propertyName ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xs text-primary">
                        {c.currency === 'USD' ? 'U$D' : '$'} {c.currentRentAmount.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {c.tenantEmail ? 'inquilino ✓' : 'sin email'}{ownerEmail ? ' · propietario ✓' : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Vencimiento: {nextMonthDueDate}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowGeneratePreview(false)}>Cancelar</Button>
            <Button
              className="bg-primary font-black px-8"
              onClick={handleGenerateMonthlyRent}
              disabled={isGeneratingRent || contractsToProcess.length === 0}
            >
              {isGeneratingRent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval dialog for cron-generated invoices */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprobar envío de liquidaciones</DialogTitle>
            <DialogDescription>
              El sistema generó {pendingApprovalInvoices.length} factura{pendingApprovalInvoices.length !== 1 ? 's' : ''} automáticamente. Revisalas y aprobá el envío de correos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2 max-h-72 overflow-y-auto">
            {pendingApprovalInvoices.map(inv => {
              const rentAmount = inv.charges?.find(c => c.type === 'Alquiler')?.amount ?? inv.totalAmount;
              const sym = inv.currency === 'USD' ? 'U$D' : '$';
              return (
                <div key={inv.id} className="p-2.5 rounded-lg bg-muted/30 text-sm space-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs">{inv.tenantName}</p>
                    <p className="font-black text-xs text-primary">{sym} {rentAmount.toLocaleString('es-AR')}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{inv.propertyName} · {inv.period}</p>
                  <p className="text-[9px] text-muted-foreground">
                    Vence: {inv.dueDate}
                    {inv.tenantEmail ? ` · inquilino: ${inv.tenantEmail}` : ''}
                    {inv.ownerEmail ? ` · propietario: ${inv.ownerEmail}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-[11px] text-blue-700">
            Se enviarán correos con el detalle de la liquidación, datos bancarios para transferencia y el recordatorio de emisión ARCA a cada destinatario.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowApprovalDialog(false)}>Revisar después</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8"
              onClick={handleApproveAndSend}
              disabled={approvingInvoices}
            >
              {approvingInvoices ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aprobar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptConfirmDialogOpen} onOpenChange={setIsReceiptConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Registro de Pago</DialogTitle>
            <DialogDescription>Complete los detalles del pago recibido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tempReceiptFile && (
              <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                <span className="text-xs font-bold truncate">{tempReceiptFile.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observaciones Internas</Label>
              <Textarea 
                placeholder="Ej: Enviado por WhatsApp - Confirmado Banco" 
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReceiptConfirmDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black px-8" onClick={handleConfirmReceipt}>Confirmar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
