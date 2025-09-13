'use client';

import React from 'react';
import { useReader } from '@/lib/reader-store';

export default function Player() {
  const {
    currentChunk,
    currentIndex,
    totalChunks,
    isPlaying,
    isProcessing,
    streamDone,
  } = useReader();

  const status = (() => {
    if (isProcessing) return 'Processing…';
    if (totalChunks === 0) return 'Ready';
    if (!isPlaying) return 'Paused';
    return '';
    // when playing and we have a chunk, we show the chunk text instead of status
  })();

  return (
    <section className="w-full max-w-3xl flex flex-col items-center gap-2">

      <div className="w-full h-40 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <span className="text-5xl sm:text-6xl font-semibold tracking-tight select-none">
          {currentChunk?.text ?? status}
        </span>
      </div>

      {/* <div className="text-xs text-zinc-500">
        {totalChunks > 0
          ? `Chunk ${Math.min(currentIndex + 1, totalChunks)} / ${totalChunks} ${
              streamDone ? '' : '(streaming…)'
            }`
          : 'No document loaded'}
      </div> */}
    </section>
  );
}
