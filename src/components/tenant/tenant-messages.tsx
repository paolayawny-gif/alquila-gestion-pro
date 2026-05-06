'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Building2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { TenantRegistryEntry } from './tenant-portal';

const APP_ID = 'alquilagestion-pro';

interface SharedChat {
  id: string;
  adminId: string;
  adminEmail: string;
  tenantEmail: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadAdmin: number;
  unreadTenant: number;
}

interface SharedMessage {
  id: string;
  text: string;
  sender: 'admin' | 'tenant';
  senderName: string;
  senderId: string;
  ts: number;
}

interface TenantMessagesProps {
  tenantEntry: TenantRegistryEntry;
}

export function TenantMessages({ tenantEntry }: TenantMessagesProps) {
  const db = useFirestore();
  const { user } = useUser();
  const [messageText, setMessageText] = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // All chats for this tenant (could be multiple properties in future)
  const chatsQ = useMemoFirebase(() => {
    if (!db || !tenantEntry.tenantEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats'),
      where('tenantEmail', '==', tenantEntry.tenantEmail),
    );
  }, [db, tenantEntry.tenantEmail]);
  const { data: chatsRaw } = useCollection<SharedChat>(chatsQ);
  const chats = chatsRaw ?? [];

  // Auto-select or auto-create chat with admin
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats]);

  // Create chat if none exists
  useEffect(() => {
    if (!db || !user || chatsRaw === undefined || chatsRaw === null) return;
    if (chatsRaw.length === 0) {
      const chatId  = `chat_${tenantEntry.adminId}_${tenantEntry.tenantEmail.replace(/[@.]/g, '_')}_${tenantEntry.propertyId}`;
      const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', chatId);
      const chat: SharedChat = {
        id: chatId,
        adminId: tenantEntry.adminId,
        adminEmail: '',
        tenantEmail: tenantEntry.tenantEmail,
        tenantName: tenantEntry.tenantName,
        propertyId: tenantEntry.propertyId,
        propertyName: tenantEntry.propertyName,
        lastMessage: '',
        lastMessageAt: Date.now(),
        unreadAdmin: 0,
        unreadTenant: 0,
      };
      setDocumentNonBlocking(chatRef, chat, {});
      setSelectedChatId(chatId);
    }
  }, [chatsRaw, db, user, tenantEntry]);

  // Messages for selected chat
  const messagesQ = useMemoFirebase(() => {
    if (!db || !selectedChatId) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId, 'mensajes'),
      orderBy('ts'),
    );
  }, [db, selectedChatId]);
  const { data: messagesRaw } = useCollection<SharedMessage>(messagesQ);
  const messages = messagesRaw ?? [];

  const selectedChat = chats.find(c => c.id === selectedChatId) ?? null;

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when tenant opens chat
  useEffect(() => {
    if (!db || !selectedChatId || !selectedChat || selectedChat.unreadTenant === 0) return;
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId);
    setDocumentNonBlocking(chatRef, { unreadTenant: 0 }, { merge: true });
  }, [selectedChatId, db]);

  const handleSend = async () => {
    const txt = messageText.trim();
    if (!txt || !selectedChatId || !user || !db) return;
    setIsSending(true);
    const msgId  = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now    = Date.now();
    const msgRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId, 'mensajes', msgId);
    const msg: SharedMessage = {
      id: msgId, text: txt, sender: 'tenant',
      senderName: tenantEntry.tenantName,
      senderId: user.uid, ts: now,
    };
    setDocumentNonBlocking(msgRef, msg, {});
    const chatRef = doc(db, 'artifacts', APP_ID, 'sharedChats', selectedChatId);
    setDocumentNonBlocking(chatRef, {
      lastMessage: txt, lastMessageAt: now, unreadAdmin: (selectedChat?.unreadAdmin ?? 0) + 1,
    }, { merge: true });
    setMessageText('');
    setIsSending(false);
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div>
        <h1 className="text-2xl font-black">Mensajes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Chat directo con la administración de tu propiedad.
        </p>
      </div>

      <div className="flex h-[calc(100vh-15rem)] rounded-2xl overflow-hidden border shadow-sm bg-white">

        {/* Chat list (future: multiple properties) */}
        {chats.length > 1 && (
          <div className="w-64 border-r flex flex-col shrink-0">
            <div className="p-4 border-b">
              <p className="font-black text-sm">Mis Chats</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b hover:bg-muted/40 transition-colors border-l-[3px]',
                    selectedChatId === chat.id
                      ? 'bg-primary/5 border-l-primary'
                      : 'border-l-transparent',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-black shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{chat.propertyName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{chat.lastMessage || 'Sin mensajes aún'}</p>
                    </div>
                    {chat.unreadTenant > 0 && (
                      <span className="bg-primary text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shrink-0">
                        {chat.unreadTenant}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat window */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-14 border-b px-5 flex items-center gap-3 shrink-0 bg-white">
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-black shrink-0">
              A
            </div>
            <div>
              <p className="font-black text-sm leading-tight">Administración</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{selectedChat?.propertyName}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-muted/10">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground/40 text-xs py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Aún no hay mensajes. Escribí para empezar.</p>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender === 'tenant';
              return (
                <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                  {!isMe && (
                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mr-2 mt-1">A</div>
                  )}
                  <div className={cn('max-w-[72%]')}>
                    <div className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                      isMe
                        ? 'bg-primary text-white rounded-br-none'
                        : 'bg-white text-foreground rounded-bl-none border border-muted',
                    )}>
                      {msg.text}
                    </div>
                    <p className={cn('text-[9px] text-muted-foreground px-1 mt-0.5', isMe ? 'text-right' : '')}>
                      {new Date(msg.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex items-center gap-2 shrink-0 bg-white">
            <Input
              placeholder="Escribe un mensaje..."
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="flex-1 bg-muted/30 border-muted rounded-xl"
            />
            <button
              onClick={handleSend}
              disabled={!messageText.trim() || isSending}
              className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                messageText.trim()
                  ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
