import { APP_ID, SUPER_ADMIN_EMAIL } from '@/lib/constants';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus, ChevronLeft, ChevronRight, ShoppingBag, Repeat, DollarSign,
  CheckCircle2, Trash2, AlertCircle, Crown, Search, SlidersHorizontal,
  MessageSquare, Send, Bookmark, Images, ChevronDown,
} from 'lucide-react';
import { Sofa, Monitor, Shirt, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy, where, increment } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { sendEmail } from '@/services/email-service';

const ADMIN_COMMISSION  = 0.03;
const SUPER_COMMISSION  = 0.03;

// ── Types ──────────────────────────────────────────────────────────────────────
interface MarketplaceItem {
  id: string; sellerId: string; sellerName: string; sellerAdminId: string;
  sellerEmail: string;
  title: string; description: string; price?: number; isExchange: boolean;
  images: string[]; category: string;
  status: 'Disponible' | 'Reservado' | 'Vendido';
  createdAt: string;
}

interface MarketplaceChat {
  id: string;
  itemId: string;
  itemTitle: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadSeller: number;
  unreadBuyer: number;
}

interface MarketplaceChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  ts: number;
}

interface CommissionRecord {
  id: string; itemId: string; itemTitle: string;
  saleAmount: number; sellerId: string; sellerName: string;
  adminId: string; adminName: string;
  adminCommission: number; superAdminCommission: number;
  status: 'Pendiente' | 'Pagado'; createdAt: string;
}

interface MarketplaceViewProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) { return `$${n.toLocaleString('es-AR')}`; }

const ITEM_CATEGORY_ICONS: Record<string, React.ElementType> = {
  Muebles: Sofa, Electrónica: Monitor, Ropa: Shirt, Deportes: Bike, Otros: ShoppingBag,
};
const CATEGORIES = ['Todos', 'Muebles', 'Electrónica', 'Ropa', 'Deportes', 'Otros'];

