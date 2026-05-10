'use client';

import React, { useState, useMemo } from 'react';
import { Bell, Check, CheckCheck, Wrench, FileText, Calendar, AlertTriangle, DollarSign } from 'lucide-react';
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
import { collection, query, orderBy } from 'firebase/firestore';
import { AppNotification, NotificationType } from '@/lib/types';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';

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

interface NotificationBellProps {
  userId?: string;
  onNavigate?: (link: string) => void;
}

export function NotificationBell({ userId, onNavigate }: NotificationBellProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);

  const notifQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
    );
  }, [db, userId]);
  const { data: notifData } = useCollection<AppNotification>(notifQ);
  const notifications = useMemo(() => (notifData ?? []).slice(0, 30), [notifData]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const handleClick = (n: AppNotification) => {
    if (db && userId && !n.read) markNotificationRead(db, userId, n.id);
    if (n.link && onNavigate) {
      onNavigate(n.link);
      setOpen(false);
    }
  };

  const handleMarkAll = () => {
    if (!db || !userId) return;
    markAllNotificationsRead(db, userId, notifications.filter(n => !n.read).map(n => n.id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-bold text-sm">Notificaciones</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <CheckCheck className="h-3 w-3" /> Marcar todas leídas
            </button>
          )}
        </div>
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
                      onClick={() => handleClick(n)}
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
      </PopoverContent>
    </Popover>
  );
}
