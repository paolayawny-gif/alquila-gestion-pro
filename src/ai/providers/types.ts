export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export const AI_PROVIDERS: { value: AIProvider; label: string; keyUrl: string; keyHint: string }[] = [
  { value: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza...' },
  { value: 'openai', label: 'ChatGPT (OpenAI)', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-...' },
  { value: 'anthropic', label: 'Claude (Anthropic)', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-...' },
  { value: 'deepseek', label: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-...' },
];

/** Modelo fijo por proveedor — el admin no elige modelo, solo proveedor + key. */
export const PROVIDER_DEFAULT_MODEL: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  deepseek: 'deepseek-chat',
};

/** Gemini es el único proveedor con variante "Pro" seleccionable hoy. */
export const GEMINI_PRO_MODEL = 'gemini-2.5-pro';

export interface ProviderCallOptions {
  apiKey: string;
  modelName?: string;
}

export interface AIProviderAdapter {
  /** Devuelve texto plano (para el asistente de chat, con su propio system prompt). */
  generateText(systemPrompt: string, userMessage: string, opts: ProviderCallOptions): Promise<string>;
  /** Devuelve un objeto ya parseado desde JSON. */
  generateJSON<T>(prompt: string, opts: ProviderCallOptions): Promise<T>;
  /** Igual que generateJSON pero adjuntando un archivo (imagen/PDF) en base64. */
  generateJSONWithMedia<T>(prompt: string, mediaDataUri: string, opts: ProviderCallOptions): Promise<T>;
}

export class UnsupportedMediaError extends Error {
  constructor(provider: AIProvider) {
    super(`El proveedor ${provider} no soporta análisis de imágenes o PDF. Elegí Gemini, OpenAI o Claude para esta función.`);
    this.name = 'UnsupportedMediaError';
  }
}
