'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { FEATURE_LABELS, type AIFeature } from '@/lib/ai-usage-logger';

const APP_ID = 'alquilagestion-pro';

export interface AIUsageEntry {
  id: string;
  feature: AIFeature;
  model: string;
  isPro: boolean;
  ok: boolean;
  ts: string;
}

export interface AIUsageStats {
  totalCalls: number;
  totalOk: number;
  totalFailed: number;
  proCalls: number;
  flashCalls: number;
  byFeature: { feature: AIFeature; label: string; count: number; proCalls: number }[];
  recent: AIUsageEntry[];
  loading: boolean;
}

export function useAIUsage(days = 30): AIUsageStats {
  const { user } = useUser();
  const db = useFirestore();
  const [stats, setStats] = useState<AIUsageStats>({
    totalCalls: 0, totalOk: 0, totalFailed: 0,
    proCalls: 0, flashCalls: 0,
    byFeature: [], recent: [], loading: true,
  });

  useEffect(() => {
    if (!db || !user?.uid) { setStats(s => ({ ...s, loading: false })); return; }

    const since = new Date();
    since.setDate(since.getDate() - days);

    getDocs(
      query(
        collection(db, 'artifacts', APP_ID, 'users', user.uid, 'aiUsageLogs'),
        where('ts', '>=', since.toISOString()),
        orderBy('ts', 'desc'),
        limit(500),
      )
    ).then(snap => {
      const entries: AIUsageEntry[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<AIUsageEntry, 'id'>),
      }));

      const byFeatureMap = new Map<AIFeature, { count: number; proCalls: number }>();
      let totalOk = 0, totalFailed = 0, proCalls = 0, flashCalls = 0;

      for (const e of entries) {
        if (e.ok) totalOk++; else totalFailed++;
        if (e.isPro) proCalls++; else flashCalls++;
        const cur = byFeatureMap.get(e.feature) ?? { count: 0, proCalls: 0 };
        byFeatureMap.set(e.feature, {
          count: cur.count + 1,
          proCalls: cur.proCalls + (e.isPro ? 1 : 0),
        });
      }

      const byFeature = Array.from(byFeatureMap.entries())
        .map(([feature, val]) => ({
          feature,
          label: FEATURE_LABELS[feature] ?? feature,
          count: val.count,
          proCalls: val.proCalls,
        }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalCalls: entries.length,
        totalOk,
        totalFailed,
        proCalls,
        flashCalls,
        byFeature,
        recent: entries.slice(0, 20),
        loading: false,
      });
    }).catch(() => setStats(s => ({ ...s, loading: false })));
  }, [db, user?.uid, days]);

  return stats;
}
