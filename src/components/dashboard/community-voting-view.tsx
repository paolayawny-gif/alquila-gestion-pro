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
  Building2, Vote, MessageCircle, BarChart2,
  Pencil, Trash2, Download, History, UserCheck,
  AlertTriangle, Lock, Unlock, Eye, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Contract } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const APP_ID = 'alquilagestion-pro';

// ── Tipos ──────────────────────────────────────────────
export type ProposalIconType   = 'solar' | 'gym' | 'paint' | 'pets' | 'security' | 'other';
export type ProposalStatus     = 'activa' | 'aprobada' | 'rechazada' | 'cerrada';
export type VoterRestriction   = 'todos' | 'solo_inquilinos' | 'solo_propietarios';

export interface VoteRecord {
  voterName: string;
  voterUnit: string;
  vote: 'for' | 'against';
  ts: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  iconType: ProposalIconType;
  deadline: string;
  quorumRequired: number;
  votesFor: number;
  votesAgainst: number;
  totalEligible: number;
  status: ProposalStatus;
  propertyId: string;
  ownerId: string;
  createdAt: number;
  voterRestriction: VoterRestriction;
  voteHistory: VoteRecord[];   // historial de votos registrados
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
  solar:    <Zap         className="h-6 w-6 text-amber-500"  />,
  gym:      <Dumbbell    className="h-6 w-6 text-blue-500"   />,
  paint:    <PaintBucket className="h-6 w-6 text-purple-500" />,
  pets:     <PawPrint    className="h-6 w-6 text-orange-500" />,
  security: <ShieldCheck className="h-6 w-6 text-green-600"  />,
  other:    <HelpCircle  className="h-6 w-6 text-slate-500"  />,
};

const ICON_BG: Record<ProposalIconType, string> = {
  solar:    'bg-amber-50',
  gym:      'bg-blue-50',
  paint:    'bg-purple-50',
  pets:     'bg-orange-50',
  security: 'bg-green-50',
  other:    'bg-slate-100',
};

const RESTRICTION_LABEL: Record<VoterRestriction, string> = {
  todos:                 'Todos (inquilinos y propietarios)',
  solo_inquilinos:       'Solo inquilinos',
  solo_propietarios:     'Solo propietarios',
};

