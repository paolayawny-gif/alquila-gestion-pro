'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

const APP_ID = 'alquilagestion-pro';

export interface AIConfig {
  geminiApiKey: string;
  updatedAt: string;
}

export function useAIConfig() {
  const { user } = useUser();
  const db = useFirestore();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db || !user?.uid) { setLoading(false); return; }
    getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'aiConfig'))
      .then(snap => { if (snap.exists()) setConfig(snap.data() as AIConfig); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [db, user?.uid]);

  async function save(geminiApiKey: string): Promise<boolean> {
    if (!db || !user?.uid) return false;
    setSaving(true);
    try {
      const data: AIConfig = { geminiApiKey: geminiApiKey.trim(), updatedAt: new Date().toISOString() };
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'aiConfig'),
        data,
        { merge: true },
      );
      setConfig(data);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<boolean> {
    if (!db || !user?.uid) return false;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'aiConfig'),
        { geminiApiKey: '', updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setConfig(null);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    config,
    loading,
    saving,
    hasProKey: !!config?.geminiApiKey,
    proKey: config?.geminiApiKey ?? null,
    save,
    remove,
  };
}
