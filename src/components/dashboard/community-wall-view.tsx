'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Heart, MessageCircle, Send, CalendarDays, Megaphone,
  Tag, Home, Percent, PartyPopper, Coffee, Shirt, Star, Store,
  Trash2, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

// ── Types ──────────────────────────────────────────────────────────────────────
interface PostReply {
  id: string; authorId: string; authorName: string;
  authorInitial: string; authorColor: string;
  content: string; createdAt: string;
}
interface CommunityPost {
  id: string; authorId: string; authorName: string;
  authorInitial: string; authorColor: string;
  authorRole: string; authorUnit?: string;
  content: string; isOfficial: boolean;
  likes: string[]; replies: PostReply[];
  createdAt: string;
}
interface CommunityEvent {
  id: string; creatorId: string; creatorName: string;
  title: string; description: string;
  date: string; time?: string; location?: string;
  tag: string; type: 'evento' | 'roomie';
  roomieBudget?: number;
  createdAt: string;
}
interface Benefit {
  id: string; adminId: string; businessName: string;
  distance?: string; discountText: string;
  promoCode?: string; promoLabel?: string;
  iconType: 'coffee' | 'laundry' | 'food' | 'shop' | 'other';
  createdAt: string;
}

interface CommunityWallViewProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-emerald-500','bg-blue-500','bg-purple-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500'];
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function initial(name: string) { return name.trim().charAt(0).toUpperCase(); }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} hora${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `Hace ${d} día${d > 1 ? 's' : ''}`;
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return { day: d.getDate(), month: d.toLocaleString('es-AR', { month: 'short' }).toUpperCase() };
}
function fmt(n: number) { return `$${n.toLocaleString('es-AR')}`; }

