'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReader } from '@/lib/reader-store';

function IconPlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.94 2.06-1.73-.3a7.78 7.78 0 0 0-.64-1.55l1-1.45a.8.8 0 0 0-.08-1.03l-1.4-1.4a.8.8 0 0 0-1.03-.08l-1.45 1a7.78 7.78 0 0 0-1.55-.64l-.3-1.73A.8.8 0 0 0 12.86 1h-1.72a.8.8 0 0 0-.79.66l-.3 1.73c-.55.15-1.07.37-1.55.64l-1.45-1a.8.8 0 0 0-1.03.08L4.62 4.51a.8.8 0 0 0-.08 1.03l1 1.45c-.27.48-.49 1-.64 1.55l-1.73.3a.8.8 0 0 0-.66.79v1.72c0 .39.28.72.66.79l1.73.3c.15.55.37 1.07.64 1.55l-1 1.45a.8.8 0 0 0 .08 1.03l1.4 1.4c.28.28.74.31 1.03.08l1.45-1c.48.27 1 .49 1.55.64l.3 1.73c.07.38.4.66.79.66h1.72c.39 0 .72-.28.79-.66l.3-1.73c.55-.15 1.07-.37 1.55-.64l1.45 1c.29.23.75.2 1.03-.08l1.4-1.4a.8.8 0 0 0 .08-1.03l-1-1.45c.27-.48.49-1 .64-1.55l1.73-.3c.38-.07.66-.4.66-.79v-1.72a.8.8 0 0 0-.66-.79Z"
      />
    </svg>
  );
}

export default function Controls() {
  const {
    // playback
    isPlaying,
    play,
    pause,
    reset,
    seek,
    // chunks/progress
    chunks,
    currentIndex,
    totalChunks,
    isProcessing,
    progress,
    // timing controls
    baseWPM,
    setBaseWPM,
    pCommaSemicolon,
    setPCommaSemicolon,
    pColonDash,
    setPColonDash,
    pSentenceEnd,
    setPSentenceEnd,
    // metrics
    instWPM,
    dynamicWPM,
  } = useReader();

  // Hover preview state (store ratio 0..1)
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  // Drag-to-seek
  const barRef = useRef<HTMLDivElement | null>(null);
  const barRectRef = useRef<DOMRect | null>(null);
  const wasPlayingRef = useRef(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const dragging = dragRatio !== null;

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);

  const previewForIndex = (idx: number) => {
    if (idx < 0 || idx >= chunks.length) return 'No preview';
    const window = chunks.slice(idx, Math.min(idx + 12, chunks.length));
    const text = window.map((c) => c.text).join(' ');
    const trimmed = text.length > 140 ? text.slice(0, 140) + '…' : text;
    return trimmed || 'No preview';
  };

  const ratioToIndex = (ratio: number) => {
    if (totalChunks <= 0) return 0;
    return Math.min(totalChunks - 1, Math.max(0, Math.floor(ratio * totalChunks)));
  };

  const clampRatio = (r: number) => Math.min(1, Math.max(0, r));

  const handleMoveAt = (clientX: number) => {
    const rect = barRectRef.current;
    if (!rect) return;
    const x = clientX - rect.left;
    const r = clampRatio(x / rect.width);
    setDragRatio(r);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      handleMoveAt(e.clientX);
    };
    const onUp = () => {
      if (!dragging) return;
      const r = dragRatio ?? 0;
      const idx = ratioToIndex(r);
      seek(idx);
      setDragRatio(null);
      if (wasPlayingRef.current) play();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, dragRatio, play, seek]);

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalChunks <= 0) return;
    barRectRef.current = barRef.current?.getBoundingClientRect() ?? null;
    if (!barRectRef.current) return;
    wasPlayingRef.current = isPlaying;
    if (isPlaying) pause();
    handleMoveAt(e.clientX);
  };

  const onTogglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const activeRatio = dragging ? dragRatio ?? 0 : progress;
  const activePercent = Math.round((activeRatio || 0) * 100);

  const hoverIndex = hoverRatio != null ? ratioToIndex(hoverRatio) : null;

  return (
    <section className="w-full max-w-3xl flex flex-col gap-3">
      {/* Top line: chunk counter on the right */}
      <div className="flex items-center">
        <div className="ml-auto text-sm text-zinc-500">
          {totalChunks > 0 ? `Chunk ${currentIndex + 1} / ${totalChunks}` : ''}
        </div>
      </div>

      {/* Progress bar with hover tooltip + drag-to-seek */}
      <div className="flex flex-col gap-1 select-none">
        <div
          ref={barRef}
          className="relative w-full h-3 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden cursor-pointer"
          onMouseDown={startDrag}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const r = clampRatio(x / rect.width);
            setHoverRatio(r);
          }}
          onMouseLeave={() => setHoverRatio(null)}
          title="Click or drag to seek. Hover to preview (summary placeholder)."
        >
          {/* Filled progress */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-500"
            style={{ width: `${activePercent}%` }}
          />
          {/* Knob */}
          <div
            className="absolute top-1/2"
            style={{ left: `${activePercent}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-3 h-3 rounded-full bg-white border border-blue-600 shadow" />
          </div>

          {/* Hover tooltip */}
          {hoverRatio != null && totalChunks > 0 && !dragging && (
            <div
              className="absolute -top-12 transform -translate-x-1/2 pointer-events-none"
              style={{ left: `${hoverRatio * 100}%` }}
            >
              <div className="max-w-xs px-2 py-1 text-xs rounded bg-zinc-900 text-white shadow">
                <div className="opacity-70">Preview (summary TBD):</div>
                <div className="truncate">{previewForIndex(hoverIndex!)}</div>
              </div>
              <div className="mx-auto w-2 h-2 rotate-45 bg-zinc-900 -mt-1" />
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>0%</span>
          <span>{activePercent}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Player controls row (like a video player) */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          disabled={totalChunks === 0 && !isProcessing}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>

        <button
          onClick={() => setSettingsOpen((s) => !s)}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          aria-label="Settings"
          title="Settings"
        >
          <IconSettings />
        </button>

        <div className="ml-auto text-xs text-zinc-500">
          Base: {baseWPM} WPM • Inst: {instWPM || 0} WPM • Avg: {dynamicWPM || 0} WPM
        </div>
      </div>

      {/* Settings panel (advanced controls) */}
      {settingsOpen && (
        <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm w-28">Base WPM</label>
              <input
                type="range"
                min={120}
                max={900}
                step={10}
                value={baseWPM}
                onChange={(e) => setBaseWPM(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={60}
                max={1500}
                step={10}
                value={baseWPM}
                onChange={(e) => setBaseWPM(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 text-sm cursor-pointer disabled:cursor-not-allowed"
                disabled={totalChunks === 0 && !isPlaying}
                title="Clear loaded chunks and reset player"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Comma ;</label>
              <input
                type="number"
                min={0}
                max={1000}
                step={10}
                value={pCommaSemicolon}
                onChange={(e) => setPCommaSemicolon(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Colon/Dash</label>
              <input
                type="number"
                min={0}
                max={1500}
                step={10}
                value={pColonDash}
                onChange={(e) => setPColonDash(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Sentence</label>
              <input
                type="number"
                min={0}
                max={2000}
                step={10}
                value={pSentenceEnd}
                onChange={(e) => setPSentenceEnd(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded bg-transparent"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
