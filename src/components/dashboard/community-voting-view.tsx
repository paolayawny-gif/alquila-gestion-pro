'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ThumbsUp, ThumbsDown, Plus, Send, Clock, CheckCircle2,
  XCircle, ChevronRight, Users, Zap, Dumbbell,
  PaintBucket, PawPrint, ShieldCheck, HelpCircle,
  Building2, Vote, MessageCircle, TrendingUp, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Contract } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const APP_ID = 'alquilagestion-pro';

// ── Tipos ──────────────────────────────────────────────
export type ProposalIconType = 'solar' | 'gym' | 'paint' | 'pets' | 'security' | 'other';
export type ProposalStatus   = 'activa' | 'aprobada' | 'rechazada' | 'cerrada';

export interface Proposal {
  id: string;
  title: string;
  description: string;
  iconType: ProposalIconType;
  deadline: string;        // ISO date string "YYYY-MM-DD"
  quorumRequired: number;  // porcentaje, ej: 60
  votesFor: number;
  votesAgainst: number;
  totalEligible: number;
  status: ProposalStatus;
  propertyId: string;
  ownerId: string;
  createdAt: number;
}

export interface VoteComment {
  id: string;
  text: string;
  authorName: string;
  authorUnit: string;
  ts: number;
  ownerId: string;
}

interface CommunityVotingViewProps {
  properties: Property[];
  contracts:  Contract[];
  people:     any[];
  userId?:    string;
}

// ── Helpers ────────────────────────────────────────────
const ICONS: Record<ProposalIconType, React.ReactNode> = {
  solar:    <Zap          className="h-6 w-6 text-amber-500" />,
  gym:      <Dumbbell     className="h-6 w-6 text-blue-500"  />,
  paint:    <PaintBucket  className="h-6 w-6 text-purple-500"/>,
  pets:     <PawPrint     className="h-6 w-6 text-orange-500"/>,
  security: <ShieldCheck  className="h-6 w-6 text-green-600" />,
  other:    <HelpCircle   className="h-6 w-6 text-slate-500" />,
};

