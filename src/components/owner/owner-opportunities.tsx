'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lightbulb, Plus, CheckCircle2, XCircle, Clock, Building2,
  Info, ChevronDown, ChevronUp, Sparkles, Send, PackageSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { OwnerRegistryEntry } from './owner-portal';
import { MonetizationSuggestion, MonetizationOffer, SpaceType } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

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

const SPACE_TYPE_EMOJI: Record<SpaceType, string> = {
  'Publicidad exterior':        '📢',
  'Cochera / Estacionamiento':  '🚗',
  'Baulera / Depósito':         '📦',
  'Local comercial':            '🏪',
  'Terraza (antenas / paneles)':'📡',
  'Vending machines':           '🥤',
  'SUM / Salón de eventos':     '🎉',
  'Coworking':                  '💻',
  'Otro':                       '📋',
};

const OFFER_STATUS_STYLE: Record<MonetizationOffer['status'], string> = {
  pendiente:       'bg-amber-50 text-amber-700 border-amber-200',
  publicada:       'bg-green-50 text-green-700 border-green-200',
  en_negociacion:  'bg-blue-50 text-blue-700 border-blue-200',
  confirmada:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  rechazada:       'bg-red-50 text-red-700 border-red-200',
};

const OFFER_STATUS_LABEL: Record<MonetizationOffer['status'], string> = {
  pendiente:      'Pendiente',
  publicada:      'Publicada',
  en_negociacion: 'En negociación',
  confirmada:     'Confirmada',
  rechazada:      'Rechazada',
};

