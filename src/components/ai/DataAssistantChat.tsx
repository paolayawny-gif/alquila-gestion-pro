"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Navigation } from 'lucide-react';
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

// Mapa completo de tabs de la app
const NAV_MAP: { pattern: RegExp; tab: string; label: string }[] = [
  { pattern: /\b(panel|dashboard|inicio|resumen|home)\b/i,              tab: 'Resumen',               label: 'Panel de Control' },
  { pattern: /\bpropiedades?\b/i,                                        tab: 'Propiedades',           label: 'Propiedades' },
  { pattern: /\b(personas?|inquilinos?|propietarios?|contactos?)\b/i,   tab: 'Personas',              label: 'Personas y Contratos' },
  { pattern: /\bcontratos?\s*(smart|inteligente)?\b/i,                   tab: 'Contratos Smart',       label: 'Contratos Smart' },
  { pattern: /\b(generador|generar|crear)\s*contrato\b/i,               tab: 'Generador Contratos',   label: 'Generador Contratos' },
  { pattern: /\b(garantías?|depósitos?)\b/i,                             tab: 'Garantías',             label: 'Garantías y Depósitos' },
  { pattern: /\b(facturas?|servicios?|facturación)\b/i,                  tab: 'Facturas',              label: 'Facturas y Servicios' },
  { pattern: /\b(mantenimiento\s*predictivo|predictivo)\b/i,             tab: 'Mantenimiento Predictivo', label: 'Mantenimiento Predictivo' },
  { pattern: /\bmantenimiento\b/i,                                       tab: 'Mantenimiento',         label: 'Mantenimiento' },
  { pattern: /\b(solicitudes?|pedidos?)\b/i,                             tab: 'Solicitudes',           label: 'Solicitudes' },
  { pattern: /\b(visitas?)\b/i,                                          tab: 'Visitas',               label: 'Visitas' },
  { pattern: /\b(proveedores?)\b/i,                                      tab: 'Proveedores',           label: 'Proveedores' },
  { pattern: /\b(mensajes?|comunicaciones?)\b/i,                         tab: 'Mensajes',              label: 'Mensajes' },
  { pattern: /\b(rentas?\s*híbridas?|híbridas?)\b/i,                    tab: 'Rentas Híbridas',       label: 'Rentas Híbridas' },
  { pattern: /\b(liquidaciones?|liquidar)\b/i,                           tab: 'Liquidaciones',         label: 'Liquidaciones' },
  { pattern: /\b(libro\s*mayor|contabilidad)\b/i,                        tab: 'Libro Mayor',           label: 'Libro Mayor' },
  { pattern: /\b(legales?|legal|juicio)\b/i,                             tab: 'Legales',               label: 'Legales' },
  { pattern: /\b(reportes?|analytics?|análisis\s*ia|ia\s*análisis)\b/i, tab: 'Análisis IA',           label: 'Análisis IA' },
  { pattern: /\b(reportes?|estadísticas?)\b/i,                           tab: 'Reportes',              label: 'Reportes' },
  { pattern: /\b(índices?|icl|ipc|cer|bcra)\b/i,                        tab: 'Índices',               label: 'Índices' },
  { pattern: /\b(cronograma|agenda|calendario)\b/i,                      tab: 'Cronograma',            label: 'Cronograma' },
  { pattern: /\b(simulador\s*roi|roi)\b/i,                               tab: 'Simulador ROI',         label: 'Simulador ROI' },
  { pattern: /\b(redes\s*sociales?|social\s*media|marketing|instagram|facebook)\b/i, tab: 'Redes Sociales', label: 'Redes Sociales' },
  { pattern: /\b(seguros?)\b/i,                                          tab: 'Seguros',               label: 'Seguros' },
  { pattern: /\b(monetización|monetizar)\b/i,                            tab: 'Monetización',          label: 'Monetización' },
  { pattern: /\b(comunidad|comunal|votaciones?)\b/i,                     tab: 'Comunidad',             label: 'Comunidad' },
  { pattern: /\b(marketplace|mercado)\b/i,                               tab: 'Marketplace',           label: 'Marketplace' },
  { pattern: /\b(concierge)\b/i,                                         tab: 'Concierge',             label: 'Concierge' },
  { pattern: /\b(configuración|config|ajustes\s*generales)\b/i,          tab: 'Configuración',         label: 'Configuración' },
  { pattern: /\b(ayuda|help|soporte)\b/i,                                tab: 'Ayuda',                 label: 'Ayuda' },
];

