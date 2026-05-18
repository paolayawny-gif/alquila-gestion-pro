'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calculator, TrendingUp, Clock, CheckCircle2, Building2, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { Liquidation } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';
import { fmtMoney as fmt } from '@/lib/format';

interface OwnerLiquidationsProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerLiquidations({ ownerEntry }: OwnerLiquidationsProps) {
  const db = useFirestore();
  const [filterStatus, setFilterStatus] = useState<'Todas' | 'Pagada' | 'Pendiente'>('Todas');

  const liqQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'liquidaciones'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: liqRaw } = useCollection<Liquidation>(liqQ);
  const all = (liqRaw ?? []).sort((a, b) => (b.dateCreated ?? '').localeCompare(a.dateCreated ?? ''));

  const filtered = filterStatus === 'Todas'
    ? all
    : all.filter(l => l.status === filterStatus || (filterStatus === 'Pendiente' && l.status !== 'Pagada'));

  const totalPaid     = all.filter(l => l.status === 'Pagada').reduce((s, l) => s + (l.netAmount ?? 0), 0);
  const totalPending  = all.filter(l => l.status !== 'Pagada').reduce((s, l) => s + (l.netAmount ?? 0), 0);
  const avgNet        = all.length > 0 ? Math.round(totalPaid / Math.max(all.filter(l => l.status === 'Pagada').length, 1)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Liquidaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Historial de cobros netos de tus propiedades</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Total Cobrado (Neto)</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black text-green-700">{fmt(totalPaid)}</p>
              <div className="p-2 bg-green-50 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Pendiente de Cobro</p>
            <div className="flex items-center justify-between">
              <p className={cn('text-2xl font-black', totalPending > 0 ? 'text-amber-600' : 'text-green-600')}>
                {fmt(totalPending)}
              </p>
              <div className={cn('p-2 rounded-full', totalPending > 0 ? 'bg-amber-50' : 'bg-green-50')}>
                <Clock className={cn('h-4 w-4', totalPending > 0 ? 'text-amber-600' : 'text-green-600')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Promedio Mensual</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black text-primary">{fmt(avgNet)}</p>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['Todas', 'Pagada', 'Pendiente'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold transition-colors',
              filterStatus === f
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border text-muted-foreground hover:bg-muted',
            )}
          >
            {f}
            {f !== 'Todas' && (
              <span className="ml-1.5 opacity-70">
                ({f === 'Pagada' ? all.filter(l => l.status === 'Pagada').length : all.filter(l => l.status !== 'Pagada').length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" />
            Detalle de Liquidaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Sin liquidaciones{filterStatus !== 'Todas' ? ` en estado "${filterStatus}"` : ''}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(l => {
                const isPaid = l.status === 'Pagada';
                return (
                  <div key={l.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                    {/* Icon */}
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                      isPaid ? 'bg-green-50' : 'bg-amber-50',
                    )}>
                      <Building2 className={cn('h-4 w-4', isPaid ? 'text-green-600' : 'text-amber-600')} />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{l.propertyName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">{l.period}</span>
                        {l.dateCreated && (
                          <span className="text-[10px] text-muted-foreground">
                            · {l.dateCreated.slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Breakdown */}
                    <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 mr-4">
                      <span className="text-[10px] text-muted-foreground">
                        Alquiler: {fmt(l.ingresoAlquiler ?? 0)}
                      </span>
                      {l.adminFeeDeduction !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          Honorarios: -{fmt(l.adminFeeDeduction)}
                        </span>
                      )}
                    </div>
                    {/* Net + status */}
                    <div className="text-right shrink-0">
                      <p className={cn('text-base font-black', isPaid ? 'text-green-700' : 'text-amber-600')}>
                        {fmt(l.netAmount ?? 0)}
                      </p>
                      <Badge className={cn(
                        'text-[10px] font-bold border mt-0.5',
                        isPaid
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200',
                      )}>
                        {l.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
