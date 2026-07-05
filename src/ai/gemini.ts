import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

const customClients = new Map<string, GoogleGenerativeAI>();

/**
 * Cada admin trae su propia API key de Gemini — no existe una key compartida
 * de la plataforma. El costo de cada llamada lo paga quien la usa, nunca
 * AlquilaGestión Pro. Si no hay key, esto lanza en vez de caer a un cliente
 * compartido en silencio.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super('MISSING_API_KEY');
    this.name = 'MissingApiKeyError';
  }
}

function getClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey?.trim();
  if (!key) throw new MissingApiKeyError();
  let client = customClients.get(key);
  if (!client) {
    client = new GoogleGenerativeAI(key);
    customClients.set(key, client);
  }
  return client;
}

export interface AIOptions {
  /** Modelo a usar. Default: 'gemini-2.5-flash'. */
  modelName?: string;
  /** API key de Gemini del admin. Obligatoria — no hay key compartida de respaldo. */
  apiKey?: string;
}

export function getModel(opts: AIOptions = {}): GenerativeModel {
  return getClient(opts.apiKey).getGenerativeModel({
    model: opts.modelName ?? 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
}

export async function generateJSON<T>(prompt: string, opts: AIOptions = {}): Promise<T> {
  const model = getModel(opts);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}

export async function generateJSONWithMedia<T>(
  prompt: string,
  mediaDataUri: string,
  opts: AIOptions = {},
): Promise<T> {
  const model = getModel(opts);
  const match = mediaDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');
  const [, mimeType, data] = match;
  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data } },
  ]);
  const text = result.response.text();
  return JSON.parse(text) as T;
}
