import OpenAI from 'openai';
import type { AIProviderAdapter, ProviderCallOptions } from './types';
import { PROVIDER_DEFAULT_MODEL, UnsupportedMediaError } from './types';

const clients = new Map<string, OpenAI>();

function getClient(apiKey: string, baseURL?: string): OpenAI {
  const cacheKey = `${baseURL ?? 'default'}:${apiKey}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey, baseURL });
    clients.set(cacheKey, client);
  }
  return client;
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

/**
 * Adaptador compartido para OpenAI y DeepSeek — DeepSeek expone una API
 * compatible con la de OpenAI, solo cambia el baseURL y el modelo.
 */
function buildOpenAICompatibleProvider(defaultModel: string, baseURL?: string, supportsVision = true): AIProviderAdapter {
  return {
    async generateText(systemPrompt, userMessage, opts: ProviderCallOptions) {
      const client = getClient(opts.apiKey, baseURL);
      const res = await client.chat.completions.create({
        model: opts.modelName ?? defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      return res.choices[0]?.message?.content ?? '';
    },

    async generateJSON<T>(prompt: string, opts: ProviderCallOptions): Promise<T> {
      const client = getClient(opts.apiKey, baseURL);
      const res = await client.chat.completions.create({
        model: opts.modelName ?? defaultModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      const text = res.choices[0]?.message?.content ?? '{}';
      return JSON.parse(stripJsonFences(text)) as T;
    },

    async generateJSONWithMedia<T>(prompt: string, mediaDataUri: string, opts: ProviderCallOptions): Promise<T> {
      if (!supportsVision) throw new UnsupportedMediaError('deepseek');
      const client = getClient(opts.apiKey, baseURL);
      const res = await client.chat.completions.create({
        model: opts.modelName ?? defaultModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: mediaDataUri } },
          ],
        }],
        response_format: { type: 'json_object' },
      });
      const text = res.choices[0]?.message?.content ?? '{}';
      return JSON.parse(stripJsonFences(text)) as T;
    },
  };
}

export const openaiProvider = buildOpenAICompatibleProvider(PROVIDER_DEFAULT_MODEL.openai);
export const deepseekProvider = buildOpenAICompatibleProvider(
  PROVIDER_DEFAULT_MODEL.deepseek,
  'https://api.deepseek.com',
  /* supportsVision */ false,
);
