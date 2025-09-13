'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Chunk = { text: string; complexity: number };

type ReaderContextValue = {
  // Document input and processing
  documentText: string;
  setDocumentText: (t: string) => void;
  isProcessing: boolean;
  streamDone: boolean;
  processDocument: (text?: string) => Promise<void>;
  cancelProcessing: () => void;

  // Chunk data
  chunks: Chunk[];
  currentIndex: number;
  currentChunk: Chunk | null;

  // Player state
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  seek: (index: number) => void;

  // Timing controls
  baseWPM: number;
  setBaseWPM: (n: number) => void;
  pCommaSemicolon: number;
  setPCommaSemicolon: (n: number) => void;
  pColonDash: number;
  setPColonDash: (n: number) => void;
  pSentenceEnd: number;
  setPSentenceEnd: (n: number) => void;

  // Metrics
  instWPM: number;
  dynamicWPM: number;
  progress: number; // 0..1
  totalChunks: number;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function useReader() {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error('useReader must be used within <ReaderProvider>');
  return ctx;
}

const DEFAULT_DOC = `Welcome to the AI‑augmented RSVP Reader.

Paste any article or text, then click “Process”. We will chunk the text and pace it for Rapid Serial Visual Presentation (RSVP), showing one unit at a time so you can focus your attention.

Benefits:
- Focused, distraction‑free reading
- Adaptive pacing (longer pauses at punctuation and for complex chunks)
- Keyboard: Space (play/pause), ←/→ (prev/next), ↑/↓ (speed)
- Mouse: click/drag the progress bar to seek
- Reset with “New document” to start over

Tip: You can adjust base WPM and punctuation pauses in Settings.`;

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  // Document and processing state
  const [documentText, setDocumentText] = useState(DEFAULT_DOC);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const chunksRef = useRef<Chunk[]>([]);
  const streamDoneRef = useRef(false);
  const [streamDoneState, setStreamDoneState] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const indexRef = useRef(0);
  const [currentIndexState, setCurrentIndexState] = useState(0);
  const [currentChunkState, setCurrentChunkState] = useState<Chunk | null>(null);
  const isPlayingRef = useRef(false);
  const loopStartedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const currentStartRef = useRef<number | null>(null);

  // Timing controls
  const [baseWPM, setBaseWPM] = useState(300);
  const [pCommaSemicolon, setPCommaSemicolon] = useState(80);
  const [pColonDash, setPColonDash] = useState(120);
  const [pSentenceEnd, setPSentenceEnd] = useState(220);

  // Metrics
  const [instWPM, setInstWPM] = useState(0);
  const [dynamicWPM, setDynamicWPM] = useState(0);
  const lastMsRef = useRef(0);
  const lastWordsRef = useRef(0);
  const totalWordsRef = useRef(0);
  const totalMsRef = useRef(0);

  // Effects to mirror refs/state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      clearTimers();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    loopStartedRef.current = false;
  }, []);

  const stopPlaybackInternal = useCallback(() => {
    clearTimers();
    setIsPlaying(false);
    isPlayingRef.current = false;
    loopStartedRef.current = false;
  }, [clearTimers]);

  const reset = useCallback(() => {
    stopPlaybackInternal();
    // cancel processing if any
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsProcessing(false);
    streamDoneRef.current = false;
    setStreamDoneState(false);
    setDocumentText(DEFAULT_DOC);

    chunksRef.current = [];
    setChunks([]);
    indexRef.current = 0;
    setCurrentIndexState(0);
    setCurrentChunkState(null);

    totalWordsRef.current = 0;
    totalMsRef.current = 0;
    lastMsRef.current = 0;
    lastWordsRef.current = 0;
    setDynamicWPM(0);
    setInstWPM(0);
  }, [stopPlaybackInternal]);

  // Utilities
  const countWords = useCallback((text: string) => {
    const m = text.trim().match(/\S+/g);
    return Math.max(1, m ? m.length : 0);
  }, []);

  const computeMs = useCallback(
    (chunk: Chunk) => {
      const words = countWords(chunk.text);
      const baseMs = (60000 / baseWPM) * words;

      let punctBonus = 0;
      if (/[,;]$/.test(chunk.text)) punctBonus += pCommaSemicolon;
      if (/[:–—-]$/.test(chunk.text)) punctBonus += pColonDash;
      if (/[.!?]$/.test(chunk.text)) punctBonus += pSentenceEnd;

      const complexity = Math.max(0, Math.min(1, chunk.complexity));
      const complexityMultiplier = 0.6 + 1.2 * complexity; // ~[0.6, 1.8]

      const ms = Math.round(baseMs * complexityMultiplier + punctBonus);
      return Math.max(50, Math.min(5000, ms));
    },
    [baseWPM, pCommaSemicolon, pColonDash, pSentenceEnd, countWords]
  );

  const advanceFromCurrent = useCallback(() => {
    // advance to next chunk and continue scheduling
    indexRef.current = indexRef.current + 1;
    setCurrentIndexState(indexRef.current);

    totalWordsRef.current += lastWordsRef.current;
    totalMsRef.current += lastMsRef.current;
    setDynamicWPM(
      Math.round(
        (totalWordsRef.current / Math.max(1, totalMsRef.current)) * 60000
      )
    );
    scheduleNext();
  }, []);

  const adjustTimingForCurrent = useCallback(() => {
    if (!isPlayingRef.current || !currentChunkState || currentStartRef.current == null) return;
    const words = countWords(currentChunkState.text);
    const newMs = computeMs(currentChunkState);
    lastWordsRef.current = words;
    lastMsRef.current = newMs;
    setInstWPM(Math.round((words / newMs) * 60000));

    // Restart the current chunk timing from "now" so changes are instantly perceptible
    // (rather than preserving the old elapsed baseline).
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    currentStartRef.current = performance.now();
    timeoutRef.current = window.setTimeout(() => {
      advanceFromCurrent();
    }, newMs);
  }, [advanceFromCurrent, computeMs, countWords, currentChunkState]);


  const scheduleNext = useCallback(() => {
    clearTimers();
    loopStartedRef.current = true;

    const loop = () => {
      if (!isPlayingRef.current) return;

      const buf = chunksRef.current;
      const idx = indexRef.current;

      if (idx < buf.length) {
        const c = buf[idx];
        const words = countWords(c.text);
        const ms = computeMs(c);
        lastWordsRef.current = words;
        lastMsRef.current = ms;
        setInstWPM(Math.round((words / ms) * 60000));
        setCurrentChunkState(c);
        currentStartRef.current = performance.now();
        timeoutRef.current = window.setTimeout(() => {
          advanceFromCurrent();
        }, ms);
      } else if (streamDoneRef.current) {
        // Finished: no more data and buffer consumed
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentChunkState(null);
        loopStartedRef.current = false;
        return;
      } else {
        // Wait briefly for more streamed chunks
        timeoutRef.current = window.setTimeout(loop, 50);
      }
    };

    loop();
  }, [advanceFromCurrent, clearTimers, computeMs, countWords]);

  useEffect(() => {
    // Apply timing changes to the current chunk immediately if possible.
    // If no active chunk timing is running (e.g., waiting for buffer), restart scheduling to apply new params.
    if (!isPlayingRef.current) return;
    if (currentStartRef.current != null && currentChunkState) {
      adjustTimingForCurrent();
    } else {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      loopStartedRef.current = false;
      scheduleNext();
    }
  }, [baseWPM, pCommaSemicolon, pColonDash, pSentenceEnd, adjustTimingForCurrent, scheduleNext, currentChunkState]);

  const play = useCallback(() => {
    // If we're at the end, restart from the beginning when user presses Play.
    const len = chunksRef.current.length;
    if (len > 0 && indexRef.current >= len) {
      indexRef.current = 0;
      setCurrentIndexState(0);
      setCurrentChunkState(chunksRef.current[0] ?? null);
    }
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
    if (!loopStartedRef.current) {
      scheduleNext();
    }
  }, [scheduleNext]);

  const pause = useCallback(() => {
    stopPlaybackInternal();
  }, [stopPlaybackInternal]);

  const seek = useCallback(
    (index: number) => {
      const len = chunksRef.current.length;
      if (len === 0) return;
      const clamped = Math.max(0, Math.min(len - 1, index));
      indexRef.current = clamped;
      setCurrentIndexState(clamped);
      setCurrentChunkState(chunksRef.current[clamped] ?? null);

      if (isPlayingRef.current) {
        // restart timing from new index
        scheduleNext();
      } else {
        // not playing: just show the target chunk
        clearTimers();
      }
    },
    [clearTimers, scheduleNext]
  );

  const cancelProcessing = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsProcessing(false);
  }, []);

  const processDocument = useCallback(
    async (optionalText?: string) => {
      const text = (optionalText ?? documentText).trim();
      if (!text) return;

      // Reset reading state but do NOT auto-play
      reset();
      setDocumentText(text);
      setIsProcessing(true);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch('/api/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error('Failed to start AI chunk stream');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          let mutated = false;
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk: Chunk = JSON.parse(trimmed);
              if (typeof chunk.text === 'string' && typeof chunk.complexity === 'number') {
                chunksRef.current.push(chunk);
                mutated = true;
              }
            } catch {
              // ignore parse errors for partial / malformed lines
            }
          }
          if (mutated) {
            // batch update to state
            setChunks([...chunksRef.current]);
          }
        }
      } catch (err) {
        // aborted or failed
      } finally {
        streamDoneRef.current = true;
        setStreamDoneState(true);
        setIsProcessing(false);

        // Auto-play after processing completes if we have content
        if (chunksRef.current.length > 0) {
          play();
        }

        try {
          console.log('[reader] full streamed chunks', {
            count: chunksRef.current.length,
            chunks: chunksRef.current,
          });
        } catch {}
      }
    },
    [documentText, reset, play]
  );

  const progress = useMemo(() => {
    const total = Math.max(1, chunks.length);
    return Math.min(1, Math.max(0, currentIndexState / total));
  }, [currentIndexState, chunks.length]);

  const value: ReaderContextValue = {
    // Document
    documentText,
    setDocumentText,
    isProcessing,
    streamDone: streamDoneState,
    processDocument,
    cancelProcessing,

    // Chunk data
    chunks,
    currentIndex: currentIndexState,
    currentChunk: currentChunkState,

    // Player
    isPlaying,
    play,
    pause,
    reset,
    seek,

    // Timing controls
    baseWPM,
    setBaseWPM,
    pCommaSemicolon,
    setPCommaSemicolon,
    pColonDash,
    setPColonDash,
    pSentenceEnd,
    setPSentenceEnd,

    // Metrics
    instWPM,
    dynamicWPM,
    progress,
    totalChunks: chunks.length,
  };

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}