interface Props {
  ownerEntry: OwnerRegistryEntry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion card — handles its own "mark as seen" side-effect
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion,
  adminId,
  db,
  onReply,
  replying,
}: {
  suggestion: MonetizationSuggestion;
  adminId: string;
  db: ReturnType<typeof useFirestore>;
  onReply: (id: string, status: 'interesado' | 'no_por_ahora') => void;
  replying: string | null;
}) {
  const markedRef = useRef(false);
  const isReplied = suggestion.status === 'interesado' || suggestion.status === 'no_por_ahora';

  // Mark as 'vista' once rendered if still 'enviada'
  useEffect(() => {
    if (markedRef.current) return;
    if (suggestion.status !== 'enviada') return;
    markedRef.current = true;
    const ref = doc(
      db,
      'artifacts', APP_ID, 'users', adminId, 'monetizationSuggestions',
      suggestion.id,
    );
    updateDoc(ref, { status: 'vista', seenAt: new Date().toISOString() }).catch(() => {});
  }, [suggestion.id, suggestion.status, db, adminId]);

  return (
    <Card
      className={cn(
        'border-none shadow-sm transition-all',
        isReplied ? 'bg-muted/30 opacity-60' : 'bg-white',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0',
            isReplied ? 'bg-muted/40' : 'bg-emerald-50',
          )}>
            <Lightbulb className={cn('h-5 w-5', isReplied ? 'text-muted-foreground' : 'text-emerald-600')} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className={cn('font-bold text-sm', isReplied && 'text-muted-foreground')}>
                {suggestion.templateTitle}
              </p>
              {isReplied && (
                <Badge className={cn(
                  'text-[10px] font-bold border shrink-0',
                  suggestion.status === 'interesado'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200',
                )}>
                  {suggestion.status === 'interesado' ? '✓ Me interesa' : 'No por ahora'}
                </Badge>
              )}
            </div>

            {/* Description */}
            <p className={cn(
              'text-sm mt-1',
              isReplied ? 'text-muted-foreground/70' : 'text-muted-foreground',
            )}>
              {suggestion.templateDescription}
            </p>

            {/* Custom message from admin */}
            {suggestion.customMessage && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">{suggestion.customMessage}</p>
              </div>
            )}

            {/* Property tag */}
            {suggestion.propertyName && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {suggestion.propertyName}
              </p>
            )}

            {/* Action buttons — only when not yet replied */}
            {!isReplied && (
              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  disabled={replying === suggestion.id}
                  onClick={() => onReply(suggestion.id, 'interesado')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Me interesa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={replying === suggestion.id}
                  onClick={() => onReply(suggestion.id, 'no_por_ahora')}
                  className="text-xs h-8 px-4 text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  No por ahora
                </Button>
              </div>
            )}

            {/* Replied-at date */}
            {isReplied && suggestion.repliedAt && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Respondido el {suggestion.repliedAt.slice(0, 10).split('-').reverse().join('/')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function OwnerOpportunities({ ownerEntry }: Props) {
  const db = useFirestore();
  const { toast } = useToast();

  // ── Suggestions ────────────────────────────────────────────────────────────
  const suggestionsQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'monetizationSuggestions'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: suggestionsRaw } = useCollection<MonetizationSuggestion>(suggestionsQ);

  const suggestions = [...(suggestionsRaw ?? [])].sort(
    (a, b) => b.sentAt.localeCompare(a.sentAt),
  );
  const pendingSuggestions  = suggestions.filter(s => s.status === 'enviada' || s.status === 'vista');
  const repliedSuggestions  = suggestions.filter(s => s.status === 'interesado' || s.status === 'no_por_ahora');

  const [replying, setReplying] = useState<string | null>(null);

  async function handleReply(id: string, status: 'interesado' | 'no_por_ahora') {
    if (!db) return;
    setReplying(id);
    try {
      const ref = doc(
        db,
        'artifacts', APP_ID, 'users', ownerEntry.adminId, 'monetizationSuggestions', id,
      );
      await updateDoc(ref, { status, repliedAt: new Date().toISOString() });
      toast({
        title: status === 'interesado' ? '¡Genial! Tu interés fue registrado.' : 'Respuesta registrada.',
        description: status === 'interesado'
          ? 'El administrador se pondrá en contacto contigo.'
          : 'Podés cambiar de opinión en cualquier momento.',
      });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la respuesta.', variant: 'destructive' });
    } finally {
      setReplying(null);
    }
  }

  // ── Offers ─────────────────────────────────────────────────────────────────
  const offersQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'monetizationOffers'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: offersRaw } = useCollection<MonetizationOffer>(offersQ);

  const offers = [...(offersRaw ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // ── Offer form ─────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReplied, setShowReplied] = useState(false);

  const [form, setForm] = useState({
    propertyId:     ownerEntry.propertyIds[0] ?? '',
    propertyName:   ownerEntry.propertyNames[0] ?? '',
    spaceType:      '' as SpaceType | '',
    description:    '',
    estimatedPrice: '',
    currency:       'ARS' as 'ARS' | 'USD',
    area:           '',
    conditions:     '',
  });

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Sync propertyName when propertyId changes
  function handlePropertyChange(id: string) {
    const idx = ownerEntry.propertyIds.indexOf(id);
    setForm(prev => ({
      ...prev,
      propertyId:   id,
      propertyName: idx >= 0 ? (ownerEntry.propertyNames[idx] ?? '') : '',
    }));
  }

  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !form.spaceType || !form.description.trim() || !form.propertyId) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const payload: Omit<MonetizationOffer, 'id'> = {
        ownerEmail:     ownerEntry.ownerEmail,
        ownerName:      ownerEntry.ownerName,
        propertyId:     form.propertyId,
        propertyName:   form.propertyName,
        spaceType:      form.spaceType as SpaceType,
        description:    form.description.trim(),
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : undefined,
        currency:       form.currency,
        area:           form.area.trim() || undefined,
        conditions:     form.conditions.trim() || undefined,
        status:         'pendiente',
        createdAt:      now,
        updatedAt:      now,
      };

      await addDoc(
        collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'monetizationOffers'),
        payload,
      );

      toast({
        title: 'Oferta enviada',
        description: 'El administrador revisará tu propuesta y te contactará.',
      });

      // Reset form
      setForm({
        propertyId:     ownerEntry.propertyIds[0] ?? '',
        propertyName:   ownerEntry.propertyNames[0] ?? '',
        spaceType:      '',
        description:    '',
        estimatedPrice: '',
        currency:       'ARS',
        area:           '',
        conditions:     '',
      });
      setShowForm(false);
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la oferta.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black">Oportunidades de Monetización</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sugerencias de tu administrador y espacios que podés ofrecer para generar ingresos extras.
        </p>
      </div>

      {/* ── Section 1: Suggestions ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-black text-base">Sugerencias del administrador</h2>
            <p className="text-xs text-muted-foreground">
              Oportunidades identificadas para tus propiedades
            </p>
          </div>
          {pendingSuggestions.length > 0 && (
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 font-bold text-[10px]">
              {pendingSuggestions.length} nueva{pendingSuggestions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {suggestions.length === 0 ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="py-14 text-center text-muted-foreground">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">Aún sin sugerencias</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                Tu administrador aún no envió sugerencias de monetización.
                Cuando lo haga, aparecerán aquí para que puedas responder.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Pending suggestions */}
            {pendingSuggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                adminId={ownerEntry.adminId}
                db={db}
                onReply={handleReply}
                replying={replying}
              />
            ))}

            {/* Replied suggestions — collapsible */}
            {repliedSuggestions.length > 0 && (
              <div>
                <button
                  onClick={() => setShowReplied(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {showReplied
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                  {showReplied ? 'Ocultar' : 'Ver'} respondidas ({repliedSuggestions.length})
                </button>

                {showReplied && (
                  <div className="space-y-3 mt-2">
                    {repliedSuggestions.map(s => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        adminId={ownerEntry.adminId}
                        db={db}
                        onReply={handleReply}
                        replying={replying}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: Offers ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <PackageSearch className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-base">Mis ofertas de espacios</h2>
            <p className="text-xs text-muted-foreground">
              Espacios disponibles que ofreciste a la administración
            </p>
          </div>
          {!showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ofrecer un espacio
            </Button>
          )}
        </div>

        {/* Inline offer form */}
        {showForm && (
          <Card className="border border-emerald-100 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" />
                Nueva oferta de espacio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitOffer} className="space-y-4">

                {/* Property */}
                {ownerEntry.propertyIds.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Propiedad *</Label>
                    <Select
                      value={form.propertyId}
                      onValueChange={handlePropertyChange}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Seleccioná una propiedad" />
                      </SelectTrigger>
                      <SelectContent>
                        {ownerEntry.propertyIds.map((id, i) => (
                          <SelectItem key={id} value={id}>
                            {ownerEntry.propertyNames[i] ?? id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Space type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Tipo de espacio *</Label>
                  <Select
                    value={form.spaceType}
                    onValueChange={v => setField('spaceType', v as SpaceType)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Seleccioná el tipo de espacio" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPACE_TYPES.map(t => (
                        <SelectItem key={t} value={t}>
                          {SPACE_TYPE_EMOJI[t]} {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Descripción *</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Describí el espacio, sus características y para qué podría usarse…"
                    className="text-sm min-h-[80px] resize-none"
                    required
                  />
                </div>

                {/* Price row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Precio estimado <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.estimatedPrice}
                      onChange={e => setField('estimatedPrice', e.target.value)}
                      placeholder="Ej: 50000"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Moneda</Label>
                    <Select
                      value={form.currency}
                      onValueChange={v => setField('currency', v as 'ARS' | 'USD')}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">ARS $</SelectItem>
                        <SelectItem value="USD">USD u$s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Area */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Superficie <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Input
                    value={form.area}
                    onChange={e => setField('area', e.target.value)}
                    placeholder="Ej: 20m²"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Conditions */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Condiciones o requisitos <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Textarea
                    value={form.conditions}
                    onChange={e => setField('conditions', e.target.value)}
                    placeholder="Ej: solo por temporada, horario limitado, acceso independiente…"
                    className="text-sm min-h-[60px] resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                    className="text-xs h-8"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !form.spaceType || !form.description.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-5"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 animate-spin" />
                        Enviando…
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Send className="h-3.5 w-3.5" />
                        Enviar oferta
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Existing offers list */}
        {offers.length === 0 && !showForm ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="py-14 text-center text-muted-foreground">
              <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">Sin ofertas todavía</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                ¿Tenés un espacio libre en tu propiedad? Ofrecelo para que el administrador
                encuentre interesados y genere ingresos extras.
              </p>
              <Button
                size="sm"
                onClick={() => setShowForm(true)}
                className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-5"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ofrecer un espacio
              </Button>
            </CardContent>
          </Card>
        ) : (
          offers.length > 0 && (
            <div className="space-y-3">
              {offers.map(offer => (
                <Card key={offer.id} className="border-none shadow-sm bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Emoji icon */}
                      <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center text-lg shrink-0">
                        {SPACE_TYPE_EMOJI[offer.spaceType] ?? '📋'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-bold text-sm">{offer.spaceType}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {offer.propertyName}
                            </p>
                          </div>
                          <Badge className={cn(
                            'text-[10px] font-bold border shrink-0',
                            OFFER_STATUS_STYLE[offer.status],
                          )}>
                            {OFFER_STATUS_LABEL[offer.status]}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {offer.description}
                        </p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {offer.estimatedPrice != null && (
                            <span className="text-xs text-emerald-700 font-bold">
                              {offer.currency === 'USD' ? 'u$s' : '$'}
                              {offer.estimatedPrice.toLocaleString('es-AR')}
                            </span>
                          )}
                          {offer.area && (
                            <span className="text-xs text-muted-foreground">{offer.area}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {offer.createdAt.slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        </div>

                        {offer.adminNotes && (
                          <div className="mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide mb-0.5">
                              Nota del administrador
                            </p>
                            <p className="text-xs text-blue-700">{offer.adminNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  );
}
