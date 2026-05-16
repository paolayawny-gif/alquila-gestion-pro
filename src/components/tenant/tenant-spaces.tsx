'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Building2, CheckCircle2, Clock, Loader2, Plus, Send, Sparkles, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { TenantRegistryEntry } from './tenant-portal';
import { MonetizationOffer, MonetizationRequest, SpaceType } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

// ── Emoji map ─────────────────────────────────────────────────────────────────
const SPACE_EMOJI: Record<SpaceType, string> = {
  'Cochera / Estacionamiento':    '🚗',
  'Publicidad exterior':          '📢',
  'Baulera / Depósito':           '📦',
  'Local comercial':              '🏪',
  'Terraza (antenas / paneles)':  '📡',
  'Vending machines':             '🥤',
  'SUM / Salón de eventos':       '🎉',
  'Coworking':                    '💼',
  'Otro':                         '✨',
};

const SPACE_TYPES: SpaceType[] = [
  'Publicidad exterior',
  'Cochera / Estacionamiento',
  'Baulera / Depósito',
  'Local comercial',
  'Terraza (antenas / paneles)',
  'Vending machines',
  'SUM / Salón de eventos',
  'Coworking',
  'Otro',
];

// ── Request status badges ─────────────────────────────────────────────────────
type RequestStatus = MonetizationRequest['status'];

const REQUEST_STATUS_CFG: Record<RequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendiente:         { label: 'Pendiente',         color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  icon: Clock        },
  en_proceso:        { label: 'En proceso',        color: 'bg-blue-50 text-blue-700 border-blue-200',        icon: Loader2      },
  match_encontrado:  { label: 'Match encontrado',  color: 'bg-purple-50 text-purple-700 border-purple-200',  icon: Sparkles     },
  confirmada:        { label: 'Confirmada',         color: 'bg-green-50 text-green-700 border-green-200',     icon: CheckCircle2 },
  rechazada:         { label: 'Rechazada',          color: 'bg-red-50 text-red-700 border-red-200',           icon: X            },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
import { fmtMoney as fmt } from '@/lib/format';

