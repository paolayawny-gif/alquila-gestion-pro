'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare, Send, Users, User, Search,
  Languages, Sparkles, PenLine,
  Hash, Info, Paperclip, TrendingUp, AlertTriangle,
  Zap, FileText, Copy, CheckCheck, ChevronDown, ChevronUp,
  BarChart3, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, Property, Person } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, increment } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { writePropertyEvent } from '@/lib/property-events';
import { useToast } from '@/hooks/use-toast';
import { richCommunication, fetchIndexTicker } from '@/ai/flows/rich-communication-flow';
import type { RichCommunicationInput, IndexTicker } from '@/ai/flows/rich-communication-flow';

const APP_ID = 'alquilagestion-pro';

// ── Tipos ──────────────────────────────────────────────
interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string;
  propertyId: string;
  propertyName: string;
  members: string[];
  memberNames: string[];
  lastMessage: string;
  lastMessageAt: number;
  unreadAdmin: number;
  ownerId: string;
}

interface ChatMessage {
  id: string;
  text: string;
  translatedText?: string;
  originalLang?: string;
  sender: 'admin' | string;
  senderName: string;
  ts: number;
  ownerId: string;
}

interface MessagesViewProps {
  contracts: Contract[];
  properties: Property[];
  people: Person[];
  userId?: string;
}

// ── Helpers de traducción y sugerencias ───────────────
const SPANISH_WORDS = new Set([
  'de','la','el','en','es','que','y','a','los','del','se','las',
  'un','por','con','no','una','su','para','al','lo','me','mi',
  'si','pero','como','te','hay','más','muy','esto','esta','está',
  'hola','gracias','buenas','días','tardes','tengo','quiero','necesito'
]);

function isLikelySpanish(text: string): boolean {
  const words = text.toLowerCase().split(/[\s,!?.;:]+/).filter(w => w.length > 1);
  if (words.length < 2) return true;
  const match = words.filter(w => SPANISH_WORDS.has(w)).length;
  return match / words.length >= 0.12;
}

async function translateToSpanish(text: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`
    );
    const data = await res.json();
    if (data.responseStatus === 200) {
      const translated: string = data.responseData.translatedText;
      if (translated && translated.toLowerCase() !== text.toLowerCase()) return translated;
    }
    return null;
  } catch {
    return null;
  }
}

function getSmartSuggestions(text: string, contract?: Contract): string[] {
  const t = text.toLowerCase();
  const suggestions: string[] = [];

  if (/pago|alquiler|rent|payment|cuota|debe|deuda|vence|due/.test(t)) {
    suggestions.push('El alquiler vence el día 5 de cada mes.');
    if (contract?.currentRentAmount)
      suggestions.push(`El monto actual es $${contract.currentRentAmount.toLocaleString('es-AR')}. Podés abonar por transferencia.`);
    suggestions.push('Tienes hasta el 5, luego aplica recargo.');
  }

  if (/roto|problema|arreglar|broken|repair|maintenance|mantenimiento|agua|luz|gas|calefac|ac|aire/.test(t)) {
    suggestions.push('Entendido, enviaré a un técnico de mantenimiento mañana por la mañana.');
    suggestions.push('Por favor mandame fotos del problema para gestionarlo con el proveedor.');
  }

  if (/contrato|contract|vencimiento|renovar|renew|plazo/.test(t)) {
    if (contract?.endDate)
      suggestions.push(`Tu contrato vence el ${contract.endDate}. Nos ponemos en contacto antes para coordinar.`);
    suggestions.push('El contrato se puede renovar con 30 días de anticipación al vencimiento.');
  }

  if (/llave|key|acceso|access|puerta|door/.test(t)) {
    suggestions.push('Las llaves pueden retirarse en la administración de lunes a viernes de 9 a 18hs.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Muchas gracias por tu mensaje. Lo revisamos y te respondemos a la brevedad.');
    suggestions.push('Recibimos tu consulta. Te contactamos en horario de atención (lun–vie 9–18hs).');
  }

  return suggestions.slice(0, 3);
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Hoy, ${time}` : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) + ` ${time}`;
}

