import { config } from 'dotenv';
config();

import '@/ai/flows/ai-communication-assistant-flow.ts';
import '@/ai/flows/extract-contract-data-flow.ts';
import '@/ai/flows/extract-invoice-data-flow.ts';
import '@/ai/flows/analyze-application-flow.ts';
