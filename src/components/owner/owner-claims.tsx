'use client'
import { APP_ID } from '@/lib/constants';;

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Wrench, Building2, User, Clock, Image,
  ExternalLink, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { MaintenanceTicket } from '@/components/tenant/tenant-maintenance';


const STATUS_COLOR: Record<string, string> = {
  'Abierto':    'bg-amber-50 text-amber-700 border-amber-200',
  'En proceso': 'bg-blue-50  text-blue-700  border-blue-200',
  'Resuelto':   'bg-green-50 text-green-700 border-green-200',
};

const PRIORITY_COLOR: Record<string, string> = {
  'Urgente': 'bg-red-50   text-red-700   border-red-200',
  'Normal':  'bg-slate-50 text-slate-600  border-slate-200',
  'Baja':    'bg-gray-50  text-gray-500   border-gray-200',
};

const CATEGORY_ICON: Record<string, string> = {
  'Plomería': '🔧', 'Electricidad': '⚡', 'Gas': '🔥', 'Carpintería': '🪵',
  'Pintura': '🎨', 'Limpieza': '🧹', 'Acceso / Llave': '🔑',
  'Climatización': '❄️', 'Otro': '📋',
};

interface OwnerClaimsProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerClaims({ ownerEntry }: OwnerClaimsProps) {
  const db = useFirestore();
  const [selected, setSelected] = useState<MaintenanceTicket | null>(null);

  const ticketsQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'maintenanceTickets'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
      where('ownerVisible', '==', true),
    );
  }, [db, ownerEntry.ownerEmail]);
  const { data: ticketsRaw } = useCollection<MaintenanceTicket>(ticketsQ);
  const tickets = useMemo(() =>
    [...(ticketsRaw ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  [ticketsRaw]);

  const open    = tickets.filter(t => t.status === 'Abierto').length;
  const inProc  = tickets.filter(t => t.status === 'En proceso').length;
  const resolved = tickets.filter(t => t.status === 'Resuelto').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Reclamos de Inquilinos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Solicitudes de tus propiedades comunicadas por la administración
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Abiertos',   value: open,     color: 'text-amber-600' },
          { label: 'En proceso', value: inProc,   color: 'text-blue-600'  },
          { label: 'Resueltos',  value: resolved, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Sin reclamos comunicados</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Cuando un inquilino reporte un problema y la administración te lo informe, aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <Card
              key={ticket.id}
              className="border-none shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelected(selected?.id === ticket.id ? null : ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center text-lg shrink-0">
                    {CATEGORY_ICON[ticket.category] ?? '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{ticket.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />{ticket.propertyName}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />{ticket.tenantName}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ticket.createdAt?.slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <Badge className={cn('text-[10px] font-bold border', STATUS_COLOR[ticket.status] ?? '')}>
                          {ticket.status}
                        </Badge>
                        <Badge className={cn('text-[10px] font-bold border', PRIORITY_COLOR[ticket.priority] ?? '')}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {selected?.id === ticket.id && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-border/40">
                        {ticket.description && (
                          <div className="p-3 bg-muted/30 rounded-xl">
                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 tracking-wide">
                              Descripción del inquilino
                            </p>
                            <p className="text-sm">{ticket.description}</p>
                          </div>
                        )}

                        {ticket.photoUrl && (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-[10px] font-black text-blue-700 uppercase mb-1.5 tracking-wide flex items-center gap-1">
                              <Image className="h-3 w-3" /> Foto del problema
                            </p>
                            <a
                              href={ticket.photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">Ver foto adjunta</span>
                            </a>
                          </div>
                        )}

                        {ticket.adminResponse ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <p className="text-[10px] font-black text-emerald-700 uppercase mb-1 tracking-wide flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Respuesta de la administración
                            </p>
                            <p className="text-sm text-emerald-800">{ticket.adminResponse}</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-xs text-amber-700 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              La administración aún no registró una respuesta sobre este reclamo.
                            </p>
                          </div>
                        )}

                        {ticket.ownerNotifiedAt && (
                          <p className="text-[10px] text-muted-foreground text-right">
                            Notificado el {ticket.ownerNotifiedAt.slice(0, 10).split('-').reverse().join('/')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
