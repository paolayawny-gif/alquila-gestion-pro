'use server';
/**
 * @fileOverview A Genkit flow for analyzing rental applications with AI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeApplicationInputSchema = z.object({
  applicantName: z.string(),
  applicantIncome: z.number(),
  rentAmount: z.number(),
  currency: z.string(),
  references: z.string().optional(),
});
export type AnalyzeApplicationInput = z.infer<typeof AnalyzeApplicationInputSchema>;

const AnalyzeApplicationOutputSchema = z.object({
  score: z.number().describe('Score from 0 to 100 based on financial viability.'),
  recommendation: z.string().describe('Final decision: APROBADO, RECHAZADO, or REQUIERE CO-GARANTE.'),
  reasoning: z.string().describe('Detailed explanation in Spanish about the decision.'),
  riskFactors: z.array(z.string()).describe('List of detected risks.'),
});
export type AnalyzeApplicationOutput = z.infer<typeof AnalyzeApplicationOutputSchema>;

export async function analyzeApplication(
  input: AnalyzeApplicationInput
): Promise<AnalyzeApplicationOutput> {
  return analyzeApplicationFlow(input);
}

const analyzeApplicationPrompt = ai.definePrompt({
  name: 'analyzeApplicationPrompt',
  input: {schema: AnalyzeApplicationInputSchema},
  output: {schema: AnalyzeApplicationOutputSchema},
  prompt: `You are an expert real estate risk analyst in Argentina.
Analyze the following rental application for a property with a monthly rent of {{{rentAmount}}} {{{currency}}}.

Applicant: {{{applicantName}}}
Declared Income: {{{applicantIncome}}} {{{currency}}}
References/Notes: {{{references}}}

Guidelines:
1. Income to Rent Ratio: Ideally, the rent should not exceed 30-35% of the declared income.
2. If the ratio is > 40%, it is risky.
3. If the ratio is > 50%, it should be rejected unless strong references exist.

Provide a professional reasoning in SPANISH.
`,
});

const analyzeApplicationFlow = ai.defineFlow(
  {
    name: 'analyzeApplicationFlow',
    inputSchema: AnalyzeApplicationInputSchema,
    outputSchema: AnalyzeApplicationOutputSchema,
  },
  async input => {
    const {output} = await analyzeApplicationPrompt(input);
    if (!output) throw new Error('Analysis failed.');
    return output;
  }
);
