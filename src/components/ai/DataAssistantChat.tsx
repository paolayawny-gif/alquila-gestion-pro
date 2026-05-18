"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { authedFetch } from '@/lib/authed-fetch';
import { cn } from '@/lib/utils';
import { HouseMascot } from '@/components/ai/HouseMascot';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  followUps?: string[];
  navigated?: string;
}

// Detección client-side para navegación pura (sin llamada a la API)
const NAV_MAP: { pattern: RegExp; route: string; label: string }[] = [
  { pattern: /\b(ir a |abrir |ver |mostrar )?(el |la )?(panel|dashboard|inicio|home)\b/i, route: '/dashboard', label: 'Panel' },
  { pattern: /\b(ir a |abrir |ver |mostrar )?(las? )?propiedades?\b/i, route: '/propiedades', label: 'Propiedades' },
  { pattern: /\b(ir a |abrir |ver |mostrar )?(los? )?contratos?\b/i, route: '/contratos', label: 'Contratos' },
  { pattern: /\b(ir a |abrir |ver |mostrar )?(los? )?pagos?\b/i, route: '/pagos', label: 'Pagos' },
  { pattern: /\b(ir a |abrir |ver |mostrar )?(las? )?(personas?|inquilinos?|propietarios?)\b/i, route: '/personas', label: 'Personas' },
];

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Panel',
  '/propiedades': 'Propiedades',
  '/contratos': 'Contratos',
  '/pagos': 'Pagos',
  '/personas': 'Personas',
};

function detectNavOnly(q: string): { route: string; label: string } | null {
  const trimmed = q.trim();
  for (const { pattern, route, label } of NAV_MAP) {
    // Si el mensaje es SOLO navegación (corto y sin signo de pregunta)
    if (pattern.test(trimmed) && trimmed.length < 40 && !trimmed.includes('?')) {
      return { route, label };
    }
  }
  return null;
}

export function DataAssistantChat() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: 'Hola! Podés preguntarme sobre tus datos o pedirme que te lleve a alguna sección.',
          followUps: ['¿Qué propiedades están disponibles?', '¿Hay contratos próximos a vencer?', 'Ir a contratos'],
        }]);
      }
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!user) return null;

  async function handleSend(question?: string) {
    const q = (question ?? input).trim();
    if (!q || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);

    // Navegación pura — instantánea, sin API
    const navOnly = detectNavOnly(q);
    if (navOnly) {
      router.push(navOnly.route);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Te llevo a ${navOnly.label}.`,
        navigated: navOnly.route,
      }]);
      return;
    }

    setLoading(true);
    try {
      const res = await authedFetch('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ adminId: user!.uid, question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error del servidor');

      // Si la IA indica navegar, hacerlo
      if (data.navigateTo && ROUTE_LABELS[data.navigateTo]) {
        router.push(data.navigateTo);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        followUps: data.followUpQuestions,
        navigated: data.navigateTo,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `No pude procesar tu consulta: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex flex-col items-center gap-0 transition-all duration-200 group',
          open && 'opacity-0 pointer-events-none scale-90'
        )}
        aria-label="Abrir asistente IA"
      >
        <HouseMascot size={56} animate className="drop-shadow-lg group-hover:-translate-y-1 transition-transform duration-200" mood="waving" />
        <span className="text-[10px] font-semibold text-emerald-700 bg-white/90 backdrop-blur rounded-full px-2 py-0.5 shadow -mt-1 border border-emerald-100">
          Asistente IA
        </span>
      </button>

      {/* Chat panel — colores forzados para que no los pise el dark mode */}
      <div className={cn(
        'fixed bottom-6 right-6 z-50 flex flex-col w-[360px] max-h-[560px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 origin-bottom-right',
        open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      )} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <HouseMascot size={44} animate mood="happy" />
            <div>
              <p className="font-semibold text-sm leading-none">Asistente IA</p>
              <p className="text-xs text-emerald-100 mt-0.5">Solo tus datos · Gemini Flash</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-emerald-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ backgroundColor: '#f9fafb' }}>
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
              {msg.role === 'assistant' && (
                <div className="flex items-end gap-1.5 max-w-[90%]">
                  <HouseMascot size={28} mood="happy" className="flex-shrink-0 mb-0.5" />
                  <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              )}
              {msg.role === 'user' && (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-emerald-600 text-white">
                  {msg.content}
                </div>
              )}
              {msg.navigated && ROUTE_LABELS[msg.navigated] && (
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <Navigation className="h-3 w-3" />
                  Navegando a {ROUTE_LABELS[msg.navigated]}
                </div>
              )}
              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 items-start w-full">
                  {msg.followUps.map((q, j) => (
                    <button
                      key={j}
                      onClick={() => handleSend(q)}
                      disabled={loading}
                      className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full px-3 py-1 transition-colors text-left disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Preguntá o decí 'ir a contratos'..."
            disabled={loading}
            className="flex-1 text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
