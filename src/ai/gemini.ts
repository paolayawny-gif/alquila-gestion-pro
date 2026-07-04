import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

const envApiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  '';

const defaultClient = new GoogleGenerativeAI(envApiKey);
const customClients = new Map<string, GoogleGenerativeAI>();

function getClient(apiKey?: string): GoogleGenerativeAI {
  if (!apiKey) return defaultClient;
  let client = customClients.get(apiKey);
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
    customClients.set(apiKey, client);
  }
  return client;
}

export interface AIOptions {
  /** Modelo a usar. Default: 'gemini-2.5-flash'. */
  modelName?: string;
  /** API key propia del admin (ej. para desbloquear un modelo Pro). Si no se pasa, usa la key compartida de la plataforma. */
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
