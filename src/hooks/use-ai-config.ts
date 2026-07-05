"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { APP_ID } from '@/lib/constants';
import type { AIConfig } from '@/lib/types';

interface UseAIConfigResult {
  /** API key de Gemini del admin, o null si no cargó ninguna. */
  apiKey: string | null;
  loading: boolean;
}

/** Lee la config de IA del admin (artifacts/{APP_ID}/users/{userId}/config/aiConfig). */
export function useAIConfig(userId?: string): UseAIConfigResult {
  const db = useFirestore();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'aiConfig'))
      .then(snap => {
        if (cancelled) return;
        const data = snap.exists() ? (snap.data() as AIConfig) : null;
        setApiKey(data?.geminiApiKey?.trim() || null);
      })
      .catch(() => { if (!cancelled) setApiKey(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [db, userId]);

  return { apiKey, loading };
}
