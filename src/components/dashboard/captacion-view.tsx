'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Search, Globe, Mail, Phone, Plus, Loader2, CheckCircle2,
  Star, Trash2, Edit2, Send, AlertTriangle, ExternalLink,
  Users, TrendingUp, Target, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { sendEmail } from '@/services/email-service';
import { ARGENTINA_PROVINCES, ARGENTINA_CITIES } from '@/lib/argentina-cities';
import type { Lead, LeadStatus, GoogleLeadResult } from '@/lib/types';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDeleteButton } from '@/components/ui/confirm-delete-button';

const APP_ID = 'alquilagestion-pro';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; dot: string }> = {
  'Nuevo':       { label: 'Nuevo',       color: 'bg-slate-100 text-slate-700 border-slate-200',   dot: 'bg-slate-400' },
  'Contactado':  { label: 'Contactado',  color: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-400' },
  'Interesado':  { label: 'Interesado',  color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  'Demo':        { label: 'Demo',        color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'Suscripto':   { label: 'Suscripto',   color: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500' },
  'Descartado':  { label: 'Descartado',  color: 'bg-red-100 text-red-600 border-red-200',         dot: 'bg-red-400' },
};

const LEAD_STATUSES = Object.keys(STATUS_CONFIG) as LeadStatus[];

const PIPELINE_STEPS: LeadStatus[] = ['Nuevo', 'Contactado', 'Interesado', 'Demo', 'Suscripto'];

const EMAIL_TEMPLATE = (agencia: string) => `Estimado equipo de ${agencia},

Me comunico desde AlquilaGestión Pro, una plataforma de gestión inmobiliaria diseñada para administradoras y agentes del mercado argentino.

Nuestra solución les permite gestionar propiedades, contratos, facturas, liquidaciones y mucho más desde un solo lugar — con soporte para actualizaciones ICL/IPC, multi-moneda (ARS/USD/UVA), panel fiscal por provincia y portal para propietarios e inquilinos.

Me gustaría agendar una demo de 20 minutos para mostrarles cómo podría simplificar su operación diaria.

¿Tienen disponibilidad esta semana?

Saludos cordiales,
Equipo AlquilaGestión Pro`;

interface CaptacionViewProps {
  userId?: string;
}

export function CaptacionView({ userId }: CaptacionViewProps) {
  const { toast } = useToast();
  const db = useFirestore();

  // — Búsqueda Google —
  const [provincia, setProvincia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GoogleLeadResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // — Leads CRM —
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<Partial<Lead>>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [isEmailOpen, setIsEmailOpen] = useState(false);

  // — Firestore —
  const leadsQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads'));
  }, [db, userId]);
  const { data: leadsRaw } = useCollection<Lead>(leadsQuery);
  const leads = leadsRaw ?? [];

  const cities = provincia ? (ARGENTINA_CITIES[provincia] ?? []) : [];

  const filteredLeads = useMemo(() => {
    let base = leads;
    if (statusFilter !== 'all') base = base.filter(l => l.status === statusFilter);
    if (leadSearch) {
      const s = leadSearch.toLowerCase();
      base = base.filter(l =>
        (l.agencia ?? '').toLowerCase().includes(s) ||
        (l.ciudad ?? '').toLowerCase().includes(s) ||
        l.email?.toLowerCase().includes(s),
      );
    }
    return [...base].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, statusFilter, leadSearch]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<LeadStatus, number> = {} as any;
    LEAD_STATUSES.forEach(s => { counts[s] = leads.filter(l => l.status === s).length; });
    return counts;
  }, [leads]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!ciudad || !provincia) {
      toast({ title: 'Seleccioná provincia y ciudad', variant: 'destructive' }); return;
    }
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    setSetupHint(null);
    setIsDemo(false);
    try {
      const res = await fetch(`/api/superadmin/buscar-leads?ciudad=${encodeURIComponent(ciudad)}&provincia=${encodeURIComponent(provincia)}`);
      const json = await res.json();
      if (json.error && !json.demo) {
        setSearchError(json.error);
        if (json.setup) setSetupHint(json.setup);
      } else {
        if (json.demo) setIsDemo(true);
        setSearchResults(json.results ?? []);
      }
    } catch {
      setSearchError('Error de conexión. Verificá tu acceso a internet.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportLead = (result: GoogleLeadResult) => {
    if (!db || !userId) return;
    const alreadyExists = leads.some(l => l.website === result.website || (result.email && l.email === result.email));
    if (alreadyExists) {
      toast({ title: 'Ya existe', description: 'Este lead ya fue importado anteriormente.' }); return;
    }
    const id = `lead_${Date.now()}`;
    const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', id);
    const lead: Lead = {
      id, agencia: result.agencia, email: result.email,
      website: result.website, ciudad: result.ciudad,
      provincia: result.provincia, status: 'Nuevo',
      snippet: result.snippet, source: 'google',
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, lead, {});
    toast({ title: 'Lead importado', description: result.agencia });
  };

  const handleSaveManual = () => {
    if (!manualForm.agencia || !db || !userId) return;
    const id = `lead_${Date.now()}`;
    const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', id);
    const lead: Lead = {
      id, agencia: manualForm.agencia!, email: manualForm.email,
      phone: manualForm.phone, website: manualForm.website,
      ciudad: manualForm.ciudad ?? ciudad, provincia: manualForm.provincia ?? provincia,
      status: 'Nuevo', source: 'manual', notes: manualForm.notes,
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, lead, {});
    setIsManualOpen(false);
    setManualForm({});
    toast({ title: 'Lead creado', description: manualForm.agencia });
  };

  const handleSaveEdit = () => {
    if (!selectedLead || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', selectedLead.id);
    setDocumentNonBlocking(ref, { ...editForm, lastContactAt: new Date().toISOString() }, { merge: true });
    setIsEditOpen(false);
    toast({ title: 'Lead actualizado' });
  };

  const handleChangeStatus = (lead: Lead, status: LeadStatus) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', lead.id);
    setDocumentNonBlocking(ref, { status, lastContactAt: new Date().toISOString() }, { merge: true });
  };

  const handleDeleteLead = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', id));
  };

  const handleOpenEmail = (lead: Lead) => {
    setSelectedLead(lead);
    setEmailBody(EMAIL_TEMPLATE(lead.agencia));
    setIsEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedLead?.email) return;
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: selectedLead.email,
        subject: `AlquilaGestión Pro — Demo para ${selectedLead.agencia}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;white-space:pre-line;">${emailBody}</div>`,
      });
      // Marcar como contactado
      if (selectedLead.status === 'Nuevo' && db) {
        const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'leads', selectedLead.id);
        setDocumentNonBlocking(ref, { status: 'Contactado', lastContactAt: new Date().toISOString() }, { merge: true });
      }
      toast({ title: 'Email enviado', description: `A ${selectedLead.agencia}` });
      setIsEmailOpen(false);
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {PIPELINE_STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={cn(
              'rounded-xl p-3 text-left transition-all border',
              statusFilter === s ? 'ring-2 ring-primary shadow-md' : 'bg-white shadow-sm hover:shadow-md',
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn('h-2 w-2 rounded-full', STATUS_CONFIG[s].dot)} />
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-muted-foreground/40 text-xs">→</span>
              )}
            </div>
            <p className="text-xs font-bold text-muted-foreground">{s}</p>
            <p className="text-2xl font-black">{pipelineCounts[s]}</p>
          </button>
        ))}
        <button
          onClick={() => setStatusFilter(statusFilter === 'Descartado' ? 'all' : 'Descartado')}
          className={cn(
            'rounded-xl p-3 text-left transition-all border',
            statusFilter === 'Descartado' ? 'ring-2 ring-destructive shadow-md' : 'bg-white shadow-sm',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
          </div>
          <p className="text-xs font-bold text-muted-foreground">Descartado</p>
          <p className="text-2xl font-black text-red-500">{pipelineCounts['Descartado']}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Buscador Google ─────────────────────────────────── */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" /> Buscar inmobiliarias en Google
            </CardTitle>
            <CardDescription className="text-[11px]">
              Buscá por ciudad y provincia para encontrar agencias con sus correos de contacto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Provincia</Label>
                <Select value={provincia} onValueChange={v => { setProvincia(v); setCiudad(''); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccioná..." /></SelectTrigger>
                  <SelectContent>
                    {ARGENTINA_PROVINCES.map(p => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Select value={ciudad} onValueChange={setCiudad} disabled={!provincia}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccioná..." /></SelectTrigger>
                  <SelectContent>
                    {cities.map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
              onClick={handleSearch}
              disabled={isSearching || !ciudad}
            >
              {isSearching
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
                : <><Search className="h-4 w-4" /> Buscar en Google</>}
            </Button>

            {setupHint && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <p className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Búsqueda no configurada
                </p>
                <p className="text-[10px] text-amber-800 leading-tight">{setupHint}</p>
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 underline">
                  Ir a Google Cloud Console →
                </a>
              </div>
            )}

            {searchError && !setupHint && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {searchError}
              </p>
            )}

            {isDemo && (
              <p className="text-[10px] text-muted-foreground italic">
                Modo demo activo. Configurá SERPER_API_KEY en Vercel para búsquedas reales.
              </p>
            )}

            {/* Resultados */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((r, i) => {
                  const alreadyImported = leads.some(l => l.website === r.website || (r.email && l.email === r.email));
                  return (
                    <div key={i} className={cn(
                      'p-3 rounded-lg border space-y-1.5 text-xs',
                      alreadyImported ? 'bg-green-50 border-green-200' : 'bg-muted/30',
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold truncate">{r.agencia}</p>
                          {r.email && (
                            <p className="text-blue-600 font-mono text-[11px]">{r.email}</p>
                          )}
                          {r.emails.length > 1 && (
                            <p className="text-muted-foreground text-[10px]">
                              +{r.emails.length - 1} email{r.emails.length > 2 ? 's' : ''} más
                            </p>
                          )}
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground text-[10px] flex items-center gap-0.5 hover:text-primary truncate max-w-[200px]">
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              {r.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                        </div>
                        {alreadyImported ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 text-[9px] shrink-0">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Importado
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2 bg-primary text-white font-bold shrink-0"
                            onClick={() => handleImportLead(r)}
                          >
                            <Plus className="h-3 w-3 mr-0.5" /> Importar
                          </Button>
                        )}
                      </div>
                      {r.snippet && (
                        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2 italic">
                          {r.snippet}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── CRM de Leads ──────────────────────────────────── */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Mis leads ({leads.length})
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => { setManualForm({ ciudad, provincia }); setIsManualOpen(true); }}
              >
                <Plus className="h-3 w-3" /> Manual
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Buscar por agencia, ciudad o email..."
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['all', ...LEAD_STATUSES] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors',
                    statusFilter === s
                      ? 'bg-primary text-white border-primary'
                      : 'bg-muted/40 text-muted-foreground border-transparent hover:border-muted',
                  )}
                >
                  {s === 'all' ? 'Todos' : s}
                </button>
              ))}
            </div>

            {filteredLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Sin leads"
                description="Buscá inmobiliarias en Google o agregá leads manualmente."
              />
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredLeads.map(lead => {
                  const sc = STATUS_CONFIG[lead.status];
                  return (
                    <div key={lead.id} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{lead.agencia}</p>
                          <p className="text-[10px] text-muted-foreground">{lead.ciudad} · {lead.provincia}</p>
                          {lead.email && (
                            <p className="text-[10px] text-blue-600 font-mono">{lead.email}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={cn('text-[9px] shrink-0 border', sc.color)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full mr-1', sc.dot)} />
                          {lead.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        <Select value={lead.status} onValueChange={v => handleChangeStatus(lead, v as LeadStatus)}>
                          <SelectTrigger className="h-6 text-[10px] w-auto min-w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map(s => (
                              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {lead.email && (
                          <Button
                            variant="outline" size="sm"
                            className="h-6 text-[10px] px-2 gap-1 text-blue-600 border-blue-200"
                            onClick={() => handleOpenEmail(lead)}
                          >
                            <Mail className="h-3 w-3" /> Email
                          </Button>
                        )}

                        <Button
                          variant="ghost" size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => { setSelectedLead(lead); setEditForm({ ...lead }); setIsEditOpen(true); }}
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </Button>

                        <ConfirmDeleteButton
                          trigger={
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          }
                          title="Eliminar lead"
                          itemName={lead.agencia}
                          onConfirm={() => handleDeleteLead(lead.id)}
                        />
                      </div>

                      {lead.notes && (
                        <p className="text-[10px] text-muted-foreground italic line-clamp-1">{lead.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: manual lead ─────────────────────────────── */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar lead manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Agencia / Nombre *</Label>
              <Input placeholder="Ej: Inmobiliaria Pérez" value={manualForm.agencia ?? ''} onChange={e => setManualForm(f => ({ ...f, agencia: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" placeholder="contacto@..." value={manualForm.email ?? ''} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input placeholder="11 1234-5678" value={manualForm.phone ?? ''} onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provincia</Label>
                <Select value={manualForm.provincia ?? ''} onValueChange={v => setManualForm(f => ({ ...f, provincia: v, ciudad: '' }))}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Provincia..." /></SelectTrigger>
                  <SelectContent>
                    {ARGENTINA_PROVINCES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Select value={manualForm.ciudad ?? ''} onValueChange={v => setManualForm(f => ({ ...f, ciudad: v }))} disabled={!manualForm.provincia}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Ciudad..." /></SelectTrigger>
                  <SelectContent>
                    {(manualForm.provincia ? ARGENTINA_CITIES[manualForm.provincia] ?? [] : []).map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sitio web</Label>
              <Input placeholder="https://..." value={manualForm.website ?? ''} onChange={e => setManualForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Textarea rows={2} placeholder="Contexto, referido por..." value={manualForm.notes ?? ''} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsManualOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black" onClick={handleSaveManual} disabled={!manualForm.agencia}>Agregar lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: editar lead ──────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar lead — {selectedLead?.agencia}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={editForm.status ?? 'Nuevo'} onValueChange={v => setEditForm(f => ({ ...f, status: v as LeadStatus }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <Textarea rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-black" onClick={handleSaveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: enviar email ─────────────────────────────── */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" /> Email a {selectedLead?.agencia}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enviando a: <strong>{selectedLead?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              rows={14}
              className="text-xs font-mono leading-relaxed"
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground italic">
              Al enviar, el lead pasará automáticamente a estado "Contactado".
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEmailOpen(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-black gap-2"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
