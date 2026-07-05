import Anthropic from '@anthropic-ai/sdk';
import type { AIProviderAdapter, ProviderCallOptions } from './types';
import { PROVIDER_DEFAULT_MODEL } from './types';

const clients = new Map<string, Anthropic>();

function getClient(apiKey: string): Anthropic {
  let client = clients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    clients.set(apiKey, client);
  }
  return client;
}

function textFromMessage(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function parseDataUri(dataUri: string) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');
  return { mimeType: match[1], data: match[2] };
}

// Claude no tiene un "modo JSON" nativo como Gemini/OpenAI — se le pide
// explícitamente que responda solo con el JSON, sin texto ni markdown.
const JSON_ONLY_SUFFIX = '\n\nRespondé ÚNICAMENTE con el JSON solicitado, sin texto adicional ni bloques de markdown.';

export const anthropicProvider: AIProviderAdapter = {
  async generateText(systemPrompt, userMessage, opts: ProviderCallOptions) {
    const client = getClient(opts.apiKey);
    const msg = await client.messages.create({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.anthropic,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    return textFromMessage(msg);
  },

  async generateJSON<T>(prompt: string, opts: ProviderCallOptions): Promise<T> {
    const client = getClient(opts.apiKey);
    const msg = await client.messages.create({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.anthropic,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt + JSON_ONLY_SUFFIX }],
    });
    return JSON.parse(stripJsonFences(textFromMessage(msg))) as T;
  },

  async generateJSONWithMedia<T>(prompt: string, mediaDataUri: string, opts: ProviderCallOptions): Promise<T> {
    const client = getClient(opts.apiKey);
    const { mimeType, data } = parseDataUri(mediaDataUri);
    const msg = await client.messages.create({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.anthropic,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as any, data } },
          { type: 'text', text: prompt + JSON_ONLY_SUFFIX },
        ],
      }],
    });
    return JSON.parse(stripJsonFences(textFromMessage(msg))) as T;
  },
};
