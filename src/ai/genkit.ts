import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY })],
  model: 'googleai/gemini-2.0-flash',
});

export const PRO_MODEL = 'googleai/gemini-2.5-pro';

export function createProAI(apiKey: string) {
  return genkit({
    plugins: [googleAI({ apiKey })],
    model: PRO_MODEL,
  });
}
