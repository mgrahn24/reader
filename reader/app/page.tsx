'use client';

import React, { useEffect } from 'react';
import { ReaderProvider, useReader } from '@/lib/reader-store';
import DocumentInput from '@/components/DocumentInput';
import Player from '@/components/Player';
import Controls from '@/components/Controls';

export default function Home() {
  return (
    <ReaderProvider>
      <HomeInner />
    </ReaderProvider>
  );
}

function HomeInner() {
  const {
    streamDone,
    isPlaying,
    play,
    pause,
    seek,
    currentIndex,
    totalChunks,
    baseWPM,
    setBaseWPM,
    reset,
  } = useReader();

  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (totalChunks > 0) seek(Math.min(currentIndex + 1, totalChunks - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (totalChunks > 0) seek(Math.max(currentIndex - 1, 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setBaseWPM(Math.min(baseWPM + 10, 1500));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setBaseWPM(Math.max(baseWPM - 10, 60));
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, play, pause, seek, currentIndex, totalChunks, baseWPM, setBaseWPM]);

  return (
    <div
      className={`min-h-screen p-8 sm:p-12 flex flex-col items-center gap-8 ${
        streamDone ? 'justify-center' : ''
      }`}
    >
      {!streamDone && <h1 className="text-2xl font-bold">AI-augmented RSVP Reader</h1>}

      {!streamDone && <DocumentInput />}

      {streamDone && (
        <>
          <div className="w-full max-w-3xl flex justify-end">
            <button
              onClick={reset}
              className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              title="Start over with a new document"
            >
              New document
            </button>
          </div>
          <Player />
          <Controls />
        </>
      )}
    </div>
  );
}
