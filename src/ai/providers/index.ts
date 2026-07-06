import type { AIProvider, AIProviderAdapter } from './types';
import { geminiProvider } from './gemini-provider';
import { openaiProvider, deepseekProvider } from './openai-provider';
import { anthropicProvider } from './anthropic-provider';

const REGISTRY: Record<AIProvider, AIProviderAdapter> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  deepseek: deepseekProvider,
};

export function getProviderAdapter(provider: AIProvider = 'gemini'): AIProviderAdapter {
  return REGISTRY[provider] ?? geminiProvider;
}

export * from './types';
