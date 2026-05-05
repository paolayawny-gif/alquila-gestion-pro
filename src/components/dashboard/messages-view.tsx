'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare, Send, Plus, Users, User, Search,
  Languages, Sparkles, PenLine, Building2, Phone,
  ChevronRight, CheckCircle2, Clock, AlertCircle,
  Hash, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, Property, Person } from '@/lib/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const APP_ID = 'alquilagestion-pro';

// ── Tipos ──────────────────────────────────────────────
interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string;
  propertyId: string;
  propertyName: string;
  members: string[];       // emails de inquilinos
  memberNames: string[];
  lastMessage: string;
  lastMessageAt: number;   // timestamp numérico para ordenar
  unreadAdmin: number;
  ownerId: string;
}

interface ChatMessage {
  id: string;
  text: string;
  translatedText?: string;
  originalLang?: string;
  sender: 'admin' | string;  // 'admin' o email del inquilino
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
    suggestions.push('Tienes hasta el 5, luego aplica recargo por mora.');
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

  // Traducciones en memoria: msgId → texto traducido
  const [translations,   setTranslations]   = useState<Record<string, string>>({});
  const [translating,    setTranslating]    = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore: lista de chats ──
  const chatsQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'chats'));
  }, [db, userId]);
  const { data: chatsRaw } = useCollection<Chat>(chatsQ);

  // ── Firestore: mensajes del chat seleccionado ──
  const messagesQ = useMemoFirebase(() => {
    if (!db || !userId || !selectedChatId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', userId, 'chats', selectedChatId, 'mensajes'),
      orderBy('ts')
    );
  }, [db, userId, selectedChatId]);
  const { data: messagesRaw } = useCollection<ChatMessage>(messagesQ);

  const chats    = useMemo(() => (chatsRaw || []).sort((a, b) => b.lastMessageAt - a.lastMessageAt), [chatsRaw]);
  const messages = useMemo(() => messagesRaw || [], [messagesRaw]);

  const selectedChat    = chats.find(c => c.id === selectedChatId) ?? null;
  const filteredChats   = useMemo(() =>
    chats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.propertyName.toLowerCase().includes(searchTerm.toLowerCase())),
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

  // ── Enviar mensaje ──
  const handleSend = async (text?: string) => {
    const txt = (text ?? messageText).trim();
    if (!txt || !selectedChatId || !userId || !db) return;
    setIsSending(true);
    const msgId  = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now    = Date.now();
    const msgRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'chats', selectedChatId, 'mensajes', msgId);
    const msg: ChatMessage = {
      id: msgId, text: txt, sender: 'admin', senderName: 'Administración',
      ts: now, ownerId: userId,
    };
    setDocumentNonBlocking(msgRef, msg, {});
    // Actualizar metadata del chat
    const chatRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'chats', selectedChatId);
    setDocumentNonBlocking(chatRef, { lastMessage: txt, lastMessageAt: now, unreadAdmin: 0 }, { merge: true });
    if (!text) setMessageText('');
    setIsSending(false);
  };

  // ── Crear chat directo ──
  const handleCreateDirect = (tenantEmail: string, tenantName: string, propertyId: string, propertyName: string) => {
    if (!userId || !db) return;
    // Buscar chat existente
    const existing = chats.find(c => c.type === 'direct' && c.members[0] === tenantEmail);
    if (existing) { setSelectedChatId(existing.id); setShowNewDirect(false); return; }
    const chatId  = `direct_${tenantEmail.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
    const chatRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'chats', chatId);
    const chat: Chat = {
      id: chatId, type: 'direct', name: tenantName,
      propertyId, propertyName, members: [tenantEmail], memberNames: [tenantName],
      lastMessage: '', lastMessageAt: Date.now(), unreadAdmin: 0, ownerId: userId,
    };
    setDocumentNonBlocking(chatRef, chat, {});
    setSelectedChatId(chatId);
    setShowNewDirect(false);
    toast({ title: `Chat abierto con ${tenantName}` });
  };

  // ── Crear grupo ──
  const handleCreateGroup = (propertyId: string, groupName: string) => {
    if (!userId || !db) return;
    const property  = properties.find(p => p.id === propertyId);
    const activeContracts = contracts.filter(c => c.propertyId === propertyId);
    const members      = activeContracts.map(c => c.tenantEmail || '').filter(Boolean);
    const memberNames  = activeContracts.map(c => c.tenantName  || '').filter(Boolean);
    if (members.length === 0) {
      toast({ title: 'Sin inquilinos', description: 'Esta propiedad no tiene contratos activos.', variant: 'destructive' });
      return;
    }
    const chatId  = `group_${propertyId}_${Date.now()}`;
    const chatRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'chats', chatId);
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
      <div>
        <h1 className="text-2xl font-black">Mensajes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Comunicación directa con inquilinos y grupos de edificio.
        </p>
      </div>

      <div className="flex h-[calc(100vh-13rem)] rounded-2xl overflow-hidden border shadow-sm bg-white">

        {/* ══ Columna izquierda: lista de conversaciones ══ */}
        <div className="w-72 border-r flex flex-col shrink-0">
          {/* Cabecera */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-black text-sm">Conversaciones</p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Mensaje directo"
                  onClick={() => setShowNewDirect(true)}>
                  <User className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Nuevo grupo"
                  onClick={() => setShowNewGroup(true)}>
                  <Users className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input className="pl-8 h-8 text-xs" placeholder="Buscar..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          {/* Lista */}
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
                    selectedChatId === chat.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black',
                      chat.type === 'group' ? 'bg-slate-500' : 'bg-primary'
                    )}>
                      {chat.type === 'group'
                        ? <Hash className="h-4 w-4" />
                        : chat.name.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-bold truncate">{chat.name}</p>
                        {chat.unreadAdmin > 0 && (
                          <Badge className="bg-primary text-white text-[9px] font-black h-4 min-w-4 px-1">
                            {chat.unreadAdmin}
                          </Badge>
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

          {/* Botones nueva conversación */}
          <div className="p-3 border-t space-y-1.5">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs font-bold"
              onClick={() => setShowNewDirect(true)}>
              <User className="h-3.5 w-3.5 text-primary" /> Mensaje directo
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs font-bold"
              onClick={() => setShowNewGroup(true)}>
              <Users className="h-3.5 w-3.5 text-slate-500" /> Nuevo grupo de edificio
            </Button>
          </div>
        </div>

        {/* ══ Centro: ventana de chat ══ */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
              <MessageSquare className="h-14 w-14" />
              <p className="font-semibold">Seleccioná una conversación</p>
              <p className="text-xs text-center max-w-[220px]">
                O creá un mensaje directo o un grupo de edificio desde el panel izquierdo.
              </p>
            </div>
          ) : (
            <>
              {/* Header del chat */}
              <div className="h-14 border-b px-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-black',
                    selectedChat.type === 'group' ? 'bg-slate-500' : 'bg-primary'
                  )}>
                    {selectedChat.type === 'group' ? <Hash className="h-4 w-4" /> : selectedChat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight">{selectedChat.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {selectedChat.type === 'group'
                        ? `${selectedChat.members.length} inquilino${selectedChat.members.length !== 1 ? 's' : ''} · ${selectedChat.propertyName}`
                        : `${selectedChat.propertyName} · Mensaje directo`
                      }
                    </p>
                  </div>
                </div>
                {selectedChat.type === 'group' && (
                  <Badge variant="outline" className="text-[9px] gap-1 font-bold">
                    <Users className="h-2.5 w-2.5" />
                    {selectedChat.memberNames.slice(0, 2).join(', ')}
                    {selectedChat.memberNames.length > 2 && ` +${selectedChat.memberNames.length - 2}`}
                  </Badge>
                )}
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground/50 text-xs py-8">
                    Aún no hay mensajes. Escribí el primero.
                  </div>
                )}
                {messages.map(msg => {
                  const isAdmin      = msg.sender === 'admin';
                  const needsTransl  = !isAdmin && !isLikelySpanish(msg.text);
                  const translated   = translations[msg.id];
                  const isTranslating = translating[msg.id];

                  return (
                    <div key={msg.id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] space-y-1', isAdmin ? 'items-end' : 'items-start')}>
                        {/* Nombre en grupo */}
                        {selectedChat.type === 'group' && !isAdmin && (
                          <p className="text-[9px] text-muted-foreground px-1 font-bold">{msg.senderName}</p>
                        )}

                        {/* Burbuja */}
                        <div className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm',
                          isAdmin
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-muted/60 text-foreground rounded-bl-sm'
                        )}>
                          {msg.text}
                        </div>

                        {/* Traducción */}
                        {needsTransl && (
                          <div className="px-1">
                            {isTranslating ? (
                              <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                <Languages className="h-3 w-3 animate-pulse" /> Traduciendo...
                              </p>
                            ) : translated ? (
                              <div className="flex items-start gap-1 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1">
                                <Languages className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
                                <span className="italic">{translated}</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        <p className={cn('text-[9px] text-muted-foreground px-1', isAdmin ? 'text-right' : '')}>
                          {new Date(msg.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de mensaje */}
              <div className="border-t p-3 flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Escribí un mensaje..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  className="flex-1 bg-muted/30 border-muted focus:border-primary/30"
                />
                <Button
                  className="bg-primary gap-1.5 font-bold px-4 shrink-0"
                  onClick={() => handleSend()}
                  disabled={!messageText.trim() || isSending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* ══ Panel derecho: IA + contexto ══ */}
        {selectedChat && (
          <div className="w-72 border-l flex flex-col shrink-0 overflow-y-auto">

            {/* Asistente IA */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="font-black text-sm">Asistente IA</p>
              </div>

              {lastTenantMsg ? (
                <>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    La IA detectó el tema del mensaje. Sugerencias de respuesta:
                  </p>
                  <div className="space-y-2">
                    {aiSuggestions.map((s, i) => (
                      <button key={i} onClick={() => handleSend(s)}
                        className="w-full text-left text-[11px] font-medium text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-2.5 transition-colors leading-relaxed border border-primary/10">
                        "{s}"
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm"
                    className="w-full gap-2 text-xs font-bold border-muted-foreground/20"
                    onClick={() => setMessageText('')}>
                    <PenLine className="h-3.5 w-3.5" /> Redactar respuesta propia
                  </Button>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Las sugerencias aparecen cuando el inquilino envíe un mensaje.
                </p>
              )}
            </div>

            {/* Contexto activo */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                  <Info className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <p className="font-black text-sm">Contexto Activo</p>
                {relatedProperty && (
                  <Badge variant="outline" className="ml-auto text-[9px] font-bold border-primary/30 text-primary">
                    {relatedProperty.name}
                  </Badge>
                )}
              </div>

              {relatedContract ? (
                <div className="space-y-2.5">
                  {/* Cláusula de pagos */}
                  <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-wider">
                      Cláusula — Pagos
                    </p>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      El canon mensual debe abonarse entre el día 1 y 5 de cada mes calendario.
                      En caso de mora se aplicarán los intereses punitorios correspondientes.
                    </p>
                  </div>
                  {/* Estado de cuenta */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-wider">
                      Estado de cuenta
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <p className="text-[11px] font-bold text-green-700">Al día</p>
                    </div>
                  </div>
                  {/* Datos del contrato */}
                  <Separator />
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inquilino</span>
                      <span className="font-bold truncate max-w-[120px]">{relatedContract.tenantName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Alquiler</span>
                      <span className="font-bold text-primary">
                        {relatedContract.currency} {relatedContract.currentRentAmount?.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vencimiento</span>
                      <span className="font-bold">{relatedContract.endDate}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-xl p-3">
                  {selectedChat.type === 'group'
                    ? `Grupo con ${selectedChat.members.length} inquilino${selectedChat.members.length !== 1 ? 's' : ''} de ${selectedChat.propertyName}.`
                    : 'No se encontró un contrato activo vinculado a esta conversación.'}
                </div>
              )}

              {/* Miembros del grupo */}
              {selectedChat.type === 'group' && selectedChat.memberNames.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-wider">
                      Miembros del grupo
                    </p>
                    {selectedChat.memberNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-[11px] font-medium truncate">{name}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ Dialog: Nuevo mensaje directo ══ */}
      <NewDirectDialog
        open={showNewDirect}
        onClose={() => setShowNewDirect(false)}
        contracts={contracts}
        properties={properties}
        onCreate={handleCreateDirect}
      />

      {/* ══ Dialog: Nuevo grupo ══ */}
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

          {/* Preview de miembros */}
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
