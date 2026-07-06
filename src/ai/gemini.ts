import { getProviderAdapter, type AIProvider } from '@/ai/providers';

/**
 * Cada admin trae su propia API key — de Gemini, ChatGPT, Claude o DeepSeek,
 * a elección. No existe una key compartida de la plataforma: el costo de
 * cada llamada lo paga quien la usa, nunca AlquilaGestión Pro. Si no hay
 * key, esto lanza en vez de caer a un cliente compartido en silencio.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super('MISSING_API_KEY');
    this.name = 'MissingApiKeyError';
  }
}

export interface AIOptions {
  /** Proveedor elegido por el admin. Default: 'gemini' (retrocompatibilidad). */
  provider?: AIProvider;
  /** Sobreescribe el modelo fijo por defecto de ese proveedor (uso interno, ej. Gemini Pro). */
  modelName?: string;
  /** API key del admin para el proveedor elegido. Obligatoria — no hay key compartida de respaldo. */
  apiKey?: string;
}

function requireKey(opts: AIOptions): string {
  const key = opts.apiKey?.trim();
  if (!key) throw new MissingApiKeyError();
  return key;
}

export async function generateJSON<T>(prompt: string, opts: AIOptions = {}): Promise<T> {
  const apiKey = requireKey(opts);
  const adapter = getProviderAdapter(opts.provider);
  return adapter.generateJSON<T>(prompt, { apiKey, modelName: opts.modelName });
}

export async function generateJSONWithMedia<T>(
  prompt: string,
  mediaDataUri: string,
  opts: AIOptions = {},
): Promise<T> {
  const apiKey = requireKey(opts);
  const adapter = getProviderAdapter(opts.provider);
  return adapter.generateJSONWithMedia<T>(prompt, mediaDataUri, { apiKey, modelName: opts.modelName });
}

/** Para el asistente de chat: system prompt + mensaje de usuario, devuelve texto plano. */
export async function generateText(systemPrompt: string, userMessage: string, opts: AIOptions = {}): Promise<string> {
  const apiKey = requireKey(opts);
  const adapter = getProviderAdapter(opts.provider);
  return adapter.generateText(systemPrompt, userMessage, { apiKey, modelName: opts.modelName });
}
