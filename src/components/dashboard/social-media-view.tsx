"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import {
  Sparkles, Copy, ExternalLink, Plus, Trash2, Save,
  Loader2, Hash, FileText, Layers, Send, Edit3,
  RefreshCw, Link2, Globe, CalendarDays, ChevronLeft, ChevronRight,
  BarChart2, Clock, ImageIcon, GalleryHorizontal, UserCircle2, BellRing,
} from 'lucide-react';
import { format as dateFnsFormat, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SocialPost, SocialNetworkLink, SocialContentType, SocialTone, SocialNetworkType, SocialBrandProfile } from '@/lib/types';
import { generateSocialContent } from '@/ai/flows/generate-social-content-flow';
import { SocialCardDesigner } from './social-card-designer';
import { SocialCarousel } from './social-carousel';
import { SocialBrandProfileView } from './social-brand-profile';

interface SocialMediaViewProps {
  posts: SocialPost[];
  networkLinks: SocialNetworkLink[];
  userId?: string;
}


type ActiveTab = SocialContentType | 'Calendario' | 'Tarjeta' | 'Carrusel' | 'Perfil';

// ── Limits & config ───────────────────────────────────────────────────────────

const CHAR_LIMITS: Record<SocialNetworkType, number> = {
  'X (Twitter)': 280,
  'Instagram': 2200,
  'TikTok': 2200,
  'Facebook': 1000,
  'LinkedIn': 1500,
  'YouTube': 300,
  'WhatsApp Business': 500,
  'Otro': 1000,
};

const NETWORKS: { id: SocialNetworkType; label: string; color: string; bg: string; icon: React.ReactNode; homeUrl: string; dot: string }[] = [
  {
    id: 'Instagram', label: 'Instagram',
    color: 'text-pink-600', bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    dot: 'bg-pink-500',
    homeUrl: 'https://www.instagram.com',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  },
  {
    id: 'Facebook', label: 'Facebook',
    color: 'text-blue-600', bg: 'bg-blue-600', dot: 'bg-blue-500',
    homeUrl: 'https://www.facebook.com',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    id: 'TikTok', label: 'TikTok',
    color: 'text-gray-900', bg: 'bg-black', dot: 'bg-gray-800',
    homeUrl: 'https://www.tiktok.com',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>,
  },
  {
    id: 'YouTube', label: 'YouTube',
    color: 'text-red-600', bg: 'bg-red-600', dot: 'bg-red-500',
    homeUrl: 'https://studio.youtube.com',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  },
  {
    id: 'LinkedIn', label: 'LinkedIn',
    color: 'text-blue-700', bg: 'bg-blue-700', dot: 'bg-blue-700',
    homeUrl: 'https://www.linkedin.com/feed',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  },
  {
    id: 'X (Twitter)', label: 'X / Twitter',
    color: 'text-gray-900', bg: 'bg-black', dot: 'bg-gray-900',
    homeUrl: 'https://x.com/compose/tweet',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    id: 'WhatsApp Business', label: 'WhatsApp',
    color: 'text-green-600', bg: 'bg-green-500', dot: 'bg-green-500',
    homeUrl: 'https://web.whatsapp.com',
    icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  },
];

const TONE_LABELS: Record<SocialTone, string> = {
  profesional: 'Profesional', cercano: 'Cercano', urgente: 'Urgente',
  inspiracional: 'Inspiracional', informativo: 'Informativo',
};

const CONTENT_LABELS: Record<SocialContentType, string> = {
  Plantilla: 'Plantillas', Contenido: 'Contenido / Slices', Publicación: 'Publicaciones',
};

