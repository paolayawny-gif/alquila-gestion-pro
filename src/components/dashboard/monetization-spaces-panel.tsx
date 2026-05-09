'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  MessageSquare,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { SUGGESTION_TEMPLATES } from '@/lib/monetization-templates';
import {
  MonetizationSuggestion,
  MonetizationOffer,
  MonetizationRequest,
  Property,
} from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_ID = 'alquilagestion-pro';

type TabId = 'sugerencias' | 'ofertas' | 'solicitudes';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  userId?: string;
  properties: Property[];
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
const SUGGESTION_STATUS_CFG = {
  enviada:      { label: 'Enviada',       className: 'bg-blue-100 text-blue-700 border-blue-200' },
  vista:        { label: 'Vista',         className: 'bg-gray-100 text-gray-600 border-gray-200' },
  interesado:   { label: 'Interesado',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  no_por_ahora: { label: 'No por ahora',  className: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;

const OFFER_STATUS_CFG = {
  pendiente:      { label: 'Pendiente',      className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  publicada:      { label: 'Publicada',      className: 'bg-green-100 text-green-700 border-green-200' },
  en_negociacion: { label: 'En negociación', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  confirmada:     { label: 'Confirmada',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazada:      { label: 'Rechazada',      className: 'bg-red-100 text-red-700 border-red-200' },
} as const;

const REQUEST_STATUS_CFG = {
  pendiente:        { label: 'Pendiente',         className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  en_proceso:       { label: 'En proceso',        className: 'bg-blue-100 text-blue-700 border-blue-200' },
  match_encontrado: { label: 'Match encontrado',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  confirmada:       { label: 'Confirmada',        className: 'bg-green-100 text-green-700 border-green-200' },
  rechazada:        { label: 'Rechazada',         className: 'bg-red-100 text-red-700 border-red-200' },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtMoney(n: number, currency: 'ARS' | 'USD' = 'ARS') {
  if (currency === 'USD') return `USD ${n.toLocaleString('es-AR')}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-AR')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Collapsible card for an inline notes+status edit on offers/requests */
function InlineEditRow({
  label,
  notes,
  onNotesChange,
  onSave,
}: {
  label: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <Label className="text-xs text-muted-foreground">Notas del admin</Label>
      <Textarea
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder="Añadí notas internas sobre este registro…"
        className="text-xs min-h-[60px] resize-none"
      />
      <Button size="sm" className="h-7 text-xs px-3 bg-accent text-white" onClick={onSave}>
        Guardar notas
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MonetizationSpacesPanel({ userId, properties }: Props) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite } = useOrgPermissions();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('sugerencias');

  // ── Firestore queries ──────────────────────────────────────────────────────
  const suggestionsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'monetizationSuggestions'),
      orderBy('sentAt', 'desc'),
    );
  }, [db, userId]);
  const { data: suggestionsRaw } = useCollection<MonetizationSuggestion>(suggestionsQ);
  const suggestions = suggestionsRaw ?? [];

  const offersQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'monetizationOffers'),
      orderBy('createdAt', 'desc'),
    );
  }, [db, userId]);
  const { data: offersRaw } = useCollection<MonetizationOffer>(offersQ);
  const offers = offersRaw ?? [];

  const requestsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'monetizationRequests'),
      orderBy('createdAt', 'desc'),
    );
  }, [db, userId]);
  const { data: requestsRaw } = useCollection<MonetizationRequest>(requestsQ);
  const requests = requestsRaw ?? [];

  // ── Send suggestion form state ─────────────────────────────────────────────
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingDialog, setSendingDialog] = useState(false);

  // ── Inline edit state (offers) ─────────────────────────────────────────────
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [offerNotesMap, setOfferNotesMap] = useState<Record<string, string>>({});

  // ── Inline edit state (requests) ──────────────────────────────────────────
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [requestNotesMap, setRequestNotesMap] = useState<Record<string, string>>({});

  // ── Counters for tab badges ────────────────────────────────────────────────
  const pendingOffers = offers.filter(o => o.status === 'pendiente').length;
  const pendingRequests = requests.filter(r => r.status === 'pendiente').length;
  const interestedSuggestions = suggestions.filter(s => s.status === 'interesado').length;

  // ── Handler: send suggestion ───────────────────────────────────────────────
  const handleSendSuggestion = () => {
    if (!ownerEmail.trim() || !selectedTemplateId || !db || !userId) {
      toast({ title: 'Completá el email del propietario y elegí una plantilla.', variant: 'destructive' });
      return;
    }
    const tpl = SUGGESTION_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!tpl) return;

    const property = properties.find(p => p.id === selectedPropertyId);
    const colRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'monetizationSuggestions');
    const data: Omit<MonetizationSuggestion, 'id'> = {
      ownerEmail: ownerEmail.trim(),
      ownerName: ownerName.trim() || ownerEmail.trim(),
      propertyId: property?.id,
      propertyName: property?.name,
      templateId: tpl.id,
      templateTitle: tpl.title,
      templateDescription: tpl.description,
      customMessage: customMessage.trim() || undefined,
      sentAt: new Date().toISOString(),
      status: 'enviada',
      isAutomatic: false,
    };

    addDocumentNonBlocking(colRef, data);
    toast({ title: 'Sugerencia enviada', description: `${tpl.title} → ${ownerEmail.trim()}` });

    // Reset form
    setOwnerEmail('');
    setOwnerName('');
    setSelectedPropertyId('');
    setSelectedTemplateId('');
    setCustomMessage('');
    setSendingDialog(false);
  };

  // ── Handler: update offer status ───────────────────────────────────────────
  const handleOfferStatus = (offer: MonetizationOffer, status: MonetizationOffer['status']) => {
    if (!db || !userId) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizationOffers', offer.id);
    setDocumentNonBlocking(ref, { status, updatedAt: new Date().toISOString() }, { merge: true });
    toast({ title: 'Estado actualizado', description: OFFER_STATUS_CFG[status].label });
  };

  // ── Handler: save offer notes ──────────────────────────────────────────────
  const handleSaveOfferNotes = (offer: MonetizationOffer) => {
    if (!db || !userId) return;
    const notes = offerNotesMap[offer.id] ?? offer.adminNotes ?? '';
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizationOffers', offer.id);
    setDocumentNonBlocking(ref, { adminNotes: notes, updatedAt: new Date().toISOString() }, { merge: true });
    toast({ title: 'Notas guardadas' });
  };

  // ── Handler: update request status ────────────────────────────────────────
  const handleRequestStatus = (req: MonetizationRequest, status: MonetizationRequest['status']) => {
    if (!db || !userId) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizationRequests', req.id);
    setDocumentNonBlocking(ref, { status }, { merge: true });
    toast({ title: 'Estado actualizado', description: REQUEST_STATUS_CFG[status].label });
  };

  // ── Handler: save request notes ────────────────────────────────────────────
  const handleSaveRequestNotes = (req: MonetizationRequest) => {
    if (!db || !userId) return;
    const notes = requestNotesMap[req.id] ?? req.adminNotes ?? '';
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'monetizationRequests', req.id);
    setDocumentNonBlocking(ref, { adminNotes: notes }, { merge: true });
    toast({ title: 'Notas guardadas' });
  };

  // ── Tab button style ───────────────────────────────────────────────────────
  const tabBtn = (id: TabId, label: string, count?: number) => (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        activeTab === id
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-muted-foreground hover:text-gray-700 hover:bg-white/60',
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center h-4.5 min-w-[1.25rem] px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-none py-0.5">
          {count}
        </span>
      )}
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-500">

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {tabBtn('sugerencias', 'Sugerencias', interestedSuggestions)}
        {tabBtn('ofertas', 'Ofertas de propietarios', pendingOffers)}
        {tabBtn('solicitudes', 'Solicitudes de inquilinos', pendingRequests)}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: SUGERENCIAS
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sugerencias' && (
        <div className="space-y-4">

          {/* Send panel */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-accent" />
                Enviar sugerencia a propietario
              </CardTitle>
              {canWrite && (
                <Button
                  size="sm"
                  className="bg-accent text-white gap-1.5 h-8 text-xs"
                  onClick={() => setSendingDialog(true)}
                >
                  <Send className="h-3.5 w-3.5" /> Nueva sugerencia
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {suggestions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Send className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hay sugerencias enviadas aún</p>
                  <p className="text-xs mt-1">Enviá ideas de monetización a tus propietarios.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map(s => {
                    const cfg = SUGGESTION_STATUS_CFG[s.status];
                    const isInterested = s.status === 'interesado';
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-colors',
                          isInterested
                            ? 'border-emerald-300 bg-emerald-50/60'
                            : 'border-border/50 bg-white hover:bg-muted/10',
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn(
                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-base',
                            isInterested ? 'bg-emerald-100' : 'bg-muted/40',
                          )}>
                            {SUGGESTION_TEMPLATES.find(t => t.id === s.templateId)?.emoji ?? '💡'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {s.templateTitle}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.ownerEmail}
                              {s.propertyName && ` · ${s.propertyName}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Enviada {fmtDate(s.sentAt)}
                              {s.repliedAt && ` · Respondida ${fmtDate(s.repliedAt)}`}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {isInterested && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-semibold border', cfg.className)}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interested alert */}
          {interestedSuggestions > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">
                <strong>{interestedSuggestions} propietario{interestedSuggestions > 1 ? 's' : ''}</strong>{' '}
                {interestedSuggestions > 1 ? 'han mostrado interés' : 'ha mostrado interés'} en explorar una
                oportunidad de monetización. Contactalos para coordinar los próximos pasos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: OFERTAS DE PROPIETARIOS
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ofertas' && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              Ofertas de espacios de propietarios
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {offers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Sin ofertas registradas</p>
                <p className="text-xs mt-1">Cuando un propietario ofrezca un espacio, aparecerá aquí.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {offers.map(offer => {
                  const cfg = OFFER_STATUS_CFG[offer.status];
                  const expanded = expandedOfferId === offer.id;
                  const localNotes = offerNotesMap[offer.id] ?? offer.adminNotes ?? '';

                  return (
                    <div
                      key={offer.id}
                      className="rounded-xl border border-border/50 overflow-hidden"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 p-3 hover:bg-muted/10">
                        <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {offer.ownerName}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] font-semibold border shrink-0', cfg.className)}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {offer.spaceType} · {offer.propertyName}
                          </p>
                          {offer.estimatedPrice && (
                            <p className="text-[10px] text-muted-foreground">
                              {fmtMoney(offer.estimatedPrice, offer.currency ?? 'ARS')}
                              {offer.area && ` · ${offer.area}`}
                            </p>
                          )}
                        </div>

                        {/* Status selector */}
                        {canWrite && (
                          <Select
                            value={offer.status}
                            onValueChange={v => handleOfferStatus(offer, v as MonetizationOffer['status'])}
                          >
                            <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(OFFER_STATUS_CFG) as MonetizationOffer['status'][]).map(s => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {OFFER_STATUS_CFG[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Expand toggle */}
                        <button
                          onClick={() => setExpandedOfferId(expanded ? null : offer.id)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground shrink-0"
                        >
                          {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {expanded && (
                        <div className="border-t border-border/40 bg-muted/5 px-4 pb-4 pt-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Descripción</span>
                              <p className="mt-0.5 text-gray-700 leading-relaxed">{offer.description}</p>
                            </div>
                            {offer.conditions && (
                              <div>
                                <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Condiciones</span>
                                <p className="mt-0.5 text-gray-700 leading-relaxed">{offer.conditions}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Email: <strong className="text-gray-700">{offer.ownerEmail}</strong></span>
                            <span>Creada: <strong className="text-gray-700">{fmtDate(offer.createdAt)}</strong></span>
                            <span>Actualizada: <strong className="text-gray-700">{fmtDate(offer.updatedAt)}</strong></span>
                          </div>
                          {canWrite && (
                            <InlineEditRow
                              label="Notas del admin"
                              notes={localNotes}
                              onNotesChange={v =>
                                setOfferNotesMap(prev => ({ ...prev, [offer.id]: v }))
                              }
                              onSave={() => handleSaveOfferNotes(offer)}
                            />
                          )}
                          {offer.adminNotes && !canWrite && (
                            <div>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notas admin</span>
                              <p className="text-xs text-gray-700 mt-0.5">{offer.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3: SOLICITUDES DE INQUILINOS
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'solicitudes' && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-accent" />
              Solicitudes de inquilinos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {requests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Sin solicitudes registradas</p>
                <p className="text-xs mt-1">Cuando un inquilino solicite un espacio, aparecerá aquí.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map(req => {
                  const cfg = REQUEST_STATUS_CFG[req.status];
                  const expanded = expandedRequestId === req.id;
                  const localNotes = requestNotesMap[req.id] ?? req.adminNotes ?? '';

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-border/50 overflow-hidden"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 p-3 hover:bg-muted/10">
                        <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {req.tenantName}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] font-semibold border shrink-0', cfg.className)}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {req.spaceType} · {req.propertyName}
                          </p>
                          {req.budget && (
                            <p className="text-[10px] text-muted-foreground">
                              Presupuesto: {fmtMoney(req.budget, req.currency ?? 'ARS')}
                              {req.duration && ` · ${req.duration}`}
                            </p>
                          )}
                        </div>

                        {/* Status selector */}
                        {canWrite && (
                          <Select
                            value={req.status}
                            onValueChange={v => handleRequestStatus(req, v as MonetizationRequest['status'])}
                          >
                            <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(REQUEST_STATUS_CFG) as MonetizationRequest['status'][]).map(s => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {REQUEST_STATUS_CFG[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Expand toggle */}
                        <button
                          onClick={() => setExpandedRequestId(expanded ? null : req.id)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground shrink-0"
                        >
                          {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {expanded && (
                        <div className="border-t border-border/40 bg-muted/5 px-4 pb-4 pt-3 space-y-3">
                          <div className="text-xs">
                            <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Descripción</span>
                            <p className="mt-0.5 text-gray-700 leading-relaxed">{req.description}</p>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Email: <strong className="text-gray-700">{req.tenantEmail}</strong></span>
                            <span>Creada: <strong className="text-gray-700">{fmtDate(req.createdAt)}</strong></span>
                            {req.duration && <span>Duración: <strong className="text-gray-700">{req.duration}</strong></span>}
                          </div>
                          {canWrite && (
                            <InlineEditRow
                              label="Notas del admin"
                              notes={localNotes}
                              onNotesChange={v =>
                                setRequestNotesMap(prev => ({ ...prev, [req.id]: v }))
                              }
                              onSave={() => handleSaveRequestNotes(req)}
                            />
                          )}
                          {req.adminNotes && !canWrite && (
                            <div>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notas admin</span>
                              <p className="text-xs text-gray-700 mt-0.5">{req.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DIALOG: Nueva Sugerencia
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={sendingDialog} onOpenChange={setSendingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar sugerencia a propietario</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Owner fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email del propietario *</Label>
                <Input
                  type="email"
                  placeholder="propietario@ejemplo.com"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nombre del propietario</Label>
                <Input
                  placeholder="Nombre (opcional)"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                />
              </div>
            </div>

            {/* Property selector (optional) */}
            {properties.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Propiedad relacionada (opcional)</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná una propiedad…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin propiedad específica</SelectItem>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Template selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Elegí una plantilla *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTION_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id === selectedTemplateId ? '' : tpl.id)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                      selectedTemplateId === tpl.id
                        ? 'border-accent bg-accent/5'
                        : 'border-border/50 hover:border-accent/40 hover:bg-muted/10',
                    )}
                  >
                    <span className="text-xl leading-none shrink-0 mt-0.5">{tpl.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{tpl.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {tpl.potentialNote}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom message */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensaje personalizado (opcional)</Label>
              <Textarea
                placeholder="Añadí contexto específico para este propietario…"
                className="min-h-[70px] resize-none text-sm"
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendingDialog(false)}>Cancelar</Button>
            <Button
              className="bg-accent text-white gap-2"
              onClick={handleSendSuggestion}
              disabled={!ownerEmail.trim() || !selectedTemplateId}
            >
              <Send className="h-4 w-4" /> Enviar sugerencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
