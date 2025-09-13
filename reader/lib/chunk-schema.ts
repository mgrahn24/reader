import { z } from 'zod';

export const ChunkSchema = z.object({
  text: z.string().min(1),
  complexity: z.number().min(0).max(1),
});

export const OutputSchema = z.array(ChunkSchema).min(1);

export type Chunk = z.infer<typeof ChunkSchema>;
