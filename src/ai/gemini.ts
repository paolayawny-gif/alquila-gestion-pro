import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  '';

const genAI = new GoogleGenerativeAI(apiKey);

export function getModel(modelName = 'gemini-2.5-flash'): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });
}

export async function generateJSON<T>(prompt: string, modelName?: string): Promise<T> {
  const model = getModel(modelName);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}

export async function generateJSONWithMedia<T>(
  prompt: string,
  mediaDataUri: string,
  modelName?: string,
): Promise<T> {
  const model = getModel(modelName);
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