const RESTRICTION_ICON: Record<VoterRestriction, React.ReactNode> = {
  todos:             <Unlock  className="h-3 w-3" />,
  solo_inquilinos:   <Users   className="h-3 w-3" />,
  solo_propietarios: <UserCheck className="h-3 w-3" />,
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

function exportProposalCSV(proposal: Proposal) {
  const lines = [
    `"Propuesta","${proposal.title}"`,
    `"Descripción","${proposal.description}"`,
    `"Estado","${proposal.status}"`,
    `"Votos a favor","${proposal.votesFor}"`,
    `"Votos en contra","${proposal.votesAgainst}"`,
    `"Total elegibles","${proposal.totalEligible}"`,
    `"Quórum alcanzado","${quorumPercent(proposal)}%"`,
    `"Quórum requerido","${proposal.quorumRequired}%"`,
    `"Fecha de cierre","${proposal.deadline}"`,
    `"Restricción de voto","${RESTRICTION_LABEL[proposal.voterRestriction]}"`,
    `""`,
    `"Historial de votos"`,
    `"Nombre","Unidad","Voto","Fecha"`,
    ...(proposal.voteHistory || []).map(v =>
      `"${v.voterName}","${v.voterUnit}","${v.vote === 'for' ? 'A Favor' : 'En Contra'}","${new Date(v.ts).toLocaleDateString('es-AR')}"`
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `votacion_${proposal.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ───────────────────────────────
export function CommunityVotingView({ properties, contracts, people, userId }: CommunityVotingViewProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [commentText,        setCommentText]        = useState('');
  const [showNewProposal,    setShowNewProposal]    = useState(false);
  const [editingProposal,    setEditingProposal]    = useState<Proposal | null>(null);
  const [deletingProposal,   setDeletingProposal]   = useState<Proposal | null>(null);
  const [showRegisterVote,   setShowRegisterVote]   = useState(false);
  const [showHistory,        setShowHistory]        = useState(false);
  const [filterStatus,       setFilterStatus]       = useState<'todas' | ProposalStatus>('todas');

  // ── Firestore: propuestas ──
  const proposalsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'votaciones'));
  }, [db, userId]);
  const { data: proposalsRaw } = useCollection<Proposal>(proposalsQ);

  // ── Firestore: comentarios ──
  const commentsQ = useMemoFirebase(() => {
    if (!db || !userId || !selectedProposalId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', selectedProposalId, 'comentarios'),
      orderBy('ts')
    );
  }, [db, userId, selectedProposalId]);
  const { data: commentsRaw } = useCollection<VoteComment>(commentsQ);

  const allProposals = useMemo(() =>
    (proposalsRaw || []).sort((a, b) => b.createdAt - a.createdAt),
  [proposalsRaw]);
  const comments = useMemo(() => commentsRaw || [], [commentsRaw]);

  const selectedProperty  = properties.find(p => p.id === selectedPropertyId);
  const propertyProposals = useMemo(() =>
    allProposals.filter(p => p.propertyId === selectedPropertyId),
  [allProposals, selectedPropertyId]);

  const filteredProposals = useMemo(() =>
    filterStatus === 'todas'
      ? propertyProposals
      : propertyProposals.filter(p => p.status === filterStatus),
  [propertyProposals, filterStatus]);

  const activeProposals   = propertyProposals.filter(p => p.status === 'activa');

  const featuredProposal = useMemo(() => {
    if (selectedProposalId) return propertyProposals.find(p => p.id === selectedProposalId);
    return activeProposals.sort((a, b) =>
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )[0] ?? propertyProposals[0];
  }, [selectedProposalId, propertyProposals, activeProposals]);

  // Stats
  const totalEligible    = contracts.filter(c => c.propertyId === selectedPropertyId).length;
  const tenantsCount     = totalEligible;
  const ownersCount      = Math.max(1, Math.round(tenantsCount * 0.67));
  const totalRatio       = tenantsCount + ownersCount;
  const tenantRatioPct   = totalRatio > 0 ? Math.round((tenantsCount / totalRatio) * 100) : 60;
  const participationPct = (() => {
    if (propertyProposals.length === 0) return 0;
    const totalVoted = propertyProposals.reduce((s, p) => s + p.votesFor + p.votesAgainst, 0);
    const maxPossible = totalEligible * propertyProposals.length;
    return maxPossible > 0 ? Math.min(100, Math.round((totalVoted / maxPossible) * 100)) : 0;
  })();

  // ── Registrar voto manual ──
  const handleVote = (proposalId: string, type: 'for' | 'against', voterName = 'Admin', voterUnit = 'Administración') => {
    if (!userId || !db) return;
    const proposal = propertyProposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'activa') return;

    const newRecord: VoteRecord = { voterName, voterUnit, vote: type, ts: Date.now() };
    const newHistory = [...(proposal.voteHistory || []), newRecord];
    const newFor     = type === 'for'     ? proposal.votesFor + 1     : proposal.votesFor;
    const newAgainst = type === 'against' ? proposal.votesAgainst + 1 : proposal.votesAgainst;
    const newTotal   = newFor + newAgainst;
    const newQuorum  = proposal.totalEligible > 0 ? (newTotal / proposal.totalEligible) * 100 : 0;

    let newStatus: ProposalStatus = 'activa';
    if (newQuorum >= proposal.quorumRequired) {
      newStatus = (newFor / newTotal) >= 0.5 ? 'aprobada' : 'rechazada';
    }

    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', proposalId);
    setDocumentNonBlocking(ref, {
      votesFor: newFor, votesAgainst: newAgainst,
      voteHistory: newHistory, status: newStatus,
    }, { merge: true });

    if (newStatus !== 'activa') {
      toast({
        title: newStatus === 'aprobada' ? '✅ Propuesta aprobada' : '❌ Propuesta rechazada',
        description: `"${proposal.title}" alcanzó el quórum necesario.`,
      });
    } else {
      toast({ title: type === 'for' ? '👍 Voto a favor registrado' : '👎 Voto en contra registrado' });
    }
  };

  // ── Cerrar manualmente ──
  const handleClose = (proposalId: string) => {
    if (!userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', proposalId);
    setDocumentNonBlocking(ref, { status: 'cerrada' }, { merge: true });
    toast({ title: 'Votación cerrada manualmente' });
  };

  // ── Comentar ──
  const handleComment = () => {
    if (!commentText.trim() || !selectedProposalId || !userId || !db) return;
    const id  = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', selectedProposalId, 'comentarios', id);
    setDocumentNonBlocking(ref, {
      id, text: commentText.trim(),
      authorName: 'Administración', authorUnit: 'Admin',
      ts: Date.now(), ownerId: userId,
    }, {});
    setCommentText('');
  };

  // ── Crear propuesta ──
  const handleCreateProposal = (data: Omit<Proposal, 'id' | 'votesFor' | 'votesAgainst' | 'status' | 'createdAt' | 'ownerId' | 'totalEligible' | 'voteHistory'>) => {
    if (!userId || !db) return;
    const id  = `vote_${Date.now()}`;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', id);
    const eligible = getEligibleCount(data.propertyId, data.voterRestriction);
    const proposal: Proposal = {
      ...data, id,
      votesFor: 0, votesAgainst: 0, voteHistory: [],
      totalEligible: eligible,
      status: 'activa', createdAt: Date.now(), ownerId: userId,
    };
    setDocumentNonBlocking(ref, proposal, {});
    setSelectedProposalId(id);
    setShowNewProposal(false);
    toast({ title: `Propuesta "${data.title}" creada` });
  };

  // ── Editar propuesta ──
  const handleEditProposal = (data: Partial<Proposal>) => {
    if (!editingProposal || !userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', editingProposal.id);
    const eligible = getEligibleCount(
      data.propertyId ?? editingProposal.propertyId,
      data.voterRestriction ?? editingProposal.voterRestriction
    );
    setDocumentNonBlocking(ref, { ...data, totalEligible: eligible }, { merge: true });
    setEditingProposal(null);
    toast({ title: 'Propuesta actualizada' });
  };

  // ── Eliminar propuesta ──
  const handleDeleteProposal = () => {
    if (!deletingProposal || !userId || !db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'votaciones', deletingProposal.id);
    deleteDocumentNonBlocking(ref);
    if (selectedProposalId === deletingProposal.id) setSelectedProposalId(null);
    setDeletingProposal(null);
    toast({ title: 'Propuesta eliminada', variant: 'destructive' });
  };

  // ── Helper: calcular elegibles según restricción ──
  const getEligibleCount = (propId: string, restriction: VoterRestriction): number => {
    const tenants = contracts.filter(c => c.propertyId === propId).length;
    const owners  = Math.max(1, Math.round(tenants * 0.67));
    if (restriction === 'solo_inquilinos')   return tenants;
    if (restriction === 'solo_propietarios') return owners;
    return tenants + owners;
  };

  // ── Vista: selector de propiedad ──
  if (!selectedPropertyId) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Votaciones Comunitarias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Decisiones colectivas para consorcios y edificios. Quórum digital, transparente y en tiempo real.
          </p>
        </div>
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Vote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-sm">¿Qué son las Votaciones Comunitarias?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Permiten tomar decisiones colectivas en edificios o consorcios con quórum configurable,
              restricción de votantes, foro de debate, historial completo y exportación de resultados.
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
                const propCount   = allProposals.filter(v => v.propertyId === p.id).length;
                const activeCount = allProposals.filter(v => v.propertyId === p.id && v.status === 'activa').length;
                const tenantCount = contracts.filter(c => c.propertyId === p.id).length;
                return (
                  <button key={p.id} onClick={() => setSelectedPropertyId(p.id)}
                    className="text-left rounded-2xl border hover:border-primary/40 hover:shadow-md transition-all p-4 bg-white group space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.photos?.[0]
                          ? <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />
                          : <Building2 className="h-6 w-6 text-primary/60" />}
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

  // ── Vista principal ──
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
          <p className="text-sm text-muted-foreground">{selectedProperty?.name} · Decisiones Activas</p>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Badge restricción */}
                        <Badge variant="outline" className="text-[9px] font-bold gap-1 shrink-0">
                          {RESTRICTION_ICON[featuredProposal.voterRestriction]}
                          {RESTRICTION_LABEL[featuredProposal.voterRestriction]}
                        </Badge>
                        {/* Badge estado */}
                        {featuredProposal.status === 'activa' ? (
                          <Badge variant="outline" className={cn('shrink-0 text-[10px] font-black border gap-1',
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
                        ) : featuredProposal.status === 'cerrada' ? (
                          <Badge className="bg-slate-100 text-slate-600 text-[10px] font-black gap-1 shrink-0">
                            <Lock className="h-3 w-3" /> Cerrada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-600 text-[10px] font-black gap-1 shrink-0">
                            <XCircle className="h-3 w-3" /> Rechazada
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{featuredProposal.description}</p>
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
                    <div className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/40"
                      style={{ left: `${Math.min(featuredProposal.quorumRequired, 99)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{featuredProposal.votesFor + featuredProposal.votesAgainst} de {featuredProposal.totalEligible} habilitados votaron</span>
                    <span>Se requiere {featuredProposal.quorumRequired}% para validez</span>
                  </div>
                </div>

                {/* Barra favor/contra */}
                {(featuredProposal.votesFor + featuredProposal.votesAgainst) > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-primary">A favor: {featuredProposal.votesFor} ({favorPercent(featuredProposal)}%)</span>
                      <span className="text-red-500">En contra: {featuredProposal.votesAgainst} ({100 - favorPercent(featuredProposal)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-red-200 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${favorPercent(featuredProposal)}%` }} />
                    </div>
                  </div>
                )}

                {/* Botones de voto */}
                <div className="flex gap-3">
                  <Button variant="outline"
                    className={cn('flex-1 gap-2 font-bold border-2 transition-all',
                      featuredProposal.status !== 'activa'
                        ? 'opacity-40 cursor-not-allowed'
                        : 'border-primary/30 hover:border-primary hover:bg-primary/5 text-primary'
                    )}
                    disabled={featuredProposal.status !== 'activa'}
                    onClick={() => setShowRegisterVote(true)}>
                    <ThumbsUp className="h-4 w-4" /> A Favor ({featuredProposal.votesFor})
                  </Button>
                  <Button variant="outline"
                    className={cn('flex-1 gap-2 font-bold border-2 transition-all',
                      featuredProposal.status !== 'activa'
                        ? 'opacity-40 cursor-not-allowed'
                        : 'border-muted hover:border-destructive/30 hover:bg-destructive/5 text-muted-foreground hover:text-destructive'
                    )}
                    disabled={featuredProposal.status !== 'activa'}
                    onClick={() => handleVote(featuredProposal.id, 'against')}>
                    <ThumbsDown className="h-4 w-4" /> En Contra ({featuredProposal.votesAgainst})
                  </Button>
                </div>

                {/* Acciones admin */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button onClick={() => setEditingProposal(featuredProposal)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  {featuredProposal.status === 'activa' && (
                    <button onClick={() => handleClose(featuredProposal.id)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-amber-600 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50">
                      <Lock className="h-3.5 w-3.5" /> Cerrar votación
                    </button>
                  )}
                  <button onClick={() => setShowHistory(true)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5">
                    <History className="h-3.5 w-3.5" /> Historial ({(featuredProposal.voteHistory || []).length})
                  </button>
                  <button onClick={() => exportProposalCSV(featuredProposal)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-green-600 transition-colors px-2 py-1 rounded-lg hover:bg-green-50">
                    <Download className="h-3.5 w-3.5" /> Exportar CSV
                  </button>
                  <button onClick={() => setDeletingProposal(featuredProposal)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/5 ml-auto">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            )}

            {/* Panel stats */}
            <div className="bg-primary rounded-2xl p-6 text-white space-y-5 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -right-2 top-16 h-12 w-12 rounded-full bg-white/10" />
              <div className="relative space-y-1">
                <p className="text-[9px] uppercase font-black tracking-widest text-white/60">Participación Global</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black leading-none">{participationPct}</span>
                  <span className="text-2xl font-black pb-1">%</span>
                </div>
                <p className="text-[11px] text-green-300 font-bold">
                  {participationPct >= 75 ? 'Participación récord 🎉' : participationPct >= 50 ? 'Buena participación' : 'Participación en curso'}
                </p>
              </div>
              <Separator className="bg-white/20" />
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-white/80">Inquilinos vs Propietarios</p>
                  <span className="text-[11px] font-black text-white/60">{tenantsCount}/{ownersCount}</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${tenantRatioPct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-white/50">
                  <span>Inquilinos {tenantRatioPct}%</span>
                  <span>Propietarios {100 - tenantRatioPct}%</span>
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black">{activeProposals.length}</p>
                  <p className="text-[9px] text-white/60 font-bold">Activas</p>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-black">{propertyProposals.filter(p => p.status === 'aprobada').length}</p>
                  <p className="text-[9px] text-white/60 font-bold">Aprobadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Fila inferior: foro + lista de votaciones ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Foro */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <p className="font-black text-base">Foro de Discusión</p>
                {featuredProposal && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {featuredProposal.title.length > 25
                      ? featuredProposal.title.slice(0, 25) + '…'
                      : featuredProposal.title}
                  </span>
                )}
              </div>
              <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60 text-center py-4">
                    Sin comentarios aún. Abrí el debate.
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
              <div className="flex gap-2">
                <Input placeholder="Escribí un comentario..."
                  value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleComment(); }}
                  className="flex-1 bg-muted/30 rounded-xl border-muted text-sm" />
                <button onClick={handleComment} disabled={!commentText.trim()}
                  className={cn('h-9 w-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                    commentText.trim() ? 'bg-primary text-white hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Lista de votaciones con filtro */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <BarChart2 className="h-4 w-4 text-primary" />
                <p className="font-black text-base flex-1">Todas las Votaciones</p>
                {/* Filtro de estado */}
                <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
                  <SelectTrigger className="h-7 text-xs w-32 border-muted">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="activa">Activas</SelectItem>
                    <SelectItem value="aprobada">Aprobadas</SelectItem>
                    <SelectItem value="rechazada">Rechazadas</SelectItem>
                    <SelectItem value="cerrada">Cerradas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredProposals.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground/40">
                    <Vote className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs">Sin resultados para este filtro.</p>
                  </div>
                ) : (
                  filteredProposals.map(p => (
                    <div key={p.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border transition-all px-3 py-3',
                        p.id === featuredProposal?.id
                          ? 'border-primary/30 bg-primary/5'
                          : 'hover:border-primary/20 hover:bg-muted/20 cursor-pointer'
                      )}
                      onClick={() => setSelectedProposalId(p.id === selectedProposalId ? null : p.id)}
                    >
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', ICON_BG[p.iconType])}>
                        {ICONS[p.iconType]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{p.title}</p>
                        <p className={cn('text-[10px] font-bold',
                          p.status === 'activa'    ? 'text-muted-foreground' :
                          p.status === 'aprobada'  ? 'text-green-600' :
                          p.status === 'cerrada'   ? 'text-slate-500' :
                          'text-red-500'
                        )}>
                          {p.status === 'activa'    ? `Activa · ${quorumPercent(p)}% Quórum` :
                           p.status === 'aprobada'  ? `Aprobada · ${favorPercent(p)}% a favor` :
                           p.status === 'cerrada'   ? `Cerrada · ${quorumPercent(p)}% Quórum` :
                           `Rechazada · ${100 - favorPercent(p)}% en contra`}
                        </p>
                      </div>
                      {/* Acciones rápidas */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); setEditingProposal(p); }}
                          className="h-6 w-6 rounded-lg hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Editar">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeletingProposal(p); }}
                          className="h-6 w-6 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar">
                          <Trash2 className="h-3 w-3" />
                        </button>
                        {p.status === 'activa'
                          ? <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                          : p.status === 'aprobada'
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : p.status === 'cerrada'
                          ? <Lock className="h-4 w-4 text-slate-400" />
                          : <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Dialogs ── */}

      {/* Nueva propuesta */}
      <ProposalFormDialog
        open={showNewProposal}
        onClose={() => setShowNewProposal(false)}
        properties={properties}
        defaultPropertyId={selectedPropertyId}
        onSave={data => handleCreateProposal(data as any)}
        mode="create"
      />

      {/* Editar propuesta */}
      {editingProposal && (
        <ProposalFormDialog
          open={!!editingProposal}
          onClose={() => setEditingProposal(null)}
          properties={properties}
          defaultPropertyId={editingProposal.propertyId}
          initialData={editingProposal}
          onSave={data => handleEditProposal(data)}
          mode="edit"
        />
      )}

      {/* Confirmar eliminación */}
      <Dialog open={!!deletingProposal} onOpenChange={v => !v && setDeletingProposal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Eliminar propuesta
            </DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Se eliminarán la propuesta, todos los votos y comentarios asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 text-sm font-bold text-destructive">
            "{deletingProposal?.title}"
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingProposal(null)}>Cancelar</Button>
            <Button variant="destructive" className="font-bold gap-2" onClick={handleDeleteProposal}>
              <Trash2 className="h-4 w-4" /> Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial de votos */}
      <Dialog open={showHistory} onOpenChange={v => !v && setShowHistory(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Historial de Votos
            </DialogTitle>
            <DialogDescription>
              {featuredProposal?.title} — {(featuredProposal?.voteHistory || []).length} votos registrados
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-1">
            {(featuredProposal?.voteHistory || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay votos registrados aún.</p>
            ) : (
              [...(featuredProposal?.voteHistory || [])].reverse().map((v, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2.5">
                  <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                    v.vote === 'for' ? 'bg-primary/15' : 'bg-red-100'
                  )}>
                    {v.vote === 'for'
                      ? <ThumbsUp  className="h-3.5 w-3.5 text-primary"     />
                      : <ThumbsDown className="h-3.5 w-3.5 text-red-500"    />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{v.voterName}</p>
                    <p className="text-[10px] text-muted-foreground">{v.voterUnit}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-[11px] font-black', v.vote === 'for' ? 'text-primary' : 'text-red-500')}>
                      {v.vote === 'for' ? 'A Favor' : 'En Contra'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{timeAgo(v.ts)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-2 font-bold" onClick={() => featuredProposal && exportProposalCSV(featuredProposal)}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button className="bg-primary font-bold" onClick={() => setShowHistory(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar voto con nombre */}
      <RegisterVoteDialog
        open={showRegisterVote}
        onClose={() => setShowRegisterVote(false)}
        proposal={featuredProposal ?? null}
        contracts={contracts.filter(c => c.propertyId === selectedPropertyId)}
        onRegister={(type, name, unit) => {
          if (featuredProposal) handleVote(featuredProposal.id, type, name, unit);
          setShowRegisterVote(false);
        }}
      />
    </div>
  );
}

// ── Dialog reutilizable: crear / editar propuesta ──────
function ProposalFormDialog({ open, onClose, properties, defaultPropertyId, initialData, onSave, mode }: {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  defaultPropertyId: string | null;
  initialData?: Partial<Proposal>;
  onSave: (data: any) => void;
  mode: 'create' | 'edit';
}) {
  const [title,          setTitle]          = useState(initialData?.title          ?? '');
  const [description,    setDescription]    = useState(initialData?.description    ?? '');
  const [iconType,       setIconType]       = useState<ProposalIconType>(initialData?.iconType ?? 'other');
  const [deadline,       setDeadline]       = useState(initialData?.deadline       ?? '');
  const [quorumRequired, setQuorumRequired] = useState(String(initialData?.quorumRequired ?? 60));
  const [restriction,    setRestriction]    = useState<VoterRestriction>(initialData?.voterRestriction ?? 'todos');
  const [propertyId,     setPropertyId]     = useState(initialData?.propertyId ?? defaultPropertyId ?? '');

  React.useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title ?? '');
      setDescription(initialData.description ?? '');
      setIconType(initialData.iconType ?? 'other');
      setDeadline(initialData.deadline ?? '');
      setQuorumRequired(String(initialData.quorumRequired ?? 60));
      setRestriction(initialData.voterRestriction ?? 'todos');
      setPropertyId(initialData.propertyId ?? defaultPropertyId ?? '');
    }
  }, [open, initialData]);

  const valid = title && description && deadline && Number(quorumRequired) > 0 && propertyId;

  const handleSave = () => {
    if (!valid) return;
    onSave({ title, description, iconType, deadline, quorumRequired: Number(quorumRequired), voterRestriction: restriction, propertyId });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'create'
              ? <><Vote className="h-5 w-5 text-primary" /> Nueva Propuesta</>
              : <><Pencil className="h-5 w-5 text-primary" /> Editar Propuesta</>
            }
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Configurá todos los parámetros de la votación.'
              : 'Modificá los datos de la propuesta. Los votos ya registrados se mantienen.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
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
            <Textarea placeholder="Describí la propuesta en detalle..."
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="resize-none" />
          </div>

          {/* Categoría + Fecha */}
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

          {/* Quórum + Restricción */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quórum requerido (%)</Label>
              <Input type="number" min={1} max={100}
                value={quorumRequired} onChange={e => setQuorumRequired(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>¿Quién puede votar?</Label>
              <Select value={restriction} onValueChange={v => setRestriction(v as VoterRestriction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">🔓 Todos</SelectItem>
                  <SelectItem value="solo_inquilinos">👥 Solo inquilinos</SelectItem>
                  <SelectItem value="solo_propietarios">✅ Solo propietarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info de restricción */}
          <div className="bg-muted/30 rounded-xl p-3 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Quórum {quorumRequired}%</strong> con acceso <strong>{RESTRICTION_LABEL[restriction].toLowerCase()}</strong>.
              Se necesita al menos ese porcentaje de participación para que el resultado sea válido.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold gap-2" onClick={handleSave} disabled={!valid}>
            {mode === 'create'
              ? <><Vote className="h-4 w-4" /> Publicar propuesta</>
              : <><Pencil className="h-4 w-4" /> Guardar cambios</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Registrar voto con nombre ─────────────────
function RegisterVoteDialog({ open, onClose, proposal, contracts, onRegister }: {
  open: boolean;
  onClose: () => void;
  proposal: Proposal | null;
  contracts: Contract[];
  onRegister: (type: 'for' | 'against', name: string, unit: string) => void;
}) {
  const [voteType,    setVoteType]    = useState<'for' | 'against'>('for');
  const [voterName,   setVoterName]   = useState('');
  const [voterUnit,   setVoterUnit]   = useState('');
  const [useExisting, setUseExisting] = useState(true);
  const [selectedId,  setSelectedId]  = useState('');

  const tenantOptions = useMemo(() =>
    contracts.filter(c => c.tenantName).map(c => ({
      id: c.id, name: c.tenantName ?? '', unit: c.propertyName ?? c.propertyId,
    })),
  [contracts]);

  const handleRegister = () => {
    let name = voterName;
    let unit = voterUnit;
    if (useExisting && selectedId) {
      const opt = tenantOptions.find(o => o.id === selectedId);
      if (opt) { name = opt.name; unit = opt.unit; }
    }
    if (!name) return;
    onRegister(voteType, name, unit || 'Unidad sin especificar');
    setVoteType('for'); setVoterName(''); setVoterUnit(''); setSelectedId('');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> Registrar Voto
          </DialogTitle>
          <DialogDescription>
            Registrá el voto de un votante habilitado para esta propuesta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Seleccionar votante */}
          {tenantOptions.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setUseExisting(true)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                    useExisting ? 'bg-primary text-white border-primary' : 'border-muted text-muted-foreground hover:border-primary/30')}>
                  Desde contratos
                </button>
                <button onClick={() => setUseExisting(false)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                    !useExisting ? 'bg-primary text-white border-primary' : 'border-muted text-muted-foreground hover:border-primary/30')}>
                  Ingresar manualmente
                </button>
              </div>
              {useExisting ? (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná votante..." /></SelectTrigger>
                  <SelectContent>
                    {tenantOptions.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="font-bold">{o.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{o.unit}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nombre" value={voterName} onChange={e => setVoterName(e.target.value)} />
                  <Input placeholder="Unidad (Ej: Apt 3B)" value={voterUnit} onChange={e => setVoterUnit(e.target.value)} />
                </div>
              )}
            </div>
          )}
          {tenantOptions.length === 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nombre" value={voterName} onChange={e => setVoterName(e.target.value)} />
              <Input placeholder="Unidad (Ej: Apt 3B)" value={voterUnit} onChange={e => setVoterUnit(e.target.value)} />
            </div>
          )}

          {/* Tipo de voto */}
          <div className="space-y-1.5">
            <Label>Tipo de voto</Label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setVoteType('for')}
                className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                  voteType === 'for'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted text-muted-foreground hover:border-primary/30')}>
                <ThumbsUp className="h-4 w-4" /> A Favor
              </button>
              <button onClick={() => setVoteType('against')}
                className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                  voteType === 'against'
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-muted text-muted-foreground hover:border-destructive/20')}>
                <ThumbsDown className="h-4 w-4" /> En Contra
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold" onClick={handleRegister}
            disabled={useExisting ? !selectedId : !voterName}>
            Registrar voto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
