'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  CheckCircle2, Trash2, AlertCircle, Crown, Search, SlidersHorizontal
} from 'lucide-react';
import { Sofa, Monitor, Shirt, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOrgPermissions } from '@/contexts/org-permissions-context';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';
const ADMIN_COMMISSION  = 0.03;
const SUPER_COMMISSION  = 0.03;

// ── Types ──────────────────────────────────────────────────────────────────────
interface MarketplaceItem {
  id: string; sellerId: string; sellerName: string; sellerAdminId: string;
  title: string; description: string; price?: number; isExchange: boolean;
  images: string[]; category: string;
  status: 'Disponible' | 'Reservado' | 'Vendido';
  createdAt: string;
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
  Muebles: Sofa, Electrónica: Monitor, Ropa: Shirt, Deportes: Bike,
  Otros: ShoppingBag,
};

const CATEGORIES = ['Todos', 'Muebles', 'Electrónica', 'Ropa', 'Deportes', 'Otros'];

// ── Main Component ─────────────────────────────────────────────────────────────
export function MarketplaceView({ userId, userEmail, userName }: MarketplaceViewProps) {
  const { toast }    = useToast();
  const db           = useFirestore();
  const { user }     = useUser();
  const { canWrite } = useOrgPermissions();
  const isSuperAdmin = (user?.email ?? userEmail) === SUPER_ADMIN_EMAIL;

  const uid   = user?.uid  ?? userId  ?? '';
  const uName = user?.displayName ?? userName ?? 'Usuario';

  // ── Filters ──
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('Todos');
  const [filterType,  setFilterType]  = useState<'all' | 'sale' | 'exchange'>('all');

  // ── Pagination ──
  const [page, setPage] = useState(0);
  const PER_PAGE = 6;

  // ── Dialogs ──
  const [showNewDialog,    setShowNewDialog]    = useState(false);
  const [saleItem,         setSaleItem]         = useState<MarketplaceItem | null>(null);
  const [saleConfirmAmt,   setSaleConfirmAmt]   = useState('');
  const [showCommissions,  setShowCommissions]  = useState(false);

  // ── Item form ──
  const [itemForm, setItemForm] = useState({
    title: '', description: '', price: '', isExchange: false, category: 'Otros', images: [] as string[],
  });

  // ── Firestore ──
  const itemsQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadMarketplace'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: itemsRaw } = useCollection<MarketplaceItem>(itemsQ);

  const transQ = useMemoFirebase(() => {
    if (!db || !uid) return null;
    return query(collection(db, 'artifacts', APP_ID, 'comunidadTransacciones'), orderBy('createdAt', 'desc'));
  }, [db, uid]);
  const { data: transRaw } = useCollection<CommissionRecord>(transQ);

  const allItems = itemsRaw ?? [];
  const trans    = transRaw  ?? [];

  // ── Filtered items ──
  const activeItems = allItems.filter(i => i.status !== 'Vendido');
  const filtered = activeItems.filter(item => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase()) || item.sellerName.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === 'Todos' || item.category === filterCat;
    const matchType   = filterType === 'all' || (filterType === 'exchange' ? item.isExchange : !item.isExchange);
    return matchSearch && matchCat && matchType;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible    = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Reset page on filter change
  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleCat    = (v: string) => { setFilterCat(v); setPage(0); };
  const handleType   = (v: typeof filterType) => { setFilterType(v); setPage(0); };

  // ── Commissions ──
  const myCommissions  = trans.filter(t => t.adminId === uid);
  const myPending      = myCommissions.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.adminCommission, 0);
  const superTotal     = trans.filter(t => t.status === 'Pendiente').reduce((a, t) => a + t.superAdminCommission, 0);

  // ── Handlers ──
  const handleSaveItem = () => {
    if (!itemForm.title.trim() || !db) return;
    const id  = Math.random().toString(36).substr(2, 9);
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', id), {
      id, sellerId: uid, sellerName: uName, sellerAdminId: uid,
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

  const handleMarkSold = (item: MarketplaceItem) => {
    setSaleItem(item);
    setSaleConfirmAmt(item.price ? String(item.price) : '');
  };

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
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-9 h-9 text-sm" placeholder="Buscar artículos, vendedores…"
                value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
            {/* Category filter */}
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
            {/* Type filter */}
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
            {filtered.length === 0 && activeItems.length > 0
              ? 'Probá con otros filtros'
              : 'Sé el primero en publicar algo en el marketplace'}
          </p>
          {activeItems.length === 0 && (
            <Button size="sm" variant="outline" className="mt-4 gap-1.5 font-bold"
              onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4" /> Publicar algo
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map(item => {
              const CatIcon = ITEM_CATEGORY_ICONS[item.category] || ShoppingBag;
              const isOwner = item.sellerId === uid || canWrite;
              return (
                <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-border/50 bg-white hover:shadow-lg transition-all duration-200">
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-muted/30">
                    {item.images[0] ? (
                      <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CatIcon className="h-14 w-14 text-muted-foreground/15" />
                      </div>
                    )}
                    {/* Price badge */}
                    <div className="absolute bottom-2 left-2">
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
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Reservado</div>
                    )}
                    {/* Mod overlay for super admin */}
                    {isSuperAdmin && item.sellerId !== uid && (
                      <button
                        onClick={() => {
                          if (!db) return;
                          if (confirm(`¿Eliminar "${item.title}" por incumplimiento de las reglas?`)) {
                            deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'comunidadMarketplace', item.id));
                            toast({ title: '🛡️ Publicación eliminada por moderación' });
                          }
                        }}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 bg-amber-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-0.5 transition-opacity hover:bg-red-600/90"
                        title="Eliminar por moderación">
                        ⚑ Mod
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-black text-sm leading-tight line-clamp-1">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-2.5 gap-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">{item.sellerName}</p>
                        <Badge variant="outline" className="text-[9px] font-bold mt-0.5 px-1.5">{item.category}</Badge>
                      </div>
                      {isOwner && (
                        <button onClick={() => handleMarkSold(item)}
                          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-colors whitespace-nowrap">
                          ✓ Vendido
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
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

          {/* Stats row */}
          <p className="text-center text-xs text-muted-foreground">
            {filtered.length} publicación{filtered.length !== 1 ? 'es' : ''} activa{filtered.length !== 1 ? 's' : ''} en el marketplace
          </p>
        </>
      )}

      {/* ── Dialog: Publicar artículo ── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
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
              {isSuperAdmin
                ? 'Todas las comisiones generadas (3% plataforma).'
                : 'Comisiones generadas por ventas en el marketplace (3% administradora).'}
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
                  <Badge className={cn('text-[10px] font-bold border shrink-0',
                    t.status === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                    {t.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total pendiente:</span>
            <span className="font-black text-emerald-700 text-base">
              {fmt(isSuperAdmin ? superTotal : myPending)}
            </span>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