function navigateToTab(tab: string) {
  window.dispatchEvent(new CustomEvent('alquila-navigate', { detail: { tab } }));
}

function detectNavOnly(q: string): { tab: string; label: string } | null {
  const trimmed = q.trim();
  // Solo si es un comando corto sin signo de pregunta
  if (trimmed.length > 50 || trimmed.includes('?')) return null;
  for (const { pattern, tab, label } of NAV_MAP) {
    if (pattern.test(trimmed)) return { tab, label };
  }
  return null;
}

export function DataAssistantChat() {
  const { user } = useUser();
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
          content: 'Hola! Podés preguntarme sobre tus datos o pedirme que te lleve a cualquier sección.',
          followUps: ['¿Qué propiedades están disponibles?', '¿Hay contratos próximos a vencer?', 'Ir a redes sociales'],
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
      navigateToTab(navOnly.tab);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Te llevo a ${navOnly.label}.`,
        navigated: navOnly.label,
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

      // Si la IA sugiere navegar, hacerlo
      if (data.navigateTo) {
        const match = NAV_MAP.find(n => n.tab === data.navigateTo);
        if (match) navigateToTab(match.tab);
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
        <span className="text-[10px] font-semibold text-accent bg-popover/90 backdrop-blur rounded-full px-2 py-0.5 shadow -mt-1 border border-accent/20">
          AGP Help
        </span>
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 flex flex-col w-[360px] max-h-[560px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 origin-bottom-right bg-popover border text-popover-foreground',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-accent text-accent-foreground">
          <div className="flex items-center gap-2">
            <HouseMascot size={44} animate mood="happy" />
            <div>
              <p className="font-semibold text-sm leading-none">AGP Help</p>
              <p className="text-xs text-accent-foreground/70 mt-0.5">Solo tus datos · Gemini Flash</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent/80 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 bg-muted/40">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
              {msg.role === 'assistant' && (
                <div className="flex items-end gap-1.5 max-w-[90%]">
                  <HouseMascot size={28} mood="happy" className="flex-shrink-0 mb-0.5" />
                  <div className="rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm bg-popover border text-popover-foreground">
                    {msg.content}
                  </div>
                </div>
              )}
              {msg.role === 'user' && (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-accent text-accent-foreground">
                  {msg.content}
                </div>
              )}
              {msg.navigated && (
                <div className="mt-1 flex items-center gap-1 text-xs text-accent ml-8">
                  <Navigation className="h-3 w-3" />
                  Navegando a {msg.navigated}
                </div>
              )}
              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 items-start w-full ml-8">
                  {msg.followUps.map((q, j) => (
                    <button
                      key={j}
                      onClick={() => handleSend(q)}
                      disabled={loading}
                      className="text-xs rounded-full px-3 py-1 transition-colors text-left disabled:opacity-50 text-accent bg-accent/10 border border-accent/20"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-1.5">
              <HouseMascot size={28} mood="thinking" className="flex-shrink-0 mb-0.5" />
              <div className="rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm bg-popover border">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-3 border-t bg-popover">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Preguntá o decí 'ir a redes sociales'..."
            disabled={loading}
            className="flex-1 text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent border border-border bg-muted/40 text-foreground disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2 bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-accent-foreground rounded-xl transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
