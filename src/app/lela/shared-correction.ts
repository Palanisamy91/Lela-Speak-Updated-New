// The one place where Lela Chat, Lela Voice Session and the practice screens turn a sentence into a correction.
// Pure TypeScript (no Angular) so it can be tested directly.

import { teachSentence } from './grammar-teacher';
import { sameIgnoringStyle } from './lela-text';

export interface SharedExplanation { found: string; replacement: string; english: string; tamil: string }
export interface SharedResult { corrected: string; changed: boolean; explanations: SharedExplanation[] }

/**
 * `base` is the sentence after the older database/rule pass (may equal `original`). `dbFixes` are the explanations of
 * the db.json "common mistakes" that pass applied, kept because they are hand-written.
 */
export function sharedCorrection(original: string, base: string, dbFixes: { found: string; english: string; tamil: string }[] = []): SharedResult {
  const shared = teachSentence(original, base);
  const corrected = shared.corrected;
  const changed = !sameIgnoringStyle(original, corrected);
  const explanations = changed
    ? shared.mistakes.map((m, i) => {
        const d = shared.details[i];
        const db = dbFixes.find((f) => f.found.toLowerCase() === m.found.toLowerCase());
        return { found: m.found, replacement: m.replacement, english: db?.english ?? d?.english ?? '', tamil: db?.tamil ?? d?.tamil ?? '' };
      })
    : [];
  return { corrected, changed, explanations };
}
