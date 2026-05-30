import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, Send, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { Invoice } from '@/lib/types';


const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'Pendiente':               { label: 'Pendiente',      color: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Clock         },
  'Vencido':                 { label: 'Vencido',        color: 'bg-red-50 text-red-700 border-red-200',          icon: AlertTriangle  },
  'Pago Informado':          { label: 'Pago Informado', color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: Send          },
  'Pagado':                  { label: 'Pagado',         color: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2  },
  'Anulado':                 { label: 'Anulado',        color: 'bg-gray-50 text-gray-500 border-gray-200',       icon: FileText      },
  'Esperando Factura ARCA':  { label: 'Esp. ARCA',      color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Clock         },
};

import { fmtMoney as fmt } from '@/lib/format';

interface OwnerInvoicesProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerInvoices({ ownerEntry }: OwnerInvoicesProps) {
  const db = useFirestore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const invQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'facturas'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: invRaw } = useCollection<Invoice>(invQ);
  const invoices = [...(invRaw ?? [])].sort((a, b) => b.dueDate?.localeCompare(a.dueDate ?? '') ?? 0);

  const pending   = invoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido').length;
  const paid      = invoices.filter(i => i.status === 'Pagado').length;
  const totalRent = invoices
    .filter(i => i.status === 'Pagado')
    .reduce((acc, i) => acc + (i.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Facturas de la Propiedad</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Recibos de alquiler generados por la administración para tus propiedades.
        </p>
      </div>

      {/* ARCA workflow guidance */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-black text-amber-800">¿Cómo emitir tu factura ARCA?</p>
          <ol className="text-[11px] text-amber-700 space-y-0.5 list-decimal list-inside">
            <li>Ingresá a <strong>arca.afip.gob.ar</strong> con tu CUIL y clave fiscal.</li>
            <li>En <em>Comprobantes Online</em>, emití la factura por el alquiler del período correspondiente.</li>
            <li>Descargá el PDF y subilo desde el panel de la administración cuando te lo soliciten.</li>
          </ol>
          <p className="text-[10px] text-amber-600 mt-1">
            La administración te avisará por email cuando registre un pago y sea momento de emitir el comprobante.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes',       value: pending,                             color: pending > 0 ? 'text-amber-600' : 'text-green-600' },
          { label: 'Cobrados',         value: paid,                                color: 'text-green-600' },
          { label: 'Total recaudado',  value: totalRent > 0 ? fmt(totalRent) : '—', color: 'text-emerald-700' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 text-center">
              <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {invoices.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Sin facturas disponibles</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Las facturas aparecen aquí cuando la administración las genera y vincula a tu propiedad.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG['Pendiente'];
            const Icon = cfg.icon;
            const isOpen = expanded === inv.id;
            const tenantCharges = (inv.charges ?? []).filter(c => c.imputedTo === 'Inquilino');

            return (
              <Card key={inv.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-4">
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
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {inv.propertyName} · {inv.tenantName}
                          </p>
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

                  {isOpen && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/40">

                      {tenantCharges.length > 0 && (
                        <div className="p-3 bg-muted/20 rounded-xl space-y-1.5">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-2">
                            Detalle de cargos al inquilino
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

                      {inv.tenantReceiptUrl && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-wide mb-1.5">
                            Comprobante del inquilino
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
                            <p className="text-xs text-blue-700 mt-1 italic">"{inv.tenantReceiptNote}"</p>
                          )}
                        </div>
                      )}

                      {inv.paymentReceiptUrl && (
                        <a
                          href={inv.paymentReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 font-medium hover:underline"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Recibo de pago confirmado
                        </a>
                      )}

                      {inv.paymentDate && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          Pagado el {inv.paymentDate?.split('-').reverse().join('/')}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
