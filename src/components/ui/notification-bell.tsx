'use client';

import React, { useState, useMemo } from 'react';
import { Bell, Check, CheckCheck, Wrench, FileText, Calendar, AlertTriangle, DollarSign, Megaphone, Zap, Lightbulb, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { AppNotification, NotificationType, Anuncio, AnuncioType } from '@/lib/types';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';
import { markAnuncioRead, markAllAnunciosRead } from '@/lib/anuncios';

const APP_ID = 'alquilagestion-pro';

const ICONS: Record<NotificationType, React.ElementType> = {
  maintenance_approved: Wrench,
  maintenance_rejected: Wrench,
  invoice_paid: DollarSign,
  invoice_overdue: AlertTriangle,
  contract_expiring: Calendar,
  contract_expired: Calendar,
  liquidation_ready: FileText,
  tenant_request: FileText,
  system: Bell,
};

const COLORS: Record<NotificationType, string> = {
  maintenance_approved: 'text-green-600 bg-green-50',
  maintenance_rejected: 'text-orange-600 bg-orange-50',
  invoice_paid: 'text-green-600 bg-green-50',
  invoice_overdue: 'text-red-600 bg-red-50',
  contract_expiring: 'text-orange-600 bg-orange-50',
  contract_expired: 'text-red-600 bg-red-50',
  liquidation_ready: 'text-blue-600 bg-blue-50',
  tenant_request: 'text-purple-600 bg-purple-50',
  system: 'text-gray-600 bg-gray-50',
};

const ANUNCIO_ICONS: Record<AnuncioType, React.ElementType> = {
  novedad:  Megaphone,
  funcion:  Zap,
  tip:      Lightbulb,
  negocio:  TrendingUp,
};

const ANUNCIO_COLORS: Record<AnuncioType, string> = {
  novedad:  'text-blue-600 bg-blue-50',
  funcion:  'text-violet-600 bg-violet-50',
  tip:      'text-amber-600 bg-amber-50',
  negocio:  'text-green-600 bg-green-50',
};

const ANUNCIO_LABELS: Record<AnuncioType, string> = {
  novedad:  'Novedad',
  funcion:  'Nueva función',
  tip:      'Tip',
  negocio:  'Oportunidad',
};

interface NotificationBellProps {
  userId?: string;
  onNavigate?: (link: string) => void;
}

export function NotificationBell({ userId, onNavigate }: NotificationBellProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifs' | 'novedades'>('notifs');
  const [readAnuncioIds, setReadAnuncioIds] = useState<string[]>([]);

  // — Notificaciones del usuario —
  const notifQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
    );
  }, [db, userId]);
  const { data: notifData } = useCollection<AppNotification>(notifQ);
  const notifications = useMemo(() => (notifData ?? []).slice(0, 30), [notifData]);
  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // — Anuncios publicados (globales) —
  const anunciosQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'anuncios'),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc'),
    );
  }, [db, userId]);
  const { data: anunciosData } = useCollection<Anuncio>(anunciosQ);
  const anuncios = useMemo(() => (anunciosData ?? []).slice(0, 20), [anunciosData]);

  // — Cargar IDs leídos del usuario —
  useMemo(() => {
    if (!db || !userId) return;
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'meta', 'anunciosLeidos'))
      .then(snap => { if (snap.exists()) setReadAnuncioIds(snap.data().readIds ?? []); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, open]);

  const unreadAnuncioCount = useMemo(
    () => anuncios.filter(a => !readAnuncioIds.includes(a.id)).length,
    [anuncios, readAnuncioIds],
  );

  const totalUnread = unreadNotifCount + unreadAnuncioCount;

  const handleNotifClick = (n: AppNotification) => {
    if (db && userId && !n.read) markNotificationRead(db, userId, n.id);
    if (n.link && onNavigate) {
      onNavigate(n.link);
      setOpen(false);
    }
  };

  const handleMarkAllNotifs = () => {
    if (!db || !userId) return;
    markAllNotificationsRead(db, userId, notifications.filter(n => !n.read).map(n => n.id));
  };

  const handleAnuncioClick = (a: Anuncio) => {
    if (!db || !userId || readAnuncioIds.includes(a.id)) return;
    markAnuncioRead(db, userId, a.id);
    setReadAnuncioIds(prev => [...prev, a.id]);
  };

  const handleMarkAllAnuncios = () => {
    if (!db || !userId) return;
    const unreadIds = anuncios.filter(a => !readAnuncioIds.includes(a.id)).map(a => a.id);
    markAllAnunciosRead(db, userId, unreadIds);
    setReadAnuncioIds(prev => [...prev, ...unreadIds]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {totalUnread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('notifs')}
            className={cn(
              'flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
              activeTab === 'notifs'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Notificaciones
            {unreadNotifCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('novedades')}
            className={cn(
              'flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
              activeTab === 'novedades'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Novedades
            {unreadAnuncioCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                {unreadAnuncioCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Notificaciones ── */}
        {activeTab === 'notifs' && (
          <>
            {unreadNotifCount > 0 && (
              <div className="flex justify-end px-3 py-1.5 border-b">
                <button
                  onClick={handleMarkAllNotifs}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <CheckCheck className="h-3 w-3" /> Marcar todas leídas
                </button>
              </div>
            )}
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No tenés notificaciones.
              </div>
            ) : (
              <ScrollArea className="h-96">
                <ul className="divide-y">
                  {notifications.map(n => {
                    const Icon = ICONS[n.type] ?? Bell;
                    const colorClass = COLORS[n.type] ?? 'text-gray-600 bg-gray-50';
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => handleNotifClick(n)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-muted/50 transition-colors',
                            !n.read && 'bg-primary/5',
                          )}
                        >
                          <div className={cn('shrink-0 h-8 w-8 rounded-full flex items-center justify-center', colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn('text-xs font-bold', !n.read && 'text-foreground')}>{n.title}</p>
                              {!n.read && <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {new Date(n.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </>
        )}

        {/* ── Novedades ── */}
        {activeTab === 'novedades' && (
          <>
            {unreadAnuncioCount > 0 && (
              <div className="flex justify-end px-3 py-1.5 border-b">
                <button
                  onClick={handleMarkAllAnuncios}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <CheckCheck className="h-3 w-3" /> Marcar todas leídas
                </button>
              </div>
            )}
            {anuncios.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Sin novedades por ahora.
              </div>
            ) : (
              <ScrollArea className="h-96">
                <ul className="divide-y">
                  {anuncios.map(a => {
                    const isRead = readAnuncioIds.includes(a.id);
                    const Icon = ANUNCIO_ICONS[a.type] ?? Megaphone;
                    const colorClass = ANUNCIO_COLORS[a.type] ?? 'text-blue-600 bg-blue-50';
                    return (
                      <li key={a.id}>
                        <button
                          onClick={() => handleAnuncioClick(a)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-muted/50 transition-colors',
                            !isRead && 'bg-primary/5',
                          )}
                        >
                          <div className={cn('shrink-0 h-8 w-8 rounded-full flex items-center justify-center', colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className={cn('text-[10px] font-bold uppercase tracking-wide', colorClass.split(' ')[0])}>
                                  {ANUNCIO_LABELS[a.type]}
                                </span>
                                <p className={cn('text-xs font-bold leading-tight', !isRead && 'text-foreground')}>{a.title}</p>
                              </div>
                              {!isRead && <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{a.body}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {new Date(a.publishedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
