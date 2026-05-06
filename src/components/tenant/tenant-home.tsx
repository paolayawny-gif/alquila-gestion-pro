'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, DollarSign, Wrench, MessageSquare,
  Building2, AlertTriangle, CheckCircle2,
  ArrowRight, Clock, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { TenantRegistryEntry } from './tenant-portal';
import { Contract } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

function daysUntil(dateStr: string) {
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
}
const fmt = (n: number, cur = 'ARS') =>
  `${cur === 'USD' ? 'U$D' : '$'}${n.toLocaleString('es-AR')}`;

interface TenantHomeProps {
  tenantEntry: TenantRegistryEntry;
  onNavigate: (tab: any) => void;
}

export function TenantHome({ tenantEntry, onNavigate }: TenantHomeProps) {
  const db = useFirestore();
  const [contract, setContract] = useState<Contract | null>(null);

  // Fetch their contract from admin namespace
  useEffect(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.contractId) return;
    getDoc(doc(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'contratos', tenantEntry.contractId))
      .then(snap => { if (snap.exists()) setContract(snap.data() as Contract); })
      .catch(() => {});
  }, [db, tenantEntry.adminId, tenantEntry.contractId]);

  // Maintenance tickets
  const ticketsQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'maintenanceTickets'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.tenantEmail]);
  const { data: ticketsRaw } = useCollection<any>(ticketsQ);
  const tickets = ticketsRaw ?? [];
  const openTickets = tickets.filter(t => t.status !== 'Resuelto').length;

  // Unread messages
  const chatsQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.tenantEmail]);
  const { data: chatsRaw } = useCollection<any>(chatsQ);
  const unreadMessages = (chatsRaw ?? []).reduce((a: number, c: any) => a + (c.unreadTenant ?? 0), 0);

  const endDays     = contract ? daysUntil(contract.endDate) : null;
  const contractOk  = contract?.status === 'Vigente' || contract?.status === 'Próximo a Vencer';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-foreground">
          Hola, {tenantEntry.tenantName.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {tenantEntry.propertyName}
        </p>
      </div>

      {/* Quick-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Mensajes',
            value: unreadMessages > 0 ? `${unreadMessages} nuevo${unreadMessages > 1 ? 's' : ''}` : 'Al día',
            icon: MessageSquare,
            color: unreadMessages > 0 ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50',
            tab: 'Mensajes',
          },
          {
            label: 'Mantenimiento',
            value: openTickets > 0 ? `${openTickets} abierto${openTickets > 1 ? 's' : ''}` : 'Sin tickets',
            icon: Wrench,
            color: openTickets > 0 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50',
            tab: 'Mantenimiento',
          },
          {
            label: 'Contrato',
            value: endDays !== null
              ? endDays < 0 ? 'Vencido' : endDays <= 30 ? `${endDays}d restantes` : 'Vigente'
              : '—',
            icon: FileText,
            color: endDays !== null && endDays <= 30
              ? 'text-amber-600 bg-amber-50'
              : 'text-green-600 bg-green-50',
            tab: null,
          },
          {
            label: 'Alquiler',
            value: contract ? fmt(contract.currentRentAmount, contract.currency) : '—',
            icon: DollarSign,
            color: 'text-primary bg-primary/10',
            tab: null,
          },
        ].map(s => (
          <Card
            key={s.label}
            className={cn('border-none shadow-sm bg-white', s.tab && 'cursor-pointer hover:shadow-md transition-shadow')}
            onClick={() => s.tab && onNavigate(s.tab)}
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

        {/* Contract summary */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Mi Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {contract ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <Badge className={cn(
                    'text-[10px] font-black border',
                    contractOk
                      ? (endDays !== null && endDays <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200')
                      : 'bg-red-50 text-red-700 border-red-200',
                  )}>
                    {contract.status}
                  </Badge>
                </div>
                {[
                  { label: 'Propiedad',   value: tenantEntry.propertyName },
                  { label: 'Inicio',      value: contract.startDate.split('-').reverse().join('/') },
                  { label: 'Vencimiento', value: contract.endDate.split('-').reverse().join('/') },
                  { label: 'Alquiler',    value: fmt(contract.currentRentAmount, contract.currency) },
                  { label: 'Depósito',    value: fmt(contract.depositAmount, contract.depositCurrency) },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-bold text-foreground">{row.value}</span>
                  </div>
                ))}
                {endDays !== null && endDays <= 60 && endDays > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">Tu contrato vence en {endDays} días.</p>
                  </div>
                )}
                {contract.documents?.mainContractUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 font-bold text-xs mt-1"
                    onClick={() => window.open(contract!.documents.mainContractUrl, '_blank')}
                  >
                    <FileText className="h-3.5 w-3.5" /> Ver contrato completo
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Cargando datos del contrato…</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tickets */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> Mis Solicitudes
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-primary gap-1"
              onClick={() => onNavigate('Mantenimiento')}
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {tickets.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">Sin solicitudes abiertas</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5 font-bold text-xs"
                  onClick={() => onNavigate('Mantenimiento')}
                >
                  <Wrench className="h-3.5 w-3.5" /> Crear solicitud
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {[...tickets]
                  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                  .slice(0, 4)
                  .map((t: any) => {
                    const statusColor =
                      t.status === 'Resuelto'   ? 'bg-green-50 text-green-700 border-green-200' :
                      t.status === 'En proceso' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200';
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{t.title}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {t.createdAt?.slice(0, 10).split('-').reverse().join('/')}
                          </p>
                        </div>
                        <Badge className={cn('border text-[10px] font-bold shrink-0', statusColor)}>
                          {t.status}
                        </Badge>
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
              { icon: MessageSquare, label: 'Enviar mensaje',     tab: 'Mensajes',      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
              { icon: Wrench,        label: 'Reportar problema',  tab: 'Mantenimiento', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
              { icon: Building2,     label: 'Mi Edificio',        tab: 'Comunidad',     color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
              { icon: Shield,        label: 'Cotizar seguro',     tab: 'Seguros',       color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
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
