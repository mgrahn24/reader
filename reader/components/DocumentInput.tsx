'use client';

import React from 'react';
import { useReader } from '@/lib/reader-store';

export default function DocumentInput() {
  const {
    documentText,
    setDocumentText,
    isProcessing,
    processDocument,
    cancelProcessing,
    reset,
    chunks,
    streamDone,
  } = useReader();

  const canProcess = documentText.trim().length > 0 && !isProcessing;

  return (
    <section className="w-full max-w-3xl flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Document</h2>

      <textarea
        className="w-full h-48 p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Paste text here..."
        value={documentText}
        onChange={(e) => setDocumentText(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => processDocument()}
          className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          disabled={!canProcess}
        >
          {isProcessing ? 'Processing…' : 'Process'}
        </button>

        {isProcessing && (
          <button
            onClick={cancelProcessing}
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 cursor-pointer"
          >
            Cancel
          </button>
        )}

        <div className="ml-auto text-sm text-zinc-500">
          {isProcessing
            ? 'Streaming chunks…'
            : chunks.length > 0
              ? `${chunks.length} chunks ${streamDone ? '(ready)' : '(streaming)'}` 
              : 'No chunks'}
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        Roadmap: file upload and automatic summarization for navigation will be added here.
      </div>
    </section>
  );
}
