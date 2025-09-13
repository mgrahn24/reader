import { NextResponse } from 'next/server';
import { streamObject } from 'ai';
import { groq, GROQ_MODEL } from '@/lib/ai/groq';
import { OutputSchema, ChunkSchema } from '@/lib/chunk-schema';
import { generateChunkPrompt } from './prompt';

export const runtime = 'edge';

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { text } = await req.json();

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or empty "text"' }, { status: 400 });
    }

    const model = groq(GROQ_MODEL);

    // Build a single explicit prompt (no system prompt usage).
    const prompt = generateChunkPrompt(text);

    // Structured generation, but we stream out each newly produced chunk as NDJSON lines
    // so the client can consume incrementally and start playback before completion.
    const result = await streamObject({
      model,
      schema: OutputSchema,
      prompt,
      temperature: 0.2,
    });

    const encoder = new TextEncoder();
    let emitted = 0;
    const full: unknown[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const partial of result.partialObjectStream) {
            const chunks = partial as unknown as unknown[] | undefined;
            if (Array.isArray(chunks) && chunks.length > emitted) {
              for (let i = emitted; i < chunks.length; i++) {
                const parsed = ChunkSchema.safeParse(chunks[i]);
                if (!parsed.success) continue;
                const data = parsed.data;
                full.push(data);
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
              }
              emitted = chunks.length;
            }
          }
        } catch (err) {
          controller.error(err);
          return;
        }
        try {
          const timeTakenMs = Date.now() - startTime;
          console.log('[api/chunk] full response', {
            count: full.length,
            model: GROQ_MODEL,
            timeMs: timeTakenMs,
          });
        } catch {}
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Error in /api/chunk:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
