'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, DollarSign, MessageSquare, Calculator,
  ArrowRight, CheckCircle2, Clock,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { Liquidation, Property } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';
const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

interface OwnerHomeProps {
  ownerEntry: OwnerRegistryEntry;
  onNavigate: (tab: any) => void;
}

export function OwnerHome({ ownerEntry, onNavigate }: OwnerHomeProps) {
  const db = useFirestore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);

  // Fetch owner's properties from admin namespace
  useEffect(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.propertyIds?.length) {
      setLoadingProps(false);
      return;
    }
    getDocs(collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'propiedades'))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
        const mine = all.filter(p =>
          p.owners?.some(o => o.email.toLowerCase() === ownerEntry.ownerEmail.toLowerCase())
        );
        setProperties(mine);
      })
      .catch(() => {})
      .finally(() => setLoadingProps(false));
  }, [db, ownerEntry.adminId, ownerEntry.propertyIds?.join(',')]);

  // Fetch liquidations
  const liqQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'liquidaciones'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: liqRaw } = useCollection<Liquidation>(liqQ);

  const liquidations = liqRaw ?? [];

  // Unread messages (owner chats)
  const chatsQ = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.ownerEmail]);
  const { data: chatsRaw } = useCollection<any>(chatsQ);
  const unreadMessages = (chatsRaw ?? []).reduce((a: number, c: any) => a + (c.unreadTenant ?? 0), 0);

  const totalReceived = liquidations
    .filter(l => l.status === 'Pagada')
    .reduce((a, l) => a + (l.netAmount ?? 0), 0);

  const pendingLiquidations = liquidations.filter(l => l.status !== 'Pagada').length;

  const rented = properties.filter(p => p.status === 'Alquilada').length;

  const stats = [
    {
      label: 'Propiedades',
      value: loadingProps ? '…' : `${rented}/${properties.length} alquiladas`,
      icon: Building2,
      color: 'text-emerald-600 bg-emerald-50',
      tab: 'Propiedades',
    },
    {
      label: 'Mensajes',
      value: unreadMessages > 0 ? `${unreadMessages} nuevo${unreadMessages > 1 ? 's' : ''}` : 'Al día',
      icon: MessageSquare,
      color: unreadMessages > 0 ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50',
      tab: 'Mensajes',
    },
    {
      label: 'Total Cobrado',
      value: fmt(totalReceived),
      icon: TrendingUp,
      color: 'text-primary bg-primary/10',
      tab: 'Liquidaciones',
    },
    {
      label: 'Liquidaciones',
      value: pendingLiquidations > 0 ? `${pendingLiquidations} pendiente${pendingLiquidations > 1 ? 's' : ''}` : 'Al día',
      icon: Calculator,
      color: pendingLiquidations > 0 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50',
      tab: 'Liquidaciones',
    },
  ];

  const recentLiquidations = [...liquidations]
    .sort((a, b) => (b.dateCreated ?? '').localeCompare(a.dateCreated ?? ''))
    .slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-foreground">
          Hola, {ownerEntry.ownerName.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Portal Propietario · {ownerEntry.propertyNames.length} propiedad{ownerEntry.propertyNames.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card
            key={s.label}
            className={cn('border-none shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow')}
            onClick={() => onNavigate(s.tab)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-black text-foreground truncate">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* My properties */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" /> Mis Propiedades
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-bold text-emerald-600 gap-1"
              onClick={() => onNavigate('Propiedades')}>
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingProps ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Cargando…</div>
            ) : properties.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Sin propiedades asociadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {properties.slice(0, 4).map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.address}</p>
                    </div>
                    <Badge className={cn(
                      'text-[10px] font-bold border shrink-0',
                      p.status === 'Alquilada' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent liquidations */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-600" /> Últimas Liquidaciones
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-bold text-emerald-600 gap-1"
              onClick={() => onNavigate('Liquidaciones')}>
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentLiquidations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Sin liquidaciones registradas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentLiquidations.map(l => {
                  const isPaid = l.status === 'Pagada';
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{l.propertyName}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {l.period}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-black', isPaid ? 'text-green-700' : 'text-amber-600')}>
                          {fmt(l.netAmount ?? 0)}
                        </p>
                        <Badge className={cn(
                          'text-[10px] font-bold border',
                          isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200',
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

      {/* Quick actions */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Building2,    label: 'Ver propiedades',   tab: 'Propiedades',   color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
              { icon: Calculator,   label: 'Ver liquidaciones', tab: 'Liquidaciones', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
              { icon: MessageSquare,label: 'Mensajes',          tab: 'Mensajes',      color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
              { icon: DollarSign,   label: 'Resumen cobros',    tab: 'Liquidaciones', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => onNavigate(a.tab)}
                className={cn('flex flex-col items-center gap-2 p-4 rounded-xl font-medium text-xs transition-colors', a.color)}
              >
                <a.icon className="h-5 w-5" />
                {a.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
