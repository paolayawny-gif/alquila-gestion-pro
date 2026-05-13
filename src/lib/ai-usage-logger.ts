'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const APP_ID = 'alquilagestion-pro';

export type AIFeature =
  | 'analyze-contract-risks'
  | 'verify-consistency'
  | 'compare-market'
  | 'query-contract'
  | 'analyze-application'
  | 'ai-communication'
  | 'rich-communication'
  | 'generate-contract'
  | 'extract-contract-data'
  | 'extract-invoice-data'
  | 'help-assistant'
  | 'social-content'
  | 'extract-template';

export const FEATURE_LABELS: Record<AIFeature, string> = {
  'analyze-contract-risks': 'Análisis de riesgo legal',
  'verify-consistency': 'Coherencia del contrato',
  'compare-market': 'Comparación con mercado',
  'query-contract': 'Consulta legal al contrato',
  'analyze-application': 'Análisis de solicitud',
  'ai-communication': 'Comunicación IA',
  'rich-communication': 'Comunicación enriquecida',
  'generate-contract': 'Generación de contrato',
  'extract-contract-data': 'Extracción de contrato',
  'extract-invoice-data': 'Extracción de factura',
  'help-assistant': 'Asistente de ayuda',
  'social-content': 'Contenido para redes',
  'extract-template': 'Análisis de plantilla',
};

export interface AIUsageLog {
  feature: AIFeature;
  model: string;
  isPro: boolean;
  ok: boolean;
  ts: string;
}

export async function logAIUsage(
  userId: string,
  feature: AIFeature,
  model: string,
  isPro: boolean,
  ok: boolean,
): Promise<void> {
  try {
    const db = getAdminDb();
    await db
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users')
      .doc(userId)
      .collection('aiUsageLogs')
      .add({
        feature,
        model,
        isPro,
        ok,
        ts: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch {
    // Logging failures must never break the main flow
  }
}
