/**
 * Mention text splitting — aware of display names that contain spaces
 * (e.g. "אוראל אספקה 1"). We greedy-match the longest known name first,
 * so `@אוראל אספקה 1` is captured as a single token instead of just `@אוראל`.
 *
 * Copied (pure, dependency-free) from parcel-story `src/lib/mentions.ts`.
 */

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string };

/**
 * Split a piece of text into plain-text segments and @mention segments,
 * using a known list of mentionable names. Names are matched longest-first.
 * If an `@word` doesn't match any known name, we fall back to a simple
 * whitespace-bounded capture so legacy mentions still highlight.
 */
export function splitByMentions(text: string, knownNames: string[] = []): MentionSegment[] {
  if (!text) return [];
  const sorted = [...knownNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const result: MentionSegment[] = [];
  let buffer = '';
  let i = 0;

  const flushBuffer = () => {
    if (buffer) {
      result.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < text.length) {
    if (text[i] === '@') {
      // Try to match a known name (longest first)
      let matched: string | null = null;
      for (const name of sorted) {
        if (text.startsWith(`@${name}`, i)) {
          matched = `@${name}`;
          break;
        }
      }
      if (!matched) {
        // Fallback: single word (legacy behaviour)
        const m = text.slice(i).match(/^@[^\s@]+/);
        if (m) matched = m[0];
      }
      if (matched) {
        flushBuffer();
        result.push({ type: 'mention', value: matched });
        i += matched.length;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }
  flushBuffer();
  return result;
}
