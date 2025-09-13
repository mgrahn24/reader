import { createGroq } from '@ai-sdk/groq';

if (!process.env.GROQ_API_KEY) {
  console.warn('GROQ_API_KEY is not set. Please add it to reader/.env.local');
}

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const GROQ_MODEL = 'moonshotai/kimi-k2-instruct';
