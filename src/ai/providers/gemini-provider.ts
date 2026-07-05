import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProviderAdapter, ProviderCallOptions } from './types';
import { PROVIDER_DEFAULT_MODEL } from './types';

const clients = new Map<string, GoogleGenerativeAI>();

function getClient(apiKey: string): GoogleGenerativeAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
    clients.set(apiKey, client);
  }
  return client;
}

function parseDataUri(dataUri: string) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');
  return { mimeType: match[1], data: match[2] };
}

export const geminiProvider: AIProviderAdapter = {
  async generateText(systemPrompt, userMessage, opts: ProviderCallOptions) {
    const model = getClient(opts.apiKey).getGenerativeModel({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.gemini,
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userMessage);
    return result.response.text();
  },

  async generateJSON<T>(prompt: string, opts: ProviderCallOptions): Promise<T> {
    const model = getClient(opts.apiKey).getGenerativeModel({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.gemini,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as T;
  },

  async generateJSONWithMedia<T>(prompt: string, mediaDataUri: string, opts: ProviderCallOptions): Promise<T> {
    const model = getClient(opts.apiKey).getGenerativeModel({
      model: opts.modelName ?? PROVIDER_DEFAULT_MODEL.gemini,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const { mimeType, data } = parseDataUri(mediaDataUri);
    const result = await model.generateContent([prompt, { inlineData: { mimeType, data } }]);
    return JSON.parse(result.response.text()) as T;
  },
};