// ── Plantillas rápidas ─────────────────────────────────
const QUICK_TEMPLATES: { label: string; icon: React.ReactNode; type: RichCommunicationInput['communicationType']; channel: RichCommunicationInput['channel']; tone: RichCommunicationInput['tone']; moraStep?: 1 | 5 | 15 | 30 | 45 }[] = [
  { label: 'Recordatorio de pago',   icon: <Clock className="h-3 w-3" />,         type: 'rentReminder',           channel: 'whatsapp', tone: 'amigable'  },
  { label: 'Aviso de mora (día 5)',   icon: <AlertTriangle className="h-3 w-3" />, type: 'rentOverdue',            channel: 'whatsapp', tone: 'firme',     moraStep: 5  },
  { label: 'Intimación legal',        icon: <FileText className="h-3 w-3" />,      type: 'intimacionPago',         channel: 'email',    tone: 'juridico',  moraStep: 15 },
  { label: 'Carta Documento',         icon: <AlertTriangle className="h-3 w-3" />, type: 'cartaDocumentoDesalojo', channel: 'carta_documento', tone: 'urgente', moraStep: 30 },
  { label: 'Aviso de ajuste',         icon: <TrendingUp className="h-3 w-3" />,    type: 'leaseAdjustment',        channel: 'email',    tone: 'formal'    },
  { label: 'Vencimiento próximo',     icon: <Clock className="h-3 w-3" />,         type: 'notificacionVencimientoProximo', channel: 'email', tone: 'formal' },
];