// ── Sub-componente: Carrusel de imágenes ────────────────────────────────────────
function ImageCarousel({ images, title, onOpenGallery }: { images: string[]; title: string; onOpenGallery: () => void }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => Math.min(images.length - 1, i + 1)); };
  return (
    <button className="relative w-full h-full group/car block" aria-label="Ver galería de imágenes" onClick={onOpenGallery}>
      <img src={images[idx]} alt={title} className="w-full h-full object-cover cursor-pointer" />
      {images.length > 1 && (
        <>
          {idx > 0 && (
            <button onClick={prev} aria-label="Imagen anterior"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/car:opacity-100 transition-opacity z-10">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {idx < images.length - 1 && (
            <button onClick={next} aria-label="Imagen siguiente"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/car:opacity-100 transition-opacity z-10">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10" aria-hidden="true">
            {images.map((_, i) => (
              <div key={i} className={cn('h-1.5 rounded-full transition-colors', i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
            ))}
          </div>
        </>
      )}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function MarketplaceView({ userId, userEmail, userName }: MarketplaceViewProps) {
  const { toast }    = useToast();
  const db           = useFirestore();
  const { user }     = useUser();
  const { canWrite } = useOrgPermissions();
  const isSuperAdmin = (user?.email ?? userEmail) === SUPER_ADMIN_EMAIL;

  const uid      = user?.uid   ?? userId   ?? '';
  const uName    = user?.displayName ?? userName ?? 'Usuario';
  const uEmail   = user?.email ?? userEmail ?? '';
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Filters ──
  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('Todos');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'exchange'>('all');
  const [page,       setPage]       = useState(0);
  const PER_PAGE = 6;

  // ── Dialogs ──
  const [showNewDialog,   setShowNewDialog]   = useState(false);
  const [saleItem,        setSaleItem]        = useState<MarketplaceItem | null>(null);
  const [saleConfirmAmt,  setSaleConfirmAmt]  = useState('');
  const [showCommissions, setShowCommissions] = useState(false);
  const [galleryItem,     setGalleryItem]     = useState<{ images: string[]; title: string } | null>(null);
  const [galleryIdx,      setGalleryIdx]      = useState(0);

  // ── Chat estado ──
  const [chatItem,       setChatItem]       = useState<MarketplaceItem | null>(null);
  const [chatInput,      setChatInput]      = useState('');
  const [isSendingMsg,   setIsSendingMsg]   = useState(false);
  const [consultasItem,  setConsultasItem]  = useState<MarketplaceItem | null>(null);
  const [activeConsulta, setActiveConsulta] = useState<MarketplaceChat | null>(null);

  // ── Item form ──
  const [itemForm, setItemForm] = useState({
    title: '', description: '', price: '', isExchange: false, category: 'Otros', images: [] as string[],
  });

  // ── Firestore: artículos ──
  const itemsQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadMarketplace'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: itemsRaw } = useCollection<MarketplaceItem>(itemsQ);

  // ── Firestore: transacciones ──
  const transQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadTransacciones'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: transRaw } = useCollection<CommissionRecord>(transQ);

  // ── Firestore: mensajes del chat activo ──
  const chatId = chatItem ? `mpchat_${chatItem.id}_${uid}` : activeConsulta?.id ?? null;
  const messagesQ = useMemoFirebase(() => {
    if (!db || !chatId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', chatId, 'mensajes'),
      orderBy('ts'),
    );
  }, [db, chatId]);
  const { data: messagesRaw } = useCollection<MarketplaceChatMessage>(messagesQ);
  const chatMessages = useMemo(() => messagesRaw ?? [], [messagesRaw]);

  // ── Firestore: consultas del vendedor para un artículo ──
  const consultasQ = useMemoFirebase(() => {
    if (!db || !consultasItem) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats'),
      where('itemId', '==', consultasItem.id),
      where('sellerId', '==', uid),
      orderBy('lastMessageAt', 'desc'),
    );
  }, [db, consultasItem, uid]);
  const { data: consultasRaw } = useCollection<MarketplaceChat>(consultasQ);
  const consultas = useMemo(() => consultasRaw ?? [], [consultasRaw]);

  const allItems = itemsRaw ?? [];
  const trans    = transRaw  ?? [];

  // ── Filtrado ──
  const activeItems = allItems.filter(i => i.status !== 'Vendido');
  const filtered = activeItems.filter(item => {
    const matchSearch = !search || (item.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (item.sellerName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat  = filterCat === 'Todos' || item.category === filterCat;
    const matchType = filterType === 'all' || (filterType === 'exchange' ? item.isExchange : !item.isExchange);
    return matchSearch && matchCat && matchType;
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible    = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSearch = (v: string) => { setSearch(v);    setPage(0); };
  const handleCat    = (v: string) => { setFilterCat(v); setPage(0); };
  const handleType   = (v: typeof filterType) => { setFilterType(v); setPage(0); };

  // ── Comisiones ──
  const myCommissions = trans.filter(t => t.adminId === uid);
  const myPending     = myCommissions.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.adminCommission, 0);
  const superTotal    = trans.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.superAdminCommission, 0);

  // Scroll al último mensaje del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Marcar leídos cuando el comprador abre el chat
  useEffect(() => {
    if (!db || !chatItem || !chatId) return;
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', chatId);
    setDocumentNonBlocking(ref, { unreadBuyer: 0 }, { merge: true });
  }, [chatId, db]);

  // Marcar leídos cuando el vendedor selecciona una consulta
  useEffect(() => {
    if (!db || !activeConsulta) return;
    const ref = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', activeConsulta.id);
    setDocumentNonBlocking(ref, { unreadSeller: 0 }, { merge: true });
  }, [activeConsulta?.id, db]);

  // ── Handlers ──
  const handleSaveItem = () => {
    if (!itemForm.title.trim() || !db) return;
    const id = Math.random().toString(36).substr(2, 9);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', id), {
      id, sellerId: uid, sellerName: uName, sellerAdminId: uid,
      sellerEmail: uEmail,
      title: itemForm.title.trim(), description: itemForm.description.trim(),
      price: itemForm.isExchange ? undefined : parseFloat(itemForm.price) || 0,
      isExchange: itemForm.isExchange, images: itemForm.images,
      category: itemForm.category, status: 'Disponible',
      createdAt: new Date().toISOString(),
    }, {});
    toast({ title: '✅ Publicación creada' });
    setShowNewDialog(false);
    setItemForm({ title: '', description: '', price: '', isExchange: false, category: 'Otros', images: [] });
  };

  const handleMarkSold = (item: MarketplaceItem) => { setSaleItem(item); setSaleConfirmAmt(item.price ? String(item.price) : ''); };

  const confirmSale = () => {
    if (!saleItem || !db) return;
    const amount   = parseFloat(saleConfirmAmt) || 0;
    const adminCom = Math.round(amount * ADMIN_COMMISSION);
    const superCom = Math.round(amount * SUPER_COMMISSION);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', saleItem.id), { status: 'Vendido' }, { merge: true });
    if (amount > 0) {
      const tId = Math.random().toString(36).substr(2, 9);
      setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadTransacciones', tId), {
        id: tId, itemId: saleItem.id, itemTitle: saleItem.title,
        saleAmount: amount, sellerId: saleItem.sellerId, sellerName: saleItem.sellerName,
        adminId: saleItem.sellerAdminId, adminName: uName,
        adminCommission: adminCom, superAdminCommission: superCom,
        status: 'Pendiente', createdAt: new Date().toISOString(),
      }, {});
    }
    toast({ title: `✅ Venta registrada${amount > 0 ? ` · Comisión ${fmt(adminCom + superCom)}` : ''}` });
    setSaleItem(null); setSaleConfirmAmt('');
  };

  // ── Reservar artículo ──
  const handleReserve = async (item: MarketplaceItem) => {
    if (!db) return;
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', item.id), { status: 'Reservado' }, { merge: true });
    // Abrir chat y enviar mensaje automático
    setChatItem(item);
    const now   = Date.now();
    const cId   = `mpchat_${item.id}_${uid}`;
    const chatRef = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', cId);
    setDocumentNonBlocking(chatRef, {
      id: cId, itemId: item.id, itemTitle: item.title,
      buyerId: uid, buyerName: uName,
      sellerId: item.sellerId, sellerName: item.sellerName, sellerEmail: item.sellerEmail,
      lastMessage: `🔖 ${uName} reservó este artículo`,
      lastMessageAt: now, unreadSeller: increment(1), unreadBuyer: 0,
    }, { merge: true });
    const msgId  = `${now}_auto`;
    const msgRef = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', cId, 'mensajes', msgId);
    setDocumentNonBlocking(msgRef, {
      id: msgId, text: `🔖 Reservé este artículo y me interesa concretar la compra.`,
      senderId: uid, senderName: uName, ts: now,
    }, {});
    // Notificar al vendedor por email
    if (item.sellerEmail) {
      sendEmail({
        to: item.sellerEmail,
        subject: `Reserva: "${item.title}"`,
        html: `<p>${uName} reservó tu artículo <strong>${item.title}</strong> en el Marketplace. Abrí el chat en la plataforma para coordinar.</p>`,
      }).catch(() => {});
    }
    toast({ title: '✅ Artículo reservado', description: 'Se notificó al vendedor. Podés coordinar por el chat.' });
  };

  // ── Chat: iniciar conversación ──
  const handleOpenChat = (item: MarketplaceItem) => {
    if (!db) return;
    const now = Date.now();
    const cId = `mpchat_${item.id}_${uid}`;
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', cId), {
      id: cId, itemId: item.id, itemTitle: item.title,
      buyerId: uid, buyerName: uName,
      sellerId: item.sellerId, sellerName: item.sellerName, sellerEmail: item.sellerEmail,
      lastMessage: '', lastMessageAt: now,
      unreadSeller: 0, unreadBuyer: 0,
    }, { merge: true });
    setChatItem(item);
  };

  // ── Chat: enviar mensaje ──
  const handleSendChatMessage = async (asRole: 'buyer' | 'seller') => {
    const txt = chatInput.trim();
    if (!txt || !db || !chatId) return;
    setIsSendingMsg(true);
    const now   = Date.now();
    const msgId = `${now}_${Math.random().toString(36).substr(2, 6)}`;
    const msgRef = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', chatId, 'mensajes', msgId);
    setDocumentNonBlocking(msgRef, { id: msgId, text: txt, senderId: uid, senderName: uName, ts: now }, {});
    const chatRef = doc(db, 'artifacts', APP_ID, 'comunidadMarketplaceChats', chatId);
    setDocumentNonBlocking(chatRef, {
      lastMessage: txt, lastMessageAt: now,
      ...(asRole === 'buyer' ? { unreadSeller: increment(1), unreadBuyer: 0 } : { unreadBuyer: increment(1), unreadSeller: 0 }),
    }, { merge: true });
    setChatInput('');
    setIsSendingMsg(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-600" /> Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            Solo podés publicar artículos o servicios de tu exclusiva propiedad.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {myPending > 0 && !isSuperAdmin && (
            <button onClick={() => setShowCommissions(true)}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Comisiones: {fmt(myPending)}
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => setShowCommissions(true)}
              className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" /> Comisiones: {fmt(superTotal)}
            </button>
          )}
          <Button className="gap-2 font-black bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4" /> Publicar artículo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-9 h-9 text-sm" placeholder="Buscar artículos, vendedores…"
                value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => handleCat(c)}
                  className={cn('text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                    filterCat === c ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-700')}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {([['all','Todo'],['sale','Venta'],['exchange','Intercambio']] as const).map(([v, l]) => (
                <button key={v} onClick={() => handleType(v)}
                  className={cn('text-xs font-bold px-3 py-1.5 rounded-md transition-colors',
                    filterType === v ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-base">
            {filtered.length === 0 && activeItems.length > 0 ? 'Sin resultados para tu búsqueda' : 'Sin publicaciones todavía'}
          </p>
          <p className="text-sm mt-1">
            {filtered.length === 0 && activeItems.length > 0 ? 'Probá con otros filtros' : 'Sé el primero en publicar algo en el marketplace'}
          </p>
          {activeItems.length === 0 && (
            <Button size="sm" variant="outline" className="mt-4 gap-1.5 font-bold" onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4" /> Publicar algo
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map(item => {
              const CatIcon = ITEM_CATEGORY_ICONS[item.category] || ShoppingBag;
              const isOwner = item.sellerId === uid || (canWrite && item.sellerAdminId === uid);
              return (
                <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-border/50 bg-white hover:shadow-lg transition-colors duration-200 flex flex-col">
                  {/* Imagen / carrusel */}
                  <div className="relative aspect-[4/3] bg-muted/30 shrink-0">
                    {item.images.length > 0 ? (
                      <ImageCarousel
                        images={item.images}
                        title={item.title}
                        onOpenGallery={() => { setGalleryItem({ images: item.images, title: item.title }); setGalleryIdx(0); }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CatIcon className="h-14 w-14 text-muted-foreground/15" />
                      </div>
                    )}
                    {/* Precio badge */}
                    <div className="absolute bottom-2 left-2 z-10">
                      {item.isExchange ? (
                        <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Repeat className="h-3 w-3" /> Intercambio
                        </span>
                      ) : item.price != null && item.price > 0 ? (
                        <span className="bg-black/75 text-white text-xs font-black px-2.5 py-1 rounded-full">
                          {fmt(item.price)}
                        </span>
                      ) : null}
                    </div>
                    {item.status === 'Reservado' && (
                      <div className="absolute top-2 right-2 z-10 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Reservado</div>
                    )}
                    {/* Fotos badge */}
                    {item.images.length > 1 && (
                      <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Images className="h-2.5 w-2.5" /> {item.images.length}
                      </div>
                    )}
                    {/* Moderación super admin */}
                    {isSuperAdmin && item.sellerId !== uid && (
                      <button
                        onClick={() => {
                          if (!db) return;
                          if (confirm(`¿Eliminar "${item.title}" por incumplimiento?`)) {
                            deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', item.id));
                            toast({ title: '🛡️ Publicación eliminada por moderación' });
                          }
                        }}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 bg-amber-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5 transition-opacity hover:bg-red-600/90 z-20">
                        ⚑ Mod
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="font-black text-sm leading-tight line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto gap-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">{item.sellerName}</p>
                        <Badge variant="outline" className="text-[9px] font-bold mt-0.5 px-1.5">{item.category}</Badge>
                      </div>
                      {isOwner ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setConsultasItem(item)}
                            className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 hover:bg-primary/20 transition-colors flex items-center gap-1">
                            <MessageSquare className="h-2.5 w-2.5" /> Consultas
                          </button>
                          {item.status !== 'Vendido' && (
                            <button onClick={() => handleMarkSold(item)}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-colors whitespace-nowrap">
                              ✓ Vendido
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {item.status === 'Disponible' && (
                            <button onClick={() => handleReserve(item)}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 transition-colors flex items-center gap-1">
                              <Bookmark className="h-2.5 w-2.5" /> Reservar
                            </button>
                          )}
                          <button onClick={() => handleOpenChat(item)}
                            className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 hover:bg-primary/20 transition-colors flex items-center gap-1">
                            <MessageSquare className="h-2.5 w-2.5" /> Contactar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-muted-foreground">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {filtered.length} publicación{filtered.length !== 1 ? 'es' : ''} activa{filtered.length !== 1 ? 's' : ''} en el marketplace
          </p>
        </>
      )}

      {/* ── Dialog: Publicar artículo ── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Publicar en Marketplace</DialogTitle>
            <DialogDescription>Completá los datos del artículo o servicio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input placeholder="Ej: Silla ergonómica casi nueva"
                  value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} />
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
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer pb-1">
                  <Switch checked={itemForm.isExchange} onCheckedChange={v => setItemForm(f => ({ ...f, isExchange: v }))} />
                  Solo intercambio
                </label>
              </div>
              {!itemForm.isExchange && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Precio ($)</Label>
                  <Input type="number" placeholder="Ej: 45000"
                    value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label>Descripción</Label>
                <Textarea placeholder="Estado, características, motivo de venta…"
                  className="min-h-[80px]" value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Images className="h-3.5 w-3.5 text-muted-foreground" /> Fotos (hasta 5)
                </Label>
                <PhotoUpload
                  value={itemForm.images}
                  onChange={urls => setItemForm(f => ({ ...f, images: urls }))}
                  storagePath={`marketplace/${Date.now()}`}
                  maxPhotos={5}
                />
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-[11px]">
              <p className="font-bold text-amber-700">⚖️ Al publicar declarás que el artículo o servicio es de tu exclusiva propiedad.</p>
              <p className="text-amber-600">💡 Comisión del <strong>6%</strong> sobre el precio final de venta (3% administradora + 3% plataforma).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveItem}
              disabled={!itemForm.title.trim()}>
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Galería de fotos ── */}
      {galleryItem && (
        <Dialog open={!!galleryItem} onOpenChange={v => { if (!v) setGalleryItem(null); }}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black">
            <div className="relative">
              <img src={galleryItem.images[galleryIdx]} alt={galleryItem.title} className="w-full max-h-[80vh] object-contain" />
              {galleryItem.images.length > 1 && (
                <>
                  <button onClick={() => setGalleryIdx(i => Math.max(0, i - 1))} disabled={galleryIdx === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => setGalleryIdx(i => Math.min(galleryItem.images.length - 1, i + 1))} disabled={galleryIdx >= galleryItem.images.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {galleryItem.images.map((_, i) => (
                      <button key={i} onClick={() => setGalleryIdx(i)}
                        className={cn('h-2 rounded-full transition-colors', i === galleryIdx ? 'w-6 bg-white' : 'w-2 bg-white/40')} />
                    ))}
                  </div>
                  <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {galleryIdx + 1} / {galleryItem.images.length}
                  </div>
                </>
              )}
            </div>
            <p className="text-white text-sm font-bold text-center pb-4 pt-2 px-4 truncate">{galleryItem.title}</p>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Chat con vendedor ── */}
      <Dialog open={!!chatItem} onOpenChange={v => { if (!v) { setChatItem(null); setChatInput(''); } }}>
        <DialogContent className="max-w-md flex flex-col max-h-[85vh] p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              {chatItem?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">Chat con {chatItem?.sellerName}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 bg-muted/10">
            {chatMessages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Hacé tu consulta al vendedor</p>
              </div>
            )}
            {chatMessages.map(m => {
              const isMe = m.senderId === uid;
              return (
                <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                    isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white text-foreground rounded-bl-none border border-muted')}>
                    {m.text}
                    <p className={cn('text-[9px] mt-0.5', isMe ? 'text-emerald-200 text-right' : 'text-muted-foreground')}>
                      {new Date(m.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t px-4 py-3 flex items-center gap-2 shrink-0 bg-white">
            <Input
              placeholder="Escribí tu mensaje…"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage('buyer'); } }}
              className="flex-1 rounded-xl"
            />
            <Button size="icon" className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 shrink-0"
              disabled={!chatInput.trim() || isSendingMsg}
              onClick={() => handleSendChatMessage('buyer')}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Consultas del vendedor ── */}
      <Dialog open={!!consultasItem} onOpenChange={v => { if (!v) { setConsultasItem(null); setActiveConsulta(null); setChatInput(''); } }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[85vh] p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Consultas — {consultasItem?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">{consultas.length} consulta{consultas.length !== 1 ? 's' : ''} recibida{consultas.length !== 1 ? 's' : ''}</DialogDescription>
          </DialogHeader>

          {consultas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">Sin consultas aún</p>
              <p className="text-xs mt-1">Cuando alguien contacte sobre este artículo, aparecerá aquí.</p>
            </div>
          ) : activeConsulta ? (
            <>
              <div className="px-4 py-2 border-b bg-muted/5 shrink-0">
                <button onClick={() => { setActiveConsulta(null); setChatInput(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium">
                  <ChevronLeft className="h-3.5 w-3.5" /> Todas las consultas
                </button>
                <p className="text-sm font-black mt-0.5">{activeConsulta.buyerName}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 bg-muted/10">
                {chatMessages.map(m => {
                  const isMe = m.senderId === uid;
                  return (
                    <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                        isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white text-foreground rounded-bl-none border border-muted')}>
                        {m.text}
                        <p className={cn('text-[9px] mt-0.5', isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground')}>
                          {new Date(m.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t px-4 py-3 flex items-center gap-2 shrink-0 bg-white">
                <Input placeholder="Responder…" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage('seller'); } }}
                  className="flex-1 rounded-xl" />
                <Button size="icon" className="h-9 w-9 rounded-xl shrink-0"
                  disabled={!chatInput.trim() || isSendingMsg}
                  onClick={() => handleSendChatMessage('seller')}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {consultas.map(c => (
                <button key={c.id} onClick={() => setActiveConsulta(c)}
                  className="w-full text-left px-5 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm shrink-0">
                    {c.buyerName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold truncate">{c.buyerName}</p>
                      {c.unreadSeller > 0 && (
                        <span className="bg-primary text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shrink-0">
                          {c.unreadSeller}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{c.lastMessage || 'Sin mensajes'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar venta ── */}
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
                <Input type="number" value={saleConfirmAmt}
                  onChange={e => setSaleConfirmAmt(e.target.value)} placeholder="0" />
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
                Confirmar venta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Comisiones ── */}
      <Dialog open={showCommissions} onOpenChange={setShowCommissions}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 font-black">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              {isSuperAdmin ? 'Comisiones — Plataforma' : 'Mis Comisiones'}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin ? 'Todas las comisiones generadas (3% plataforma).' : 'Comisiones generadas por ventas en el marketplace (3% administradora).'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {(isSuperAdmin ? trans : myCommissions).length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="font-semibold">Sin comisiones registradas</p>
              </div>
            ) : (isSuperAdmin ? trans : myCommissions).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/40">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm truncate">{t.itemTitle}</p>
                  <p className="text-[11px] text-muted-foreground">{t.sellerName} · {new Date(t.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-emerald-700">{fmt(isSuperAdmin ? t.superAdminCommission : t.adminCommission)}</p>
                  <p className="text-[10px] text-muted-foreground">Venta: {fmt(t.saleAmount)}</p>
                </div>
                <Badge className={cn('text-[10px] font-bold border shrink-0',
                  t.status === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="p-4 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total pendiente:</span>
            <span className="font-black text-emerald-700 text-base">{fmt(isSuperAdmin ? superTotal : myPending)}</span>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
