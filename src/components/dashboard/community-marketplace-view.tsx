'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Search, Plus, Heart, MessageCircle, Send, Star, ChevronLeft, ChevronRight,
  Tag, CalendarDays, Users, Megaphone, ShoppingBag, MapPin, Clock,
  CheckCircle2, Trash2, Edit2, Coffee, Shirt, Monitor, Sofa, Bike,
  PartyPopper, Home, Percent, Repeat, DollarSign, AlertCircle, Crown,
  Store, X, ImagePlus, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Person, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID   = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';
const ADMIN_COMMISSION  = 0.03;
const SUPER_COMMISSION  = 0.03;

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
interface MarketplaceItem {
  id: string; sellerId: string; sellerName: string; sellerAdminId: string;
  title: string; description: string; price?: number; isExchange: boolean;
  images: string[]; category: string;
  status: 'Disponible' | 'Reservado' | 'Vendido';
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
interface CommissionRecord {
  id: string; itemId: string; itemTitle: string;
  saleAmount: number; sellerId: string; sellerName: string;
  adminId: string; adminName: string;
  adminCommission: number; superAdminCommission: number;
  status: 'Pendiente' | 'Pagado'; createdAt: string;
}

interface CommunityMarketplaceViewProps {
  people:     Person[];
  properties: Property[];
  userId?:    string;
  userEmail?: string;
  userName?:  string;
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
import { fmtMoney as fmt } from '@/lib/format';
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return { day: d.getDate(), month: d.toLocaleString('es-AR', { month: 'short' }).toUpperCase() };
}

const BENEFIT_ICON: Record<string, React.ElementType> = {
  coffee: Coffee, laundry: Shirt, food: Star, shop: Store, other: Tag,
};

const ITEM_CATEGORY_ICONS: Record<string, React.ElementType> = {
  Muebles: Sofa, Electrónica: Monitor, Ropa: Shirt, Deportes: Bike,
  Otros: ShoppingBag,
};

// ── Sub-components ──────────────────────────────────────────────────────────────
function AvatarCircle({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <div className={cn('rounded-full flex items-center justify-center font-black text-white shrink-0', color, sizes[size])}>
      {initial(name)}
    </div>
  );
}

function PostCard({ post, userId, onLike, onReply, onDelete, canDelete, isModerator }:
  { post: CommunityPost; userId?: string; onLike: () => void; onReply: (txt: string) => void; onDelete: () => void; canDelete: boolean; isModerator?: boolean }
) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const liked = userId ? post.likes.includes(userId) : false;
  const showDelete = canDelete || isModerator;

