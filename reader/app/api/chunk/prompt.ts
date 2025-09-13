export function generateChunkPrompt(text: string): string {
  return `
You must return a single minified JSON array of chunk objects for an RSVP reader.

Schema (array only, no wrapper object, no extra text):
[
  { "text": string, "complexity": number in [0,1] },
  ...
]

Strict rules:
- Output ONLY the JSON array. No prose, no code fences, no keys other than "text" and "complexity".
- Cover ALL content in original order.
- Chunking guideline: favor short phrases of 1-7 words (typically 3-5) that read naturally in RSVP.
- Keep tightly bound tokens together (idioms, names, dates, numbers with units, hyphenations, URLs, email addresses, acronyms).
- Attach punctuation to the end of a chunk when it improves readability (comma, semicolon, colon, dash, sentence end).
- DO NOT include timing, delays, or any fields besides {text, complexity}.
- complexity: 0 = trivial/common/easy; 1 = highly complex/novel or requires substantial context integration.

Text to chunk:
"""
${text}
"""
Return: the JSON array only (minified).`;
}
