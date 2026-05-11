'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, DollarSign, MessageSquare, Calculator,
  ArrowRight, CheckCircle2, Clock,
  TrendingUp, Wrench, FileText, Bell, Users, ShoppingBag, Receipt, Zap, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { OwnerContractSign } from './owner-contract-sign';
import { Contract, Liquidation, Property } from '@/lib/types';
import { useAdminWhatsApp } from '@/components/dashboard/admin-settings-view';

const APP_ID = 'alquilagestion-pro';
const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

interface OwnerHomeProps {
  ownerEntry: OwnerRegistryEntry;
  onNavigate: (tab: any) => void;
}

export function OwnerHome({ ownerEntry, onNavigate }: OwnerHomeProps) {
  const db = useFirestore();
  const { whatsappNumber: adminWhatsApp } = useAdminWhatsApp(ownerEntry.adminId);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);

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

  // Fetch active contracts for owner's properties
  useEffect(() => {
    if (!db || !ownerEntry.adminId || !properties.length) return;
    const propertyIds = new Set(properties.map(p => p.id));
    getDocs(collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'contratos'))
      .then(snap => {
        setContracts(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Contract))
            .filter(c =>
              propertyIds.has(c.propertyId) &&
              (c.status === 'Vigente' || c.status === 'Próximo a Vencer'),
            ),
        );
      })
      .catch(() => {});
  }, [db, ownerEntry.adminId, properties]);

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

  // Invoices pending AFIP emission
  const invQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'facturas'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: invRaw } = useCollection<any>(invQ);
  const pendingAfip = (invRaw ?? []).filter(
    (i: any) => !i.afipCae && (i.status === 'Pendiente' || i.status === 'Vencido' || i.status === 'Pagado' || i.status === 'Pago Informado'),
  ).length;

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
          Portal Propietario · {(ownerEntry.propertyNames ?? []).length} propiedad{(ownerEntry.propertyNames ?? []).length !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Urgent action: AFIP pending */}
      {pendingAfip > 0 && (
        <div
          className="rounded-xl bg-emerald-700 text-white p-4 flex items-center gap-4 cursor-pointer hover:bg-emerald-800 transition-colors"
          onClick={() => onNavigate('Facturación AFIP')}
        >
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-black text-sm">Acción urgente</p>
            <p className="text-xs text-white/80">
              {pendingAfip} liquidación{pendingAfip !== 1 ? 'es' : ''} lista{pendingAfip !== 1 ? 's' : ''} para facturar. Datos precargados.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white text-emerald-700 font-black text-xs rounded-lg px-3 py-1.5 shrink-0">
            <Receipt className="h-3.5 w-3.5" />
            Ir a Facturación AFIP
          </div>
        </div>
      )}

      {/* Contract signing banners */}
      {contracts.map(c => (
        <OwnerContractSign
          key={c.id}
          contract={c}
          adminId={ownerEntry.adminId}
          ownerEntry={ownerEntry}
        />
      ))}

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

      {/* Propiedades activas — resumen de contratos */}
      {properties.filter(p => p.status === 'Alquilada').length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Contratos Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {properties.filter(p => p.status === 'Alquilada').map(p => {
              const ownerShare = p.owners?.find(
                o => o.email.toLowerCase() === ownerEntry.ownerEmail.toLowerCase(),
              )?.percentage ?? 100;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-emerald-50/30">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="text-[10px] font-bold border bg-green-50 text-green-700 border-green-200">
                      Alquilada
                    </Badge>
                    {ownerShare < 100 && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">{ownerShare}% tuyo</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: FileText,      label: 'Mis Facturas',      tab: 'Facturas',      color: 'text-primary bg-primary/10 hover:bg-primary/20' },
              { icon: Wrench,        label: 'Aprobaciones',      tab: 'Aprobaciones',  color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
              { icon: Bell,          label: 'Reclamos',          tab: 'Reclamos',      color: 'text-red-600 bg-red-50 hover:bg-red-100' },
              { icon: Calculator,    label: 'Liquidaciones',     tab: 'Liquidaciones', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
              { icon: MessageSquare, label: 'Mensajes',          tab: 'Mensajes',      color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
              { icon: Users,         label: 'Comunidad',         tab: 'Comunidad',     color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
              { icon: ShoppingBag,   label: 'Marketplace',       tab: 'Marketplace',   color: 'text-pink-600 bg-pink-50 hover:bg-pink-100' },
              { icon: Briefcase,     label: 'Servicios',         tab: 'Servicios',     color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
              { icon: Building2,     label: 'Propiedades',       tab: 'Propiedades',   color: 'text-green-600 bg-green-50 hover:bg-green-100' },
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

      {/* WhatsApp contact */}
      {adminWhatsApp && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
          <svg viewBox="0 0 24 24" fill="#25D366" className="h-5 w-5 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-black text-green-900">Contactar al administrador por WhatsApp</p>
            <p className="text-xs text-green-700">Consultá cualquier duda sobre tu propiedad</p>
          </div>
          <a
            href={`https://wa.me/${adminWhatsApp.replace(/[\s\-\(\)\+]/g, '')}?text=${encodeURIComponent(`Hola, soy ${ownerEntry.ownerName}, propietario de ${ownerEntry.propertyNames[0] ?? 'la propiedad'}. Quería consultarle sobre...`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-black text-green-800 underline shrink-0"
          >
            Abrir WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
