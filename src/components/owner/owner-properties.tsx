'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, MapPin, BedDouble, Ruler,
  Users, DollarSign, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { OwnerRegistryEntry } from './owner-portal';
import { Property, Contract } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';
import { fmtMoney as fmt } from '@/lib/format';

interface OwnerPropertiesProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerProperties({ ownerEntry }: OwnerPropertiesProps) {
  const db = useFirestore();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch properties from admin namespace
  useEffect(() => {
    if (!db || !ownerEntry.adminId) { setLoading(false); return; }
    getDocs(collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'propiedades'))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
        const mine = all.filter(p =>
          p.owners?.some(o => o.email.toLowerCase() === ownerEntry.ownerEmail.toLowerCase())
        );
        setProperties(mine);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);

  // Fetch contracts to show current tenant
  const contractsQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'contratos'),
    );
  }, [db, ownerEntry.adminId]);
  const { data: contractsRaw } = useCollection<Contract>(contractsQ);
  const contracts = contractsRaw ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Cargando propiedades…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Mis Propiedades</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {properties.length} propiedad{properties.length !== 1 ? 'es' : ''} asociada{properties.length !== 1 ? 's' : ''} a tu cuenta
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: properties.length,                                      color: 'text-foreground bg-muted/50' },
          { label: 'Alquiladas', value: properties.filter(p => p.status === 'Alquilada').length, color: 'text-green-700 bg-green-50'  },
          { label: 'Disponibles',value: properties.filter(p => p.status !== 'Alquilada').length,  color: 'text-amber-700 bg-amber-50'  },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className={cn('text-2xl font-black mt-1', s.color.split(' ')[0])}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {properties.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Sin propiedades asociadas</p>
            <p className="text-xs mt-1">La administración aún no ha registrado propiedades a tu nombre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {properties.map(p => {
            const myPart = p.owners?.find(o => o.email.toLowerCase() === ownerEntry.ownerEmail.toLowerCase());
            const activeContract = contracts.find(c =>
              c.propertyId === p.id && (c.status === 'Vigente' || c.status === 'Próximo a Vencer')
            );
            return (
              <Card key={p.id} className="border-none shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
                {/* Status bar */}
                <div className={cn('h-1.5 w-full', p.status === 'Alquilada' ? 'bg-green-500' : 'bg-amber-400')} />
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-black leading-tight">{p.name}</CardTitle>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {p.address}
                      </p>
                    </div>
                    <Badge className={cn(
                      'text-[10px] font-black border shrink-0',
                      p.status === 'Alquilada' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}>
                      {p.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Property details */}
                  <div className="grid grid-cols-2 gap-3">
                    {p.rooms !== undefined && (
                      <div className="flex flex-col items-center p-2.5 bg-muted/30 rounded-xl">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                        <span className="text-xs font-black">{p.rooms}</span>
                        <span className="text-[9px] text-muted-foreground">Amb.</span>
                      </div>
                    )}
                    {p.squareMeters !== undefined && (
                      <div className="flex flex-col items-center p-2.5 bg-muted/30 rounded-xl">
                        <Ruler className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                        <span className="text-xs font-black">{p.squareMeters}</span>
                        <span className="text-[9px] text-muted-foreground">m²</span>
                      </div>
                    )}
                  </div>

                  {/* My participation */}
                  {myPart && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                      <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Mi participación
                      </span>
                      <span className="text-sm font-black text-emerald-700">{myPart.percentage}%</span>
                    </div>
                  )}

                  {/* Current contract */}
                  {activeContract && (
                    <div className="space-y-1.5 p-3 border border-border/40 rounded-xl">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Contrato activo</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Inquilino
                        </span>
                        <span className="text-xs font-bold">{activeContract.tenantName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Alquiler
                        </span>
                        <span className="text-xs font-black text-emerald-700">
                          {fmt(activeContract.currentRentAmount, activeContract.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Vence</span>
                        <span className="text-xs font-bold">
                          {activeContract.endDate?.split('-').reverse().join('/') ?? '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {!activeContract && p.status !== 'Alquilada' && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700">Propiedad disponible para alquilar</p>
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
