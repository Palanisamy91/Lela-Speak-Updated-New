// Small word-token helpers shared by the English checker files. Pure functions, no Angular.

export interface Tok { w: string; raw: string }

export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function tokenise(sentence: string): Tok[] {
  return sentence.replace(/[‘’]/g, "'").split(/\s+/).filter(Boolean).map((raw) => ({ raw, w: raw.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '') }));
}

/** A token's edge punctuation (",", ".", "?") is kept when its word is replaced. */
export function withPunct(raw: string, word: string): string {
  const lead = raw.match(/^[^A-Za-z0-9']+/)?.[0] ?? '';
  const trail = raw.match(/[^A-Za-z0-9']+$/)?.[0] ?? '';
  return `${lead}${word}${trail}`;
}

export const mk = (word: string, raw = word): Tok => ({ raw, w: word.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '') });

/** Replace the word of token i. A capital letter at the start of the old word is kept. */
export function setWord(toks: Tok[], i: number, word: string): void {
  const upper = /^[A-Z]/.test(toks[i].raw.replace(/^[^A-Za-z]+/, ''));
  toks[i] = { raw: withPunct(toks[i].raw, upper && word !== 'I' ? cap(word) : word), w: word.toLowerCase() };
}

/** Insert a word before token i. If it goes to the very start, the capital letter moves to the new word. */
export function insertBefore(toks: Tok[], i: number, word: string): void {
  const first = i === 0 && /^[A-Z]/.test(toks[0].raw) && toks[0].w !== 'i';
  if (first) toks[0] = { raw: toks[0].raw[0].toLowerCase() + toks[0].raw.slice(1), w: toks[0].w };
  toks.splice(i, 0, { raw: first ? cap(word) : word, w: word.toLowerCase() });
}

/** Remove token i. If it was the first word and was capitalised, the next word becomes capitalised. */
export function removeAt(toks: Tok[], i: number): void {
  const wasFirstCap = i === 0 && /^[A-Z]/.test(toks[0].raw);
  const trailing = toks[i].raw.match(/[^A-Za-z0-9']+$/)?.[0] ?? '';
  toks.splice(i, 1);
  if (trailing && toks.length && i > 0) toks[i - 1] = { ...toks[i - 1], raw: toks[i - 1].raw + trailing };
  if (wasFirstCap && toks[0] && toks[0].w !== 'i') toks[0] = { ...toks[0], raw: cap(toks[0].raw) };
}

export const words = (toks: Tok[]): string[] => toks.map((t) => t.w);
export const sentenceOf = (toks: Tok[]): string => toks.map((t) => t.raw).join(' ');
