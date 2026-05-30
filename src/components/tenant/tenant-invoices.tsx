import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, DollarSign, Clock, CheckCircle2, AlertTriangle,
  Upload, ExternalLink, ChevronDown, ChevronUp, Send, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { TenantRegistryEntry } from './tenant-portal';
import { Invoice } from '@/lib/types';


const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'Pendiente':               { label: 'Pendiente',         color: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Clock        },
  'Vencido':                 { label: 'Vencido',           color: 'bg-red-50 text-red-700 border-red-200',          icon: AlertTriangle },
  'Pago Informado':          { label: 'Pago Informado',    color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Send         },
  'Pagado':                  { label: 'Pagado',            color: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
  'Anulado':                 { label: 'Anulado',           color: 'bg-gray-50 text-gray-500 border-gray-200',       icon: FileText     },
  'Esperando Factura ARCA':  { label: 'Esperando ARCA',    color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Clock        },
};

import { fmtMoney as fmt } from '@/lib/format';

interface TenantInvoicesProps {
  tenantEntry: TenantRegistryEntry;
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: 'Copiado', description: text }); }}
      title="Copiar"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

export function TenantInvoices({ tenantEntry }: TenantInvoicesProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payDialog, setPayDialog] = useState<Invoice | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [saving, setSaving] = useState(false);

  const invQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'facturas'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.adminId, tenantEntry.tenantEmail]);
  const { data: invRaw } = useCollection<Invoice>(invQ);
  const invoices = [...(invRaw ?? [])].sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''));

  const pending  = invoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido').length;
  const paid     = invoices.filter(i => i.status === 'Pagado').length;
  const informed = invoices.filter(i => i.status === 'Pago Informado').length;

  const handleInformPay = async () => {
    if (!payDialog || !db) return;
    setSaving(true);
    const ref = doc(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'facturas', payDialog.id);
    setDocumentNonBlocking(ref, {
      status: 'Pago Informado',
      tenantReceiptUrl: receiptUrl.trim() || '',
      tenantReceiptNote: receiptNote.trim() || '',
    }, { merge: true });
    toast({ title: '✅ Pago informado', description: 'La administración fue notificada.' });
    setPayDialog(null);
    setReceiptUrl('');
    setReceiptNote('');
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Mis Recibos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Seguí el estado de tus pagos e informá comprobantes de transferencia.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendiente/Vencido', value: pending,  color: pending  > 0 ? 'text-red-600'   : 'text-green-600' },
          { label: 'Pago Informado',    value: informed, color: informed > 0 ? 'text-blue-600'  : 'text-muted-foreground' },
          { label: 'Pagado',            value: paid,     color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {invoices.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Sin recibos generados</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Cuando la administración genere un recibo para tu unidad aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG['Pendiente'];
            const Icon = cfg.icon;
            const isOpen = expanded === inv.id;
            const canInform = inv.status === 'Pendiente' || inv.status === 'Vencido';
            const tenantCharges = (inv.charges ?? []).filter(c => c.imputedTo === 'Inquilino');

            return (
              <Card key={inv.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
                  {/* Header row */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : inv.id)}
                  >
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', cfg.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate">{inv.period}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{inv.propertyName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="text-sm font-black">{fmt(inv.totalAmount, inv.currency)}</p>
                          <Badge className={cn('text-[10px] font-bold border', cfg.color)}>
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Vencimiento: {inv.dueDate?.split('-').reverse().join('/')}
                      </p>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/40">

                      {/* Charge breakdown */}
                      {tenantCharges.length > 0 && (
                        <div className="p-3 bg-muted/20 rounded-xl space-y-1.5">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-2">
                            Detalle de cargos
                          </p>
                          {tenantCharges.map(c => (
                            <div key={c.id} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{c.type}</span>
                              <span className="font-bold">{fmt(c.amount, inv.currency)}</span>
                            </div>
                          ))}
                          {inv.lateFees > 0 && (
                            <div className="flex justify-between text-xs text-red-600">
                              <span>Punitorios / Mora</span>
                              <span className="font-bold">{fmt(inv.lateFees, inv.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-black pt-1 border-t border-border/40">
                            <span>Total</span>
                            <span>{fmt(inv.totalAmount, inv.currency)}</span>
                          </div>
                        </div>
                      )}

                      {/* ARCA invoice */}
                      {inv.arcaInvoiceUrl && (
                        <a
                          href={inv.arcaInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Ver factura oficial (ARCA)
                        </a>
                      )}

                      {/* Admin receipt */}
                      {inv.paymentReceiptUrl && (
                        <a
                          href={inv.paymentReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 font-medium hover:underline"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Recibo confirmado por administración
                        </a>
                      )}

                      {/* Tenant already informed */}
                      {inv.tenantReceiptUrl && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-wide">
                            Tu comprobante enviado
                          </p>
                          <a
                            href={inv.tenantReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            Ver comprobante
                          </a>
                          {inv.tenantReceiptNote && (
                            <p className="text-xs text-blue-700 italic">"{inv.tenantReceiptNote}"</p>
                          )}
                        </div>
                      )}

                      {/* CBU transfer info — only when pending/overdue */}
                      {canInform && (inv.ownerCbu || inv.ownerAlias) && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1">
                            Datos para transferencia
                          </p>
                          {inv.ownerCbu && (
                            <div className="flex items-center text-xs">
                              <span className="text-muted-foreground w-12 shrink-0">CBU</span>
                              <span className="font-mono font-bold">{inv.ownerCbu}</span>
                              <CopyButton text={inv.ownerCbu} />
                            </div>
                          )}
                          {inv.ownerAlias && (
                            <div className="flex items-center text-xs">
                              <span className="text-muted-foreground w-12 shrink-0">Alias</span>
                              <span className="font-mono font-bold">{inv.ownerAlias}</span>
                              <CopyButton text={inv.ownerAlias} />
                            </div>
                          )}
                          {inv.ownerBank && (
                            <div className="flex items-center text-xs">
                              <span className="text-muted-foreground w-12 shrink-0">Banco</span>
                              <span className="font-bold">{inv.ownerBank}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action: inform payment */}
                      {canInform && (
                        <Button
                          className="w-full gap-2 font-bold"
                          onClick={() => setPayDialog(inv)}
                        >
                          <Upload className="h-4 w-4" />
                          Informar pago / Subir comprobante
                        </Button>
                      )}

                      {inv.status === 'Pago Informado' && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-xs text-amber-700 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            Pago informado — esperando confirmación de la administración.
                          </p>
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

      {/* Inform payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={v => !v && setPayDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Informar Pago</DialogTitle>
            <DialogDescription>
              {payDialog?.period} — {fmt(payDialog?.totalAmount ?? 0, payDialog?.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Link al comprobante (opcional)</Label>
              <Input
                type="url"
                placeholder="Pegá el link de tu transferencia (Google Fotos, Drive, etc.)"
                value={receiptUrl}
                onChange={e => setReceiptUrl(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Podés subir la foto a Google Fotos o Drive y pegar el link aquí.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea
                placeholder="Ej: Transferí el 5/6 desde Galicia, referencia 12345"
                className="min-h-[70px]"
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button className="font-bold px-8 bg-primary" onClick={handleInformPay} disabled={saving}>
              <Send className="h-4 w-4 mr-2" /> Informar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
