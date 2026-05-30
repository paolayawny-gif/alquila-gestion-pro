import { APP_ID } from '@/lib/constants';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, increment } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { writePropertyEvent } from '@/lib/property-events';
import { OwnerRegistryEntry } from './owner-portal';


interface ChatMessage {
  id: string;
  text: string;
  sender: 'admin' | 'owner';
  senderName: string;
  ts: number;
}

interface OwnerMessagesProps {
  ownerEntry: OwnerRegistryEntry;
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Hoy, ${time}` : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) + ` ${time}`;
}

export function OwnerMessages({ ownerEntry }: OwnerMessagesProps) {
  const db = useFirestore();
  const [messageText, setMessageText] = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive stable chat ID
  const chatId = `chat_owner_${ownerEntry.adminId}_${ownerEntry.ownerEmail.replace(/[@.+]/g, '_')}`;
  const chatRef = db ? doc(db, 'artifacts', APP_ID, 'sharedChats', chatId) : null;

  // ── Auto-create the chat doc if it doesn't exist ──
  useEffect(() => {
    if (!db || !chatRef) return;
    const chatData = {
      id: chatId,
      type: 'direct',
      chatType: 'owner',
      name: ownerEntry.ownerName,
      propertyId: ownerEntry.propertyIds[0] ?? '',
      propertyName: ownerEntry.propertyNames[0] ?? '',
      members: [ownerEntry.ownerEmail],
      memberNames: [ownerEntry.ownerName],
      lastMessage: '',
      lastMessageAt: Date.now(),
      unreadAdmin: 0,
      unreadTenant: 0,
      adminId: ownerEntry.adminId,
      ownerEmail: ownerEntry.ownerEmail,
      ownerName: ownerEntry.ownerName,
    };
    setDocumentNonBlocking(chatRef, chatData, { merge: true });
  }, [chatId, ownerEntry.adminId]);

  // Mark as read when owner opens
  useEffect(() => {
    if (!db || !chatRef) return;
    setDocumentNonBlocking(chatRef, { unreadTenant: 0 }, { merge: true });
  }, [chatId]);

  // ── Messages ──
  const messagesQ = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats', chatId, 'mensajes'),
      orderBy('ts'),
    );
  }, [db, chatId]);
  const { data: messagesRaw } = useCollection<ChatMessage>(messagesQ);
  const messages = useMemo(() => messagesRaw ?? [], [messagesRaw]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send ──
  const handleSend = async () => {
    const txt = messageText.trim();
    if (!txt || !db || !chatRef) return;
    setIsSending(true);
    const msgId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now   = Date.now();
    const msgRef = doc(db, 'artifacts', APP_ID, 'sharedChats', chatId, 'mensajes', msgId);
    const msg: ChatMessage = {
      id: msgId, text: txt, sender: 'owner',
      senderName: ownerEntry.ownerName, ts: now,
    };
    setDocumentNonBlocking(msgRef, msg, {});
    setDocumentNonBlocking(chatRef, {
      lastMessage: txt,
      lastMessageAt: now,
      unreadTenant: 0,
      unreadAdmin: increment(1),
    }, { merge: true });
    writePropertyEvent(db, ownerEntry.adminId, {
      propertyId: ownerEntry.propertyIds[0] ?? '',
      propertyName: ownerEntry.propertyNames[0] ?? '',
      type: 'message_owner',
      title: `${ownerEntry.ownerName} → Administración`,
      detail: txt.length > 140 ? txt.slice(0, 140) + '…' : txt,
      actor: ownerEntry.ownerName,
      actorRole: 'owner',
      ts: now,
      metadata: { chatId },
    });
    setMessageText('');
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black">Mensajes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Comunicación directa con la administración</p>
      </div>

      {/* Chat box */}
      <div className="flex flex-col h-[calc(100vh-17rem)] rounded-2xl overflow-hidden border shadow-sm bg-white">

        {/* Header */}
        <div className="px-5 py-4 border-b bg-white flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">
            A
          </div>
          <div>
            <p className="text-sm font-black">Administración</p>
            <p className="text-[10px] text-muted-foreground">
              {ownerEntry.propertyNames[0] ?? 'Portal Propietario'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">Sin mensajes aún</p>
              <p className="text-xs mt-1">Escribí tu consulta a la administración</p>
            </div>
          )}
          {messages.map(m => {
            const isOwner = m.sender === 'owner';
            return (
              <div key={m.id} className={cn('flex', isOwner ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                  isOwner
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-white border text-foreground rounded-bl-sm',
                )}>
                  <p className="text-sm leading-relaxed">{m.text}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    isOwner ? 'text-emerald-200 text-right' : 'text-muted-foreground',
                  )}>
                    {formatTimeLabel(m.ts)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white flex items-end gap-3">
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje a la administración…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border/60 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            className="h-10 w-10 p-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