  return (
    <div className={cn("py-4 border-b border-border/50 last:border-0", isModerator && post.authorId !== userId && "relative")}>
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

          {/* Replies */}
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

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={onLike}
              className={cn('flex items-center gap-1 text-xs font-bold transition-colors', liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500')}
            >
              <Heart className={cn('h-3.5 w-3.5', liked && 'fill-rose-500')} />
              {post.likes.length > 0 && post.likes.length}
            </button>
            <button onClick={() => setShowReply(!showReply)} className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
              <MessageCircle className="h-3.5 w-3.5" /> Responder
            </button>
            {showDelete && (
              <button onClick={onDelete} className={cn(
                "flex items-center gap-1 text-xs font-bold transition-colors ml-auto",
                isModerator && post.authorId !== userId
                  ? "text-amber-600 hover:text-destructive"
                  : "text-muted-foreground hover:text-destructive"
              )}>
                <Trash2 className="h-3.5 w-3.5" />
                {isModerator && post.authorId !== userId && <span>Moderar</span>}
              </button>
            )}
          </div>

          {showReply && (
            <div className="flex gap-2 mt-2">
              <Input className="flex-1 h-8 text-sm" placeholder="Respondé…" value={replyText} onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setShowReply(false); } }}
              />
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => { if (replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setShowReply(false); } }}>
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
export function CommunityMarketplaceView({ people, properties, userId, userEmail, userName }: CommunityMarketplaceViewProps) {
  const { toast }     = useToast();
  const db            = useFirestore();
  const { user }      = useUser();
  const { canWrite }  = useOrgPermissions();
  const isSuperAdmin  = (user?.email ?? userEmail) === SUPER_ADMIN_EMAIL;

  const uid       = user?.uid ?? userId ?? '';
  const uName     = user?.displayName ?? userName ?? 'Usuario';
  const uEmail    = user?.email       ?? userEmail ?? '';

  // ── New post input ──
  const [newPostText,  setNewPostText]  = useState('');
  const [newPostUnit,  setNewPostUnit]  = useState('');
  const [isOfficial,   setIsOfficial]   = useState(false);

  // ── Dialogs ──
  const [showNewDialog,    setShowNewDialog]    = useState(false);
  const [newType,          setNewType]          = useState<'item' | 'evento' | 'roomie' | 'beneficio' | null>(null);

  // Marketplace form
  const [itemForm,    setItemForm]    = useState({ title: '', description: '', price: '', isExchange: false, category: 'Otros', images: [] as string[] });
  // Event form
  const [eventoForm,  setEventoForm]  = useState({ title: '', description: '', date: '', time: '', location: '', tag: 'SALA COMÚN', type: 'evento' as 'evento' | 'roomie', roomieBudget: '' });
  // Benefit form
  const [benefForm,   setBenefForm]   = useState({ businessName: '', distance: '', discountText: '', promoCode: '', promoLabel: '', iconType: 'other' as Benefit['iconType'] });

  // Marketplace pagination
  const [mktPage, setMktPage] = useState(0);
  const MKT_PER_PAGE = 2;

  // Commission dialog
  const [saleItem,       setSaleItem]       = useState<MarketplaceItem | null>(null);
  const [saleConfirmAmt, setSaleConfirmAmt] = useState('');

  // Commissions panel (super admin)
  const [showCommissions, setShowCommissions] = useState(false);

  // ── Firestore — colecciones compartidas entre todos los usuarios ──
  const postsQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadPosts'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: postsRaw } = useCollection<CommunityPost>(postsQ);

  const itemsQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadMarketplace'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: itemsRaw } = useCollection<MarketplaceItem>(itemsQ);

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

  const transQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadTransacciones'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: transRaw } = useCollection<CommissionRecord>(transQ);

  const posts      = postsRaw      ?? [];
  const items      = itemsRaw      ?? [];
  const eventos    = eventosRaw    ?? [];
  const beneficios = beneficiosRaw ?? [];
  const trans      = transRaw      ?? [];

  const mktItems = items.filter(i => i.status === 'Disponible' || i.status === 'Reservado');
  const mktPages = Math.ceil(mktItems.length / MKT_PER_PAGE);
  const mktVisible = mktItems.slice(mktPage * MKT_PER_PAGE, (mktPage + 1) * MKT_PER_PAGE);

  // ── Post actions ──
  const handlePost = () => {
    if (!newPostText.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadPosts', id);
    const data: CommunityPost = {
      id, authorId: uid, authorName: uName,
      authorInitial: initial(uName), authorColor: avatarColor(uName),
      authorRole: isOfficial ? 'Administración' : 'Inquilino',
      authorUnit: newPostUnit.trim() || undefined,
      content: newPostText.trim(), isOfficial,
      likes: [], replies: [], createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, {});
    setNewPostText(''); setNewPostUnit(''); setIsOfficial(false);
    toast({ title: isOfficial ? '📢 Aviso publicado' : '✅ Publicación enviada' });
  };

  const handleLike = (post: CommunityPost) => {
    if (!db || !uid) return;
    const ref   = doc(db, 'artifacts', APP_ID, 'comunidadPosts', post.id);
    const likes = post.likes.includes(uid)
      ? post.likes.filter(l => l !== uid)
      : [...post.likes, uid];
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

  // ── Marketplace ──
  const handleSaveItem = () => {
    if (!itemForm.title.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', id);
    const data: MarketplaceItem = {
      id, sellerId: uid, sellerName: uName, sellerAdminId: uid,
      title: itemForm.title.trim(), description: itemForm.description.trim(),
      price: itemForm.isExchange ? undefined : parseFloat(itemForm.price) || 0,
      isExchange: itemForm.isExchange, images: itemForm.images,
      category: itemForm.category, status: 'Disponible',
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, {});
    toast({ title: '✅ Publicación en marketplace creada' });
    setShowNewDialog(false); setNewType(null);
    setItemForm({ title: '', description: '', price: '', isExchange: false, category: 'Otros', images: [] });
  };

  const handleMarkSold = (item: MarketplaceItem) => {
    setSaleItem(item);
    setSaleConfirmAmt(item.price ? String(item.price) : '');
  };

  const confirmSale = () => {
    if (!saleItem || !db) return;
    const amount   = parseFloat(saleConfirmAmt) || 0;
    const adminCom = Math.round(amount * ADMIN_COMMISSION);
    const superCom = Math.round(amount * SUPER_COMMISSION);
    // Update item status
    const itemRef = doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', saleItem.id);
    setDocumentNonBlocking(itemRef, { status: 'Vendido' }, { merge: true });
    // Record commission
    if (amount > 0) {
      const tId  = Math.random().toString(36).substr(2, 9);
      const tRef = doc(db, 'artifacts', APP_ID, 'comunidadTransacciones', tId);
      const rec: CommissionRecord = {
        id: tId, itemId: saleItem.id, itemTitle: saleItem.title,
        saleAmount: amount, sellerId: saleItem.sellerId, sellerName: saleItem.sellerName,
        adminId: saleItem.sellerAdminId, adminName: uName,
        adminCommission: adminCom, superAdminCommission: superCom,
        status: 'Pendiente', createdAt: new Date().toISOString(),
      };
      setDocumentNonBlocking(tRef, rec, {});
    }
    toast({ title: `✅ Venta registrada${amount > 0 ? ` · Comisión ${fmt(adminCom + superCom)}` : ''}` });
    setSaleItem(null); setSaleConfirmAmt('');
  };

  // ── Events ──
  const handleSaveEvento = () => {
    if (!eventoForm.title.trim() || !eventoForm.date || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadEventos', id);
    const data: CommunityEvent = {
      id, creatorId: uid, creatorName: uName,
      title: eventoForm.title.trim(), description: eventoForm.description.trim(),
      date: eventoForm.date, time: eventoForm.time, location: eventoForm.location,
      tag: eventoForm.tag.toUpperCase(), type: eventoForm.type,
      roomieBudget: eventoForm.roomieBudget ? parseFloat(eventoForm.roomieBudget) : undefined,
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, {});
    toast({ title: `✅ ${eventoForm.type === 'roomie' ? 'Búsqueda de roomie' : 'Evento'} publicado` });
    setShowNewDialog(false); setNewType(null);
    setEventoForm({ title: '', description: '', date: '', time: '', location: '', tag: 'SALA COMÚN', type: 'evento', roomieBudget: '' });
  };

  // ── Benefits ──
  const handleSaveBenefit = () => {
    if (!benefForm.businessName.trim() || !benefForm.discountText.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadBeneficios', id);
    const data: Benefit = {
      id, adminId: uid,
      businessName: benefForm.businessName.trim(), distance: benefForm.distance.trim(),
      discountText: benefForm.discountText.trim(), promoCode: benefForm.promoCode.trim(),
      promoLabel: benefForm.promoLabel.trim(), iconType: benefForm.iconType,
      createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(ref, data, {});
    toast({ title: '✅ Beneficio publicado' });
    setShowNewDialog(false); setNewType(null);
    setBenefForm({ businessName: '', distance: '', discountText: '', promoCode: '', promoLabel: '', iconType: 'other' });
  };

  // ── Commission totals ──
  const myCommissions    = trans.filter(t => t.adminId === uid);
  const myPendingTotal   = myCommissions.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.adminCommission, 0);
  const superTotal       = trans.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.superAdminCommission, 0);

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Comunidad y Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conectate con tus vecinos y descubrí oportunidades locales.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {myPendingTotal > 0 && !isSuperAdmin && (
            <button onClick={() => setShowCommissions(true)} className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Comisiones pendientes: {fmt(myPendingTotal)}
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => setShowCommissions(true)} className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" /> Comisiones: {fmt(superTotal)}
            </button>
          )}
          <Button className="gap-2 font-black bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => { setNewType(null); setShowNewDialog(true); }}>
            <Plus className="h-4 w-4" /> Nueva Publicación
          </Button>
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT (2/3): Wall + Marketplace ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Muro del Edificio */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> Muro del Edificio
              </CardTitle>
              <span className="text-xs font-bold text-emerald-600 cursor-pointer hover:underline">VER TODO</span>
            </CardHeader>
            <CardContent className="pt-0 space-y-0">

              {/* Compose */}
              <div className="flex gap-3 items-start pb-4 border-b border-border/50">
                <AvatarCircle name={uName} color={avatarColor(uName)} />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 bg-muted/30 border-transparent focus:border-border focus:bg-white"
                      placeholder="¿Qué está pasando en el edificio? Preguntá a tus vecinos…"
                      value={newPostText}
                      onChange={e => setNewPostText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
                    />
                    <button
                      onClick={handlePost}
                      disabled={!newPostText.trim()}
                      className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input className="w-32 h-7 text-xs bg-muted/30 border-transparent" placeholder="Ej: Apto 402" value={newPostUnit} onChange={e => setNewPostUnit(e.target.value)} />
                    {canWrite && (
                      <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground cursor-pointer">
                        <Switch checked={isOfficial} onCheckedChange={setIsOfficial} className="scale-75" />
                        Aviso Oficial
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Posts */}
              {posts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sé el primero en publicar algo</p>
                </div>
              ) : (
                posts.slice(0, 5).map(post => (
                  <PostCard
                    key={post.id} post={post} userId={uid}
                    onLike={() => handleLike(post)}
                    onReply={(txt) => handleReply(post, txt)}
                    onDelete={() => handleDeletePost(post.id)}
                    canDelete={post.authorId === uid || canWrite}
                    isModerator={isSuperAdmin}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Marketplace */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-black">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" /> Marketplace
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                  Solo podés publicar artículos o servicios de tu propiedad.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {mktPages > 1 && (
                  <>
                    <button onClick={() => setMktPage(p => Math.max(0, p - 1))} disabled={mktPage === 0}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={() => setMktPage(p => Math.min(mktPages - 1, p + 1))} disabled={mktPage >= mktPages - 1}
                      className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button onClick={() => { setNewType('item'); setShowNewDialog(true); }} className="text-xs font-bold text-emerald-600 hover:underline ml-2">+ Publicar</button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {mktVisible.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sin publicaciones en el marketplace</p>
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs font-bold"
                    onClick={() => { setNewType('item'); setShowNewDialog(true); }}>
                    <Plus className="h-3.5 w-3.5" /> Publicar algo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {mktVisible.map(item => {
                    const CatIcon = ITEM_CATEGORY_ICONS[item.category] || ShoppingBag;
                    return (
                      <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border/50 hover:shadow-md transition-shadow">
                        {/* Image / placeholder */}
                        <div className="relative aspect-[4/3] bg-muted/30">
                          {item.images[0] ? (
                            <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <CatIcon className="h-12 w-12 text-muted-foreground/20" />
                            </div>
                          )}
                          {/* Price or exchange badge */}
                          <div className="absolute bottom-2 left-2">
                            {item.isExchange ? (
                              <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Repeat className="h-3 w-3" /> Intercambio
                              </span>
                            ) : item.price != null && item.price > 0 ? (
                              <span className="bg-black/70 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                {fmt(item.price)}
                              </span>
                            ) : null}
                          </div>
                          {item.status === 'Reservado' && (
                            <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Reservado</div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="font-black text-sm leading-tight truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                          <div className="flex items-center justify-between mt-2 gap-1">
                            <span className="text-[10px] text-muted-foreground">{item.sellerName}</span>
                            <div className="flex items-center gap-1">
                              {(item.sellerId === uid || canWrite) && (
                                <button
                                  onClick={() => handleMarkSold(item)}
                                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-colors"
                                >Vendido</button>
                              )}
                              {isSuperAdmin && item.sellerId !== uid && (
                                <button
                                  onClick={() => {
                                    if (!db) return;
                                    if (confirm(`¿Eliminar "${item.title}" por incumplimiento de las reglas?`)) {
                                      deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', item.id));
                                      toast({ title: '🛡️ Publicación eliminada por moderación' });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                                  title="Eliminar por incumplimiento"
                                >⚑ Mod</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT (1/3): Beneficios + Eventos ── */}
        <div className="space-y-6">

          {/* Beneficios */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Tag className="h-4 w-4 text-emerald-600" /> Beneficios
              </CardTitle>
              {canWrite && (
                <button onClick={() => { setNewType('beneficio'); setShowNewDialog(true); }} className="text-xs font-bold text-emerald-600 hover:underline">+ Agregar</button>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {beneficios.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <Percent className="h-7 w-7 mx-auto mb-2 opacity-20" />
                  <p>Sin beneficios cargados aún</p>
                </div>
              )}
              {beneficios.slice(0, 4).map(b => {
                const BIcon = BENEFIT_ICON[b.iconType] || Tag;
                return (
                  <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-white hover:shadow-sm transition-colors group">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <BIcon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-black text-sm leading-tight">{b.businessName}</p>
                        {(isSuperAdmin || b.adminId === uid) && (
                          <button
                            onClick={() => {
                              if (!db) return;
                              deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadBeneficios', b.id));
                              toast({ title: 'Beneficio eliminado' });
                            }}
                            className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          >
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
              })}
              {beneficios.length > 4 && (
                <Button variant="outline" className="w-full text-xs font-bold mt-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  VER TODOS LOS COMERCIOS
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Eventos & Roomies */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <CalendarDays className="h-4 w-4 text-emerald-600" /> Eventos & Roomies
              </CardTitle>
              <button onClick={() => { setNewType('evento'); setShowNewDialog(true); }} className="text-xs font-bold text-emerald-600 hover:underline">+ Crear</button>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {eventos.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <CalendarDays className="h-7 w-7 mx-auto mb-2 opacity-20" />
                  <p>Sin eventos próximos</p>
                </div>
              )}
              {eventos.slice(0, 4).map(ev => {
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
                          <Badge className="text-[9px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ev.tag}
                          </Badge>
                          {(isSuperAdmin || ev.creatorId === uid) && (
                            <button
                              onClick={() => {
                                if (!db) return;
                                deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadEventos', ev.id));
                                toast({ title: 'Evento eliminado' });
                              }}
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title={isSuperAdmin ? 'Eliminar (moderación)' : 'Eliminar'}
                            >
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
              })}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════
          Dialog: Nueva Publicación (type selector or form)
      ══════════════════════════════════════════════════════ */}
      <Dialog open={showNewDialog} onOpenChange={v => { setShowNewDialog(v); if (!v) setNewType(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!newType ? 'Nueva Publicación' :
                newType === 'item'     ? '📦 Publicar en Marketplace' :
                newType === 'evento'   ? '📅 Crear Evento' :
                newType === 'roomie'   ? '🏠 Buscar Roomie' :
                '🎁 Agregar Beneficio'}
            </DialogTitle>
            <DialogDescription>
              {!newType ? 'Elegí qué tipo de publicación querés crear.' : 'Completá los datos.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Type selector ── */}
          {!newType && (
            <div className="grid grid-cols-2 gap-3 py-4">
              {[
                { type: 'item'     as const, icon: ShoppingBag, label: 'Marketplace',      sub: 'Vendé o intercambiá',     color: 'emerald' },
                { type: 'evento'   as const, icon: PartyPopper, label: 'Evento',             sub: 'Invitá a tus vecinos',    color: 'blue'    },
                { type: 'roomie'   as const, icon: Home,        label: 'Buscar Roomie',      sub: 'Compartí el depto',       color: 'purple'  },
                { type: 'beneficio'as const, icon: Tag,         label: 'Beneficio',          sub: 'Para todos los vecinos',  color: 'amber', adminOnly: true },
              ].filter(t => !t.adminOnly || canWrite).map(({ type, icon: Icon, label, sub, color }) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors text-center',
                    'group'
                  )}
                >
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

          {/* ── Marketplace form ── */}
          {newType === 'item' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Título *</Label>
                  <Input placeholder="Ej: Silla ergonómica casi nueva" value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoría</Label>
                  <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Muebles','Electrónica','Ropa','Deportes','Otros'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium h-full pt-6 cursor-pointer">
                    <Switch checked={itemForm.isExchange} onCheckedChange={v => setItemForm(f => ({ ...f, isExchange: v }))} />
                    Solo intercambio
                  </label>
                </div>
                {!itemForm.isExchange && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Precio ($)</Label>
                    <Input type="number" placeholder="Ej: 45000" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea placeholder="Estado, características, motivo de venta…" className="min-h-[70px]" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground border border-amber-200 bg-amber-50 rounded-lg p-2.5 space-y-1">
                  <p>💡 Comisión del <strong>6%</strong> sobre el precio final de venta (3% administradora + 3% plataforma).</p>
                  <p className="font-bold text-amber-700">⚖️ Regla: Solo podés publicar artículos o servicios de tu exclusiva propiedad. Publicaciones que no cumplan esta condición serán eliminadas por moderación.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Evento / Roomie form ── */}
          {(newType === 'evento' || newType === 'roomie') && (
            <div className="space-y-4 py-2">
              {newType === 'roomie' && (
                <div className="p-1 inline-flex rounded-lg bg-muted/50 gap-1">
                  {(['evento','roomie'] as const).map(t => (
                    <button key={t} onClick={() => setEventoForm(f => ({ ...f, type: t }))}
                      className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-colors capitalize',
                        eventoForm.type === t ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      {t === 'evento' ? '📅 Evento' : '🏠 Roomie'}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Título *</Label>
                  <Input placeholder={eventoForm.type === 'roomie' ? 'Ej: Busco compañero de depto' : 'Ej: Asado de Integración'} value={eventoForm.title} onChange={e => setEventoForm(f => ({ ...f, title: e.target.value }))} />
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
                {eventoForm.type === 'roomie' && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Presupuesto mensual ($)</Label>
                    <Input type="number" placeholder="0" value={eventoForm.roomieBudget} onChange={e => setEventoForm(f => ({ ...f, roomieBudget: e.target.value }))} />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea placeholder="Detalles del evento o lo que buscás en un roomie…" className="min-h-[70px]" value={eventoForm.description} onChange={e => setEventoForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* ── Beneficio form ── */}
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
              <Button className="font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                if (newType === 'item')      handleSaveItem();
                if (newType === 'evento' || newType === 'roomie') handleSaveEvento();
                if (newType === 'beneficio') handleSaveBenefit();
              }}>
                Publicar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          Dialog: Confirmar Venta + Comisión
      ══════════════════════════════════════════════════════ */}
      {saleItem && (
        <Dialog open={!!saleItem} onOpenChange={v => { if (!v) setSaleItem(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirmar Venta
              </DialogTitle>
              <DialogDescription>"{saleItem.title}"</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Monto final de la venta ($)</Label>
                <Input type="number" value={saleConfirmAmt} onChange={e => setSaleConfirmAmt(e.target.value)} placeholder="0" />
              </div>
              {parseFloat(saleConfirmAmt) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-sm">
                  <p className="font-black text-amber-800">Comisión total: {fmt(Math.round(parseFloat(saleConfirmAmt) * 0.06))}</p>
                  <p className="text-amber-700 text-xs">· 3% administradora ({fmt(Math.round(parseFloat(saleConfirmAmt) * 0.03))})</p>
                  <p className="text-amber-700 text-xs">· 3% plataforma ({fmt(Math.round(parseFloat(saleConfirmAmt) * 0.03))})</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaleItem(null)}>Cancelar</Button>
              <Button className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmSale}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ══════════════════════════════════════════════════════
          Dialog: Panel de Comisiones
      ══════════════════════════════════════════════════════ */}
      <Dialog open={showCommissions} onOpenChange={setShowCommissions}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 font-black">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              {isSuperAdmin ? 'Comisiones — Plataforma' : 'Mis Comisiones de Marketplace'}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? 'Todas las comisiones generadas en el marketplace comunitario (3% plataforma).'
                : 'Comisiones generadas por ventas en el marketplace de tu edificio (3% administradora).'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {(isSuperAdmin ? trans : myCommissions).length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="font-semibold">Sin comisiones registradas</p>
              </div>
            ) : (
              (isSuperAdmin ? trans : myCommissions).map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm truncate">{t.itemTitle}</p>
                    <p className="text-[11px] text-muted-foreground">{t.sellerName} · {new Date(t.createdAt).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-emerald-700">{fmt(isSuperAdmin ? t.superAdminCommission : t.adminCommission)}</p>
                    <p className="text-[10px] text-muted-foreground">Venta: {fmt(t.saleAmount)}</p>
                  </div>
                  <Badge className={cn('text-[10px] font-bold border', t.status === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                    {t.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total pendiente:</span>
            <span className="font-black text-emerald-700 text-base">
              {fmt(isSuperAdmin ? superTotal : myPendingTotal)}
            </span>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
