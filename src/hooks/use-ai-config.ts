"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { APP_ID } from '@/lib/constants';
import type { AIConfig } from '@/lib/types';
import type { AIProvider } from '@/ai/providers';

interface UseAIConfigResult {
  /** API key del admin para su proveedor elegido, o null si no cargó ninguna. */
  apiKey: string | null;
  /** Proveedor elegido (gemini por default, incluso en configs viejas que solo tenían geminiApiKey). */
  provider: AIProvider;
  loading: boolean;
}

/** Lee la config de IA del admin (artifacts/{APP_ID}/users/{userId}/config/aiConfig). */
export function useAIConfig(userId?: string): UseAIConfigResult {
  const db = useFirestore();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'aiConfig'))
      .then(snap => {
        if (cancelled) return;
        const data = snap.exists() ? (snap.data() as AIConfig) : null;
        // Configuraciones viejas solo tenían geminiApiKey (sin provider) — se
        // interpretan como Gemini para no perder la key ya cargada.
        setApiKey(data?.apiKey?.trim() || data?.geminiApiKey?.trim() || null);
        setProvider((data?.provider as AIProvider) ?? 'gemini');
      })
      .catch(() => { if (!cancelled) { setApiKey(null); setProvider('gemini'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [db, userId]);

  return { apiKey, provider, loading };
}