const ICON_BG: Record<ProposalIconType, string> = {
  solar:    'bg-amber-50',
  gym:      'bg-blue-50',
  paint:    'bg-purple-50',
  pets:     'bg-orange-50',
  security: 'bg-green-50',
  other:    'bg-slate-100',
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600000)  return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hora${Math.floor(diff / 3600000) !== 1 ? 's' : ''}`;
  return `Hace ${Math.floor(diff / 86400000)} día${Math.floor(diff / 86400000) !== 1 ? 's' : ''}`;
}

function quorumPercent(p: Proposal): number {
  if (!p.totalEligible) return 0;
  return Math.round(((p.votesFor + p.votesAgainst) / p.totalEligible) * 100);
}

function favorPercent(p: Proposal): number {
  const total = p.votesFor + p.votesAgainst;
  if (!total) return 0;
  return Math.round((p.votesFor / total) * 100);
}

// ── Componente principal ───────────────────────────────
export function CommunityVotingView({ properties, contracts, people, userId }: CommunityVotingViewProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [commentText,        setCommentText]        = useState('');
  const [showNewProposal,    setShowNewProposal]    = useState(false);
  const [searchTerm,         setSearchTerm]         = useState('');

  // ── Firestore: propuestas ──
  const proposalsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'votaciones'));
  }, [db, userId]);
  const { data: proposalsRaw } = useCollection<Proposal>(proposalsQ);

  // ── Firestore: comentarios de propuesta seleccionada ──
  const commentsQ = useMemoFirebase(() => {
    if (!db || !userId || !selectedProposalId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', selectedProposalId, 'comentarios'),
      orderBy('ts')
    );
  }, [db, userId, selectedProposalId]);
  const { data: commentsRaw } = useCollection<VoteComment>(commentsQ);

  const allProposals = useMemo(() => (proposalsRaw || []).sort((a, b) => b.createdAt - a.createdAt), [proposalsRaw]);
  const comments     = useMemo(() => commentsRaw || [], [commentsRaw]);

  // Propiedades del edificio activo
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const propertyProposals = useMemo(() =>
    allProposals.filter(p => p.propertyId === selectedPropertyId),
  [allProposals, selectedPropertyId]);

  const activeProposals   = propertyProposals.filter(p => p.status === 'activa');
  const inactiveProposals = propertyProposals.filter(p => p.status !== 'activa');

  // Propuesta destacada = la más próxima a vencer
  const featuredProposal = useMemo(() => {
    if (selectedProposalId) return propertyProposals.find(p => p.id === selectedProposalId);
    return activeProposals.sort((a, b) =>
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )[0] ?? propertyProposals[0];
  }, [selectedProposalId, propertyProposals, activeProposals]);

  // Stats globales
  const totalEligible    = contracts.filter(c => c.propertyId === selectedPropertyId).length;
  const totalVoted       = useMemo(() =>
    propertyProposals.reduce((sum, p) => sum + p.votesFor + p.votesAgainst, 0),
  [propertyProposals]);
  const participationPct = totalEligible > 0 && propertyProposals.length > 0
    ? Math.min(100, Math.round((totalVoted / (totalEligible * Math.max(propertyProposals.length, 1))) * 100))
    : 82; // demo

  // Ratio inquilinos vs propietarios (simulado: 60/40)
  const tenantsCount   = contracts.filter(c => c.propertyId === selectedPropertyId).length;
  const ownersCount    = Math.max(1, Math.round(tenantsCount * 0.67));
  const totalRatio     = tenantsCount + ownersCount;
  const tenantRatioPct = Math.round((tenantsCount / totalRatio) * 100);

  // ── Votar ──
  const handleVote = (proposalId: string, type: 'for' | 'against') => {
    if (!userId || !db) return;
    const proposal = propertyProposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'activa') return;
    const ref   = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', proposalId);
    const update = type === 'for'
      ? { votesFor:     proposal.votesFor     + 1 }
      : { votesAgainst: proposal.votesAgainst + 1 };
    setDocumentNonBlocking(ref, update, { merge: true });
    // Auto-aprobar/rechazar si se alcanza quórum
    const newFor     = type === 'for'     ? proposal.votesFor     + 1 : proposal.votesFor;
    const newAgainst = type === 'against' ? proposal.votesAgainst + 1 : proposal.votesAgainst;
    const newTotal   = newFor + newAgainst;
    const newQuorum  = proposal.totalEligible > 0 ? (newTotal / proposal.totalEligible) * 100 : 0;
    if (newQuorum >= proposal.quorumRequired) {
      const favor = (newFor / newTotal) * 100;
      const newStatus: ProposalStatus = favor >= 50 ? 'aprobada' : 'rechazada';
      setDocumentNonBlocking(ref, { status: newStatus, votesFor: newFor, votesAgainst: newAgainst }, { merge: true });
      toast({
        title: newStatus === 'aprobada' ? '✅ Propuesta aprobada' : '❌ Propuesta rechazada',
        description: `"${proposal.title}" alcanzó el quórum necesario.`,
      });
    } else {
      toast({ title: type === 'for' ? '👍 Voto a favor registrado' : '👎 Voto en contra registrado' });
    }
  };

  // ── Comentar ──
  const handleComment = () => {
    if (!commentText.trim() || !selectedProposalId || !userId || !db) return;
    const id  = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', selectedProposalId, 'comentarios', id);
    const comment: VoteComment = {
      id, text: commentText.trim(),
      authorName: 'Admin',
      authorUnit: 'Administración',
      ts: Date.now(), ownerId: userId,
    };
    setDocumentNonBlocking(ref, comment, {});
    setCommentText('');
  };

  // ── Crear propuesta ──
  const handleCreateProposal = (data: Omit<Proposal, 'id' | 'votesFor' | 'votesAgainst' | 'status' | 'createdAt' | 'ownerId' | 'totalEligible'>) => {
    if (!userId || !db) return;
    const id  = `vote_${Date.now()}`;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', id);
    const eligible = contracts.filter(c => c.propertyId === data.propertyId).length || 10;
    const proposal: Proposal = {
      ...data, id,
      votesFor: 0, votesAgainst: 0,
      totalEligible: eligible,
      status: 'activa',
      createdAt: Date.now(), ownerId: userId,
    };
    setDocumentNonBlocking(ref, proposal, {});
    setSelectedProposalId(id);
    setShowNewProposal(false);
    toast({ title: `Propuesta "${data.title}" creada` });
  };

  // ── Vista: sin propiedad seleccionada ──
  if (!selectedPropertyId) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Votaciones Comunitarias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Decisiones colectivas para consorcios y edificios. Quórum digital, transparente y en tiempo real.
          </p>
        </div>

        {/* Banner informativo */}
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Vote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-sm">¿Qué son las Votaciones Comunitarias?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Permiten tomar decisiones colectivas en edificios o consorcios con quórum configurable,
              foro de debate y registro transparente de cada voto. Ideal para mejoras edilicias,
              cambios de reglamento o inversiones comunes.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-black mb-3">Seleccioná el edificio o consorcio</p>
          {properties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/50">
              <Building2 className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No tenés propiedades cargadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map(p => {
                const propCount    = allProposals.filter(v => v.propertyId === p.id).length;
                const activeCount  = allProposals.filter(v => v.propertyId === p.id && v.status === 'activa').length;
                const tenantCount  = contracts.filter(c => c.propertyId === p.id).length;
                return (
                  <button key={p.id} onClick={() => setSelectedPropertyId(p.id)}
                    className="text-left rounded-2xl border hover:border-primary/40 hover:shadow-md transition-all p-4 bg-white group space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.photos?.[0]
                          ? <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />
                          : <Building2 className="h-6 w-6 text-primary/60" />
                        }
                      </div>
                      {activeCount > 0 && (
                        <Badge className="bg-primary text-white text-[9px] font-black shrink-0">
                          {activeCount} activa{activeCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="font-black text-sm">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.address}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {tenantCount} inquilinos</span>
                      <span className="flex items-center gap-1"><Vote className="h-3 w-3" /> {propCount} propuestas</span>
                    </div>
                    <div className="flex items-center text-[11px] text-primary font-bold gap-1 group-hover:gap-2 transition-all">
                      Ver votaciones <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vista principal: edificio seleccionado ──
  return (
    <div className="animate-in fade-in duration-500 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => { setSelectedPropertyId(null); setSelectedProposalId(null); }}
              className="hover:text-primary font-medium transition-colors">
              Propiedades
            </button>
            <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            <span className="text-foreground font-bold">{selectedProperty?.name}</span>
          </div>
          <h1 className="text-2xl font-black">Votaciones Comunitarias</h1>
          <p className="text-sm text-muted-foreground">
            {selectedProperty?.name} · Decisiones Activas
          </p>
        </div>
        <Button className="bg-primary font-bold gap-2 shrink-0" onClick={() => setShowNewProposal(true)}>
          <Plus className="h-4 w-4" /> Nueva Propuesta
        </Button>
      </div>

      {/* Sin propuestas */}
      {propertyProposals.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Vote className="h-7 w-7 text-primary/60" />
          </div>
          <p className="font-black text-base">Sin propuestas aún</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Creá la primera propuesta para que los inquilinos puedan votar y debatir.
          </p>
          <Button className="bg-primary font-bold gap-2 mt-2" onClick={() => setShowNewProposal(true)}>
            <Plus className="h-4 w-4" /> Nueva Propuesta
          </Button>
        </div>
      ) : (
        <>
          {/* ── Fila superior: propuesta destacada + stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

            {/* Propuesta destacada */}
            {featuredProposal && (
              <div className="bg-white rounded-2xl border p-6 space-y-5">
                {/* Encabezado */}
                <div className="flex items-start gap-4">
                  <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center shrink-0', ICON_BG[featuredProposal.iconType])}>
                    {ICONS[featuredProposal.iconType]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="font-black text-lg leading-tight">{featuredProposal.title}</p>
                      {featuredProposal.status === 'activa' ? (
                        <Badge variant="outline"
                          className={cn('shrink-0 text-[10px] font-black border gap-1',
                            daysUntil(featuredProposal.deadline) <= 3
                              ? 'border-red-300 text-red-600 bg-red-50'
                              : 'border-amber-300 text-amber-700 bg-amber-50'
                          )}>
                          <Clock className="h-3 w-3" />
                          Cierra en {daysUntil(featuredProposal.deadline)} día{daysUntil(featuredProposal.deadline) !== 1 ? 's' : ''}
                        </Badge>
                      ) : featuredProposal.status === 'aprobada' ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px] font-black gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Aprobada
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-600 text-[10px] font-black gap-1 shrink-0">
                          <XCircle className="h-3 w-3" /> Rechazada
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {featuredProposal.description}
                    </p>
                  </div>
                </div>

                {/* Barra de quórum */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">Progreso de Votación</span>
                    <span className="font-black text-primary">{quorumPercent(featuredProposal)}% de Quórum</span>
                  </div>
                  <div className="relative">
                    <Progress value={quorumPercent(featuredProposal)} className="h-2.5 rounded-full" />
                    {/* Línea de quórum requerido */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/40"
                      style={{ left: `${featuredProposal.quorumRequired}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">
                    Se requiere {featuredProposal.quorumRequired}% para validez
                  </p>
                </div>

                {/* Botones de voto */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className={cn('flex-1 gap-2 font-bold border-2 transition-all',
                      featuredProposal.status !== 'activa'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'border-primary/30 hover:border-primary hover:bg-primary/5 text-primary'
                    )}
                    disabled={featuredProposal.status !== 'activa'}
                    onClick={() => handleVote(featuredProposal.id, 'for')}
                  >
                    <ThumbsUp className="h-4 w-4" /> A Favor ({featuredProposal.votesFor})
                  </Button>
                  <Button
                    variant="outline"
                    className={cn('flex-1 gap-2 font-bold border-2 transition-all',
                      featuredProposal.status !== 'activa'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'border-muted hover:border-destructive/30 hover:bg-destructive/5 text-muted-foreground hover:text-destructive'
                    )}
                    disabled={featuredProposal.status !== 'activa'}
                    onClick={() => handleVote(featuredProposal.id, 'against')}
                  >
                    <ThumbsDown className="h-4 w-4" /> En Contra ({featuredProposal.votesAgainst})
                  </Button>
                </div>

                {/* Mini stats de la propuesta */}
                {(featuredProposal.votesFor + featuredProposal.votesAgainst) > 0 && (
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-3">
                    {/* Barra favor/contra */}
                    <div className="flex-1 h-2 rounded-full bg-red-200 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${favorPercent(featuredProposal)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-black text-primary shrink-0">{favorPercent(featuredProposal)}% favor</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats panel */}
            <div className="bg-primary rounded-2xl p-6 text-white space-y-5 relative overflow-hidden">
              {/* Decoración */}
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -right-2 top-16 h-12 w-12 rounded-full bg-white/10" />

              <div className="relative space-y-1">
                <p className="text-[9px] uppercase font-black tracking-widest text-white/60">Participación Global</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black leading-none">{participationPct}</span>
                  <span className="text-2xl font-black pb-1">%</span>
                </div>
                <p className="text-[11px] text-green-300 font-bold">Participación récord este mes</p>
              </div>

              <Separator className="bg-white/20" />

              {/* Ratio */}
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-white/60" />
                    <p className="text-[11px] font-bold text-white/80">Inquilinos vs Propietarios</p>
                  </div>
                  <span className="text-[11px] font-black text-white/60">{tenantsCount}/{ownersCount}</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${tenantRatioPct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-white/50">
                  <span>Inquilinos {tenantRatioPct}%</span>
                  <span>Prop. {100 - tenantRatioPct}%</span>
                </div>
              </div>

              {/* Mini stats */}
              <div className="relative grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black">{activeProposals.length}</p>
                  <p className="text-[9px] text-white/60 font-bold">Activas</p>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black">{inactiveProposals.filter(p => p.status === 'aprobada').length}</p>
                  <p className="text-[9px] text-white/60 font-bold">Aprobadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Fila inferior: foro + otras votaciones ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Foro de discusión */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <p className="font-black text-base">Foro de Discusión</p>
                </div>
                <span className="text-[10px] text-primary font-bold cursor-pointer hover:underline">Ver Todo</span>
              </div>

              {/* Lista de comentarios */}
              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60 text-center py-4">
                    Aún no hay comentarios. Sé el primero en opinar.
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                        {c.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[12px] font-black">{c.authorName}</p>
                          <p className="text-[10px] text-primary/70 font-medium">{c.authorUnit}</p>
                          <p className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(c.ts)}</p>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Input comentario */}
              <div className="flex gap-2">
                <Input
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
                  className="flex-1 bg-muted/30 rounded-xl border-muted text-sm"
                />
                <button
                  onClick={handleComment}
                  disabled={!commentText.trim()}
                  className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                    commentText.trim()
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Otras votaciones */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <p className="font-black text-base">Otras Votaciones</p>
              </div>

              <div className="space-y-2">
                {propertyProposals
                  .filter(p => p.id !== featuredProposal?.id)
                  .slice(0, 6)
                  .map(p => (
                    <button key={p.id}
                      onClick={() => setSelectedProposalId(p.id === selectedProposalId ? null : p.id)}
                      className="w-full flex items-center gap-3 rounded-xl border hover:border-primary/30 hover:bg-muted/20 transition-all px-3 py-3 text-left">
                      {/* Ícono */}
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', ICON_BG[p.iconType])}>
                        {ICONS[p.iconType]}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{p.title}</p>
                        {p.status === 'activa' ? (
                          <p className="text-[10px] text-muted-foreground">
                            Activa · {quorumPercent(p)}% Quórum
                          </p>
                        ) : p.status === 'aprobada' ? (
                          <p className="text-[10px] text-green-600 font-bold">
                            Aprobada ({favorPercent(p)}% Favor)
                          </p>
                        ) : (
                          <p className="text-[10px] text-red-500 font-bold">
                            Rechazada ({100 - favorPercent(p)}% Contra)
                          </p>
                        )}
                      </div>
                      {/* Estado ícono */}
                      {p.status === 'activa'    && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                      {p.status === 'aprobada'  && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {p.status === 'rechazada' && <XCircle      className="h-4 w-4 text-red-400   shrink-0" />}
                    </button>
                  ))}

                {propertyProposals.length <= 1 && (
                  <div className="text-center py-6 text-muted-foreground/40 space-y-1">
                    <Vote className="h-6 w-6 mx-auto" />
                    <p className="text-xs">No hay más votaciones.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialog: Nueva propuesta */}
      <NewProposalDialog
        open={showNewProposal}
        onClose={() => setShowNewProposal(false)}
        properties={properties}
        defaultPropertyId={selectedPropertyId}
        onCreate={handleCreateProposal}
      />
    </div>
  );
}

// ── Dialog: Nueva propuesta ────────────────────────────
function NewProposalDialog({ open, onClose, properties, defaultPropertyId, onCreate }: {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  defaultPropertyId: string | null;
  onCreate: (data: Omit<Proposal, 'id' | 'votesFor' | 'votesAgainst' | 'status' | 'createdAt' | 'ownerId' | 'totalEligible'>) => void;
}) {
  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [iconType,       setIconType]       = useState<ProposalIconType>('other');
  const [deadline,       setDeadline]       = useState('');
  const [quorumRequired, setQuorumRequired] = useState('60');
  const [propertyId,     setPropertyId]     = useState(defaultPropertyId || '');

  // Sincronizar defaultPropertyId cuando cambia
  React.useEffect(() => { if (defaultPropertyId) setPropertyId(defaultPropertyId); }, [defaultPropertyId]);

  const valid = title && description && deadline && Number(quorumRequired) > 0 && propertyId;

  const handleCreate = () => {
    if (!valid) return;
    onCreate({ title, description, iconType, deadline, quorumRequired: Number(quorumRequired), propertyId });
    setTitle(''); setDescription(''); setIconType('other'); setDeadline(''); setQuorumRequired('60');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> Nueva Propuesta
          </DialogTitle>
          <DialogDescription>
            Creá una votación comunitaria. Los inquilinos podrán votar y comentar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Propiedad */}
          {!defaultPropertyId && (
            <div className="space-y-1.5">
              <Label>Edificio / Consorcio</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Seleccioná propiedad..." /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Título de la propuesta</Label>
            <Input placeholder="Ej: Instalación de Paneles Solares" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              placeholder="Describí la propuesta en detalle..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Tipo de ícono + fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={iconType} onValueChange={v => setIconType(v as ProposalIconType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solar">⚡ Energía / Solar</SelectItem>
                  <SelectItem value="gym">🏋️ Gimnasio / Deporte</SelectItem>
                  <SelectItem value="paint">🎨 Pintura / Remodelación</SelectItem>
                  <SelectItem value="pets">🐾 Mascotas</SelectItem>
                  <SelectItem value="security">🛡️ Seguridad</SelectItem>
                  <SelectItem value="other">❓ Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de cierre</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* Quórum */}
          <div className="space-y-1.5">
            <Label>Quórum requerido (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number" min={1} max={100}
                value={quorumRequired}
                onChange={e => setQuorumRequired(e.target.value)}
                className="w-24"
              />
              <p className="text-[11px] text-muted-foreground">
                Se necesita que el <strong>{quorumRequired}%</strong> de los habilitados vote para que sea válida.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold gap-2" onClick={handleCreate} disabled={!valid}>
            <Vote className="h-4 w-4" /> Publicar propuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
