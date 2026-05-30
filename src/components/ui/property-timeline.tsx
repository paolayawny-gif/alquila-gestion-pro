'use client'
import { APP_ID } from '@/lib/constants';;

import React, { useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { type PropertyEvent } from '@/lib/property-events';
import {
  MessageSquare, Bell, FileText, CheckCircle2, TrendingUp,
  User, Building2, ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


const EVENT_CONFIG: Record<PropertyEvent['type'], {
  label: string;
  icon: React.ReactNode;
  dotClass: string;
  badgeClass: string;
}> = {
  message_admin: {
    label: 'Admin',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    dotClass: 'bg-primary/15 text-primary',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  message_tenant: {
    label: 'Inquilino',
    icon: <User className="h-3.5 w-3.5" />,
    dotClass: 'bg-emerald-100 text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  message_owner: {
    label: 'Propietario',
    icon: <Building2 className="h-3.5 w-3.5" />,
    dotClass: 'bg-purple-100 text-purple-700',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  mora_notif: {
    label: 'Mora',
    icon: <Bell className="h-3.5 w-3.5" />,
    dotClass: 'bg-orange-100 text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  invoice_created: {
    label: 'Factura',
    icon: <FileText className="h-3.5 w-3.5" />,
    dotClass: 'bg-muted text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  },
  invoice_paid: {
    label: 'Pago',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    dotClass: 'bg-green-100 text-green-700',
    badgeClass: 'bg-green-100 text-green-700',
  },
  rent_adjustment: {
    label: 'Ajuste',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    dotClass: 'bg-amber-100 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
};

interface PropertyTimelineProps {
  propertyId: string;
  adminId: string;
}

export function PropertyTimeline({ propertyId, adminId }: PropertyTimelineProps) {
  const db = useFirestore();

  const eventsQ = useMemoFirebase(() => {
    if (!db || !adminId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', adminId, 'propertyEvents'),
      where('propertyId', '==', propertyId),
      orderBy('ts', 'desc'),
    );
  }, [db, adminId, propertyId]);

  const { data: eventsRaw } = useCollection<PropertyEvent>(eventsQ);
  const events = useMemo(() => eventsRaw ?? [], [eventsRaw]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
        <ScrollText className="h-10 w-10 opacity-20 mb-3" />
        <p className="text-sm font-medium">Sin eventos registrados</p>
        <p className="text-xs mt-1 max-w-[220px]">
          Los mensajes, facturas, mora y ajustes de este inmueble aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-1">
      {/* Línea vertical */}
      <div className="absolute left-[22px] top-5 bottom-5 w-px bg-border" />

      <div className="space-y-1">
        {events.map(ev => {
          const cfg = EVENT_CONFIG[ev.type];
          const date = new Date(ev.ts);
          const isToday = date.toDateString() === new Date().toDateString();
          const timeLabel = isToday
            ? `Hoy ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
            : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
              ' · ' + date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={ev.id} className="flex gap-3 pb-3">
              {/* Ícono */}
              <div className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-background',
                cfg.dotClass,
              )}>
                {cfg.icon}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold leading-tight">{ev.title}</span>
                  <Badge className={cn('text-[9px] font-black border-none px-1.5 py-0 h-4', cfg.badgeClass)}>
                    {cfg.label}
                  </Badge>
                </div>

                {ev.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                    {ev.detail}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground/60">{timeLabel}</span>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground/60">{ev.actor}</span>
                </div>

                {ev.metadata?.amount != null && (
                  <span className="text-[11px] font-black text-foreground mt-0.5 inline-block">
                    {ev.metadata.currency ?? 'ARS'} {ev.metadata.amount.toLocaleString('es-AR')}
                    {ev.metadata.period && ` · ${ev.metadata.period}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