const STATUS_CFG: Record<SocialPost['status'], { cls: string; label: string }> = {
  Borrador: { cls: 'bg-gray-100 text-gray-600', label: 'Borrador' },
  Listo: { cls: 'bg-green-100 text-green-700', label: 'Listo' },
  Publicado: { cls: 'bg-blue-100 text-blue-700', label: 'Publicado' },
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Component ─────────────────────────────────────────────────────────────────

export function SocialMediaView({ posts, networkLinks, userId }: SocialMediaViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();

  // Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('Plantilla');

  // Editor
  const [title, setTitle] = useState('');
  const [mainText, setMainText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [tone, setTone] = useState<SocialTone>('profesional');
  const [targetNets, setTargetNets] = useState<SocialNetworkType[]>(['Instagram']);
  const [status, setStatus] = useState<SocialPost['status']>('Borrador');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | undefined>(undefined);
  const [remindMe, setRemindMe] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // AI
  const [aiTopic, setAiTopic] = useState('');
  const [aiNetwork, setAiNetwork] = useState<SocialNetworkType>('Instagram');
  const [aiExtra, setAiExtra] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Network link dialog
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [newLink, setNewLink] = useState<Partial<SocialNetworkLink>>({ network: 'Instagram', displayName: '', url: '', username: '' });

  // Calendar
  const [calMonth, setCalMonth] = useState(() => new Date());

  // Brand profile
  const [brandProfile, setBrandProfile] = useState<SocialBrandProfile | null>(null);
  const brandContext = brandProfile?.brief || undefined;

  // Load brand profile on mount
  useEffect(() => {
    if (!db || !userId) return;
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'socialBrandProfile', 'main'))
      .then(snap => { if (snap.exists()) setBrandProfile(snap.data() as SocialBrandProfile); })
      .catch(() => {});
  }, [db, userId]);

  // ── Calendar helpers ──────────────────────────────────────────────────────

  const calDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start, end });
    const offset = getDay(start); // 0=Sun
    return { days, offset };
  }, [calMonth]);

  const postsForDay = (date: Date) =>
    posts.filter(p => p.scheduledAt && isSameDay(parseISO(p.scheduledAt), date));

  const upcomingPosts = useMemo(() => {
    const today = new Date();
    return posts
      .filter(p => p.scheduledAt && parseISO(p.scheduledAt) >= today)
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
      .slice(0, 5);
  }, [posts]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const contentTab = (['Plantilla', 'Contenido', 'Publicación'] as SocialContentType[]).includes(activeTab as SocialContentType)
    ? activeTab as SocialContentType
    : null;

  const filtered = useMemo(
    () => contentTab
      ? posts.filter(p => p.contentType === contentTab).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [],
    [posts, contentTab]
  );

  const primaryNet = targetNets[0] ?? 'Instagram';
  const charLimit = CHAR_LIMITS[primaryNet];
  const charPct = Math.min(100, Math.round((mainText.length / charLimit) * 100));
  const charColor = charPct > 90 ? 'text-red-500' : charPct > 70 ? 'text-orange-500' : 'text-muted-foreground';

  const fullText = () => [mainText, hashtags, cta].filter(Boolean).join('\n\n');

  // ── Editor helpers ────────────────────────────────────────────────────────

  const reset = () => {
    setTitle(''); setMainText(''); setHashtags(''); setCta('');
    setEditingId(null); setStatus('Borrador');
    setTargetNets(['Instagram']); setTone('profesional'); setScheduledAt(undefined);
    setRemindMe(true);
  };

  const loadPost = (p: SocialPost) => {
    setTitle(p.title); setMainText(p.mainText); setHashtags(p.hashtags);
    setCta(p.callToAction ?? ''); setTone(p.tone); setTargetNets(p.targetNetworks);
    setStatus(p.status); setEditingId(p.id); setActiveTab(p.contentType);
    setScheduledAt(p.scheduledAt);
    setRemindMe(p.remindMe !== false);
  };

  const handleSave = () => {
    if (!userId || !db || !title.trim() || !mainText.trim()) {
      toast({ title: 'Campos requeridos', description: 'Título y texto son obligatorios.', variant: 'destructive' });
      return;
    }
    const now = new Date().toISOString();
    const id = editingId ?? Math.random().toString(36).substr(2, 9);
    const original = editingId ? posts.find(p => p.id === editingId) : undefined;
    const dateChanged = (original?.scheduledAt ?? undefined) !== (scheduledAt || undefined);
    const docRef = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'socialPosts'), id);
    const data: SocialPost = {
      id, contentType: contentTab ?? 'Publicación',
      title: title.trim(), mainText: mainText.trim(),
      hashtags: hashtags.trim(), callToAction: cta.trim(), targetNetworks: targetNets,
      tone, aiGenerated: false, status,
      scheduledAt: scheduledAt || undefined,
      remindMe,
      // Si se cambió la fecha, habilita un nuevo recordatorio para la nueva fecha.
      reminderSentAt: dateChanged ? undefined : original?.reminderSentAt,
      ownerId: userId, createdAt: editingId ? (original?.createdAt ?? now) : now,
      updatedAt: now,
    };
    setDocumentNonBlocking(docRef, data, { merge: true });
    toast({ title: editingId ? 'Actualizado' : 'Guardado', description: `"${data.title}" guardado.` });
    reset();
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'socialPosts', id));
    if (editingId === id) reset();
    toast({ title: 'Eliminado' });
  };

  // ── AI ────────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: 'Ingresá un tema', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const r = await generateSocialContent({
        topic: aiTopic, network: aiNetwork,
        contentType: contentTab === 'Plantilla' ? 'plantilla' : contentTab === 'Contenido' ? 'contenido' : 'post',
        tone, extraContext: aiExtra || undefined,
        brandContext,
      });
      setMainText(r.mainText); setHashtags(r.hashtags); setCta(r.callToAction);
      if (!title) setTitle(aiTopic.slice(0, 60));
      setTargetNets([aiNetwork]);
      toast({ title: '✨ Listo', description: r.tip });
    } catch (e: any) {
      toast({ title: 'Error IA', description: e?.message ?? 'Error al generar.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Copy + open ───────────────────────────────────────────────────────────

  const copyText = (extraToast?: string) => {
    const t = fullText();
    if (!t) { toast({ title: 'Sin contenido', variant: 'destructive' }); return false; }
    navigator.clipboard?.writeText(t).catch(() => {});
    if (extraToast) toast({ title: 'Copiado al portapapeles', description: extraToast });
    return true;
  };

  const handleCopyAndOpen = (link: SocialNetworkLink) => {
    if (copyText(`Abriendo ${link.displayName}…`)) window.open(link.url, '_blank');
  };

  const handleQuickOpen = (n: typeof NETWORKS[0]) => {
    copyText(`Pegá el texto en ${n.label} y publicá.`);
    window.open(n.homeUrl, '_blank');
  };

  // ── Network links ─────────────────────────────────────────────────────────

  const handleSaveLink = () => {
    if (!userId || !db || !newLink.displayName || !newLink.url) {
      toast({ title: 'Nombre y URL son obligatorios.', variant: 'destructive' }); return;
    }
    const id = Math.random().toString(36).substr(2, 9);
    const data: SocialNetworkLink = {
      id, network: newLink.network as SocialNetworkType,
      displayName: newLink.displayName!, url: newLink.url!,
      username: newLink.username, ownerId: userId!, createdAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId!, 'socialLinks', id), data, { merge: true });
    setIsLinkOpen(false);
    setNewLink({ network: 'Instagram', displayName: '', url: '', username: '' });
    toast({ title: 'Red social agregada' });
  };

  const toggleNet = (n: SocialNetworkType) =>
    setTargetNets(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-4 animate-in fade-in duration-500">

      {/* ── Left / main ── */}
      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <h2 className="text-2xl font-black text-foreground">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Creá plantillas, contenido y publicaciones con IA para todas tus redes.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as ActiveTab); if (contentTab) reset(); }}>
          <TabsList className="mb-2 flex-wrap h-auto gap-1">
            {(['Plantilla', 'Contenido', 'Publicación'] as SocialContentType[]).map(t => (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                {t === 'Plantilla' && <FileText className="h-3.5 w-3.5" />}
                {t === 'Contenido' && <Layers className="h-3.5 w-3.5" />}
                {t === 'Publicación' && <Send className="h-3.5 w-3.5" />}
                {CONTENT_LABELS[t]}
                {posts.filter(p => p.contentType === t).length > 0 && (
                  <span className="ml-1 bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {posts.filter(p => p.contentType === t).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
            <TabsTrigger value="Calendario" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </TabsTrigger>
            <TabsTrigger value="Tarjeta" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Tarjeta
            </TabsTrigger>
            <TabsTrigger value="Carrusel" className="gap-1.5">
              <GalleryHorizontal className="h-3.5 w-3.5" /> Carrusel
            </TabsTrigger>
            <TabsTrigger value="Perfil" className="gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> Perfil de marca
              {brandProfile?.brief && (
                <span className="ml-1 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">✓</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Content tabs (Plantilla / Contenido / Publicación) ── */}
          {(['Plantilla', 'Contenido', 'Publicación'] as SocialContentType[]).map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-4 mt-0">

              {/* AI Generator */}
              <Card className="border-none shadow-sm bg-gradient-to-br from-violet-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Generador con IA — Gemini Flash
                    {brandProfile?.brief && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Voz de {brandProfile.brandName} activa
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Tema / Idea</Label>
                      <Input
                        placeholder="Ej: Depto en alquiler Palermo 2 amb. piso alto…"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Red objetivo</Label>
                      <Select value={aiNetwork} onValueChange={v => setAiNetwork(v as SocialNetworkType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NETWORKS.map(n => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Contexto adicional (opcional)</Label>
                      <Input
                        placeholder="Precio, m², amenities, zona, condiciones especiales…"
                        value={aiExtra}
                        onChange={e => setAiExtra(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Tono</Label>
                      <Select value={tone} onValueChange={v => setTone(v as SocialTone)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TONE_LABELS) as SocialTone[]).map(t => (
                            <SelectItem key={t} value={t}>{TONE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold"
                    onClick={handleGenerate}
                    disabled={isGenerating || !canWrite}
                  >
                    {isGenerating
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                      : <><Sparkles className="h-4 w-4" /> Generar contenido con IA</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Editor */}
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-primary" />
                    {editingId ? 'Editando contenido' : `Nuevo ${tab.toLowerCase()}`}
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    {/* Date picker */}
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn('h-7 text-[11px] gap-1.5', scheduledAt ? 'text-primary border-primary/40' : '')}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {scheduledAt ? dateFnsFormat(parseISO(scheduledAt), 'd MMM', { locale: es }) : 'Fecha'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={scheduledAt ? parseISO(scheduledAt) : undefined}
                          onSelect={d => {
                            setScheduledAt(d ? dateFnsFormat(d, 'yyyy-MM-dd') : undefined);
                            setDatePickerOpen(false);
                          }}
                          initialFocus
                        />
                        {scheduledAt && (
                          <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setScheduledAt(undefined); setDatePickerOpen(false); }}>
                              Quitar fecha
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    {scheduledAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn('h-7 text-[11px] gap-1.5', remindMe ? 'text-primary border-primary/40' : 'text-muted-foreground')}
                        onClick={() => setRemindMe(v => !v)}
                        aria-pressed={remindMe}
                        title={remindMe ? 'Se te va a recordar el día de la publicación' : 'Recordatorio desactivado'}
                      >
                        <BellRing className="h-3 w-3" />
                        {remindMe ? 'Recordarme' : 'Sin recordatorio'}
                      </Button>
                    )}

                    <Select value={status} onValueChange={v => setStatus(v as SocialPost['status'])}>
                      <SelectTrigger className="h-7 text-[11px] w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Borrador">Borrador</SelectItem>
                        <SelectItem value="Listo">Listo</SelectItem>
                        <SelectItem value="Publicado">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingId && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
                        <RefreshCw className="h-3 w-3" /> Nuevo
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Título interno</Label>
                    <Input placeholder="Nombre para identificar este contenido…" value={title} onChange={e => setTitle(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Redes objetivo</Label>
                    <div className="flex flex-wrap gap-2">
                      {NETWORKS.map(n => (
                        <button
                          key={n.id} type="button"
                          onClick={() => toggleNet(n.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                            targetNets.includes(n.id)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-muted text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          <span className={targetNets.includes(n.id) ? n.color : ''}>{n.icon}</span>
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Texto principal</Label>
                      <span className={cn('text-[10px] font-mono font-bold tabular-nums', charColor)}>
                        {mainText.length} / {charLimit} ({primaryNet})
                      </span>
                    </div>
                    <Textarea
                      rows={7}
                      placeholder="Escribí o generá el texto del post aquí…"
                      value={mainText}
                      onChange={e => setMainText(e.target.value)}
                      className="resize-none text-sm leading-relaxed"
                    />
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-colors', charPct > 90 ? 'bg-red-500' : charPct > 70 ? 'bg-orange-400' : 'bg-primary')}
                        style={{ width: `${charPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Hashtags
                    </Label>
                    <Input placeholder="#alquiler #propiedades #buenosaires …" value={hashtags} onChange={e => setHashtags(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Call to Action</Label>
                    <Input placeholder="Ej: Consultanos por DM · Link en bio · Escribinos al WhatsApp" value={cta} onChange={e => setCta(e.target.value)} />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button className="flex-1 gap-2 font-bold" onClick={handleSave} disabled={!canWrite}>
                      <Save className="h-4 w-4" /> {editingId ? 'Actualizar' : 'Guardar'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => copyText('Texto copiado.')}>
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Saved list */}
              {filtered.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground px-1">
                    {CONTENT_LABELS[tab]} guardadas ({filtered.length})
                  </p>
                  {filtered.map(p => {
                    const sc = STATUS_CFG[p.status];
                    return (
                      <div
                        key={p.id}
                        className="flex items-start justify-between p-3 rounded-xl border bg-white hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => loadPost(p)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{p.title}</span>
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', sc.cls)}>{sc.label}</span>
                            {p.scheduledAt && (
                              <span className="text-[10px] font-semibold text-primary/80 flex items-center gap-0.5">
                                <CalendarDays className="h-2.5 w-2.5" />
                                {dateFnsFormat(parseISO(p.scheduledAt), 'd MMM', { locale: es })}
                              </span>
                            )}
                            {p.aiGenerated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> IA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.mainText}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {p.targetNetworks.slice(0, 5).map(n => {
                              const nc = NETWORKS.find(x => x.id === n);
                              return nc ? <span key={n} className={cn('text-[11px]', nc.color)}>{nc.icon}</span> : null;
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadPost(p)} title="Editar">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}

          {/* ── Calendario ── */}
          <TabsContent value="Calendario" className="mt-0">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {dateFnsFormat(calMonth, 'MMMM yyyy', { locale: es })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {/* Grid */}
                <div className="grid grid-cols-7 gap-px bg-muted rounded-xl overflow-hidden">
                  {/* Offset cells */}
                  {Array.from({ length: calDays.offset }).map((_, i) => (
                    <div key={`off-${i}`} className="bg-gray-50/60 min-h-[72px]" />
                  ))}
                  {/* Day cells */}
                  {calDays.days.map(day => {
                    const dayPosts = postsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'bg-white min-h-[72px] p-1.5 cursor-pointer hover:bg-primary/5 transition-colors',
                          isToday && 'bg-primary/5'
                        )}
                        onClick={() => {
                          setScheduledAt(dateFnsFormat(day, 'yyyy-MM-dd'));
                          setActiveTab('Publicación');
                        }}
                      >
                        <span className={cn(
                          'text-xs font-bold inline-flex h-5 w-5 items-center justify-center rounded-full',
                          isToday ? 'bg-primary text-white' : 'text-foreground'
                        )}>
                          {day.getDate()}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayPosts.slice(0, 3).map(p => {
                            const net = NETWORKS.find(n => n.id === p.targetNetworks[0]);
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-1 cursor-pointer group"
                                onClick={e => { e.stopPropagation(); loadPost(p); setActiveTab(p.contentType); }}
                              >
                                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', net?.dot ?? 'bg-gray-400')} />
                                <span className="text-[9px] truncate text-muted-foreground group-hover:text-foreground">{p.title}</span>
                              </div>
                            );
                          })}
                          {dayPosts.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 3} más</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sin fecha section */}
                {posts.filter(p => !p.scheduledAt).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-[10px] uppercase font-black text-muted-foreground mb-2">Sin fecha programada</p>
                    <div className="space-y-1.5">
                      {posts.filter(p => !p.scheduledAt).slice(0, 6).map(p => {
                        const sc = STATUS_CFG[p.status];
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => { loadPost(p); setActiveTab(p.contentType); }}
                          >
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', sc.cls)}>{sc.label}</span>
                            <span className="text-xs font-medium truncate">{p.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tarjeta ── */}
          <TabsContent value="Tarjeta" className="mt-0">
            <SocialCardDesigner canWrite={canWrite} brandContext={brandContext} />
          </TabsContent>

          {/* ── Carrusel ── */}
          <TabsContent value="Carrusel" className="mt-0">
            <SocialCarousel canWrite={canWrite} brandContext={brandContext} />
          </TabsContent>

          {/* ── Perfil de marca ── */}
          <TabsContent value="Perfil" className="mt-0">
            <SocialBrandProfileView
              userId={userId}
              profile={brandProfile}
              onProfileSaved={setBrandProfile}
              canWrite={canWrite}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

        {/* Stats card */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> Resumen de contenido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['Borrador', 'Listo', 'Publicado'] as SocialPost['status'][]).map(s => {
                const count = posts.filter(p => p.status === s).length;
                const cfg = STATUS_CFG[s];
                return (
                  <div key={s} className={cn('rounded-xl py-2.5 px-1', cfg.cls.replace('text-', 'bg-').split(' ')[0] + '/20 ' + cfg.cls.split(' ')[0])}>
                    <div className="text-xl font-black">{count}</div>
                    <div className="text-[9px] font-bold opacity-80">{s}</div>
                  </div>
                );
              })}
            </div>
            {upcomingPosts.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1 mb-2">
                  <Clock className="h-3 w-3" /> Próximos 7 días
                </p>
                {upcomingPosts.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80"
                    onClick={() => { loadPost(p); setActiveTab(p.contentType); }}
                  >
                    <span className="text-[10px] font-bold text-primary/80 w-12 flex-shrink-0">
                      {p.scheduledAt ? dateFnsFormat(parseISO(p.scheduledAt), 'd MMM', { locale: es }) : ''}
                    </span>
                    <span className="text-xs truncate text-muted-foreground">{p.title}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {(mainText || hashtags || cta) && (['Plantilla', 'Contenido', 'Publicación'] as string[]).includes(activeTab) && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground">Vista previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {mainText && <p className="text-xs leading-relaxed whitespace-pre-line text-gray-800 line-clamp-8">{mainText}</p>}
                {hashtags && <p className="text-xs text-blue-500 font-medium">{hashtags}</p>}
                {cta && <p className="text-xs font-semibold text-primary">→ {cta}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mis páginas */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Mis páginas y perfiles
            </CardTitle>
            {canWrite && (
              <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline" aria-label="Agregar" className="h-7 w-7"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Agregar red social o página</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Red social</Label>
                      <Select value={newLink.network} onValueChange={v => setNewLink({ ...newLink, network: v as SocialNetworkType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NETWORKS.map(n => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
                          <SelectItem value="Otro">Otro (sitio web, etc.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nombre para mostrar</Label>
                      <Input placeholder="Ej: Inmobiliaria García · Mi perfil personal" value={newLink.displayName} onChange={e => setNewLink({ ...newLink, displayName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">URL del perfil / página</Label>
                      <Input placeholder="https://instagram.com/mi_cuenta" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">@usuario (opcional)</Label>
                      <Input placeholder="@mi_cuenta" value={newLink.username} onChange={e => setNewLink({ ...newLink, username: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={() => setIsLinkOpen(false)}>Cancelar</Button>
                    <Button className="bg-primary text-white" onClick={handleSaveLink}>Guardar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {networkLinks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs leading-snug">Agregá tus páginas y perfiles.<br />Cada administrador gestiona los suyos.</p>
                {canWrite && (
                  <Button variant="outline" size="sm" className="mt-3 gap-1 text-xs" onClick={() => setIsLinkOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Agregar
                  </Button>
                )}
              </div>
            ) : (
              networkLinks.map(link => {
                const nc = NETWORKS.find(n => n.id === link.network);
                return (
                  <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-xl border bg-gray-50/60 hover:bg-white hover:border-primary/30 transition-colors group">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center text-white flex-shrink-0', nc?.bg ?? 'bg-gray-500')}>
                      {nc?.icon ?? <Globe className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{link.displayName}</p>
                      {link.username && <p className="text-[10px] text-muted-foreground truncate">{link.username}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Copiar texto y abrir" onClick={() => handleCopyAndOpen(link)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Abrir" onClick={() => window.open(link.url, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Eliminar" onClick={() => {
                          if (!userId || !db) return;
                          deleteDocumentNonBlocking(doc(db, 'artifacts', APP_ID, 'users', userId, 'socialLinks', link.id));
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Quick access */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground">Publicar ahora — acceso rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground mb-3 leading-snug">
              Copia el contenido al portapapeles y abre la red social para pegar y publicar.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {NETWORKS.map(n => (
                <button
                  key={n.id}
                  title={`Copiar y abrir ${n.label}`}
                  onClick={() => handleQuickOpen(n)}
                  className={cn('h-12 w-full rounded-xl flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95', n.bg)}
                >
                  {n.icon}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60 text-center mt-2 leading-tight">
              El texto se copia automáticamente. Pegalo en la publicación de cada red.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