const BENEFIT_ICON: Record<string, React.ElementType> = {
  coffee: Coffee, laundry: Shirt, food: Star, shop: Store, other: Tag,
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
function AvatarCircle({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm' };
  return (
    <div className={cn('rounded-full flex items-center justify-center font-black text-white shrink-0', color, sizes[size])}>
      {initial(name)}
    </div>
  );
}

// ── PostCard ───────────────────────────────────────────────────────────────────
function PostCard({ post, userId, onLike, onReply, onDelete, canDelete, isModerator }: {
  post: CommunityPost; userId?: string;
  onLike: () => void; onReply: (txt: string) => void; onDelete: () => void;
  canDelete: boolean; isModerator?: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const liked = userId ? post.likes.includes(userId) : false;
  const showDelete = canDelete || isModerator;

  return (
    <div className="py-4 border-b border-border/50 last:border-0 relative">
      {isModerator && post.authorId !== userId && (
        <span className="absolute top-3 right-0 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 uppercase tracking-wide">
          👑 mod
        </span>
      )}
      <div className="flex gap-3">
        <AvatarCircle name={post.authorName} color={avatarColor(post.authorName)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-black text-sm text-foreground">{post.authorName}</span>
            {post.authorUnit && <span className="text-[11px] text-muted-foreground font-medium">{post.authorUnit}</span>}
            <span className="text-muted-foreground text-[10px]">•</span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground mt-1 leading-relaxed">{post.content}</p>
          {post.isOfficial && (
            <Badge className="mt-1.5 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black gap-1 uppercase tracking-wide">
              <Megaphone className="h-2.5 w-2.5" /> Aviso Oficial
            </Badge>
          )}
          {post.replies.length > 0 && (
            <div className="mt-3 space-y-2 pl-3 border-l-2 border-border/40">
              {post.replies.map(r => (
                <div key={r.id} className="flex gap-2">
                  <AvatarCircle name={r.authorName} color={r.authorColor} size="sm" />
                  <div className="bg-muted/40 rounded-lg px-3 py-1.5 text-xs text-foreground flex-1">
                    <span className="font-bold">{r.authorName}</span> · {r.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <button onClick={onLike}
              className={cn('flex items-center gap-1 text-xs font-bold transition-colors', liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500')}>
              <Heart className={cn('h-3.5 w-3.5', liked && 'fill-rose-500')} />
              {post.likes.length > 0 && post.likes.length}
            </button>
            <button onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
              <MessageCircle className="h-3.5 w-3.5" /> Responder
            </button>
            {showDelete && (
              <button onClick={onDelete}
                className={cn('flex items-center gap-1 text-xs font-bold transition-colors ml-auto',
                  isModerator && post.authorId !== userId ? 'text-amber-600 hover:text-destructive' : 'text-muted-foreground hover:text-destructive')}>
                <Trash2 className="h-3.5 w-3.5" />
                {isModerator && post.authorId !== userId && <span>Moderar</span>}
              </button>
            )}
          </div>
          {showReply && (
            <div className="flex gap-2 mt-2">
              <Input className="flex-1 h-8 text-sm" placeholder="Respondé…" value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setShowReply(false); } }}
              />
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { if (replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setShowReply(false); } }}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function CommunityWallView({ userId, userEmail, userName }: CommunityWallViewProps) {
  const { toast }    = useToast();
  const db           = useFirestore();
  const { user }     = useUser();
  const { canWrite } = useOrgPermissions();
  const isSuperAdmin = (user?.email ?? userEmail) === SUPER_ADMIN_EMAIL;

  const uid   = user?.uid  ?? userId  ?? '';
  const uName = user?.displayName ?? userName ?? 'Usuario';

  // ── Post input ──
  const [newPostText, setNewPostText] = useState('');
  const [newPostUnit, setNewPostUnit] = useState('');
  const [isOfficial,  setIsOfficial]  = useState(false);

  // ── Dialogs ──
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newType, setNewType]             = useState<'evento' | 'roomie' | 'beneficio' | null>(null);

  const [eventoForm, setEventoForm] = useState({ title: '', description: '', date: '', time: '', location: '', tag: 'SALA COMÚN', type: 'evento' as 'evento' | 'roomie', roomieBudget: '' });
  const [benefForm,  setBenefForm]  = useState({ businessName: '', distance: '', discountText: '', promoCode: '', promoLabel: '', iconType: 'other' as Benefit['iconType'] });

  // ── Firestore ──
  const postsQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadPosts'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: postsRaw } = useCollection<CommunityPost>(postsQ);

  const eventosQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadEventos'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: eventosRaw } = useCollection<CommunityEvent>(eventosQ);

  const beneficiosQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadBeneficios'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: beneficiosRaw } = useCollection<Benefit>(beneficiosQ);

  const posts      = postsRaw      ?? [];
  const eventos    = eventosRaw    ?? [];
  const beneficios = beneficiosRaw ?? [];

  // ── Post handlers ──
  const handlePost = () => {
    if (!newPostText.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadPosts', id);
    setDocumentNonBlocking(ref, {
      id, authorId: uid, authorName: uName,
      authorInitial: initial(uName), authorColor: avatarColor(uName),
      authorRole: isOfficial ? 'Administración' : 'Inquilino',
      authorUnit: newPostUnit.trim() || undefined,
      content: newPostText.trim(), isOfficial,
      likes: [], replies: [], createdAt: new Date().toISOString(),
    }, {});
    setNewPostText(''); setNewPostUnit(''); setIsOfficial(false);
    toast({ title: isOfficial ? '📢 Aviso publicado' : '✅ Publicación enviada' });
  };

  const handleLike = (post: CommunityPost) => {
    if (!db || !uid) return;
    const ref   = doc(db, 'artifacts', APP_ID, 'comunidadPosts', post.id);
    const likes = post.likes.includes(uid) ? post.likes.filter(l => l !== uid) : [...post.likes, uid];
    setDocumentNonBlocking(ref, { likes }, { merge: true });
  };

  const handleReply = (post: CommunityPost, txt: string) => {
    if (!db) return;
    const ref   = doc(db, 'artifacts', APP_ID, 'comunidadPosts', post.id);
    const reply: PostReply = {
      id: Math.random().toString(36).substr(2, 6),
      authorId: uid, authorName: uName,
      authorInitial: initial(uName), authorColor: avatarColor(uName),
      content: txt, createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, { replies: [...post.replies, reply] }, { merge: true });
  };

  const handleDeletePost = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadPosts', id));
    toast({ title: 'Publicación eliminada' });
  };

  // ── Evento handler ──
  const handleSaveEvento = () => {
    if (!eventoForm.title.trim() || !eventoForm.date || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadEventos', id), {
      id, creatorId: uid, creatorName: uName,
      title: eventoForm.title.trim(), description: eventoForm.description.trim(),
      date: eventoForm.date, time: eventoForm.time, location: eventoForm.location,
      tag: eventoForm.tag.toUpperCase(), type: eventoForm.type,
      roomieBudget: eventoForm.roomieBudget ? parseFloat(eventoForm.roomieBudget) : undefined,
      createdAt: new Date().toISOString(),
    }, {});
    toast({ title: `✅ ${eventoForm.type === 'roomie' ? 'Búsqueda de roomie' : 'Evento'} publicado` });
    setShowNewDialog(false); setNewType(null);
    setEventoForm({ title: '', description: '', date: '', time: '', location: '', tag: 'SALA COMÚN', type: 'evento', roomieBudget: '' });
  };

  // ── Beneficio handler ──
  const handleSaveBenefit = () => {
    if (!benefForm.businessName.trim() || !benefForm.discountText.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadBeneficios', id), {
      id, adminId: uid,
      businessName: benefForm.businessName.trim(), distance: benefForm.distance.trim(),
      discountText: benefForm.discountText.trim(), promoCode: benefForm.promoCode.trim(),
      promoLabel: benefForm.promoLabel.trim(), iconType: benefForm.iconType,
      createdAt: new Date().toISOString(),
    }, {});
    toast({ title: '✅ Beneficio publicado' });
    setShowNewDialog(false); setNewType(null);
    setBenefForm({ businessName: '', distance: '', discountText: '', promoCode: '', promoLabel: '', iconType: 'other' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" /> Comunidad del Edificio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Muro de avisos, eventos, búsqueda de roomies y beneficios para los vecinos.
          </p>
        </div>
        <Button className="gap-2 font-black bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => { setNewType(null); setShowNewDialog(true); }}>
          <Plus className="h-4 w-4" /> Nueva publicación
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Muro ── */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> Muro del Edificio
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-0">
              {/* Compose */}
              <div className="flex gap-3 items-start pb-4 border-b border-border/50">
                <AvatarCircle name={uName} color={avatarColor(uName)} />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 bg-muted/30 border-transparent focus:border-border focus:bg-white"
                      placeholder="¿Qué está pasando en el edificio?"
                      value={newPostText}
                      onChange={e => setNewPostText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
                    />
                    <button onClick={handlePost} disabled={!newPostText.trim()}
                      className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input className="w-32 h-7 text-xs bg-muted/30 border-transparent" placeholder="Ej: Apto 402"
                      value={newPostUnit} onChange={e => setNewPostUnit(e.target.value)} />
                    {canWrite && (
                      <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground cursor-pointer">
                        <Switch checked={isOfficial} onCheckedChange={setIsOfficial} className="scale-75" />
                        Aviso Oficial
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sé el primero en publicar algo</p>
                </div>
              ) : (
                posts.slice(0, 10).map(post => (
                  <PostCard key={post.id} post={post} userId={uid}
                    onLike={() => handleLike(post)}
                    onReply={txt => handleReply(post, txt)}
                    onDelete={() => handleDeletePost(post.id)}
                    canDelete={post.authorId === uid || canWrite}
                    isModerator={isSuperAdmin}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Eventos + Beneficios ── */}
        <div className="space-y-6">

          {/* Eventos & Roomies */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <CalendarDays className="h-4 w-4 text-emerald-600" /> Eventos & Roomies
              </CardTitle>
              <button onClick={() => { setNewType('evento'); setShowNewDialog(true); }}
                className="text-xs font-bold text-emerald-600 hover:underline">+ Crear</button>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {eventos.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <CalendarDays className="h-7 w-7 mx-auto mb-2 opacity-20" />
                  <p>Sin eventos próximos</p>
                </div>
              ) : (
                eventos.slice(0, 5).map(ev => {
                  const { day, month } = fmtDate(ev.date);
                  const isRoomie = ev.type === 'roomie';
                  return (
                    <div key={ev.id} className="flex gap-3 items-start p-3 rounded-xl hover:bg-muted/20 transition-colors border border-transparent hover:border-border/40 group">
                      {isRoomie ? (
                        <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                          <Home className="h-5 w-5 text-purple-600" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-emerald-600 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] font-black text-emerald-200 leading-none">{month}</span>
                          <span className="text-xl font-black text-white leading-none">{day}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-black text-sm leading-tight">{ev.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {ev.tag}
                            </Badge>
                            {(isSuperAdmin || ev.creatorId === uid) && (
                              <button
                                onClick={() => { if (!db) return; deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadEventos', ev.id)); toast({ title: 'Evento eliminado' }); }}
                                className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                        {ev.roomieBudget && (
                          <p className="text-xs font-bold text-purple-600 mt-1">Presupuesto: {fmt(ev.roomieBudget)}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Beneficios */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Tag className="h-4 w-4 text-emerald-600" /> Beneficios Locales
              </CardTitle>
              {canWrite && (
                <button onClick={() => { setNewType('beneficio'); setShowNewDialog(true); }}
                  className="text-xs font-bold text-emerald-600 hover:underline">+ Agregar</button>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {beneficios.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <Percent className="h-7 w-7 mx-auto mb-2 opacity-20" />
                  <p>Sin beneficios cargados aún</p>
                </div>
              ) : (
                beneficios.slice(0, 5).map(b => {
                  const BIcon = BENEFIT_ICON[b.iconType] || Tag;
                  return (
                    <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-white hover:shadow-sm transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <BIcon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-black text-sm leading-tight">{b.businessName}</p>
                          {(isSuperAdmin || b.adminId === uid) && (
                            <button
                              onClick={() => { if (!db) return; deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadBeneficios', b.id)); toast({ title: 'Beneficio eliminado' }); }}
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {b.distance && <p className="text-[10px] text-muted-foreground">{b.distance}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-lg font-black text-emerald-700 leading-none">{b.discountText}</span>
                          {b.promoCode && (
                            <div className="bg-muted/60 rounded px-2 py-0.5">
                              <p className="text-[8px] text-muted-foreground font-bold uppercase">Código:</p>
                              <p className="text-[11px] font-black text-foreground leading-none">{b.promoCode}</p>
                            </div>
                          )}
                          {b.promoLabel && !b.promoCode && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{b.promoLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialog: Nueva publicación ── */}
      <Dialog open={showNewDialog} onOpenChange={v => { setShowNewDialog(v); if (!v) setNewType(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!newType ? 'Nueva publicación en Comunidad' :
               newType === 'evento'    ? '📅 Crear Evento' :
               newType === 'roomie'    ? '🏠 Buscar Roomie' :
               '🎁 Agregar Beneficio'}
            </DialogTitle>
            <DialogDescription>
              {!newType ? 'Elegí qué tipo de publicación querés crear.' : 'Completá los datos.'}
            </DialogDescription>
          </DialogHeader>

          {/* Selector de tipo */}
          {!newType && (
            <div className="grid grid-cols-2 gap-3 py-4">
              {[
                { type: 'evento'    as const, icon: PartyPopper, label: 'Evento',         sub: 'Invitá a tus vecinos',   color: 'blue'   },
                { type: 'roomie'    as const, icon: Home,        label: 'Buscar Roomie',   sub: 'Compartí el depto',      color: 'purple' },
                { type: 'beneficio' as const, icon: Tag,         label: 'Beneficio',       sub: 'Para todos los vecinos', color: 'amber', adminOnly: true },
              ].filter(t => !t.adminOnly || canWrite).map(({ type, icon: Icon, label, sub, color }) => (
                <button key={type} onClick={() => setNewType(type)}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-center">
                  <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', `bg-${color}-50`)}>
                    <Icon className={cn('h-6 w-6', `text-${color}-600`)} />
                  </div>
                  <div>
                    <p className="font-black text-sm">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Evento / Roomie form */}
          {(newType === 'evento' || newType === 'roomie') && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Título *</Label>
                  <Input placeholder={newType === 'roomie' ? 'Ej: Busco compañero de depto' : 'Ej: Asado de Integración'}
                    value={eventoForm.title} onChange={e => setEventoForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha *</Label>
                  <Input type="date" value={eventoForm.date} onChange={e => setEventoForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Horario</Label>
                  <Input type="time" value={eventoForm.time} onChange={e => setEventoForm(f => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Lugar</Label>
                  <Input placeholder="Ej: Terraza, Sala B" value={eventoForm.location} onChange={e => setEventoForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tag</Label>
                  <Input placeholder="TERRAZA, ONLINE…" value={eventoForm.tag} onChange={e => setEventoForm(f => ({ ...f, tag: e.target.value }))} />
                </div>
                {newType === 'roomie' && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Presupuesto mensual ($)</Label>
                    <Input type="number" placeholder="0" value={eventoForm.roomieBudget} onChange={e => setEventoForm(f => ({ ...f, roomieBudget: e.target.value }))} />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea placeholder="Detalles del evento o lo que buscás en un roomie…"
                    className="min-h-[70px]" value={eventoForm.description} onChange={e => setEventoForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Beneficio form */}
          {newType === 'beneficio' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre del Comercio *</Label>
                  <Input placeholder="Ej: Café del Parque" value={benefForm.businessName} onChange={e => setBenefForm(f => ({ ...f, businessName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Distancia / Dirección</Label>
                  <Input placeholder="A 2 cuadras del edificio" value={benefForm.distance} onChange={e => setBenefForm(f => ({ ...f, distance: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ícono</Label>
                  <Select value={benefForm.iconType} onValueChange={v => setBenefForm(f => ({ ...f, iconType: v as Benefit['iconType'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coffee">☕ Café</SelectItem>
                      <SelectItem value="laundry">👕 Lavandería</SelectItem>
                      <SelectItem value="food">🍽️ Comida</SelectItem>
                      <SelectItem value="shop">🛍️ Tienda</SelectItem>
                      <SelectItem value="other">📍 Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Texto de descuento *</Label>
                  <Input placeholder="Ej: 15% OFF  /  2×1" value={benefForm.discountText} onChange={e => setBenefForm(f => ({ ...f, discountText: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Código promocional</Label>
                  <Input placeholder="Ej: ALQ15" value={benefForm.promoCode} onChange={e => setBenefForm(f => ({ ...f, promoCode: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Etiqueta</Label>
                  <Input placeholder="Ej: Martes, Solo hoy" value={benefForm.promoLabel} onChange={e => setBenefForm(f => ({ ...f, promoLabel: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { if (newType) setNewType(null); else setShowNewDialog(false); }}>
              {newType ? '← Atrás' : 'Cancelar'}
            </Button>
            {newType && (
              <Button className="font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (newType === 'evento' || newType === 'roomie') handleSaveEvento();
                  if (newType === 'beneficio') handleSaveBenefit();
                }}>
                Publicar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