function formatDate(iso: string | undefined) {
  return iso?.slice(0, 10).split('-').reverse().join('/') ?? '—';
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  tenantEntry: TenantRegistryEntry;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TenantSpaces({ tenantEntry }: Props) {
  const db = useFirestore();
  const { toast } = useToast();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [spaceType, setSpaceType] = useState<SpaceType>('Otro');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Live data: published offers for this property ────────────────────────
  const offersQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.propertyId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'monetizationOffers'),
      where('propertyId', '==', tenantEntry.propertyId),
      where('status', '==', 'publicada'),
    );
  }, [db, tenantEntry.adminId, tenantEntry.propertyId]);
  const { data: offersRaw } = useCollection<MonetizationOffer>(offersQ);
  const offers = [...(offersRaw ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  // ── Live data: tenant's requests ─────────────────────────────────────────
  const requestsQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'monetizationRequests'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.adminId, tenantEntry.tenantEmail]);
  const { data: requestsRaw } = useCollection<MonetizationRequest>(requestsQ);
  const myRequests = [...(requestsRaw ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  // ── Submit new request ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: 'Describí el espacio que necesitás', variant: 'destructive' });
      return;
    }
    if (!db) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const req: Omit<MonetizationRequest, 'id'> = {
        tenantEmail:  tenantEntry.tenantEmail,
        tenantName:   tenantEntry.tenantName,
        propertyId:   tenantEntry.propertyId,
        propertyName: tenantEntry.propertyName,
        spaceType,
        description:  description.trim(),
        budget:       budget ? Number(budget) : undefined,
        currency:     budget ? currency : undefined,
        duration:     duration.trim() || undefined,
        status:       'pendiente',
        createdAt:    now,
      };
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'monetizationRequests'),
        req,
      );
      toast({ title: 'Solicitud enviada', description: 'La administración recibirá tu pedido en breve.' });
      setDescription('');
      setBudget('');
      setDuration('');
      setSpaceType('Otro');
      setCurrency('ARS');
    } catch {
      toast({ title: 'Error al enviar', description: 'Intentá de nuevo más tarde.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Quick-consult from an offer ────────────────────────────────────────────
  async function handleConsult(offer: MonetizationOffer) {
    if (!db) return;
    try {
      const now = new Date().toISOString();
      const req: Omit<MonetizationRequest, 'id'> = {
        tenantEmail:  tenantEntry.tenantEmail,
        tenantName:   tenantEntry.tenantName,
        propertyId:   tenantEntry.propertyId,
        propertyName: tenantEntry.propertyName,
        spaceType:    offer.spaceType,
        description:  `Consulta sobre espacio publicado: ${offer.description}`,
        budget:       undefined,
        currency:     undefined,
        duration:     undefined,
        status:       'pendiente',
        createdAt:    now,
      };
      await addDoc(
        collection(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'monetizationRequests'),
        req,
      );
      toast({ title: 'Consulta enviada', description: 'La administración te contactará a la brevedad.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la consulta.', variant: 'destructive' });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">Espacios disponibles</h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {tenantEntry.propertyName}
        </p>
      </div>

      {/* ── Section 1: Published offers ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-black text-foreground">
          Espacios disponibles en tu propiedad
        </h2>

        {offers.length === 0 ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="py-12 text-center text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Building2 className="h-7 w-7 text-primary/50" />
              </div>
              <p className="font-semibold text-sm">No hay espacios publicados en tu propiedad por el momento.</p>
              <p className="text-xs mt-1">Podés enviar una solicitud si necesitás un espacio específico.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {offers.map(offer => (
              <Card key={offer.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl shrink-0" aria-hidden="true">
                        {SPACE_EMOJI[offer.spaceType]}
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-foreground leading-tight">{offer.spaceType}</p>
                        {offer.area && (
                          <p className="text-[10px] text-muted-foreground">{offer.area}</p>
                        )}
                      </div>
                    </div>
                    {offer.estimatedPrice != null && offer.currency && (
                      <span className="shrink-0 font-black text-primary text-sm">
                        {fmt(offer.estimatedPrice, offer.currency)}
                        <span className="text-[10px] text-muted-foreground font-normal">/mes</span>
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {offer.description}
                  </p>

                  {/* Conditions */}
                  {offer.conditions && (
                    <div className="p-2.5 bg-muted/30 rounded-lg">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Condiciones</p>
                      <p className="text-xs text-foreground">{offer.conditions}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    size="sm"
                    className="w-full gap-2 font-bold bg-primary text-white mt-1"
                    onClick={() => handleConsult(offer)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Consultar al administrador
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Tenant's own requests ────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-black text-foreground">Mis solicitudes</h2>

        {myRequests.length === 0 ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">Todavía no enviaste ninguna solicitud.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-4 pb-2 divide-y divide-border/40">
              {myRequests.map(req => {
                const cfg = REQUEST_STATUS_CFG[req.status];
                const Icon = cfg.icon;
                return (
                  <div key={req.id} className="py-3 flex items-start gap-3">
                    <span className="text-xl shrink-0 pt-0.5" aria-hidden="true">
                      {SPACE_EMOJI[req.spaceType]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-foreground">{req.spaceType}</p>
                        <Badge className={cn('border text-[10px] font-bold gap-1 py-0', cfg.color)}>
                          <Icon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.description}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {req.budget != null && req.currency && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            Presupuesto: {fmt(req.budget, req.currency)}
                          </span>
                        )}
                        {req.duration && (
                          <span className="text-[10px] text-muted-foreground">Duración: {req.duration}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDate(req.createdAt)}
                        </span>
                      </div>
                      {req.adminNotes && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide mb-0.5">Nota del admin</p>
                          <p className="text-xs text-blue-800">{req.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 3: New request form ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-black text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Solicitar un espacio
        </h2>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Contanos qué necesitás y la administración te contactará.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Space type */}
              <div className="space-y-1.5">
                <Label htmlFor="space-type">Tipo de espacio</Label>
                <Select value={spaceType} onValueChange={v => setSpaceType(v as SpaceType)}>
                  <SelectTrigger id="space-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPACE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {SPACE_EMOJI[t]} {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  placeholder="¿Qué necesitás? Descripción del espacio que buscás"
                  className="min-h-[90px] resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Budget row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Presupuesto (opcional)</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej: 50000"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={currency} onValueChange={v => setCurrency(v as 'ARS' | 'USD')}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS — Pesos</SelectItem>
                      <SelectItem value="USD">USD — Dólares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <Label htmlFor="duration">Duración estimada (opcional)</Label>
                <Input
                  id="duration"
                  placeholder="Ej: 6 meses"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2 font-bold bg-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
