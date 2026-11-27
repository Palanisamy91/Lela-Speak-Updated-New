// English checker: the stages that run before and around the older rules in grammar-teacher.ts. Pure functions, no Angular.
//
//   1. cleanWords()   repeated words, spelling, wrong word forms (goed, informations), pronoun case, word order (Tamil-style order)
//   2. fixClauses()   rebuilds each verb group in the right tense: the selected tense (Tense Practice) or the tense the learner meant
//   3. extraRules()   missing "to", articles, comparisons, conjunctions, double negatives, word-usage mistakes ...
//
// Every stage works on word tokens and changes one thing at a time. A correct sentence is returned untouched.

import { IRREGULAR_VERBS, NOUN_VERBS, VERBS, analyse, thirdPerson, pastForm, participleForm, ingForm } from './verb-forms';
import type { TenseId } from './tense-data';
import { Tok, cap, insertBefore, mk, removeAt, setWord, withPunct } from './english-tokens';
import { MISSPELLINGS, OVERREGULARISED, UNCOUNTABLE_PLURALS, WRONG_PLURALS, articleFor, isKnownWord, pluralOf, singularOf, suggestSpelling } from './english-lexicon';
import { CONTINUOUS_TENSES, STATIC_HAVE, PAST_TENSES, ParsedClause, STATIVE, expandItems, parseClause, personOf, renderClause, verbForms as engineForms } from './clause-engine';

// ------------------------------------------------------------------------------------------------------------------
// Time words
// ------------------------------------------------------------------------------------------------------------------

const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
const NUM = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|few|couple of|\\d+';

export interface Markers { past: string | null; future: string | null; now: string | null; since: string | null; longFor: string | null; habitual: string | null }

export function markersOf(text: string): Markers {
  const full = ` ${text.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ')} `;
  // "since last night", "than yesterday", "like yesterday": the time word is not the time of the action
  const t = full.replace(/\b(since|than|like|as|until|till|before|after|about|of|from|for) (yesterday|(?:the )?last \w+|the day before yesterday|the other day)\b/g, ' $1_ ');
  const m = (re: RegExp): string | null => re.exec(t)?.[1]?.trim() ?? null;
  const m2 = (re: RegExp): string | null => re.exec(full)?.[1]?.trim() ?? null;
  return {
    past: m(new RegExp(`\\b(yesterday|(?:${NUM}) (?:second|minute|hour|day|week|month|year)s? ago|last (?:night|week|month|year|${DAYS}|weekend|time|summer|winter|evening|morning)|in (?:19|20)\\d\\d|when i was|when he was|when she was|the other day|the day before yesterday)\\b`)),
    future: m(new RegExp(`\\b(tomorrow|next (?:week|month|year|${DAYS}|time|weekend)|tonight|day after tomorrow)\\b`)),
    now: m(/\b(right now|at the moment|at present|currently|nowadays|these days)\b/),
    since: m2(new RegExp(`\\b(since (?:\\d{4}|yesterday|morning|childhood|then|last \\w+|${DAYS}|${MONTHS}|\\w+day))\\b`)),
    longFor: m(new RegExp(`\\b(for (?:${NUM}) (?:year|month|decade)s?)\\b`)),
    habitual: m(new RegExp(`\\b(every (?:day|morning|evening|night|week|month|year|${DAYS})|daily|usually|normally|generally|on (?:${DAYS})s)\\b`)),
  };
}

const simpleOf: Partial<Record<TenseId, TenseId>> = {
  'present-continuous': 'present-simple', 'past-continuous': 'past-simple', 'future-continuous': 'future-simple',
  'present-perfect-continuous': 'present-perfect', 'past-perfect-continuous': 'past-perfect', 'future-perfect-continuous': 'future-perfect',
};

/** The tense the learner most likely meant when no tense was selected. The written tense is kept unless a time word clearly disagrees. */
export function intendedTense(c: ParsedClause, m: Markers): TenseId {
  let t = c.inferred;
  const stative = STATIVE.has(c.lemma) && !c.copula && !(c.lemma === 'have' && !STATIC_HAVE.has(c.rest.find((r) => !['a', 'an', 'the', 'some', 'my'].includes(r.w))?.w ?? ''));
  if (stative && (t === 'present-continuous' || t === 'past-continuous' || t === 'future-continuous')) t = simpleOf[t] ?? t;
  if (m.past && !c.modal) {
    if (['present-simple', 'present-continuous', 'present-perfect', 'present-perfect-continuous', 'future-simple', 'future-continuous', 'future-perfect', 'future-perfect-continuous'].includes(t)) return 'past-simple';
    return t;
  }
  if (m.future && !m.past) {
    if (PAST_TENSES.includes(t)) return t === 'past-continuous' ? 'future-continuous' : 'future-simple';
    return t;
  }
  if (m.since) {
    if (t === 'present-simple' || t === 'past-simple') return stative || c.copula ? 'present-perfect' : 'present-perfect-continuous';
    if (t === 'present-continuous') return 'present-perfect-continuous';
    return t;
  }
  if (m.longFor) {
    if (t === 'present-continuous') return 'present-perfect-continuous';
    if (t === 'present-simple' && (stative || c.copula)) return 'present-perfect';
    return t;
  }
  if (m.now && t === 'present-simple' && !stative && !c.copula && !c.neg) return 'present-continuous';
  if (m.habitual && t === 'present-continuous' && !m.now && !stative) return 'present-simple';
  return t;
}

// ------------------------------------------------------------------------------------------------------------------
// Clauses
// ------------------------------------------------------------------------------------------------------------------

const CONJ = new Set(['and', 'but', 'or', 'then']);
const SUBORD = new Set(['if', 'when', 'while', 'because', 'although', 'though', 'unless', 'until', 'before', 'after', 'that', 'who', 'which', 'whom', 'whose', 'where', 'whenever', 'wherever', 'whether']);
const WH_START = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'whom', 'whose', 'which']);

interface Seg { toks: Tok[]; kind: 'main' | 'frozen'; conj?: Tok }