// ── Componente principal ───────────────────────────────
export function MessagesView({ contracts, properties, people, userId }: MessagesViewProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageText,    setMessageText]    = useState('');
  const [searchTerm,     setSearchTerm]     = useState('');
  const [showNewDirect,  setShowNewDirect]  = useState(false);
  const [showNewGroup,   setShowNewGroup]   = useState(false);
  const [isSending,      setIsSending]      = useState(false);
  const [isTyping,       setIsTyping]       = useState(false);

  // Panel IA de redacción
  const [showAiDraft,    setShowAiDraft]    = useState(false);
  const [aiDraftType,    setAiDraftType]    = useState<RichCommunicationInput['communicationType']>('rentReminder');
  const [aiChannel,      setAiChannel]      = useState<RichCommunicationInput['channel']>('whatsapp');
  const [aiTone,         setAiTone]         = useState<RichCommunicationInput['tone']>('formal');
  const [aiMoraStep,     setAiMoraStep]     = useState<1|5|15|30|45|undefined>(undefined);
  const [aiAutoIndex,    setAiAutoIndex]    = useState(false);
  const [aiDraftResult,  setAiDraftResult]  = useState<string>('');
  const [aiSubject,      setAiSubject]      = useState<string>('');
  const [aiIndexInfo,    setAiIndexInfo]    = useState<string>('');
  const [aiToneNote,     setAiToneNote]     = useState<string>('');
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiCopied,       setAiCopied]       = useState(false);

  // Ticker de índices en vivo
  const [indexTicker,    setIndexTicker]    = useState<IndexTicker | null>(null);
  const [tickerLoading,  setTickerLoading]  = useState(false);

  // Traducciones en memoria: msgId → texto traducido
  const [translations,   setTranslations]   = useState<Record<string, string>>({});
  const [translating,    setTranslating]    = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore: lista de chats (shared collection, filtered by adminId) ──
  const chatsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats'),
      orderBy('lastMessageAt', 'desc'),
    );
  }, [db, userId]);
  const { data: chatsAllRaw } = useCollection<Chat>(chatsQ);
  // Filter client-side: only chats owned by this admin
  const chatsRaw = (chatsAllRaw ?? []).filter((c: any) => c.adminId === userId || c.ownerId === userId);

  // ── Firestore: mensajes del chat seleccionado ──
  const messagesQ = useMemoFirebase(() => {
    if (!db || !selectedChatId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId, 'mensajes'),
      orderBy('ts')
    );
  }, [db, selectedChatId]);
  const { data: messagesRaw } = useCollection<ChatMessage>(messagesQ);

  const chats    = useMemo(() => (chatsRaw || []).sort((a, b) => b.lastMessageAt - a.lastMessageAt), [chatsRaw]);
  const messages = useMemo(() => messagesRaw || [], [messagesRaw]);

  const selectedChat    = chats.find(c => c.id === selectedChatId) ?? null;
  const filteredChats   = useMemo(() =>
    chats.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.propertyName.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [chats, searchTerm]);

  // Contrato relacionado al chat seleccionado (para contexto IA)
  const relatedContract = useMemo(() => {
    if (!selectedChat) return undefined;
    if (selectedChat.type === 'direct') {
      return contracts.find(c =>
        c.tenantEmail?.toLowerCase() === selectedChat.members[0]?.toLowerCase() &&
        c.propertyId === selectedChat.propertyId
      );
    }
    return contracts.find(c => c.propertyId === selectedChat.propertyId);
  }, [selectedChat, contracts]);

  const relatedProperty = properties.find(p => p.id === selectedChat?.propertyId);

  // Último mensaje de inquilino (para sugerencias IA)
  const lastTenantMsg = useMemo(() =>
    [...messages].reverse().find(m => m.sender !== 'admin'),
  [messages]);

  const aiSuggestions = useMemo(() =>
    lastTenantMsg ? getSmartSuggestions(lastTenantMsg.text, relatedContract) : [],
  [lastTenantMsg, relatedContract]);

  // ¿Hay mensajes con traducción activa?
  const hasTranslation = useMemo(() =>
    messages.some(m => m.sender !== 'admin' && !isLikelySpanish(m.text)),
  [messages]);

  // Marcar chat como leído cuando el admin lo abre
  useEffect(() => {
    if (!db || !selectedChatId || !selectedChat || selectedChat.unreadAdmin === 0) return;
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId);
    setDocumentNonBlocking(chatRef, { unreadAdmin: 0 }, { merge: true });
  }, [selectedChatId, db]);

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-traducir mensajes de inquilinos no-españoles
  useEffect(() => {
    if (!messages.length) return;
    messages
      .filter(m => m.sender !== 'admin' && !translations[m.id] && !translating[m.id] && !isLikelySpanish(m.text))
      .forEach(async m => {
        setTranslating(prev => ({ ...prev, [m.id]: true }));
        const t = await translateToSpanish(m.text);
        if (t) setTranslations(prev => ({ ...prev, [m.id]: t }));
        setTranslating(prev => ({ ...prev, [m.id]: false }));
      });
  }, [messages]);

  // Simular "está escribiendo" al recibir nuevo mensaje de inquilino
  useEffect(() => {
    if (!lastTenantMsg) return;
    const elapsed = Date.now() - lastTenantMsg.ts;
    if (elapsed < 8000) {
      setIsTyping(true);
      const t = setTimeout(() => setIsTyping(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastTenantMsg?.id]);

  // Cargar ticker de índices al montar
  useEffect(() => {
    setTickerLoading(true);
    fetchIndexTicker()
      .then(t => setIndexTicker(t))
      .finally(() => setTickerLoading(false));
  }, []);

  // ── Redactar con IA ──
  const handleAiDraft = async (template?: typeof QUICK_TEMPLATES[number]) => {
    setAiLoading(true);
    setAiDraftResult('');
    setAiSubject('');
    setAiIndexInfo('');
    setAiToneNote('');

    const effectiveType    = template?.type    ?? aiDraftType;
    const effectiveChannel = template?.channel ?? aiChannel;
    const effectiveTone    = template?.tone    ?? aiTone;
    const effectiveMora    = template?.moraStep ?? aiMoraStep;

    const isAdjustment = effectiveType === 'leaseAdjustment';
    const indexType = isAdjustment
      ? ((relatedContract?.adjustmentType === 'Index' ? 'ICL' : 'IPC') as RichCommunicationInput['indexType'])
      : undefined;

    const input: RichCommunicationInput = {
      communicationType: effectiveType,
      channel: effectiveChannel,
      tone: effectiveTone,
      moraSequenceStep: effectiveMora,
      autoEnrichIndex: isAdjustment,
      indexType,
      adjustmentMonths: 12,
      tenantName: relatedContract?.tenantName ?? selectedChat?.name,
      ownerName: relatedProperty?.owners?.[0]?.name ?? undefined,
      propertyName: relatedProperty?.name ?? selectedChat?.propertyName,
      propertyAddress: relatedProperty?.address ?? undefined,
      currentRentAmount: relatedContract?.currentRentAmount ?? undefined,
      currency: (relatedContract?.currency as 'ARS' | 'USD') ?? 'ARS',
      currentLeaseEndDate: relatedContract?.endDate ?? undefined,
      daysOverdue: effectiveMora,
    };

    try {
      const result = await richCommunication(input);
      if (!result.ok) {
        toast({ title: 'Error al generar mensaje', description: result.error, variant: 'destructive' });
        return;
      }
      setAiDraftResult(result.data.channelFormattedMessage);
      setAiSubject(result.data.subjectLine);
      setAiToneNote(result.data.toneNote ?? '');

      if (result.data.indexDataUsed) {
        const idx = result.data.indexDataUsed;
        setAiIndexInfo(
          `${idx.sourceLabel} — variación ${idx.accumulatedPct.toFixed(1)}%${idx.newRentCalculated ? ` → Nuevo alquiler estimado: ${(relatedContract?.currency ?? 'ARS')} ${idx.newRentCalculated.toLocaleString('es-AR')}` : ''}`
        );
      }

      if (result.data.moraStepLabel) {
        toast({ title: result.data.moraStepLabel, description: 'Mensaje generado con el tono apropiado para esta etapa.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'No se pudo generar el mensaje.', variant: 'destructive' });
    } finally {
      setAiLoading(false);
      setShowAiDraft(true);
    }
  };

  const handleCopyAndUse = () => {
    if (!aiDraftResult) return;
    setMessageText(aiDraftResult);
    setAiCopied(true);
    setShowAiDraft(false);
    setTimeout(() => setAiCopied(false), 2000);
    toast({ title: 'Mensaje copiado al campo de texto' });
  };

  // ── Enviar mensaje ──
  const handleSend = async (text?: string) => {
    const txt = (text ?? messageText).trim();
    if (!txt || !selectedChatId || !userId || !db) return;
    setIsSending(true);
    const msgId  = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now    = Date.now();
    const msgRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId, 'mensajes', msgId);
    const msg: ChatMessage = {
      id: msgId, text: txt, sender: 'admin', senderName: 'Administración',
      ts: now, ownerId: userId,
    };
    setDocumentNonBlocking(msgRef, msg, {});
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId);
    setDocumentNonBlocking(chatRef, { lastMessage: txt, lastMessageAt: now, unreadAdmin: 0, unreadTenant: increment(1) }, { merge: true });
    if (selectedChat?.propertyId) {
      writePropertyEvent(db, userId, {
        propertyId: selectedChat.propertyId,
        propertyName: selectedChat.propertyName,
        type: 'message_admin',
        title: `Admin → ${selectedChat.name}`,
        detail: txt.length > 140 ? txt.slice(0, 140) + '…' : txt,
        actor: 'Administración',
        actorRole: 'admin',
        ts: now,
        metadata: { chatId: selectedChatId },
      });
    }
    if (!text) setMessageText('');
    setIsSending(false);
  };

  // ── Crear chat directo ──
  const handleCreateDirect = (tenantEmail: string, tenantName: string, propertyId: string, propertyName: string) => {
    if (!userId || !db) return;
    const existing = chats.find(c => c.type === 'direct' && c.members[0] === tenantEmail);
    if (existing) { setSelectedChatId(existing.id); setShowNewDirect(false); return; }
    const chatId  = `chat_${userId}_${tenantEmail.replace(/[@.]/g, '_')}_${propertyId}`;
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', chatId);
    const chat = {
      id: chatId, type: 'direct', name: tenantName,
      propertyId, propertyName, members: [tenantEmail], memberNames: [tenantName],
      lastMessage: '', lastMessageAt: Date.now(),
      unreadAdmin: 0, unreadTenant: 0,
      adminId: userId, tenantEmail, tenantName,
      ownerId: userId,
    };
    setDocumentNonBlocking(chatRef, chat, {});
    setSelectedChatId(chatId);
    setShowNewDirect(false);
    toast({ title: `Chat abierto con ${tenantName}` });
  };

  // ── Crear grupo ──
  const handleCreateGroup = (propertyId: string, groupName: string) => {
    if (!userId || !db) return;
    const property        = properties.find(p => p.id === propertyId);
    const activeContracts = contracts.filter(c => c.propertyId === propertyId);
    const members         = activeContracts.map(c => c.tenantEmail || '').filter(Boolean);
    const memberNames     = activeContracts.map(c => c.tenantName  || '').filter(Boolean);
    if (members.length === 0) {
      toast({ title: 'Sin inquilinos', description: 'Esta propiedad no tiene contratos activos.', variant: 'destructive' });
      return;
    }
    const chatId  = `group_${userId}_${propertyId}_${Date.now()}`;
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', chatId);
    const chat: Chat = {
      id: chatId, type: 'group',
      name: groupName || property?.name || 'Grupo',
      propertyId, propertyName: property?.name || '',
      members, memberNames,
      lastMessage: '', lastMessageAt: Date.now(), unreadAdmin: 0, ownerId: userId,
    };
    setDocumentNonBlocking(chatRef, chat, {});
    setSelectedChatId(chatId);
    setShowNewGroup(false);
    toast({ title: `Grupo creado con ${members.length} inquilino${members.length !== 1 ? 's' : ''}` });
  };

  // ── Render ──
  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Mensajes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comunicación directa con inquilinos y grupos de edificio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 font-bold text-xs"
            onClick={() => setShowNewDirect(true)}>
            <User className="h-3.5 w-3.5 text-primary" /> Mensaje directo
          </Button>
          <Button variant="outline" size="sm" className="gap-2 font-bold text-xs"
            onClick={() => setShowNewGroup(true)}>
            <Users className="h-3.5 w-3.5 text-slate-500" /> Grupo de edificio
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-13rem)] rounded-2xl overflow-hidden border shadow-sm bg-white">

        {/* ══ Columna izquierda: lista de conversaciones ══ */}
        <div className="w-72 border-r flex flex-col shrink-0">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-black text-sm">Conversaciones</p>
              <div className="flex gap-1">
                <button
                  title="Mensaje directo"
                  onClick={() => setShowNewDirect(true)}
                  className="h-7 w-7 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Nuevo grupo"
                  onClick={() => setShowNewGroup(true)}
                  className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input className="pl-8 h-8 text-xs" placeholder="Buscar..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 p-6 text-center">
                <MessageSquare className="h-8 w-8" />
                <p className="text-xs font-medium">Sin conversaciones</p>
                <p className="text-[10px]">Creá un mensaje directo o un grupo de edificio.</p>
              </div>
            ) : (
              filteredChats.map(chat => (
                <button key={chat.id} onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b hover:bg-muted/40 transition-colors',
                    selectedChatId === chat.id
                      ? 'bg-primary/5 border-l-[3px] border-l-primary'
                      : 'border-l-[3px] border-l-transparent'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-black',
                        chat.type === 'group' ? 'bg-slate-400' : (chat as any).chatType === 'owner' ? 'bg-emerald-600' : 'bg-primary'
                      )}>
                        {chat.type === 'group'
                          ? <Hash className="h-4 w-4" />
                          : chat.name.charAt(0).toUpperCase()
                        }
                      </div>
                      {chat.type === 'direct' && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-bold truncate">{chat.name}</p>
                          {(chat as any).chatType === 'owner' && (
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 rounded px-1 shrink-0">Prop.</span>
                          )}
                        </div>
                        {chat.unreadAdmin > 0 && (
                          <span className="bg-primary text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shrink-0">
                            {chat.unreadAdmin}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-primary/70 font-medium truncate">{chat.propertyName}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {chat.lastMessage || 'Sin mensajes aún'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ══ Centro: ventana de chat ══ */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
              <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center">
                <MessageSquare className="h-8 w-8" />
              </div>
              <p className="font-semibold text-sm">Seleccioná una conversación</p>
              <p className="text-xs text-center max-w-[200px] text-muted-foreground/60">
                O creá un mensaje directo o un grupo de edificio desde el panel izquierdo.
              </p>
            </div>
          ) : (
            <>
              {/* Header del chat */}
              <div className="h-14 border-b px-5 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  {/* Avatar con punto */}
                  <div className="relative shrink-0">
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-black',
                      selectedChat.type === 'group' ? 'bg-slate-400' : 'bg-primary'
                    )}>
                      {selectedChat.type === 'group'
                        ? <Hash className="h-4 w-4" />
                        : selectedChat.name.charAt(0).toUpperCase()
                      }
                    </div>
                    {selectedChat.type === 'direct' && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight">{selectedChat.name}</p>
                    <div className="flex items-center gap-1.5">
                      {selectedChat.type === 'direct' ? (
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          En línea
                          {hasTranslation && (
                            <>
                              <span className="mx-1 opacity-40">•</span>
                              <span className="text-primary/70 font-semibold">Traducción Activa (EN ↔ ES)</span>
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {selectedChat.members.length} inquilino{selectedChat.members.length !== 1 ? 's' : ''} · {selectedChat.propertyName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {selectedChat.type === 'group' && (
                  <div className="flex items-center gap-1.5">
                    {selectedChat.memberNames.slice(0, 3).map((n, i) => (
                      <div key={i}
                        title={n}
                        className="h-7 w-7 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center text-[10px] font-black text-primary -ml-2 first:ml-0">
                        {n.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {selectedChat.memberNames.length > 3 && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        +{selectedChat.memberNames.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-muted/10">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground/40 text-xs py-8">
                    Aún no hay mensajes. Escribí el primero.
                  </div>
                )}

                {/* Separador de fecha para el primer mensaje */}
                {messages.length > 0 && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-[10px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                      {formatTimeLabel(messages[0].ts).split(',')[0] === 'Hoy'
                        ? `Hoy, ${new Date(messages[0].ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                        : new Date(messages[0].ts).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })
                      }
                    </span>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isAdmin       = msg.sender === 'admin';
                  const needsTransl   = !isAdmin && !isLikelySpanish(msg.text);
                  const translated    = translations[msg.id];
                  const isTranslating = translating[msg.id];

                  // Separador de día si cambia la fecha respecto al anterior
                  const prevMsg = messages[idx - 1];
                  const showDateSep = prevMsg && idx > 0 &&
                    new Date(prevMsg.ts).toDateString() !== new Date(msg.ts).toDateString();

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center justify-center py-3">
                          <span className="text-[10px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                            {new Date(msg.ts).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
                          </span>
                        </div>
                      )}

                      <div className={cn('flex mb-1', isAdmin ? 'justify-end' : 'justify-start')}>
                        {/* Avatar del inquilino */}
                        {!isAdmin && (
                          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mr-2 mt-1">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className={cn('max-w-[72%] space-y-1', isAdmin ? 'items-end flex flex-col' : 'items-start flex flex-col')}>
                          {/* Nombre en grupo */}
                          {selectedChat.type === 'group' && !isAdmin && (
                            <p className="text-[9px] text-primary/70 px-1 font-bold">{msg.senderName}</p>
                          )}

                          {/* Burbuja */}
                          <div className={cn(
                            'rounded-2xl px-4 py-2.5 text-sm',
                            isAdmin
                              ? 'bg-primary text-white rounded-br-none shadow-sm'
                              : 'bg-white text-foreground rounded-bl-none shadow-sm border border-muted'
                          )}>
                            {/* Mensaje de inquilino con traducción inline */}
                            {!isAdmin && needsTransl ? (
                              <div className="space-y-1.5">
                                {/* Texto original en itálicas */}
                                <p className="italic text-muted-foreground text-[12px] leading-relaxed">
                                  "{msg.text}"
                                </p>
                                {/* Traducción */}
                                {isTranslating ? (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                                    <Languages className="h-3 w-3 animate-pulse text-primary/50" />
                                    <span>Traduciendo...</span>
                                  </div>
                                ) : translated ? (
                                  <div className="flex items-start gap-1.5">
                                    <Languages className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
                                    <p className="text-[13px] text-foreground font-medium leading-relaxed">{translated}</p>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p className="leading-relaxed">{msg.text}</p>
                            )}
                          </div>

                          {/* Hora */}
                          <p className={cn('text-[9px] text-muted-foreground px-1', isAdmin ? 'text-right' : '')}>
                            {new Date(msg.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Indicador "está escribiendo" */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mr-2 mt-1">
                      {selectedChat.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="bg-white border border-muted rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input de mensaje */}
              <div className="border-t p-3 flex items-center gap-2 shrink-0 bg-white">
                <button
                  className="h-9 w-9 rounded-xl bg-muted/40 hover:bg-muted flex items-center justify-center shrink-0 transition-colors text-muted-foreground"
                  title="Adjuntar archivo (próximamente)"
                  type="button"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <Input
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  className="flex-1 bg-muted/30 border-muted focus:border-primary/30 rounded-xl"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!messageText.trim() || isSending}
                  className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    messageText.trim()
                      ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ Panel derecho: IA + contexto ══ */}
        {selectedChat && (
          <div className="w-80 border-l flex flex-col shrink-0 overflow-y-auto bg-white">

            {/* ── Ticker de índices en vivo ── */}
            <div className="px-4 pt-4 pb-3 border-b space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <p className="font-black text-[11px] uppercase tracking-wider text-muted-foreground">
                  Índices en vivo
                </p>
                {tickerLoading && (
                  <span className="ml-auto text-[9px] text-muted-foreground animate-pulse">Actualizando...</span>
                )}
              </div>
              {indexTicker ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ICL', 'IPC', 'CER'] as const).map(key => {
                    const t = indexTicker[key];
                    if (!t) return null;
                    return (
                      <div key={key} className={cn(
                        'rounded-lg px-2 py-1.5 text-center border',
                        t.source === 'api'
                          ? 'bg-emerald-50 border-emerald-100'
                          : 'bg-amber-50 border-amber-100'
                      )}>
                        <p className="text-[9px] font-black text-muted-foreground">{key}</p>
                        <p className={cn('text-sm font-black leading-tight', t.source === 'api' ? 'text-emerald-700' : 'text-amber-700')}>
                          {t.monthlyPct.toFixed(1)}%
                        </p>
                        <p className="text-[8px] text-muted-foreground/70 truncate">{t.period}</p>
                        {t.source !== 'api' && (
                          <p className="text-[8px] text-amber-600 font-bold">est.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {['ICL', 'IPC', 'CER'].map(k => (
                    <div key={k} className="rounded-lg px-2 py-1.5 text-center border bg-muted/20 animate-pulse h-14" />
                  ))}
                </div>
              )}
            </div>

            {/* ── Asistente IA de redacción ── */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="font-black text-sm">Redactar con IA</p>
              </div>

              {/* Plantillas rápidas */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase font-black text-muted-foreground/70 tracking-wider">Plantillas rápidas</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_TEMPLATES.map((t, i) => (
                    <button key={i}
                      onClick={() => handleAiDraft(t)}
                      disabled={aiLoading}
                      className={cn(
                        'flex items-center gap-1.5 text-left text-[10px] font-bold rounded-lg px-2.5 py-2 border transition-all',
                        t.moraStep && t.moraStep >= 15
                          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          : t.moraStep
                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10'
                      )}
                    >
                      {t.icon}
                      <span className="leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Redactor personalizado */}
              <details className="group">
                <summary className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground cursor-pointer hover:text-foreground select-none list-none">
                  <PenLine className="h-3 w-3" />
                  Personalizar mensaje
                  <ChevronDown className="h-3 w-3 ml-auto group-open:hidden" />
                  <ChevronUp className="h-3 w-3 ml-auto hidden group-open:block" />
                </summary>
                <div className="mt-2 space-y-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Tipo</Label>
                    <Select value={aiDraftType} onValueChange={v => setAiDraftType(v as any)}>
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rentReminder">Recordatorio de pago</SelectItem>
                        <SelectItem value="rentOverdue">Aviso de mora</SelectItem>
                        <SelectItem value="intimacionPago">Intimación de pago</SelectItem>
                        <SelectItem value="cartaDocumentoDesalojo">Carta documento</SelectItem>
                        <SelectItem value="leaseAdjustment">Ajuste de alquiler</SelectItem>
                        <SelectItem value="leaseRenewal">Renovación de contrato</SelectItem>
                        <SelectItem value="notificacionVencimientoProximo">Vencimiento próximo</SelectItem>
                        <SelectItem value="informeMoraGarante">Informe al garante</SelectItem>
                        <SelectItem value="maintenanceUpdate">Actualización mantenimiento</SelectItem>
                        <SelectItem value="ownerLiquidationReport">Liquidación al propietario</SelectItem>
                        <SelectItem value="generalMessage">Mensaje general</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Canal</Label>
                      <Select value={aiChannel} onValueChange={v => setAiChannel(v as any)}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="carta_documento">Carta Documento</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="portal">Portal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Tono</Label>
                      <Select value={aiTone} onValueChange={v => setAiTone(v as any)}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="amigable">Amigable</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="firme">Firme</SelectItem>
                          <SelectItem value="juridico">Jurídico</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs font-bold gap-2"
                    onClick={() => handleAiDraft()}
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? <><span className="animate-spin">⟳</span> Generando...</>
                      : <><Zap className="h-3.5 w-3.5" /> Generar mensaje</>
                    }
                  </Button>
                </div>
              </details>

              {/* Resultado del borrador */}
              {(aiLoading || aiDraftResult) && (
                <div className="space-y-2 mt-1">
                  {aiLoading ? (
                    <div className="bg-muted/30 rounded-xl p-3 space-y-2 animate-pulse">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-5/6" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ) : aiDraftResult && (
                    <div className="space-y-2">
                      {aiSubject && (
                        <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5">
                          <p className="text-[9px] font-black text-primary/70 uppercase tracking-wider">Asunto</p>
                          <p className="text-[11px] font-bold text-primary">{aiSubject}</p>
                        </div>
                      )}
                      {aiIndexInfo && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                            <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Índice aplicado</p>
                          </div>
                          <p className="text-[10px] text-emerald-800">{aiIndexInfo}</p>
                        </div>
                      )}
                      <div className="bg-muted/20 border border-muted rounded-xl p-3">
                        <Textarea
                          value={aiDraftResult}
                          onChange={e => setAiDraftResult(e.target.value)}
                          className="text-[11px] leading-relaxed bg-transparent border-none shadow-none resize-none min-h-[120px] p-0 focus-visible:ring-0"
                        />
                      </div>
                      {aiToneNote && (
                        <p className="text-[10px] text-muted-foreground italic px-1 leading-relaxed">{aiToneNote}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-[11px] font-bold gap-1.5"
                          onClick={() => handleAiDraft()}
                          disabled={aiLoading}
                        >
                          <Sparkles className="h-3 w-3" /> Regenerar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-[11px] font-bold gap-1.5 bg-primary"
                          onClick={handleCopyAndUse}
                        >
                          {aiCopied
                            ? <><CheckCheck className="h-3 w-3" /> Copiado</>
                            : <><Copy className="h-3 w-3" /> Usar</>
                          }
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sugerencias contextuales */}
              {!aiDraftResult && !aiLoading && lastTenantMsg && (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase font-black text-muted-foreground/70 tracking-wider">Respuestas rápidas</p>
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSend(s)}
                      className="w-full text-left text-[11px] font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-2 transition-colors leading-relaxed border border-primary/10">
                      "{s}"
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Contexto activo ── */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Info className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <p className="font-black text-sm">Contexto</p>
                {relatedProperty && (
                  <Badge variant="outline" className="ml-auto text-[9px] font-bold border-primary/30 text-primary bg-primary/5 shrink-0">
                    {relatedProperty.name}
                  </Badge>
                )}
              </div>

              {relatedContract ? (
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Inquilino</span>
                    <span className="font-bold truncate max-w-[130px]">{relatedContract.tenantName}</span>
                  </div>
                  {relatedContract.currentRentAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Alquiler</span>
                      <span className="font-bold text-primary">
                        {relatedContract.currency} {relatedContract.currentRentAmount.toLocaleString('es-AR')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vencimiento contrato</span>
                    <span className="font-bold">{relatedContract.endDate ?? '—'}</span>
                  </div>
                  {relatedContract.adjustmentType && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Mecanismo ajuste</span>
                      <Badge variant="outline" className="text-[9px] font-bold">{relatedContract.adjustmentType}</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">
                  {selectedChat.type === 'group'
                    ? `Grupo con ${selectedChat.members.length} inquilino${selectedChat.members.length !== 1 ? 's' : ''} de ${selectedChat.propertyName}.`
                    : 'Sin contrato activo vinculado a esta conversación.'}
                </div>
              )}

              {/* Miembros del grupo */}
              {selectedChat.type === 'group' && selectedChat.memberNames.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[9px] uppercase font-black text-muted-foreground/70 tracking-widest">
                      Miembros ({selectedChat.memberNames.length})
                    </p>
                    {selectedChat.memberNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-[11px] font-medium truncate">{name}</p>
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewDirectDialog
        open={showNewDirect}
        onClose={() => setShowNewDirect(false)}
        contracts={contracts}
        properties={properties}
        onCreate={handleCreateDirect}
      />
      <NewGroupDialog
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        contracts={contracts}
        properties={properties}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}

// ── Dialog: Nuevo mensaje directo ─────────────────────
function NewDirectDialog({ open, onClose, contracts, properties, onCreate }: {
  open: boolean;
  onClose: () => void;
  contracts: Contract[];
  properties: Property[];
  onCreate: (email: string, name: string, propertyId: string, propertyName: string) => void;
}) {
  const [selected, setSelected] = useState('');

  const options = useMemo(() =>
    contracts
      .filter(c => c.tenantEmail)
      .map(c => ({
        value: c.id,
        email: c.tenantEmail!,
        name: c.tenantName,
        propertyId: c.propertyId,
        propertyName: properties.find(p => p.id === c.propertyId)?.name || c.propertyId,
      })),
  [contracts, properties]);

  const handleCreate = () => {
    const opt = options.find(o => o.value === selected);
    if (!opt) return;
    onCreate(opt.email, opt.name ?? 'Inquilino', opt.propertyId, opt.propertyName);
    setSelected('');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Mensaje directo
          </DialogTitle>
          <DialogDescription>Seleccioná el inquilino con quien querés chatear.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Seleccioná inquilino..." /></SelectTrigger>
            <SelectContent>
              {options.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <div>
                    <p className="font-bold text-sm">{o.name}</p>
                    <p className="text-[10px] text-muted-foreground">{o.propertyName}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold" onClick={handleCreate} disabled={!selected}>
            Abrir chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Nuevo grupo de edificio ───────────────────
function NewGroupDialog({ open, onClose, contracts, properties, onCreate }: {
  open: boolean;
  onClose: () => void;
  contracts: Contract[];
  properties: Property[];
  onCreate: (propertyId: string, groupName: string) => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [groupName,  setGroupName]  = useState('');

  const propertiesWithTenants = useMemo(() =>
    properties.filter(p => contracts.some(c => c.propertyId === p.id)),
  [properties, contracts]);

  const membersPreview = useMemo(() =>
    contracts.filter(c => c.propertyId === propertyId).map(c => c.tenantName),
  [contracts, propertyId]);

  const handleSelect = (pid: string) => {
    setPropertyId(pid);
    const prop = properties.find(p => p.id === pid);
    setGroupName(prop ? `Edificio ${prop.name}` : '');
  };

  const handleCreate = () => {
    if (!propertyId) return;
    onCreate(propertyId, groupName);
    setPropertyId(''); setGroupName('');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Nuevo grupo de edificio
          </DialogTitle>
          <DialogDescription>
            El grupo incluye a todos los inquilinos con contrato activo en esa propiedad.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Propiedad / Edificio</Label>
            <Select value={propertyId} onValueChange={handleSelect}>
              <SelectTrigger><SelectValue placeholder="Seleccioná propiedad..." /></SelectTrigger>
              <SelectContent>
                {propertiesWithTenants.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.address}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {membersPreview.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">
                Miembros que se agregarán ({membersPreview.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {membersPreview.map((name, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-medium">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nombre del grupo</Label>
            <Input
              placeholder="Ej: Edificio Las Heras"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-primary font-bold gap-2" onClick={handleCreate}
            disabled={!propertyId || membersPreview.length === 0}>
            <Users className="h-4 w-4" /> Crear grupo ({membersPreview.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