function splitSegments(toks: Tok[]): Seg[] {
  const segs: Seg[] = [];
  let start = 0;
  let frozen = false;
  const firstWh = WH_START.has(toks[0]?.w ?? '') && SUBORD.has(toks[0]?.w ?? '');
  const flush = (end: number, nextFrozen: boolean) => {
    if (end > start) segs.push({ toks: toks.slice(start, end), kind: frozen ? 'frozen' : 'main' });
    start = end; frozen = nextFrozen;
  };
  if (SUBORD.has(toks[0]?.w ?? '') && !(firstWh && /\?$/.test(toks[toks.length - 1].raw))) frozen = true;
  for (let k = 1; k < toks.length; k++) {
    const afterComma = /,$/.test(toks[k - 1].raw);
    if (afterComma) {
      const head = toks.slice(start, k);
      if (frozen || parseClause(head) || SUBORD.has(toks[start].w)) {
        if (frozen ? true : parseClause(toks.slice(k)) !== null || CONJ.has(toks[k].w)) { flush(k, SUBORD.has(toks[k].w)); }
      }
      continue;
    }
    if (frozen) continue;
    const w = toks[k].w;
    if (CONJ.has(w) && k + 1 < toks.length) {
      const after = w === 'then' ? k + 1 : toks[k + 1].w === 'then' ? k + 2 : k + 1;
      if (parseClause(toks.slice(start, k)) && (parseClause(toks.slice(after)) || verbStarts(toks[after]))) flush(k, false);
    } else if (SUBORD.has(w) && !(k === 1 && toks[0].w === 'and') && !(w === 'that' && !['i', 'you', 'he', 'she', 'we', 'they', 'it', 'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'there', 'this', 'these', 'those'].includes(toks[k + 1]?.w ?? ''))) {
      if (parseClause(toks.slice(start, k))) flush(k, true);
    }
  }
  flush(toks.length, false);
  return segs;
}

function verbStarts(t: Tok | undefined): boolean {
  if (!t) return false;
  if (['to', 'a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'more', 'also', 'not', 'very', 'so', 'too'].includes(t.w)) return false;
  return analyse(t.w).length > 0 && !NOUN_VERBS.has(t.w);
}

const spellNorm = (w: string): string => w.replace(/ll(ing|ed|er)$/, 'l$1').replace(/is(e|ed|es|ing)$/, 'iz$1').replace(/our$/, 'or');
const sameForm = (x: string, y: string): boolean => {
  if (x === y || spellNorm(x) === spellNorm(y)) return true;
  const ax = engineForms(x);
  return ax.length > 0 && engineForms(y).some((f) => ax.some((g) => g.base === f.base && g.kind === f.kind));
};

/** Same words in the same order, or the same words with a little adverb moved ("it really was" / "it was really"). Spelling variants of one verb form ("travelling") count as the same. */
const sameWords = (a: Tok[], b: Tok[]): boolean => {
  const x = expandItems(a).map((i) => i.w);
  const y = expandItems(b).map((i) => i.w);
  if (x.length === y.length && x.every((w, k) => sameForm(w, y[k]))) return true;
  return x.length === y.length && [...x].sort().join(' ') === [...y].sort().join(' ');
};

const ALL_TENSES: TenseId[] = ['present-simple', 'present-continuous', 'present-perfect', 'present-perfect-continuous', 'past-simple', 'past-continuous', 'past-perfect', 'past-perfect-continuous', 'future-simple', 'future-continuous', 'future-perfect', 'future-perfect-continuous'];
const MENTAL = new Set(['think', 'know', 'believe', 'hope', 'say', 'said', 'feel', 'guess', 'suppose', 'wonder', 'expect', 'remember', 'see', 'hear', 'understand', 'tell', 'told', 'announce', 'announced', 'explain', 'mention', 'notice', 'realise', 'realize', 'learn', 'promise', 'decide', 'agree', 'wish', 'doubt', 'imagine']);

/** Is the verb group exactly right for at least one of the 12 tenses (or an emphatic "does help")? */
function validInSomeTense(c: ParsedClause, toks: Tok[]): boolean {
  if (c.auxs.includes('shall') || c.auxs.includes('would')) return true;
  if (!c.question && !c.neg && c.auxs.length === 1 && ['do', 'does', 'did'].includes(c.auxs[0]) && c.mainKind === 'base') return true;
  return ALL_TENSES.some((t) => sameWords(toks, renderClause(c, t)));
}

export interface FixContext {
  /** At least one clause was understood, so the older verb rules should not run again. */
  parsed: boolean;
  selected?: TenseId;
  /** The tense the learner wrote (the first clause). */
  detected?: TenseId;
  changedVerbs: boolean;
  stative?: { lemma: string; tense: TenseId };
  modal?: string;
  conflict?: { marker: string; kind: 'past' | 'future' | 'since' };
}

/** Rebuilds the verb group of every main clause in the selected tense, or in the tense the learner meant. */
export function fixClauses(input: Tok[], opts: { tense?: TenseId } = {}): { tokens: Tok[]; ctx: FixContext } {
  const ctx: FixContext = { parsed: false, selected: opts.tense, changedVerbs: false };
  if (input.length < 2 || input.some((t) => /^['"“‘]/.test(t.raw) && t.raw.length > 1 && !/^'(s|d|ll|m|re|ve|t)\b/.test(t.raw))) return { tokens: input, ctx };
  const markers = markersOf(input.map((t) => t.w).join(' '));
  const segs = splitSegments(input);
  const out: Tok[] = [];
  let lastTarget: TenseId | null = null;
  let lastClause: ParsedClause | null = null;
  let parsedAny = false;
  let skipped = false;
  let segIndex = -1;
  for (const seg of segs) {
    segIndex++;
    if (seg.kind === 'frozen') { out.push(...seg.toks); lastClause = null; continue; }
    let toks = seg.toks;
    let conj: Tok[] = [];
    if (CONJ.has(toks[0].w) && toks.length > 1) {
      conj = toks[1].w === 'then' && toks[0].w === 'and' ? toks.slice(0, 2) : toks.slice(0, 1);
      toks = toks.slice(conj.length);
    }
    const c = parseClause(toks);
    if (!c) {
      // "... and go to office": a verb that shares the subject and tense of the clause before it
      if (conj.length && lastClause && lastTarget && !/,$/.test(out[out.length - 1]?.raw ?? '') && !lastClause.copula && !SAME_FORM_VERBS.has(lastClause.lemma) && !followsInfinitive(lastClause) && verbStarts(toks[0]) && !/^[a-z]{3,}ed$/.test(toks[0].w) && !lastClause.neg && !lastClause.question && !lastClause.modal) {
        const gerund = analyse(toks[0].w).every((f) => f.kind === 'ing');
        const fixed = gerund && !CONTINUOUS_TENSES.includes(lastTarget) ? null : coordinatedVerb(toks, lastTarget, lastClause);
        if (fixed) { if (!sameWords(fixed, toks)) ctx.changedVerbs = true; out.push(...conj, ...fixed); continue; }
      }
      out.push(...seg.toks);
      lastClause = null;
      continue;
    }
    if (((c.wh.length > 0 || c.question) && segIndex > 0) || (c.rest[0] && (NUMBER_SUBJECTS.has(c.rest[0].w) || ['all', 'both'].includes(c.rest[0].w)) && c.question) || !trusted(c, toks)) { skipped = true; out.push(...seg.toks); lastClause = null; continue; }
    parsedAny = true;
    if (ctx.detected === undefined) ctx.detected = c.inferred;
    if (c.modal) {
      ctx.modal ??= c.modal;
      const fixedModal = modalBase(seg.toks);
      if (fixedModal) ctx.changedVerbs = true;
      out.push(...(fixedModal ?? seg.toks)); lastClause = null; continue;
    }
    const reported = MENTAL.has(c.lemma) && (c.rest[0]?.w === 'that' || SUBJ_PRON.has((c.rest[0]?.w ?? '').split("'")[0]) || SUBJ_PRON.has((c.rest[1]?.w ?? '').split("'")[0]));
    const ownText = (() => { const ws = toks.map((t) => t.w); const from = c.lead.length && c.lead[0].w === 'to' ? c.lead.length : 0; const k = ws.findIndex((w, idx) => idx > c.subject.length && ((SUBJ_PRON.has(w) && idx > 1) || (w === 'to' && analyse(ws[idx + 1] ?? '').some((f) => f.kind === 'base')))); return (k > 0 ? ws.slice(from, k) : ws.slice(from)).join(' '); })();
    const own = reported ? markersOf('') : markersOf(ownText);
    let target: TenseId = opts.tense ?? intendedTense(c, own);
    // no tense selected: a verb group that is already correct in some tense is left alone unless a time word in the clause disagrees
    if (!opts.tense && target === c.inferred && validInSomeTense(c, toks)) { lastTarget = target; lastClause = c; out.push(...seg.toks); continue; }
    if (!opts.tense && target !== c.inferred && !c.stativeContinuous && !own.past && !own.future && !own.since && !own.longFor) target = c.inferred;
    if (opts.tense && CONTINUOUS_TENSES.includes(opts.tense) && STATIVE.has(c.lemma) && !c.copula
      && !(c.lemma === 'have' && !STATIC_HAVE.has(c.rest.find((r) => !['a', 'an', 'the', 'some', 'my'].includes(r.w))?.w ?? ''))) {
      ctx.stative ??= { lemma: c.lemma, tense: opts.tense };
      out.push(...seg.toks);
      continue;
    }
    const rendered = renderClause(c, target);
    lastTarget = target; lastClause = c;
    if (sameWords(toks, rendered)) { out.push(...seg.toks); continue; }
    ctx.changedVerbs = true;
    out.push(...conj, ...rendered);
  }
  ctx.parsed = parsedAny && !skipped;
  const tokens = out;
  if (opts.tense) {
    const text = input.map((t) => t.w).join(' ');
    const m = markersOf(text);
    const sel = opts.tense;
    const pastTense = PAST_TENSES.includes(sel);
    const futureTense = sel.startsWith('future');
    if (m.past && !pastTense) ctx.conflict = { marker: m.past, kind: 'past' };
    else if (m.future && !futureTense && !['present-simple', 'present-continuous'].includes(sel)) ctx.conflict = { marker: m.future, kind: 'future' };
    else if (m.since && (sel === 'present-simple' || sel === 'past-simple')) ctx.conflict = { marker: m.since, kind: 'since' };
  }
  return { tokens, ctx };
}

const MODAL_WORDS = new Set(['will', 'shall', 'can', 'could', 'would', 'should', 'must', 'may', 'might', "won't", "can't", "couldn't", "wouldn't", "shouldn't", "mustn't"]);
const MODAL_SKIP = new Set(['not', 'never', 'always', 'also', 'just', 'still', 'surely', 'really', 'often', 'usually', 'definitely', 'probably', 'already']);

/** "She can sings" -> "She can sing", "I will went" -> "I will go": the verb after a modal is the base form. */
function modalBase(toks: Tok[]): Tok[] | null {
  const m = toks.findIndex((t) => MODAL_WORDS.has(t.w));
  if (m < 0) return null;
  let k = m + 1;
  if (m === 0) k = 2; // "Can she sings?": the subject stands between
  while (toks[k] && MODAL_SKIP.has(toks[k].w)) k++;
  const t = toks[k];
  if (!t) return null;
  const forms = analyse(t.w);
  if (!forms.length || forms.some((f) => f.kind === 'base') || NOUN_VERBS.has(t.w) || ['be', 'been', 'being'].includes(t.w)) return null;
  const f = forms[0];
  if (!f || !['third', 'past', 'pp', 'ing'].includes(f.kind)) return null;
  const copy = toks.map((x) => ({ ...x }));
  setWord(copy, k, f.base);
  return copy;
}

/** "I am learning to set time limits and ask ...": the verb after "and" belongs to the infinitive, not to the tense. */
function followsInfinitive(c: ParsedClause): boolean {
  return c.rest.some((t, k) => (t.w === 'to' && analyse(c.rest[k + 1]?.w ?? '').some((f) => f.kind === 'base')) || (k >= 1 && analyse(t.w).some((f) => f.kind === 'base') && !['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'some', 'of', 'in', 'on', 'at', 'for', 'with'].includes(c.rest[k - 1]?.w ?? '')));
}

const SAME_FORM_VERBS = new Set(['split', 'put', 'cut', 'set', 'read', 'let', 'hit', 'hurt', 'cost', 'shut', 'quit', 'spread', 'burst', 'beat', 'bet', 'bid', 'cast', 'shed', 'thrust']);
const IMPERATIVE_OPEN = new Set(['please', 'let', "let's", 'just', 'kindly', "don't", 'never', 'always', 'do', 'be', 'stop', 'thank', 'thanks', 'sorry', 'yes', 'no', 'okay', 'ok', 'well', 'oh', 'hello', 'hi']);
const SUBJ_DETS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'every', 'each', 'some', 'many', 'two', 'three', 'four', 'five', 'both', 'all']);
const SUBJ_PRON = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);

/** Only clauses whose subject and verb were read with confidence are rebuilt; everything else is left to the careful older rules. */
function trusted(c: ParsedClause, toks: Tok[]): boolean {
  const first = toks[0]?.w ?? '';
  if (IMPERATIVE_OPEN.has(first) && !SUBJ_PRON.has(toks[1]?.w ?? '')) return false;
  if (/,$/.test(toks[0]?.raw ?? '') || OPENERS.has(first) || /^[a-z]{3,}ly$/.test(first)) return false;
  if (c.whSubject) return false;
  if (c.auxs.includes('being')) return false;
  if (c.goingTo && (c.auxs.includes('was') || c.auxs.includes('were'))) return false;
  if (toks.length && toks[toks.length - 1].raw.endsWith(',') && c.wh.length) return false;
  if (c.lemma === 'get' && c.auxs.some((a) => ['have', 'has', 'had'].includes(a))) return false;
  if ((c.question || c.wh.length) && !SUBJ_PRON.has(c.subject[0]?.w ?? '')) return false;
  if (c.wh.length && c.rest.some((t) => BE_OR_AUX.has(t.w))) return false;
  if (!SUBJ_PRON.has(c.subject[0]?.w ?? '')) {
    const look = c.rest.filter((t) => !FREQ_LIKE.has(t.w) && !/^[a-z]{3,}ly$/.test(t.w)).slice(0, !c.auxs.length && c.mainKind === 'base' ? 4 : 1);
    if (look.some((t) => analyse(t.w).some((f) => f.kind === 'third' || f.kind === 'past') && !NOUN_VERBS.has(t.w))) return false;
  }
  if (c.subject.some((t) => COLLECTIVE.has(t.w))) return false;
  if (c.subject.some((t) => ADV_IN_SUBJECT.has(t.w))) return false;
  if (c.wh.length > 1) return false;
  if (c.wh.length === 1) {
    const after = toks[1]?.w ?? '';
    if (!(SUBJ_PRON.has(after) || ['do', 'does', 'did', 'is', 'are', 'was', 'were', 'am', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should'].includes(after))) return false;
  }
  if (NUMBER_SUBJECTS.has(c.subject[0]?.w ?? '')) return false;
  const subj = c.subject.map((t) => t.w);
  if (!subj.length) return false;
  if (SUBJ_PRON.has(subj[0])) return subj.length === 1 || subj.every((w, k) => k % 2 === 1 ? w === 'and' : SUBJ_PRON.has(w));
  if (subj.some((w) => PREPOSITION_WORDS.has(w) || w === 'and' || w === 'or' || w === ',')) return false;
  if (subj.length > 1 && subj.some((w) => SUBJ_PRON.has(w))) return false;
  if ((c.mainKind === 'ing' || c.mainKind === 'pp') && !c.auxs.length) return false;
  if (!c.auxs.length && !c.copula && NOUN_VERBS.has(c.groupWords[0] ?? '')) return false;
  const nounLike = (w: string) => analyse(w).length === 0 || NOUN_VERBS.has(w);
  if (SUBJ_DETS.has(subj[0])) return subj.length <= 3 && subj.slice(1).every(nounLike);
  if (subj.length === 1) return analyse(subj[0]).length === 0 && (!isKnownWord(subj[0]) || (subj[0].length > 3 && subj[0].endsWith('s') && !subj[0].endsWith('ss'))) && !['please', 'just', 'never', 'always', 'also', 'then', 'so', 'but', 'and'].includes(subj[0]);
  return false;
}
const OPENERS = new Set(['here', 'there', 'maybe', 'perhaps', 'sure', 'fair', 'absolutely', 'actually', 'honestly', 'anyway', 'luckily', 'sadly', 'finally', 'first', 'then', 'also', 'still', 'even', 'only', 'once', 'again', 'many', 'most', 'some', 'another', 'turn', 'use', 'go', 'come', 'stop', 'wait', 'try', 'take', 'give', 'keep', 'make', 'put', 'tell', 'show', 'ask', 'call', 'check', 'open', 'close', 'write', 'read', 'listen', 'look', 'remember', 'forget', 'fill', 'bring', 'send', 'help', 'sit', 'stand', 'say', 'speak', 'describe', 'explain', 'think', 'imagine', 'practise', 'practice', 'learn', 'repeat', 'choose']);
const ADV_IN_SUBJECT = new Set(['here', 'there', 'inside', 'outside', 'upstairs', 'downstairs', 'nearby', 'together', 'too', 'also', 'last', 'next', 'first', 'soon', 'then', 'now', 'today', 'tonight', 'tomorrow', 'yesterday', 'again', 'once', 'twice', 'back', 'away', 'abroad', 'home', 'everywhere']);
const FREQ_LIKE = new Set(['always', 'never', 'usually', 'often', 'sometimes', 'seldom', 'rarely', 'hardly', 'already', 'just', 'still', 'also', 'even', 'really', 'ever', 'only', 'probably', 'definitely', 'actually']);
const BE_OR_AUX = new Set(['am', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'do', 'does', 'did']);
const COLLECTIVE = new Set(['rest', 'staff', 'team', 'family', 'couple', 'public', 'audience', 'committee', 'group', 'class', 'majority', 'minority', 'government', 'company', 'crowd', 'army', 'board', 'jury', 'India', 'india']);
const NUMBER_SUBJECTS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'hundred', 'thousand']);
const PREPOSITION_WORDS = new Set(['in', 'on', 'at', 'of', 'with', 'for', 'from', 'to', 'by', 'about', 'near', 'under', 'over']);

/** The form of a verb that follows "and" and shares the subject (and the helping verb) of the clause before it. */
function coordinatedVerb(toks: Tok[], tense: TenseId, prev: ParsedClause): Tok[] | null {
  const forms = analyse(toks[0].w);
  if (!forms.length) return null;
  const lemma = forms[0].base;
  let form: string;
  switch (tense) {
    case 'present-simple': form = prev.person === 'sg' ? thirdPerson(lemma) : lemma; break;
    case 'past-simple': form = pastForm(lemma); break;
    case 'future-simple': form = lemma; break;
    case 'present-perfect': case 'past-perfect': case 'future-perfect': form = participleForm(lemma); break;
    default: form = ingForm(lemma);
  }
  const copy = toks.map((t) => ({ ...t }));
  if (copy[0].w !== form) setWord(copy, 0, form);
  return copy;
}

// ------------------------------------------------------------------------------------------------------------------
// Stage 1: words
// ------------------------------------------------------------------------------------------------------------------

const NOT_REPEATED = new Set(['had', 'that', 'very', 'so', 'no', 'bye', 'ha', 'yes', 'well', 'really', 'now', 'oh', 'hmm', 'go', 'more', 'many', 'much', 'knock', 'blah', 'tick', 'walk', 'day', 'night', 'step', 'again']);
const SUBJECT_FORM: Record<string, string> = { me: 'i', him: 'he', us: 'we', them: 'they', her: 'she' };
const OBJECT_FORM: Record<string, string> = { i: 'me', he: 'him', she: 'her', we: 'us', they: 'them' };
const OBJ_PREPS = new Set(['with', 'for', 'to', 'from', 'at', 'by', 'about', 'of', 'near', 'behind', 'between', 'without', 'against', 'among', 'beside', 'towards', 'toward', 'into', 'onto', 'upon']);
const BE_AUX = new Set(['am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'can', 'could', 'would', 'should', 'must', 'may', 'might', 'shall']);
const COMPARATIVES = new Set(['better', 'worse', 'bigger', 'smaller', 'taller', 'shorter', 'older', 'younger', 'faster', 'slower', 'longer', 'higher', 'lower', 'cheaper', 'richer', 'poorer', 'nicer', 'easier', 'harder', 'happier', 'earlier', 'later', 'stronger', 'weaker', 'cleaner', 'darker', 'lighter', 'heavier', 'colder', 'hotter', 'warmer', 'cooler', 'wider', 'thinner', 'fatter', 'louder', 'quicker', 'smarter', 'safer', 'sooner', 'closer', 'farther', 'further', 'more', 'less', 'bigger', 'prettier', 'funnier', 'busier', 'healthier', 'tastier', 'greater', 'newer', 'deeper', 'sweeter', 'softer']);
const SUPERLATIVES = new Set(['best', 'worst', 'biggest', 'smallest', 'tallest', 'shortest', 'oldest', 'youngest', 'fastest', 'slowest', 'longest', 'highest', 'lowest', 'cheapest', 'richest', 'poorest', 'nicest', 'easiest', 'hardest', 'happiest', 'earliest', 'latest', 'strongest', 'weakest', 'cleanest', 'darkest', 'heaviest', 'coldest', 'hottest', 'warmest', 'widest', 'loudest', 'quickest', 'smartest', 'safest', 'closest', 'prettiest', 'funniest', 'busiest', 'healthiest', 'tastiest', 'greatest', 'newest', 'deepest', 'sweetest', 'softest', 'most']);
const ONE_SYLLABLE: Record<string, string> = { tall: 'taller', short: 'shorter', big: 'bigger', small: 'smaller', old: 'older', young: 'younger', fast: 'faster', slow: 'slower', long: 'longer', high: 'higher', low: 'lower', cheap: 'cheaper', rich: 'richer', poor: 'poorer', nice: 'nicer', easy: 'easier', hard: 'harder', happy: 'happier', strong: 'stronger', weak: 'weaker', clean: 'cleaner', dark: 'darker', light: 'lighter', heavy: 'heavier', cold: 'colder', hot: 'hotter', warm: 'warmer', cool: 'cooler', wide: 'wider', thin: 'thinner', loud: 'louder', quick: 'quicker', smart: 'smarter', safe: 'safer', close: 'closer', pretty: 'prettier', funny: 'funnier', busy: 'busier', sweet: 'sweeter', soft: 'softer', new: 'newer', deep: 'deeper', good: 'better', bad: 'worse', early: 'earlier', late: 'later', great: 'greater' };
const SUPER_OF: Record<string, string> = Object.fromEntries(Object.entries(ONE_SYLLABLE).map(([k, v]) => [v, k === 'good' ? 'best' : k === 'bad' ? 'worst' : /e$/.test(k) ? `${k}st` : /y$/.test(k) ? `${k.slice(0, -1)}iest` : /^(big|thin|hot|fat)$/.test(k) ? `${k}${k[k.length - 1]}est` : `${k}est`]));

/** Spelling, wrong word forms, repeated words, pronoun case and Tamil-style word order. */
export function cleanWords(input: Tok[]): Tok[] {
  let toks = input.map((t) => ({ ...t }));

  // "What is you name?" -> "What is your name?"; "Where is you going?" -> "Where are you going?"
  for (let i = 1; i < toks.length - 1; i++) {
    if (toks[i].w !== 'you' || !['is', 'am'].includes(toks[i - 1].w) && !(toks[i - 1].w === 'was')) continue;
    const nx = toks[i + 1].w;
    if (['name', 'age', 'address', 'number', 'phone', 'mother', 'father', 'friend', 'job', 'house', 'school', 'family', 'brother', 'sister', 'book', 'bag'].includes(nx)) setWord(toks, i, 'your');
    else if (i === 2 && analyse(nx).some((f) => f.kind === 'ing') && ['what', 'where', 'why', 'how', 'when', 'who'].includes(toks[0]?.w ?? '')) setWord(toks, i - 1, toks[i - 1].w === 'was' ? 'were' : 'are');
  }

  // repeated words: "the the book", "I I am"
  for (let i = 1; i < toks.length; i++) {
    if (toks[i].w && toks[i].w === toks[i - 1].w && !NOT_REPEATED.has(toks[i].w) && !/^\d+$/.test(toks[i].w) && !['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'zero', 'hundred'].includes(toks[i].w) && !/[,;]$/.test(toks[i - 1].raw)) { removeAt(toks, i); i--; }
  }

  // spelling and wrong word forms
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    if (!w || /\d/.test(w)) continue;
    const prev = toks[i - 1]?.w ?? '';
    const properNoun = i > 0 && /^[A-Z]/.test(toks[i].raw);
    const wasName = ['name', 'called', 'mr', 'mrs', 'ms', 'dr', 'miss', 'sir', 'madam'].includes(prev) || (prev === 'is' && toks[i - 2]?.w === 'name');
    const hand = MISSPELLINGS[w];
    if (hand && !properNoun) { replaceWord(toks, i, hand); continue; }
    const over = OVERREGULARISED.get(w);
    if (over) {
      const [past, pp] = IRREGULAR_VERBS[over] ?? [over, over];
      const afterHave = ['have', 'has', 'had', 'been', 'be', 'being', 'is', 'are', 'was', 'were'].includes(prev) || ['have', 'has', 'had'].includes(toks[i - 2]?.w ?? '');
      replaceWord(toks, i, afterHave ? pp : past);
      continue;
    }
    const wrongPlural = WRONG_PLURALS[w] ?? UNCOUNTABLE_PLURALS[w];
    if (wrongPlural) { replaceWord(toks, i, wrongPlural); continue; }
    if (!properNoun && !wasName && w.length >= 4 && !isKnownWord(w)) {
      const fix = suggestSpelling(w);
      if (fix) replaceWord(toks, i, fix);
    }
  }
  // "a lot" came from "alot" etc: re-split multi-word replacements
  toks = toks.flatMap((t) => (t.w.includes(' ') ? t.raw.split(' ').map((p, k, a) => ({ w: p.toLowerCase().replace(/[^a-z0-9']/g, ''), raw: p + (k === a.length - 1 ? '' : '') })) : [t]));

  // pronoun case: "Me and my friend went", "Him is", "with I"
  if (toks.length > 3 && toks[0].w === 'me' && toks[1].w === 'and') {
    let k = 2;
    while (k < toks.length && !BE_AUX.has(toks[k].w) && analyse(toks[k].w).length === 0 && k < 6) k++;
    if (k > 2 && k < toks.length) {
      const np = toks.slice(2, k).map((t) => (SUBJECT_FORM[t.w] ? mk(SUBJECT_FORM[t.w]) : t));
      const head: Tok[] = [{ ...np[0], raw: cap(np[0].raw) }, ...np.slice(1), mk('and'), mk('I')];
      toks = [...head, ...toks.slice(k)];
    }
  }
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    const next = toks[i + 1]?.w ?? '';
    const prev = toks[i - 1]?.w ?? '';
    const atClauseStart = i === 0 || ['and', 'but', 'because', 'when', 'if', 'that', 'so'].includes(prev) || /[,;]$/.test(toks[i - 1].raw);
    if (SUBJECT_FORM[w] && atClauseStart && (BE_AUX.has(next) || (analyse(next).length > 0 && !NOUN_VERBS.has(next) && !['her'].includes(w)) || (w === 'her' && (BE_AUX.has(next) || ['has', 'does', 'goes', 'went', 'came', 'ate', 'saw', 'did', 'had', 'can', 'will', 'would', 'likes', 'wants'].includes(next))))) {
      setWord(toks, i, SUBJECT_FORM[w]);
    } else if (['and'].includes(prev) && w === 'me' && (BE_AUX.has(next) || analyse(next).length > 0) && i > 1) {
      setWord(toks, i, 'I');
    } else if (OBJECT_FORM[w] && OBJ_PREPS.has(prev) && !/[,;]$/.test(toks[i - 1]?.raw ?? '') && !/[,;]$/.test(toks[i].raw) && !['and', 'or'].includes(next) && !(toks[i + 1] && (BE_AUX.has(next) || (analyse(next).length > 0 && !NOUN_VERBS.has(next))))) {
      if (!(next === 'and' && prev === 'between')) setWord(toks, i, OBJECT_FORM[w]);
    }
  }
  // "mine book" -> "my book"
  const POSS: Record<string, string> = { mine: 'my', yours: 'your', hers: 'her', ours: 'our', theirs: 'their' };
  for (let i = 0; i + 1 < toks.length; i++) {
    const fix = POSS[toks[i].w];
    const next = toks[i + 1].w;
    if (fix && !BE_AUX.has(next) && !FUNC_AFTER.has(next) && !ADVERBISH.test(next) && !TIME_WORDS.has(next) && !['and', 'but', 'or', 'too', 'also', 'only', 'not', 'is', 'to', 'for', 'of', 'in', 'on', 'at', 'with', 'from', 'than', 'as', 'so'].includes(next) && isKnownWord(next) && analyse(next).length === 0 && !/[.,!?]$/.test(toks[i].raw)) setWord(toks, i, fix);
  }
  // their/there, your/you're, its/it's, then/than, to/too
  for (let i = 0; i + 1 < toks.length; i++) {
    const w = toks[i].w;
    const next = toks[i + 1].w;
    const next2 = toks[i + 2]?.w ?? '';
    if (w === 'their' && ['is', 'are', 'was', 'were'].includes(next) && !(toks[i + 2] && ['own', 'brother'].includes(next2))) setWord(toks, i, 'there');
    else if (w === 'your' && clauseStart(toks, i) && (['welcome', 'late', 'right', 'wrong', 'ready', 'invited', 'right'].includes(next) || (next === 'going' && next2 === 'to') || (['not', 'also', 'always', 'never'].includes(next) && analyse(next2).length > 0))) setWord(toks, i, "you're");
    else if (w === 'its' && clauseStart(toks, i) && (['a', 'an', 'the', 'very', 'not', 'too', 'going', 'raining', 'been', 'so', 'time', 'my', 'your', 'our', 'their', 'good', 'bad', 'hot', 'cold', 'late', 'nice', 'fine', 'okay', 'ok', 'true', 'easy', 'hard', 'difficult', 'important', 'possible'].includes(next))) setWord(toks, i, "it's");
    else if (w === "it's" && ['own', 'tail', 'name', 'colour', 'color', 'size', 'shape', 'price', 'owner', 'head', 'wings', 'legs', 'mother', 'food'].includes(next)) setWord(toks, i, 'its');
    else if (w === 'then' && (COMPARATIVES.has(toks[i - 1]?.w ?? '') || ['rather', 'other', 'more', 'less'].includes(toks[i - 1]?.w ?? '')) && i > 0) setWord(toks, i, 'than');
    else if (w === 'to' && ['much', 'many'].includes(next) && i > 0 && ['is', 'are', 'was', 'were', 'am', 'very', 'have', 'has', 'had', 'eat', 'ate', 'drink', 'talk', 'worry', 'spend', 'spent', 'work'].includes(toks[i - 1].w)) setWord(toks, i, 'too');
    else if (w === 'to' && ['hot', 'cold', 'late', 'early', 'big', 'small', 'heavy', 'expensive', 'difficult', 'tired', 'busy', 'far', 'fast', 'slow', 'loud', 'tall', 'short', 'long'].includes(next) && i > 0 && ['is', 'are', 'was', 'were', 'am'].includes(toks[i - 1].w) && (!toks[i + 2] || ['to', 'for', 'and', 'but'].includes(next2) || /[.,!?]$/.test(toks[i + 1].raw))) setWord(toks, i, 'too');
  }
  toks = reorderWords(toks);
  return toks;
}

function replaceWord(toks: Tok[], i: number, word: string): void {
  const proper = /^[A-Z]/.test(toks[i].raw.replace(/^[^A-Za-z]+/, '')) && (i === 0 || false);
  const w = word === 'wednesday' ? 'Wednesday' : word;
  toks[i] = { raw: withPunct(toks[i].raw, proper || (i === 0 && /^[A-Z]/.test(toks[i].raw)) ? cap(w) : w), w: w.toLowerCase() };
}

const TIME_WORDS = new Set(['yesterday', 'today', 'tomorrow', 'tonight', 'now', 'daily', 'always', 'never', 'often', 'usually', 'sometimes', 'already', 'just', 'still', 'again', 'also', 'early', 'late', 'here', 'there', 'then', 'soon', 'every', 'not', 'very', 'too']);

/** Tamil-style order (subject ... verb at the end) and other scrambled order: "English I learning am" -> "I am learning English". */
function reorderWords(input: Tok[]): Tok[] {
  const toks = input.map((t) => ({ ...t }));
  const n = toks.length;
  if (n < 3) return toks;
  const end = toks[n - 1].raw.match(/[.!?]+$/)?.[0] ?? '';
  const lastW = toks[n - 1].w;
  const pron = toks.findIndex((t) => ['i', 'you', 'he', 'she', 'it', 'we', 'they'].includes(t.w));
  const BE = ['am', 'is', 'are', 'was', 'were'];
  // a) helping verb at the end: "English I learning am", "He office going is"
  if (BE.includes(lastW) && pron >= 0 && n >= 3 && !/\?$/.test(end)) {
    const ingIdx = n - 2;
    if (analyse(toks[ingIdx].w).some((f) => f.kind === 'ing') && ingIdx !== pron) {
      const others = toks.filter((_, k) => k !== pron && k !== ingIdx && k !== n - 1);
      const subj = toks[pron];
      const rebuilt: Tok[] = [{ raw: cap(subj.w === 'i' ? 'I' : subj.w), w: subj.w }, mk(lastW), mk(toks[ingIdx].w), ...others.map((t) => ({ ...t, raw: /^[A-Z]/.test(t.raw) && !['i'].includes(t.w) && others.indexOf(t) === 0 && !isProperLike(t.raw) && !ALWAYS_CAP.has(t.w) ? t.raw[0].toLowerCase() + t.raw.slice(1) : t.raw }))];
      if (rebuilt.length) { const last = rebuilt[rebuilt.length - 1]; rebuilt[rebuilt.length - 1] = { ...last, raw: last.raw.replace(/[.!?]+$/, '') + end }; }
      return rebuilt;
    }
  }
  // b) verb at the end after the object: "I rice eat" -> "I eat rice"
  if (pron === 0 && n >= 3 && n <= 6 && !/\?$/.test(end)) {
    const verb = toks[n - 1];
    const f = analyse(verb.w);
    const middle = toks.slice(1, n - 1);
    const afterDet = (k: number) => k > 1 && DET_WORDS.has(toks[k - 1].w);
    const verbCount = 1 + toks.filter((t, k) => k > 0 && k < n - 1 && analyse(t.w).length > 0 && !NOUN_VERBS.has(t.w) && !BE.includes(t.w) && !afterDet(k)).length;
    if (f.length && !BE.includes(verb.w) && (!NOUN_VERBS.has(verb.w) || FINAL_VERBS.has(verb.w)) && verbCount === 1 && middle.length >= 1 && middle.length <= 3
      && middle.every((m, k) => !TIME_WORDS.has(m.w) && !ADVERBISH.test(m.w) && !m.w.endsWith("n't") && !BE_AUX.has(m.w) && !OBJ_PREPS.has(m.w) && !['in', 'on', 'to', 'and', 'but', 'or', 'not', 'no'].includes(m.w) && (analyse(m.w).length === 0 || afterDet(k + 1)))
      && !(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their'].includes(middle[middle.length - 1].w))) {
      const rebuilt = [toks[0], { ...verb, raw: verb.raw.replace(/[.!?]+$/, '') }, ...middle];
      const last = rebuilt[rebuilt.length - 1];
      rebuilt[rebuilt.length - 1] = { ...last, raw: last.raw.replace(/[.!?]+$/, '') + end };
      return rebuilt;
    }
  }
  // c) embedded question: "I don't know where is he" -> "where he is"
  for (let i = 0; i + 3 < n; i++) {
    if (['know', 'knew', 'ask', 'asked', 'wonder', 'wondered', 'tell', 'understand', 'remember'].includes(toks[i].w) || (toks[i].w === "know" )) {
      let k = i + 1;
      if (toks[k].w === 'me' || toks[k].w === 'us') k++;
      if (WH_START.has(toks[k]?.w ?? '') && BE.includes(toks[k + 1]?.w ?? '') && ['i', 'you', 'he', 'she', 'it', 'we', 'they'].includes(toks[k + 2]?.w ?? '')) {
        const be = toks[k + 1]; const sub = toks[k + 2];
        toks[k + 1] = { raw: sub.raw, w: sub.w };
        toks[k + 2] = { raw: be.raw, w: be.w };
        break;
      }
    }
  }
  return toks;
}

const ALWAYS_CAP = new Set(['english', 'tamil', 'hindi', 'telugu', 'malayalam', 'kannada', 'french', 'german', 'india', 'indian', 'tamilnadu', 'chennai', 'madurai', 'coimbatore', 'delhi', 'mumbai', 'london', 'america', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const DET_WORDS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'some', 'two', 'three', 'four', 'five']);
const ADVERBISH = /^([a-z]{3,}ly|really|even|just|also|only|still|always|never|quite|rather|almost|nearly|simply|too|already|often|usually|sometimes|ever|ought|must|can|could|should|would|will|shall|may|might|need|dare)$/;
const clauseStart = (toks: Tok[], i: number): boolean => i === 0 || ['and', 'but', 'because', 'when', 'if', 'that', 'so', 'while', 'as'].includes(toks[i - 1].w) || /[,;]$/.test(toks[i - 1].raw);
const NOT_A_VERB_AFTER = new Set(['clear', 'good', 'more', 'less', 'free', 'fine', 'open', 'close', 'right', 'wrong', 'full', 'sure', 'safe', 'best', 'better', 'worse', 'last', 'next', 'fast', 'slow', 'quick', 'cool', 'warm', 'cheap', 'pay', 'time', 'money', 'help', 'support', 'advice', 'permission', 'care', 'rest', 'break', 'change', 'work', 'order', 'attention']);
const ACTION_ING = new Set(['go', 'come', 'eat', 'drink', 'ask', 'tell', 'say', 'speak', 'talk', 'call', 'read', 'write', 'learn', 'study', 'practise', 'practice', 'work', 'help', 'think', 'wait', 'listen', 'use', 'try', 'see', 'meet', 'take', 'make', 'give', 'buy', 'do', 'sleep', 'run', 'walk', 'check', 'share', 'send', 'wash', 'clean', 'cook', 'plan', 'start', 'stop', 'join', 'visit', 'travel', 'leave', 'move', 'stay', 'get', 'be', 'have', 'find', 'fix', 'build', 'save', 'spend', 'pay', 'win', 'lose', 'cry', 'laugh', 'smile', 'swim', 'sing', 'dance', 'play', 'watch', 'wear', 'carry', 'bring', 'follow', 'repeat', 'change', 'forget', 'remember', 'finish', 'begin', 'complete', 'attend', 'reach', 'arrive', 'return', 'open', 'close']).add('leave');
ACTION_ING.delete('leave');
const FINAL_VERBS = new Set(['read', 'drink', 'study', 'learn', 'eat', 'write', 'watch', 'wash', 'cook', 'finish', 'visit', 'buy', 'drive', 'clean', 'call']);
const isProperLike = (raw: string) => /^[A-Z][a-z]+$/.test(raw) && !isKnownWord(raw.toLowerCase());

// ------------------------------------------------------------------------------------------------------------------
// Stage 3: extra rules
// ------------------------------------------------------------------------------------------------------------------

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean);

const COUNT_NOUNS = new Set(wordsOf(`apple banana orange mango egg sandwich cake biscuit chapati dosa idli pizza burger coconut lemon tomato potato onion carrot cookie sweet chocolate candy ice-cream
car bike bus train plane boat book pen pencil bag phone mobile laptop computer table chair bed door window watch shirt dress cap hat ticket card key box bottle glass cup plate spoon knife camera television tv fan clock lamp umbrella wallet mirror picture photo letter email message cycle scooter motorcycle
house flat room shop restaurant hotel garden temple church school college hospital bank office market
friend brother sister boy girl man woman child baby student teacher doctor nurse engineer driver farmer manager lawyer worker player singer writer artist dentist cook waiter policeman
idea question problem plan job meeting exam test game movie film song story dream habit hobby rule reason answer chance holiday trip party gift prize mistake accident appointment interview project dog cat bird horse cow fish animal
shirt pant skirt sofa kitchen bathroom bedroom balcony address number word sentence paragraph page lesson class subject topic chapter result salary loan bill receipt coupon offer discount sale cold fever cough headache toothache stomachache backache`));
const TIME_COUNT = new Set(['day', 'week', 'month', 'year', 'hour', 'minute', 'second', 'time', 'night', 'morning']);
const PROFESSIONS = new Set(['student', 'teacher', 'doctor', 'engineer', 'nurse', 'driver', 'farmer', 'manager', 'lawyer', 'worker', 'player', 'singer', 'writer', 'artist', 'dentist', 'cook', 'waiter', 'boy', 'girl', 'man', 'woman', 'friend']);
const ILLNESS = new Set(['fever', 'cold', 'cough', 'headache', 'toothache', 'stomachache', 'backache']);
const UNCOUNT = new Set(wordsOf('water rice money time food milk tea coffee information traffic homework work luggage furniture advice news music weather equipment knowledge research bread sugar salt oil butter paper air sand rain snow fruit'));
const UNCOUNT_ABSTRACT = new Set(wordsOf('information advice furniture luggage baggage equipment homework knowledge news music traffic weather jewellery research'));
const ADJ = new Set(wordsOf('red blue green yellow black white pink big small large little new old good bad nice beautiful long short hot cold fresh young tall famous important interesting delicious sweet tasty heavy expensive cheap great lovely ripe clean dirty happy sad busy quiet loud strong weak smart honest hungry sick lazy rich poor'));
for (const food of ['dosa', 'idli', 'chapati', 'pizza', 'burger', 'biscuit', 'cake', 'cookie', 'chocolate', 'candy', 'sweet', 'television', 'tv']) COUNT_NOUNS.delete(food);
const FUNC_AFTER = new Set(['in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'of', 'and', 'or', 'but', 'so', 'because', 'when', 'while', 'if', 'than', 'are', 'is', 'was', 'were', 'am', 'have', 'has', 'had', 'will', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'today', 'now', 'here', 'there', 'yesterday', 'tomorrow', 'every', 'each', 'too', 'also', 'very', 'always', 'never', 'often', 'daily', 'again', 'together', 'then', 'that', 'which', 'who', 'before', 'after', 'during', 'about', 'around', 'into', 'over', 'under', 'near', 'as', 'like', 'since', 'until', 'tonight', 'ago', 'now', 'yet', 'still', 'just', 'only', 'even', 'much', 'more', 'most', 'less', 'right', 'away', 'back', 'out', 'up', 'down', 'off', 'all', 'both', 'too', 'well', 'quickly', 'slowly', 'carefully']);
const ART_VERBS = new Set(wordsOf('have has had buy buys bought eat eats ate need needs needed want wants wanted own owns got get gets saw see sees read reads wrote write writes take took make makes made drive drove ride rode order ordered watch watched find found carry carried bring brought give gave show showed send sent hold held lost lose lost is was am'));
const SPORTS = new Set(wordsOf('cricket football tennis chess hockey badminton volleyball basketball carrom kabaddi golf'));
const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'supper']);
const PRON = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);
const OBJ_PRON = new Set(['me', 'him', 'her', 'us', 'them', 'you']);
const DET_LIKE = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'another', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'many', 'much', 'few', 'several', 'more', 'most', 'all', 'both', 'half', 'little', 'enough']);
const CITIES = new Set(wordsOf('chennai delhi mumbai bangalore bengaluru hyderabad kolkata madurai coimbatore trichy salem tirunelveli erode vellore tiruppur pune kerala karnataka india tamilnadu london america canada australia singapore dubai'));
const NUMBER_PLURAL = new Set(wordsOf('two three four five six seven eight nine ten eleven twelve many several few both hundred thousand'));
const MOTION = new Set(wordsOf('go goes went going gone come comes came coming return returns returned returning reach reached'));

function isVerbBase(w: string): boolean { return VERBS.has(w) && !NOUN_VERBS.has(w) && analyse(w).some((f) => f.kind === 'base'); }

/** Replace the tokens at i..i+len-1 with new words. The capital letter of the first word and the punctuation of the last word are kept. */
function replaceSeq(toks: Tok[], i: number, len: number, to: string[]): void {
  const firstCap = /^[A-Z]/.test(toks[i].raw);
  const lead = toks[i].raw.match(/^[^A-Za-z0-9']+/)?.[0] ?? '';
  const trail = toks[i + len - 1].raw.match(/[^A-Za-z0-9']+$/)?.[0] ?? '';
  const repl: Tok[] = to.map((w, k) => ({ w: w.toLowerCase(), raw: `${k === 0 ? lead : ''}${k === 0 && firstCap && w !== 'I' ? cap(w) : w}${k === to.length - 1 ? trail : ''}` }));
  toks.splice(i, len, ...repl);
}

function matchSeq(toks: Tok[], i: number, pattern: string[]): boolean {
  return pattern.every((p, k) => toks[i + k]?.w === p);
}

const ING_ADJ: Record<string, string> = { boring: 'bored', tiring: 'tired', confusing: 'confused', exciting: 'excited', surprising: 'surprised', interesting: 'interested', annoying: 'annoyed', worrying: 'worried', shocking: 'shocked', embarrassing: 'embarrassed' };

/** More rules: missing "to", articles, plurals, comparisons, conjunctions, double negatives, word usage. One pass; the caller repeats it. */
export function extraRules(input: Tok[]): Tok[] {
  const toks = input.map((t) => ({ ...t }));

  // "Myself Ravi" -> "I am Ravi"; "Myself went" -> "I went"
  if (toks[0]?.w === 'myself' && toks.length > 1) {
    const nx = toks[1].w;
    if (BE_AUX.has(nx) || analyse(nx).length) replaceSeq(toks, 0, 1, ['I']);
    else replaceSeq(toks, 0, 1, ['I', 'am']);
  }

  // missing subject: "Is raining" -> "It is raining"; "Am going" -> "I am going"
  if (toks.length >= 2 && !/\?$/.test(toks[toks.length - 1].raw) && ['is', 'am'].includes(toks[0].w) && analyse(toks[1].w).some((f) => f.kind === 'ing')) {
    const subj = toks[0].w === 'is' ? 'it' : 'I';
    toks[0] = { w: toks[0].w, raw: toks[0].raw[0].toLowerCase() + toks[0].raw.slice(1) };
    toks.unshift({ w: subj.toLowerCase(), raw: cap(subj) });
  }

  // "Everyone are" -> "Everyone is"
  for (let i = 0; i < toks.length - 1; i++) {
    if (['everyone', 'everybody', 'someone', 'nobody', 'anyone', 'everything'].includes(toks[i].w) && ['are', 'were'].includes(toks[i + 1].w)) setWord(toks, i + 1, toks[i + 1].w === 'are' ? 'is' : 'was');
    if (/^enjoy(ed|s|ing)?$/.test(toks[i].w) && toks[i + 1].w === 'in' && ['the', 'a', 'my', 'our', 'that', 'this'].includes(toks[i + 2]?.w ?? '')) removeAt(toks, i + 1);
  }
  // "My name Ravi" -> "My name is Ravi"
  if (toks.length >= 3 && ['my', 'your', 'his', 'her', 'our', 'their'].includes(toks[0].w) && toks[1].w === 'name' && !BE_AUX.has(toks[2].w) && !['and', 'is'].includes(toks[2].w) && analyse(toks[2].w).length === 0) {
    insertBefore(toks, 2, 'is');
  }
  // "What your name?" -> "What is your name?"; "Where my book?" -> "Where are my books?"
  if (toks.length >= 3 && toks.length <= 6 && ['what', 'where', 'who'].includes(toks[0].w) && ['my', 'your', 'his', 'her', 'their', 'our', 'the', 'this', 'that'].includes(toks[1].w)
    && toks.slice(1).every((t) => !BE_AUX.has(t.w) && (analyse(t.w).length === 0 || NOUN_VERBS.has(t.w)))) {
    const np = toks.slice(1);
    insertBefore(toks, 1, personOf(np) === 'pl' ? 'are' : 'is');
  }

  // do-support with a modal: "Do you can speak English?" -> "Can you speak English?"
  for (let i = 0; i + 2 < toks.length; i++) {
    if (['do', 'does', 'did'].includes(toks[i].w) && PRON.has(toks[i + 1].w) && ['can', 'could', 'should', 'must', 'may', 'might', 'will', 'would', 'shall'].includes(toks[i + 2].w)) {
      const modal = toks[i + 2].w;
      toks.splice(i + 2, 1);
      replaceSeq(toks, i, 1, [modal]);
      break;
    }
  }
  // modal + "to": "can to go", "Can you to speak"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (['can', 'could', 'should', 'must', 'may', 'might', 'will', 'would', 'shall'].includes(toks[i].w) && !(i > 0 && (['and', 'or'].includes(toks[i - 1].w) || /,$/.test(toks[i - 1].raw)))) {
      const j = PRON.has(toks[i + 1].w) && i === 0 ? i + 2 : i + 1;
      if (toks[j]?.w === 'to' && analyse(toks[j + 1]?.w ?? '').length) removeAt(toks, j);
    }
  }

  // missing "to": "I want go home" -> "I want to go home"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (/^(want|wants|wanted|need|needs|needed|hope|hopes|hoped|decide|decides|decided|plan|plans|planned|wish|wishes|wished|try|tries|tried|promise|promised|refuse|refused|manage|managed|expect|expected|learn|learned|learnt|forgot|forget)$/.test(toks[i].w)) {
      const nx = toks[i + 1].w;
      const before = toks[i - 1]?.w ?? '';
      if (isVerbBase(nx) && !DET_LIKE.has(nx) && !['be'].includes(nx) && !NOT_A_VERB_AFTER.has(nx) && !(i > 0 && (DET_LIKE.has(before) || ADJ.has(before) || ['good', 'new', 'old', 'big', 'small', 'own', 'next', 'last'].includes(before))) && !/[,;]$/.test(toks[i].raw)) insertBefore(toks, i + 1, 'to');
    }
  }
  // let / make + object + "to": "let me to go" -> "let me go"
  for (let i = 0; i + 3 < toks.length; i++) {
    if (['let', 'lets', 'make', 'makes', 'made'].includes(toks[i].w) && OBJ_PRON.has(toks[i + 1].w) && toks[i + 2].w === 'to' && analyse(toks[i + 3].w).length) removeAt(toks, i + 2);
  }
  // enjoy / finish ... + to-verb or base verb -> -ing; look forward to + base verb -> -ing
  for (let i = 0; i + 1 < toks.length; i++) {
    if (/^(enjoy|enjoys|enjoyed|finish|finished|avoid|avoided|mind|suggest|suggested|consider|considered|practise|practised|practice|practiced|miss|missed|keep|keeps|kept)$/.test(toks[i].w)) {
      if (toks[i + 1].w === 'to' && isVerbBase(toks[i + 2]?.w ?? '')) { const v = analyse(toks[i + 2].w)[0].base; removeAt(toks, i + 1); setWord(toks, i + 1, ingForm(v)); }
      else if (isVerbBase(toks[i + 1].w) && !DET_LIKE.has(toks[i + 1].w) && !NOUN_VERBS.has(toks[i + 1].w) && !['last', 'next'].includes(toks[i + 1].w) && analyse(toks[i + 1].w).some((f) => f.kind === 'base')) setWord(toks, i + 1, ingForm(analyse(toks[i + 1].w)[0].base));
    }
    if (matchSeq(toks, i, ['look', 'forward', 'to']) || matchSeq(toks, i, ['looking', 'forward', 'to'])) {
      if (isVerbBase(toks[i + 3]?.w ?? '')) setWord(toks, i + 3, ingForm(analyse(toks[i + 3].w)[0].base));
    }
    if (['by', 'without', 'about', 'of'].includes(toks[i].w) && ACTION_ING.has(toks[i + 1]?.w ?? '') && (toks[i].w !== 'of' || ['instead', 'afraid', 'tired', 'capable', 'sick', 'think', 'thinking', 'proud', 'fond', 'scared'].includes(toks[i - 1]?.w ?? '')) && !NOUN_VERBS.has(toks[i + 1]?.w ?? '') && i > 0 && isVerbBase(toks[i + 1].w) && !DET_LIKE.has(toks[i + 1].w) && !['it', 'him', 'her', 'me', 'us', 'them'].includes(toks[i + 1].w) && !PRON.has(toks[i - 1].w)) {
      setWord(toks, i + 1, ingForm(analyse(toks[i + 1].w)[0].base));
    }
  }

  // articles: a / an by sound
  for (let i = 0; i + 1 < toks.length; i++) {
    const w = toks[i].w;
    const nx = toks[i + 1].w;
    if ((w === 'a' || w === 'an') && /^[a-z]/.test(nx) && !['or', 'and', 'an', 'a', 'to', 'sql'].includes(nx) && !FUNC_AFTER.has(nx) && !['or', 'and', 'use', 'between', 'either'].includes(toks[i - 1]?.w ?? '')) {
      const want = articleFor(nx);
      if (want !== w) setWord(toks, i, want);
    }
  }
  // a / an before an uncountable noun: "an information" -> "information"
  for (let i = 0; i + 1 < toks.length; i++) {
    if ((toks[i].w === 'a' || toks[i].w === 'an') && UNCOUNT_ABSTRACT.has(toks[i + 1].w) && (!toks[i + 2] || FUNC_AFTER.has(toks[i + 2].w) || /[.,!?;]$/.test(toks[i + 1].raw) || analyse(toks[i + 2].w).some((f) => f.kind !== 'ing' && !NOUN_VERBS.has(f.base)))) removeAt(toks, i);
  }
  // missing a / an: "I ate apple" -> "I ate an apple"; "I am student" -> "I am a student"; "I have fever" -> "I have a fever"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (!ART_VERBS.has(toks[i].w)) continue;
    if (toks[i].w === 'own' && i > 0 && ['my', 'your', 'his', 'her', 'our', 'their', 'its'].includes(toks[i - 1].w)) continue;
    if (i > 0 && (DET_LIKE.has(toks[i - 1].w) || ADJ.has(toks[i - 1].w)) && !BE_AUX.has(toks[i].w)) continue;
    let j = i + 1;
    if (ADJ.has(toks[j].w) && j + 1 < toks.length) j++;
    const noun = toks[j].w;
    if (!COUNT_NOUNS.has(noun) || TIME_COUNT.has(noun)) continue;
    if (['school', 'college', 'office', 'hospital', 'bank', 'market', 'shop', 'temple', 'church', 'restaurant'].includes(noun) && !['buy', 'bought', 'own', 'owns'].includes(toks[i].w)) continue;
    const be = ['is', 'was', 'am'].includes(toks[i].w);
    if (be && !PROFESSIONS.has(noun)) continue;
    if (be && ['is', 'was'].includes(toks[i].w) && j === i + 1 && i > 0 && ['it', 'this', 'that', 'there', 'who', 'what', 'where'].includes(toks[i - 1].w)) continue;
    if (['have', 'has', 'had'].includes(toks[i].w) && ILLNESS.has(noun) === false && j > i + 1 && false) continue;
    const after = toks[j + 1]?.w ?? '';
    if (COUNT_NOUNS.has(after) || after === 'of') continue;
    if (after && !FUNC_AFTER.has(after) && !/[.,!?;]$/.test(toks[j].raw) && isKnownWord(after) && analyse(after).every((f) => NOUN_VERBS.has(f.base))) continue;
    if (['cold', 'cough', 'fever'].includes(noun) && !['have', 'has', 'had', 'catch', 'caught', 'get', 'got'].includes(toks[i].w)) continue;
    if (['cold'].includes(noun) && !['have', 'has', 'had'].includes(toks[i].w)) continue;
    if (toks[i + 1].w === 'to') continue;
    insertBefore(toks, i + 1, articleFor(toks[i + 1].w));
    i = j + 1;
  }
  // "play the cricket" -> "play cricket"; "had the breakfast at" -> "had breakfast at"
  for (let i = 0; i + 2 < toks.length; i++) {
    if (/^(play|plays|played|playing)$/.test(toks[i].w) && toks[i + 1].w === 'the' && SPORTS.has(toks[i + 2].w)) removeAt(toks, i + 1);
    else if (/^(have|has|had|having|eat|ate|eating|skip|skipped)$/.test(toks[i].w) && toks[i + 1].w === 'the' && MEALS.has(toks[i + 2].w)) {
      const nx = toks[i + 3]?.w ?? '';
      if (!nx || ['at', 'in', 'with', 'before', 'after', 'early', 'late', 'today', 'yesterday', 'daily', 'and', 'on', 'every'].includes(nx)) removeAt(toks, i + 1);
    }
  }
  // "in east" -> "in the east"; "Sun rises in the east"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (['in', 'from', 'towards', 'to'].includes(toks[i].w) && ['east', 'west', 'north', 'south'].includes(toks[i + 1].w) && !/^[A-Z]/.test(toks[i + 1].raw) && !['india', 'africa', 'asia', 'korea', 'america', 'indian'].includes(toks[i + 2]?.w ?? '')) insertBefore(toks, i + 1, 'the');
  }
  for (let i = 0; i < toks.length; i++) {
    if (['sun', 'moon', 'sky', 'internet'].includes(toks[i].w)) {
      const prev = toks[i - 1]?.w ?? '';
      if ((i === 0 || ['in', 'on', 'at', 'under', 'see', 'saw', 'watch', 'watched', 'of', 'by', 'from', 'across', 'around', 'look', 'looked', 'to'].includes(prev)) && toks[i + 1]?.w !== 'rise') {
        if (i === 0 || !DET_LIKE.has(prev)) { insertBefore(toks, i, 'the'); i++; }
      }
    }
  }

  // superlatives and comparisons
  for (let i = 0; i + 1 < toks.length; i++) {
    const w = toks[i].w;
    const nx = toks[i + 1].w;
    if (['am', 'is', 'are', 'was', 'were'].includes(w) && SUPERLATIVES.has(nx) && nx !== 'most' && nx !== 'latest') {
      const after = toks[i + 2]?.w ?? '';
      if (after && !['than'].includes(after) && !FUNC_AFTER.has(after)) { insertBefore(toks, i + 1, 'the'); i++; }
    }
    if ((w === 'more' || w === 'most') && !['later', 'sooner', 'further', 'farther'].includes(nx) && (COMPARATIVES.has(nx) && nx !== 'more' && nx !== 'less' || SUPERLATIVES.has(nx) && nx !== 'most')) { removeAt(toks, i); i--; continue; }
    if (w === 'more' && ONE_SYLLABLE[nx] && toks[i + 2]?.w === 'than' && !['light', 'close', 'cool', 'safe'].includes(nx)) { replaceSeq(toks, i, 2, [ONE_SYLLABLE[nx]]); continue; }
    if (w === 'most' && SUPER_OF[ONE_SYLLABLE[nx] ?? ''] && nx !== 'light' && nx !== 'close' && false) continue;
    if (w === 'gooder') setWord(toks, i, 'better');
    if (w === 'badder') setWord(toks, i, 'worse');
    if (ONE_SYLLABLE[w] && nx === 'than' && i > 0 && ['am', 'is', 'are', 'was', 'were', 'much', 'far', 'a', 'bit', 'little'].includes(toks[i - 1].w) && toks[i - 1].w !== 'a') setWord(toks, i, ONE_SYLLABLE[w]);
    if (w === 'as' && nx && ONE_SYLLABLE[nx] === undefined && toks[i + 2]?.w === 'than' && analyse(nx).length === 0) setWord(toks, i + 2, 'as');
    if (w === 'same' && ['like', 'than', 'with'].includes(nx) && i > 0 && toks[i - 1].w === 'the' || (w === 'same' && nx === 'like')) setWord(toks, i + 1, 'as');
    if (COMPARATIVES.has(w) && !['more', 'less', 'sooner', 'later', 'further', 'farther', 'better'].includes(w) && OBJ_PRON.has(nx) && nx !== 'you' && i > 0 && ['am', 'is', 'are', 'was', 'were'].includes(toks[i - 1].w)) { insertBefore(toks, i + 1, 'than'); i++; }
    if (COMPARATIVES.has(w) && ['from', 'then'].includes(nx) && i > 0 && ['am', 'is', 'are', 'was', 'were'].includes(toks[i - 1].w)) setWord(toks, i + 1, 'than');
    if (w === 'similar' && ['with', 'than'].includes(nx)) setWord(toks, i + 1, 'to');
  }

  // conjunctions
  const first = (list: string[]) => toks.findIndex((t) => list.includes(t.w));
  const al = first(['although', 'though']);
  if (al >= 0) {
    for (let k = al + 3; k < toks.length - 1; k++) {
      if (toks[k].w === 'but' && (/,$/.test(toks[k - 1].raw) || k - al >= 3)) { removeAt(toks, k); break; }
    }
  }
  const bc = first(['because']);
  if (bc >= 0) {
    for (let k = bc + 3; k < toks.length - 1; k++) {
      if (toks[k].w === 'so' && (PRON.has(toks[k + 1].w) || DET_LIKE.has(toks[k + 1].w)) && !['much', 'many'].includes(toks[k + 1].w)) { removeAt(toks, k); break; }
    }
  }
  for (let i = 0; i + 2 < toks.length; i++) {
    if (toks[i].w === 'because' && toks[i + 1].w === 'of' && PRON.has(toks[i + 2].w) && (BE_AUX.has(toks[i + 3]?.w ?? '') || analyse(toks[i + 3]?.w ?? '').length)) removeAt(toks, i + 1);
    if (toks[i].w === 'despite' && toks[i + 1].w === 'of') removeAt(toks, i + 1);
    if (toks[i].w === 'during' && PRON.has(toks[i + 1].w) && (BE_AUX.has(toks[i + 2].w) || analyse(toks[i + 2].w).length)) setWord(toks, i, 'while');
    // "if I will reach" -> "if I reach"
    if (['if', 'when', 'until', 'unless', 'before', 'after', 'once', 'while', 'as'].includes(toks[i].w) && !toks.slice(0, i).some((t) => ['know', 'knows', 'ask', 'asks', 'asked', 'tell', 'wonder', 'say', 'check', 'sure', 'what', 'remember', 'understand', 'depends', 'decide'].includes(t.w)) && (toks[i].w !== 'if' || i === 0 || /,$/.test(toks[i - 1].raw)) && PRON.has(toks[i + 1].w) && toks[i + 2].w === 'will' && analyse(toks[i + 3]?.w ?? '').length) {
      if (toks[i].w === 'as' && toks[i + 1].w !== 'soon') { /* only "as soon as" is a time clause */ }
      const subj = toks[i + 1].w;
      const verb = analyse(toks[i + 3].w)[0].base;
      removeAt(toks, i + 2);
      setWord(toks, i + 2, subj === 'he' || subj === 'she' || subj === 'it' ? thirdPerson(verb) : verb);
    }
  }

  // double negatives
  const NEG = new Set(['not', "n't", 'never', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "won't", "can't", 'cannot', "couldn't", "wouldn't", "shouldn't"]);
  const negAt = toks.findIndex((t) => NEG.has(t.w));
  if (negAt >= 0) {
    const ANY: Record<string, string> = { no: 'any', nobody: 'anybody', nothing: 'anything', nowhere: 'anywhere', none: 'any' };
    for (let k = negAt + 1; k < Math.min(toks.length, negAt + 6); k++) {
      if (k > negAt + 1 && /[,;]$/.test(toks[k - 1].raw)) break;
      const a = ANY[toks[k].w];
      if (!a) continue;
      if (toks[k].w === 'no' && BE_AUX.has(toks[negAt - 1]?.w ?? 'x') === false && toks[negAt - 1]?.w === 'is') continue;
      if (toks[k].w === 'no' && (k === toks.length - 1 || FUNC_AFTER.has(toks[k + 1]?.w ?? '') || ['say', 'said', 'says'].includes(toks[k - 1]?.w ?? ''))) continue;
      if (toks[k].w === 'none' && toks[k + 1]?.w !== 'of') { setWord(toks, k, 'any'); continue; }
      setWord(toks, k, a);
    }
  }

  // plural / singular with number words and quantifiers
  for (let i = 0; i + 1 < toks.length; i++) {
    const w = toks[i].w;
    const nx = toks[i + 1].w;
    const after = toks[i + 2]?.w ?? '';
    const isPluralCue = NUMBER_PLURAL.has(w) || (/^\d+$/.test(w) && Number(w) > 1) || (w === 'of' && i > 0 && ['lot', 'lots', 'number', 'couple'].includes(toks[i - 1].w));
    const nounAfter = !!after && !FUNC_AFTER.has(after) && !/[.,!?;]$/.test(toks[i + 1].raw) && ((analyse(after).length === 0 && isKnownWord(after)) || (after.length > 3 && after.endsWith('s') && analyse(after).every((f) => f.kind === 'third' ? NOUN_VERBS.has(f.base) || !['do', 'be', 'have'].includes(f.base) : false)));
    if (isPluralCue && !(w === 'both' && after === 'and') && (COUNT_NOUNS.has(nx) || (TIME_COUNT.has(nx) && w !== 'of')) && !(COUNT_NOUNS.has(after)) && !nounAfter && !['hundred', 'thousand'].includes(w) ) {
      if (!['time'].includes(nx) || w !== 'many') setWord(toks, i + 1, pluralOf(nx));
    }
    if (['every', 'each', 'one', 'this'].includes(w)) {
      const sing = singularOf(nx);
      if (sing && (COUNT_NOUNS.has(sing) || TIME_COUNT.has(sing)) && !(w === 'that' && analyse(nx).length) && !['news', 'series'].includes(nx)) setWord(toks, i + 1, sing);
    }
    if (w === 'many' && UNCOUNT.has(nx)) setWord(toks, i, 'much');
    if (w === 'much') {
      const sing = singularOf(nx);
      if ((sing && COUNT_NOUNS.has(sing)) || nx === 'people' || nx === 'children') setWord(toks, i, 'many');
    }
  }
  // "There is two books" / "There are a book"
  for (let i = 0; i + 2 < toks.length; i++) {
    if (toks[i].w !== 'there' || !['is', 'are', 'was', 'were'].includes(toks[i + 1].w)) continue;
    let j = i + 2;
    if (['not', 'also', 'only', 'still', 'always', 'never'].includes(toks[j].w)) j++;
    const cue = toks[j]?.w ?? '';
    const sing = cue === 'a' || cue === 'an' || cue === 'one';
    const sing2 = singularOf(cue);
    const plural = NUMBER_PLURAL.has(cue) || (/^\d+$/.test(cue) && Number(cue) > 1) || (!!sing2 && (COUNT_NOUNS.has(sing2) || TIME_COUNT.has(sing2))) || cue === 'lots' || (cue === 'a' && toks[j + 1]?.w === 'lot' && toks[j + 2]?.w === 'of' && /[a-z]s$/.test(toks[j + 3]?.w ?? '') && !/ss$/.test(toks[j + 3]?.w ?? '')) || (cue === 'a' && toks[j + 1]?.w === 'few') || cue === 'people';
    const be = toks[i + 1].w;
    const past = be === 'was' || be === 'were';
    if (plural && (be === 'is' || be === 'was')) setWord(toks, i + 1, past ? 'were' : 'are');
    else if (sing && !plural && (be === 'are' || be === 'were')) setWord(toks, i + 1, past ? 'was' : 'is');
  }

  // word usage
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    const nx = toks[i + 1]?.w ?? '';
    if (w === 'discuss' && nx === 'about') removeAt(toks, i + 1);
    else if (w === 'return' && nx === 'back') removeAt(toks, i + 1);
    else if (matchSeq(toks, i, ['cope', 'up', 'with'])) removeAt(toks, i + 1);
    else if (['do', 'does', 'did', 'doing', 'done'].includes(w) && (nx === 'a' || nx === 'the') && ['mistake', 'mistakes'].includes(toks[i + 2]?.w ?? '') && !(i > 0 && ['not'].includes(toks[i - 1].w))) setWord(toks, i, ({ do: 'make', does: 'makes', did: 'made', doing: 'making', done: 'made' } as Record<string, string>)[w]);
    else if (['make', 'makes', 'made', 'making'].includes(w) && (nx === 'homework' || (nx === 'work' && (!toks[i + 2] || /[.,!?]$/.test(toks[i + 1].raw) || ['today', 'daily', 'yesterday', 'tomorrow', 'now', 'every', 'before', 'after', 'at', 'in', 'on', 'for'].includes(toks[i + 2].w)))) && toks[i + 2]?.w !== 'of' && !(i > 0 && !PRON.has(toks[i - 1].w) && !['to', 'not', 'will', 'can', 'must', 'should', 'did', 'does', 'do'].includes(toks[i - 1].w) && /s$/.test(toks[i - 1].w) === false && false)) setWord(toks, i, ({ make: 'do', makes: 'does', made: 'did', making: 'doing' } as Record<string, string>)[w]);
    else if (['say', 'says', 'said', 'saying'].includes(w) && (nx === 'a' || nx === 'lies' || nx === 'lie') && (nx !== 'a' || ['lie', 'lies'].includes(toks[i + 2]?.w ?? ''))) setWord(toks, i, ({ say: 'tell', says: 'tells', said: 'told', saying: 'telling' } as Record<string, string>)[w]);
    else if (['learn', 'learns', 'learned', 'learnt'].includes(w) && OBJ_PRON.has(nx) && nx !== 'you' && !['to', 'from'].includes(toks[i + 2]?.w ?? '') && analyse(toks[i + 2]?.w ?? '').length === 0 && toks[i + 2] && !['learn'].includes(toks[i + 2].w) && DET_LIKE.has(toks[i + 2].w) === false && false) { /* ambiguous */ }
    else if (['learn', 'learns'].includes(w) && ['me', 'him', 'her', 'us', 'them'].includes(nx) && toks[i + 2] && (isKnownWord(toks[i + 2].w)) && !['to', 'from', 'about'].includes(toks[i + 2].w) && (DET_LIKE.has(toks[i + 2].w) || analyse(toks[i + 2].w).length === 0)) setWord(toks, i, w === 'learn' ? 'teach' : 'teaches');
    else if (['borrow', 'borrowed'].includes(w) && ['me', 'him', 'her', 'us', 'them'].includes(nx) && toks[i + 2] && !['from', 'to'].includes(toks[i + 2].w)) setWord(toks, i, w === 'borrow' ? 'lend' : 'lent');
    else if (['explain', 'explained', 'explains', 'describe', 'described', 'suggest', 'suggested'].includes(w) && ['me', 'him', 'her', 'us', 'them'].includes(nx) && toks[i + 2]?.w !== 'to') insertBefore(toks, i + 1, 'to');
    else if (['listen', 'listens', 'listened', 'listening'].includes(w) && ['the', 'my', 'his', 'her', 'your', 'our', 'their', 'me', 'him', 'them', 'us'].includes(nx)) insertBefore(toks, i + 1, 'to');
    else if (['look', 'looks', 'looked', 'looking'].includes(w) && !/[,]$/.test(toks[i].raw) && toks[i + 2]?.w !== 'way' && ['the', 'my', 'his', 'her', 'your', 'our', 'their', 'this', 'that', 'these', 'those'].includes(nx)) insertBefore(toks, i + 1, 'at');
    else if (['wait', 'waits', 'waited', 'waiting'].includes(w) && !['is', 'are', 'was', 'were', 'am'].includes(toks[i - 1]?.w ?? '') && (OBJ_PRON.has(nx) || ['the', 'my', 'his', 'her', 'your', 'our', 'their'].includes(nx)) && !(toks[i + 2]?.w === 'to')) insertBefore(toks, i + 1, 'for');
    else if (['talk', 'talks', 'talked', 'talking', 'speak', 'speaks', 'spoke', 'speaking'].includes(w) && ['me', 'him', 'her', 'us', 'them'].includes(nx) && !['into', 'out', 'about', 'to'].includes(toks[i + 2]?.w ?? '')) insertBefore(toks, i + 1, 'to');
    else if (['arrive', 'arrived', 'arrives', 'arriving'].includes(w) && nx === 'to') setWord(toks, i + 1, CITIES.has(toks[i + 2]?.w ?? '') ? 'in' : 'at');
    else if (['depend', 'depends', 'depended', 'depending'].includes(w) && ['of', 'in'].includes(nx)) setWord(toks, i + 1, 'on');
    else if (['interested'].includes(w) && ['on', 'about', 'at'].includes(nx)) setWord(toks, i + 1, 'in');
    else if (['afraid', 'scared'].includes(w) && nx === 'from') setWord(toks, i + 1, 'of');
    else if (w === 'late' && nx === 'to' && i > 0 && analyse(toks[i + 2]?.w ?? '').length === 0) setWord(toks, i + 1, 'for');
    else if (w === 'different' && nx === 'with') setWord(toks, i + 1, 'from');
    else if (w === 'by' && nx === 'walk') replaceSeq(toks, i, 2, ['on', 'foot']);
    else if (w === 'in' && ['bus', 'train', 'car', 'auto', 'bike', 'cycle', 'plane', 'flight', 'metro'].includes(nx) && i > 0 && /^(go|goes|went|going|come|comes|came|coming|travel|travelled|traveled|travelling|traveling|reach|reached)$/.test(toks[i - 1].w)) setWord(toks, i, 'by');
    else if (/^(live|lives|lived|living|stay|stays|stayed|staying|work|works|worked|working|born)$/.test(w) && nx === 'at' && CITIES.has(toks[i + 2]?.w ?? '')) setWord(toks, i + 1, 'in');
    else if (w === 'since' && /^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)$/.test(nx) && /^(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$/.test(toks[i + 2]?.w ?? '')) setWord(toks, i, 'for');
    else if (w === 'for' && /^(19|20)\d\d$/.test(nx)) setWord(toks, i, 'since');
    else if ((w === 'in' || w === 'on') && /^\d{1,2}(:\d\d)?$/.test(nx) && ['am', 'pm', "o'clock"].includes(toks[i + 2]?.w ?? '')) setWord(toks, i, 'at');
    else if ((w === 'at' || w === 'on') && /^(19|20)\d\d$/.test(nx)) setWord(toks, i, 'in');
    else if (w === 'at' && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(nx)) setWord(toks, i, 'on');
    else if (w === 'on' && /^(january|february|march|april|june|july|august|september|october|november|december)$/.test(nx) && !/^\d/.test(toks[i + 2]?.w ?? '')) setWord(toks, i, 'in');
    else if (w === 'in' && nx === 'home' && i > 0 && !['the'].includes(toks[i - 1].w)) setWord(toks, i, 'at');
    else if (w === 'to' && nx === 'home' && i > 0 && MOTION.has(toks[i - 1].w)) removeAt(toks, i);
    else if (w === 'your' && nx === 'good' && toks[i + 2]?.w === 'name') removeAt(toks, i + 1);
    else if (['am', "i'm"].includes(w) && ING_ADJ[nx] && (w === "i'm" || (i > 0 && toks[i - 1].w === 'i'))) setWord(toks, i + 1, ING_ADJ[nx]);
    else if (w === 'i' && nx === 'am' && ING_ADJ[toks[i + 2]?.w ?? '']) setWord(toks, i + 2, ING_ADJ[toks[i + 2].w]);
  }
  return toks;
}

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [SUBJECT_FORM, OBJECT_FORM, ONE_SYLLABLE, SUPER_OF, ING_ADJ] as object[]) Object.setPrototypeOf(table, null);
