// Clause engine: reads one English clause (subject + verb group + the rest) and writes it again in any of the 12 tenses.
// Pure functions, no Angular. It is a rule-based parser for ordinary practice sentences, not a full grammar.
//
// What it is used for:
//  * Selected-tense checking: "Simple Present" is chosen, the learner writes "I went to school every day" -> "I go to school every day".
//  * Free checking: "I am go", "She go", "He don't goes", "I going office" -> the verb group is rebuilt correctly in the tense the learner meant.
//
// It never changes the subject, the main verb or the rest of the sentence. Only the helping verbs and the verb form are rebuilt.

import { FormKind, IRREGULAR_VERBS, NOUN_VERBS, VERBS, analyse, ingForm, participleForm, pastForm, thirdPerson } from './verb-forms';
import type { TenseId } from './tense-data';
import { Tok, cap } from './english-tokens';
import { isKnownWord } from './english-lexicon';

export type Person = 'I' | 'sg' | 'pl';

export const PAST_TENSES: TenseId[] = ['past-simple', 'past-continuous', 'past-perfect', 'past-perfect-continuous'];
export const FUTURE_TENSES: TenseId[] = ['future-simple', 'future-continuous', 'future-perfect', 'future-perfect-continuous'];
export const CONTINUOUS_TENSES: TenseId[] = ['present-continuous', 'past-continuous', 'future-continuous', 'present-perfect-continuous', 'past-perfect-continuous', 'future-perfect-continuous'];

const BE_FORMS = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const HAVE_FORMS = new Set(['have', 'has', 'had']);
const DO_FORMS = new Set(['do', 'does', 'did']);
const WILL = new Set(['will', 'shall']);
const OTHER_MODALS = new Set(['can', 'could', 'may', 'might', 'must', 'should', 'would', 'ought']);
const AUX_ALL = new Set([...BE_FORMS, ...HAVE_FORMS, ...DO_FORMS, ...WILL, ...OTHER_MODALS]);
const PRONOUN_SUBJECT = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);
const WH = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'whom', 'whose', 'which']);
const WH_MODIFIERS = new Set(['much', 'many', 'long', 'often', 'far', 'old', 'time', 'kind', 'kinds', 'type', 'types', 'color', 'colour', 'brand', 'day', 'month', 'year', 'number', 'about', 'else']);
const DETERMINERS = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'another', 'both', 'all', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'many', 'few', 'several']);
const FREQ_ADV = new Set(['yet', 'always', 'never', 'usually', 'often', 'sometimes', 'seldom', 'rarely', 'hardly', 'already', 'just', 'still', 'also', 'even', 'really', 'ever', 'only', 'probably', 'definitely', 'recently', 'finally', 'generally', 'normally', 'frequently', 'actually', 'currently']);
const PREPOSITIONS = new Set(['of', 'in', 'on', 'at', 'from', 'with', 'for', 'near', 'by', 'under', 'over', 'to', 'into', 'about', 'between', 'behind', 'without', 'after', 'before', 'during']);
const SUBORDINATORS = new Set(['if', 'when', 'while', 'because', 'although', 'though', 'unless', 'until', 'before', 'after', 'that', 'who', 'which', 'whom', 'whose', 'where', 'whenever', 'wherever', 'since', 'as', 'once', 'whether']);
const ADJ_ING = new Set(['amazing', 'interesting', 'boring', 'exciting', 'tiring', 'confusing', 'surprising', 'shocking', 'annoying', 'disappointing', 'relaxing', 'charming', 'pleasing', 'satisfying', 'frightening', 'embarrassing', 'encouraging', 'fascinating', 'stunning', 'promising', 'missing', 'willing', 'lasting', 'appealing', 'refreshing', 'rewarding', 'challenging', 'welcoming', 'convincing', 'demanding', 'depressing', 'exhausting', 'inspiring', 'thrilling', 'worrying', 'touching', 'striking']);
const ADJ_LIKE_VERBS = new Set(['welcome', 'open', 'close', 'clear', 'free', 'like', 'worry', 'tire', 'last', 'rest', 'fit', 'mind', 'right', 'wrong', 'fine', 'sound', 'present', 'match', 'content', 'live']);
/** After am/is/are/was/were these are adjectives even though they also have an -ing verb form ("The work is complete"). */
const ADJ_AFTER_BE = new Set(['complete', 'empty', 'correct', 'perfect', 'separate', 'equal', 'open', 'close', 'clear', 'free', 'fit', 'fine', 'right', 'wrong', 'present', 'content', 'final', 'total', 'secure', 'alive', 'ready']);
const PLACE_AFTER_TO = new Set(['work', 'school', 'college', 'church', 'temple', 'bed', 'town', 'office', 'market', 'home', 'class', 'office', 'shop', 'mall', 'bank', 'hospital', 'station', 'city', 'village', 'university', 'gym', 'park', 'beach', 'cinema', 'chennai', 'delhi', 'mumbai', 'bangalore', 'madurai', 'coimbatore', 'trichy', 'salem']);
export const STATIVE = new Set(['know', 'like', 'love', 'hate', 'want', 'need', 'prefer', 'believe', 'understand', 'remember', 'belong', 'own', 'seem', 'mean', 'contain', 'cost', 'depend', 'owe', 'doubt', 'appear', 'exist', 'matter', 'wish', 'suppose', 'consist', 'deserve', 'resemble', 'possess', 'have', 'smell', 'taste', 'sound', 'agree', 'forget', 'recognise', 'recognize', 'realise', 'realize']);
/** "have" with these nouns is an action ("I am having lunch"), not possession. */
/** "have" shows possession or illness with these nouns, so a continuous form ("am having a car") is wrong. With any other noun ("having dinner", "having a get-together") it is an action. */
export const STATIC_HAVE = new Set(['car', 'bike', 'cycle', 'scooter', 'laptop', 'phone', 'mobile', 'house', 'flat', 'home', 'brother', 'brothers', 'sister', 'sisters', 'child', 'children', 'son', 'daughter', 'wife', 'husband', 'fever', 'cough', 'cold', 'headache', 'pain', 'ache', 'stomach', 'toothache', 'years', 'year', 'experience', 'money', 'job', 'doubt', 'doubts', 'idea', 'pen', 'book', 'books', 'dog', 'cat', 'time', 'two', 'three', 'four', 'five', 'six', 'one']);
export const DYNAMIC_HAVE = new Set(['breakfast', 'lunch', 'dinner', 'tea', 'coffee', 'food', 'meal', 'shower', 'bath', 'party', 'fun', 'meeting', 'class', 'break', 'rest', 'nap', 'trouble', 'problems', 'problem', 'conversation', 'discussion', 'time', 'holiday', 'dance', 'drink', 'snack', 'chat', 'talk', 'walk', 'look', 'swim', 'sleep']);

const SINGULAR_S = new Set(['news', 'physics', 'mathematics', 'maths', 'politics', 'economics', 'series', 'species', 'class', 'business', 'address', 'glass', 'bus', 'gas', 'boss', 'process', 'status', 'success', 'loss', 'kiss', 'dress', 'ass', 'chess', 'lens', 'campus', 'virus', 'bonus', 'focus', 'pass', 'access', 'progress', 'stress', 'illness', 'happiness', 'sadness', 'kindness', 'darkness', 'witness', 'mess', 'guess', 'press', 'lunchtime', 'christmas', 'james', 'charles', 'lakshmi', 'paris', 'brunch', 'atlas', 'analysis', 'basis', 'crisis', 'diabetes', 'measles', 'sparks']);
const PLURAL_IRREGULAR = new Set(['people', 'children', 'men', 'women', 'police', 'feet', 'teeth', 'mice', 'cattle', 'staff', 'parents', 'friends']);
const PLURAL_STARTERS = new Set(['those', 'these', 'both', 'few', 'several', 'many']);
const SINGULAR_STARTERS = new Set(['everyone', 'everybody', 'everything', 'someone', 'somebody', 'something', 'anyone', 'anybody', 'anything', 'nobody', 'nothing', 'each', 'every', 'neither', 'either', 'one']);

export interface Item { w: string; idx: number; expanded: boolean }

const NEG_CONTRACTION: Record<string, [string, string]> = {
  "don't": ['do', 'not'], "doesn't": ['does', 'not'], "didn't": ['did', 'not'], "isn't": ['is', 'not'], "aren't": ['are', 'not'], "wasn't": ['was', 'not'], "weren't": ['were', 'not'],
  "haven't": ['have', 'not'], "hasn't": ['has', 'not'], "hadn't": ['had', 'not'], "won't": ['will', 'not'], "can't": ['can', 'not'], cannot: ['can', 'not'], "couldn't": ['could', 'not'],
  "wouldn't": ['would', 'not'], "shouldn't": ['should', 'not'], "mustn't": ['must', 'not'], "shan't": ['shall', 'not'], "mightn't": ['might', 'not'],
};
const SUBJ_CONTRACTION: Record<string, [string, string]> = {
  "i'm": ['i', 'am'], "you're": ['you', 'are'], "we're": ['we', 'are'], "they're": ['they', 'are'], "he's": ['he', 'is'], "she's": ['she', 'is'], "it's": ['it', 'is'],
  "i've": ['i', 'have'], "you've": ['you', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'],
  "i'll": ['i', 'will'], "you'll": ['you', 'will'], "he'll": ['he', 'will'], "she'll": ['she', 'will'], "it'll": ['it', 'will'], "we'll": ['we', 'will'], "they'll": ['they', 'will'],
  "i'd": ['i', 'would'], "you'd": ['you', 'would'], "he'd": ['he', 'would'], "she'd": ['she', 'would'], "we'd": ['we', 'would'], "they'd": ['they', 'would'],
  "what's": ['what', 'is'], "where's": ['where', 'is'], "who's": ['who', 'is'], "how's": ['how', 'is'], "when's": ['when', 'is'], "why's": ['why', 'is'], "that's": ['that', 'is'],
};

const isPpOnly = (w: string): boolean => { const k = analyse(w); return k.length > 0 && k.every((x) => x.kind === 'pp') && !VERBS.has(w); };
const isEdWord = (w: string): boolean => w.length > 3 && w.endsWith('ed');

/** Splits contractions into the words they stand for ("doesn't" -> does + not). Each word remembers which written word it came from. */
export function expandItems(toks: Tok[]): Item[] {
  const out: Item[] = [];
  toks.forEach((tok, idx) => {
    const w = tok.w;
    const neg = NEG_CONTRACTION[w];
    if (neg) { out.push({ w: neg[0], idx, expanded: true }, { w: neg[1], idx, expanded: true }); return; }
    const subj = SUBJ_CONTRACTION[w];
    if (subj) {
      let second = subj[1];
      const next = toks[idx + 1]?.w ?? '';
      if ((second === 'is') && (next === 'been' || next === 'got' || isPpOnly(next))) second = 'has';
      if (second === 'would' && (next === 'been' || isPpOnly(next) || (isEdWord(next) && !['like', 'love', 'prefer'].includes(next)))) second = 'had';
      out.push({ w: subj[0], idx, expanded: true }, { w: second, idx, expanded: true });
      return;
    }
    out.push({ w, idx, expanded: false });
  });
  return out;
}

/** The written tokens for a run of items. A contracted token ("he's") that carries a helping verb is cut back to its pronoun. */
function tokensOf(all: Tok[], items: Item[]): Tok[] {
  const out: Tok[] = [];
  let last = -1;
  for (const it of items) {
    if (it.idx === last) continue;
    last = it.idx;
    const t = all[it.idx];
    if (SUBJ_CONTRACTION[t.w] && it.expanded) {
      const first = SUBJ_CONTRACTION[t.w][0];
      const raw = /^[A-Z]/.test(t.raw) && first !== 'i' ? cap(first) : first === 'i' ? (t.raw[0] === 'I' ? 'I' : 'i') : first;
      out.push({ w: first, raw: raw + (t.raw.match(/[,;:]$/)?.[0] ?? '') });
    } else out.push(t);
  }
  return out;
}

export function personOf(subject: Tok[]): Person {
  const ws = subject.map((t) => t.w);
  if (!ws.length) return 'pl';
  if (ws.length === 1) {
    const w = ws[0];
    if (w === 'i') return 'I';
    if (w === 'he' || w === 'she' || w === 'it') return 'sg';
    if (w === 'we' || w === 'you' || w === 'they') return 'pl';
  }
  // "my brother and I", "Ravi and Kumar"
  const cut = ws.findIndex((w, i) => i > 0 && PREPOSITIONS.has(w));
  const region = cut > 0 ? ws.slice(0, cut) : ws;
  if (region.includes('and') && region.indexOf('and') > 0) return 'pl';
  if (SINGULAR_STARTERS.has(region[0]) && region[0] !== 'one') return 'sg';
  if (PLURAL_STARTERS.has(region[0])) return 'pl';
  if (region[0] === 'one' || (region[0] === 'each') || (region[0] === 'every')) return 'sg';
  if (['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that'].includes(region[0]) === false && (region[0] === 'many' || region[0] === 'several' || region[0] === 'both' || region[0] === 'few' || /^([2-9]|\d{2,}|two|three|four|five|six|seven|eight|nine|ten)$/.test(region[0]))) return 'pl';
  if (ws.slice(0, 3).join(' ') === 'a lot of' || ws.slice(0, 2).join(' ') === 'lots of' || ws.slice(0, 4).join(' ') === 'a number of' || ws.slice(0, 4).join(' ') === 'a couple of' || ws.slice(0, 3).join(' ') === 'a few' || ws.slice(0, 2).join(' ') === 'a few') return ws[0] === 'a' && ws[1] === 'few' ? 'pl' : 'pl';
  if (ws[0] === 'the' && ws[1] === 'number' && ws[2] === 'of') return 'sg';
  if (['one', 'each', 'every', 'either', 'neither'].includes(region[0])) return 'sg';
  const head = region[region.length - 1];
  const rawHead = subject[region.length - 1]?.raw ?? '';
  if (PLURAL_IRREGULAR.has(head)) return 'pl';
  if (SINGULAR_S.has(head)) return 'sg';
  if (/^[A-Z]/.test(rawHead) && region.length >= 1 && subject[0].raw !== rawHead && !/^(The|A|An|My|Your|His|Her|Our|Their)$/.test(subject[0].raw)) return 'sg';
  if (/^[A-Z]{2,}s$/.test(rawHead)) return 'pl';
  if (/^[A-Z]{2,}$/.test(rawHead)) return 'sg';
  if (head.length > 3 && head.endsWith('s') && !head.endsWith('ss') && !head.endsWith('us') && (!head.endsWith('is') || !/(sis|xis|nnis|vis|ris|ois|ics)$/.test(head) && head.length > 4)) return 'pl';
  return 'sg';
}

export interface ParsedClause {
  lead: Tok[];
  wh: Tok[];
  /** "Who went?": the question word is the subject. */
  whSubject: boolean;
  subject: Tok[];
  person: Person;
  advs: Tok[];
  question: boolean;
  neg: boolean;
  contractedNeg: boolean;
  /** helping verbs as written (am, has, been, will, do ...), in order, without "not". */
  auxs: string[];
  lemma: string;
  copula: boolean;
  mainKind: FormKind;
  modal: string | null;
  goingTo: boolean;
  /** Everything after the verb group. */
  rest: Tok[];
  endPunct: string;
  inferred: TenseId;
  /** Items that make up the written verb group, for comparing with the rebuilt one. */
  groupWords: string[];
  /** Words (not tokens) of the whole clause in the order written, contractions expanded. */
  allWords: string[];
  stativeContinuous: boolean;
  startsUpper: boolean;
}

const isFiniteAux = (w: string) => AUX_ALL.has(w);

/** Verb-looking word: a known verb form, or an -ing / -ed word of a known verb. */
export function verbForms(w: string): { base: string; kind: FormKind }[] {
  const known = analyse(w);
  if (known.length) return known;
  if (w.endsWith('ing') && w.length > 5 && isKnownWord(w) && !/(thing|ning|ding)$/.test(w.slice(-5)) && !['morning', 'evening', 'during', 'nothing', 'something', 'anything', 'everything', 'building', 'meeting', 'wedding', 'feeling', 'ceiling', 'clothing', 'training', 'painting', 'writing', 'reading'].includes(w)) {
    const stem = w.slice(0, -3);
    const undoubled = stem[stem.length - 1] === stem[stem.length - 2] ? stem.slice(0, -1) : '';
    const base = [stem, `${stem}e`, undoubled].find((b) => b && isKnownWord(b));
    return base ? [{ base, kind: 'ing' }] : [];
  }
  // regular past forms of verbs the list does not hold: shared, booked, travelled, registered
  if (w.endsWith('ed') && w.length > 4 && !/(eed|ied)$/.test(w) || /ied$/.test(w) && w.length > 4) {
    const stem = w.slice(0, -2);
    const cands = [w.slice(0, -1), stem, /ied$/.test(w) ? `${w.slice(0, -3)}y` : '', stem[stem.length - 1] === stem[stem.length - 2] ? stem.slice(0, -1) : ''];
    const base = cands.find((b) => b && b.length > 2 && isKnownWord(b));
    if (base) return [{ base, kind: 'past' }, { base, kind: 'pp' }];
  }
  return [];
}

function skipAdverbs(items: Item[], i: number, out?: Item[]): number {
  let j = i;
  while (j < items.length && FREQ_ADV.has(items[j].w)) { out?.push(items[j]); j++; }
  return j;
}

/** Where the subject noun phrase ends (exclusive), or -1 when there is no usable subject at `s`. */
function subjectEnd(items: Item[], s: number): number {
  if (s >= items.length) return -1;
  const first = items[s].w;
  if (AUX_ALL.has(first) && s === 0) return -1;
  let i = s;
  if (PRONOUN_SUBJECT.has(first)) {
    i = s + 1;
    // "he and I", "you and she"
    while (items[i]?.w === 'and' && i + 1 < items.length && (PRONOUN_SUBJECT.has(items[i + 1].w) || DETERMINERS.has(items[i + 1].w))) i += 2;
    return i;
  }
  if (first === 'there') return -1;
  if (VERBS.has(first) && !DETERMINERS.has(first) && !NOUN_VERBS.has(first) && !isKnownNoun(first)) return -1;
  // a noun phrase: take words until the verb starts
  const auxAt = (() => { for (let k = s + 1; k < Math.min(items.length, s + 8); k++) if (AUX_ALL.has(items[k].w) && !(items[k - 1] && ['to', 'of', 'the'].includes(items[k - 1].w))) return k; return -1; })();
  if (auxAt > s) return auxAt;
  for (let k = s + 1; k < Math.min(items.length, s + 8); k++) {
    const w = items[k].w;
    const prev = items[k - 1].w;
    if (PREPOSITIONS.has(prev) || DETERMINERS.has(prev)) continue;
    const forms = verbForms(w);
    if (!forms.length) continue;
    if (w === 'to') continue;
    // "the test results show": a verb-looking word followed by another bare verb is a noun
    const next = items[k + 1]?.w;
    if (next && verbForms(next).some((f) => f.kind === 'base') && !AUX_ALL.has(next) && !PREPOSITIONS.has(next) && !DETERMINERS.has(next) && k + 2 < items.length + 1 && verbForms(w).some((f) => f.kind === 'third')) continue;
    return k;
  }
  return -1;
}

const LY_NOT = new Set(['family', 'july', 'reply', 'supply', 'apply', 'rely', 'fly', 'italy', 'ally', 'belly', 'jelly', 'bully', 'lily', 'holy', 'ugly', 'only', 'early', 'daily', 'weekly', 'monthly', 'yearly', 'lovely', 'friendly', 'lonely']);
function isLyAdverb(w: string): boolean { return /^[a-z]{3,}ly$/.test(w) && !LY_NOT.has(w); }

function isKnownNoun(w: string): boolean {
  return ['name', 'work', 'plan', 'test', 'cook', 'help', 'call', 'visit', 'study', 'walk', 'play', 'light', 'water', 'fish', 'iron', 'watch', 'drink', 'dance'].includes(w) || NOUN_VERBS.has(w);
}

function endPunctOf(toks: Tok[]): string {
  const last = toks[toks.length - 1];
  return last?.raw.match(/[.!?]+$/)?.[0] ?? '';
}

function stripEnd(raw: string): string { return raw.replace(/[.!?]+$/, ''); }

/**
 * Reads one clause. Returns null when the clause is not a plain subject + verb clause that this engine understands
 * (imperatives, "there is", passives, fragments, modal verbs with no subject ...); callers then leave the tense alone.
 */
export function parseClause(input: Tok[]): ParsedClause | null {
  if (input.length < 2) return null;
  const endPunct = endPunctOf(input);
  const toks = input.map((t, i) => (i === input.length - 1 ? { ...t, raw: stripEnd(t.raw) || t.raw } : t));
  const items = expandItems(toks);
  const n = items.length;
  const isQuestionMark = endPunct.includes('?');

  // lead: "Yesterday", "Every day,", "In the morning," ...
  let p = 0;
  const lead: Item[] = [];
  const LEAD_SINGLE = new Set(['yesterday', 'today', 'tomorrow', 'tonight', 'now', 'then', 'also', 'finally', 'usually', 'sometimes', 'often', 'always', 'never', 'later', 'afterwards', 'first', 'next', 'suddenly', 'recently', 'currently', 'generally', 'normally', 'actually', 'soon', 'however']);
  for (let guard = 0; guard < 6 && p < n - 1; guard++) {
    const w = items[p].w;
    const lw = items.slice(p, p + 3).map((x) => x.w);
    let take = 0;
    if (LEAD_SINGLE.has(w) && (subjectEnd(items, p + 1) > 0 || PRONOUN_SUBJECT.has(items[p + 1]?.w))) take = 1;
    else if (/^(every|last|next|this|one|each)$/.test(w) && /^(day|night|week|month|year|morning|evening|afternoon|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|summer|winter|time)$/.test(lw[1] ?? '')) take = 2;
    else if (/^(in|at|on|during|after|before)$/.test(w) && /^(the)$/.test(lw[1] ?? '') && /^(morning|evening|afternoon|night|weekend|end)$/.test(lw[2] ?? '')) take = 3;
    else if (w === 'at' && /^(night|noon|midnight|present)$/.test(lw[1] ?? '')) take = 2;
    else if (w === 'on' && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$/.test(lw[1] ?? '')) take = 2;
    else if (w === 'yesterday' || w === 'today') take = 1;
    if (!take) break;
    // only treat it as a lead if a subject follows
    if (subjectEnd(items, p + take) <= p + take && !PRONOUN_SUBJECT.has(items[p + take]?.w ?? '')) break;
    for (let k = 0; k < take; k++) lead.push(items[p + k]);
    p += take;
  }
  // a comma ends a lead phrase: "After lunch, we went home"
  if (!lead.length) {
    const comma = items.findIndex((it, i) => i < n - 2 && i <= 5 && toks[it.idx].raw.endsWith(',') && (items[i + 1]?.idx !== it.idx));
    if (comma >= 0 && !SUBORDINATORS.has(items[0].w) && !PRONOUN_SUBJECT.has(items[0].w) && subjectEnd(items, comma + 1) > comma + 1) {
      for (let k = 0; k <= comma; k++) lead.push(items[k]);
      p = comma + 1;
    }
  }
  const leadToks = tokensOf(toks, lead);

  let wh: Item[] = [];
  let question = false;
  let whSubject = false;
  let subjStart = p;
  let firstAux: string | null = null;
  let inverted = false;
  let nonInverted = false;

  if (WH.has(items[p]?.w)) {
    let e = p + 1;
    while (e < n && WH_MODIFIERS.has(items[e].w)) e++;
    // "what time": the question word + one noun when an auxiliary follows right after
    wh = items.slice(p, e);
    question = true;
    if (e >= n) return null;
    const nx = items[e].w;
    if (AUX_ALL.has(nx) && !(nx === 'be')) {
      // "Who is coming?" / "What is happening?": the question word is the subject
      const isSubjQ = (items[p].w === 'who' || items[p].w === 'what' || items[p].w === 'which') && BE_FORMS.has(nx) && verbForms(items[e + 1]?.w ?? '').some((f) => f.kind === 'ing');
      if (isSubjQ) { whSubject = true; subjStart = e; }
      else { inverted = true; firstAux = nx; subjStart = e + 1; }
    } else if (PRONOUN_SUBJECT.has(nx) || DETERMINERS.has(nx) || subjectEnd(items, e) > e) { nonInverted = true; subjStart = e; }
    else if (verbForms(nx).length && (items[p].w === 'who' || items[p].w === 'what' || items[p].w === 'which')) { whSubject = true; subjStart = e; }
    else return null;
  } else if (AUX_ALL.has(items[p]?.w) && p === lead.length) {
    // "Do you go?" / "Have you eaten?" / "Is he a doctor?"
    const nx = items[p + 1];
    if (!nx) return null;
    if (!(PRONOUN_SUBJECT.has(nx.w) || DETERMINERS.has(nx.w) || subjectEnd(items, p + 1) > p + 1)) return null;
    inverted = true; question = true; firstAux = items[p].w; subjStart = p + 1;
  }

  let subjectToks: Tok[] = [];
  let person: Person = 'pl';
  let g = subjStart;
  if (whSubject) {
    person = 'sg';
    if (subjStart < n && AUX_ALL.has(items[subjStart].w)) g = subjStart; // who + is + coming
  } else {
    const se = subjectEnd(items, subjStart);
    if (se <= subjStart) return null;
    let seEnd = se;
    while (seEnd - 1 > subjStart && (FREQ_ADV.has(items[seEnd - 1].w) || isLyAdverb(items[seEnd - 1].w))) seEnd--;
    subjectToks = tokensOf(toks, items.slice(subjStart, seEnd));
    person = personOf(subjectToks);
    g = seEnd;
  }
  if (!subjectToks.length && !whSubject) return null;
  if (subjectToks.some((t) => SUBORDINATORS.has(t.w) || t.w === ',')) return null;

  // ---- the verb group
  const auxs: string[] = firstAux ? [firstAux] : [];
  const advs: Item[] = [];
  let neg = false;
  let contractedNeg = false;
  let i = g;
  let negSeen = false;
  const consumeNegAdv = () => {
    while (i < n) {
      if (items[i].w === 'not' || (items[i].w === 'no' && auxs.length === 0 && i + 1 < n && verbForms(items[i + 1].w).length && !DETERMINERS.has(items[i + 1].w) && !isKnownNoun(items[i + 1].w))) {
        neg = true; negSeen = true; if (items[i].expanded) contractedNeg = true; i++; continue;
      }
      if (FREQ_ADV.has(items[i].w) || isLyAdverb(items[i].w)) { advs.push(items[i]); i++; continue; }
      break;
    }
  };
  consumeNegAdv();
  // inverted yes/no: the first aux was before the subject; a copula-less "Do you ..." still needs the main verb next
  while (i < n && AUX_ALL.has(items[i].w) && !(whSubject && false)) {
    if ((HAVE_FORMS.has(items[i].w) || DO_FORMS.has(items[i].w)) && DO_FORMS.has(auxs[auxs.length - 1] ?? '')) break; // "Do you have change?": have is the main verb
    // a second "do/have/be" is a helping verb only when something verb-like follows
    auxs.push(items[i].w);
    if (items[i].expanded && items[i].w !== 'not' && NEG_CONTRACTION[toks[items[i].idx].w]) contractedNeg = true;
    i++;
    consumeNegAdv();
    if (auxs.length >= 4) break;
  }
  void negSeen;
  if (!auxs.length && !(i < n)) return null;

  let lemma = '';
  let copula = false;
  let mainKind: FormKind = 'base';
  let goingTo = false;
  let modal: string | null = null;
  let restStart = i;
  const lastAux = auxs[auxs.length - 1];

  const cand = i < n ? verbForms(items[i].w) : [];
  const takeMain = (base: string, kind: FormKind, at: number) => { lemma = base; mainKind = kind; restStart = at + 1; };
  const modals = auxs.filter((a) => WILL.has(a) || OTHER_MODALS.has(a));
  if (modals.some((m) => OTHER_MODALS.has(m))) modal = modals.find((m) => OTHER_MODALS.has(m)) ?? null;

  // "I have work to do", "She has plans today": "have" is the main verb and the next word is a noun
  if (!cand.length && DO_FORMS.has(lastAux ?? '') && i < n && !HAVE_FORMS.has(items[i].w)) return null; // an unknown verb after do/does/did: not understood, leave it
  const haveNoun = !!lastAux && HAVE_FORMS.has(lastAux) && auxs.length === 1 && i < n && isKnownNoun(items[i].w)
    && ['to', 'today', 'tomorrow', 'now', 'at', 'in', 'on', 'for', 'here', 'there', 'tonight'].includes(items[i + 1]?.w ?? 'to');
  if (cand.length && !haveNoun && !(lastAux && BE_FORMS.has(lastAux) && ADJ_ING.has(items[i].w)) && !(lastAux && BE_FORMS.has(lastAux) && ADJ_AFTER_BE.has(items[i].w)) && !(lastAux && BE_FORMS.has(lastAux) && ADJ_LIKE_VERBS.has(items[i].w) && !verbForms(items[i].w).some((f) => f.kind === 'ing'))) {
    const pick = pickForm(cand, auxs);
    if (lastAux === 'been' && pick.kind === 'pp' && !cand.some((f) => f.kind === 'ing')) return null; // "has been stuck": passive or adjective
    // be + past participle only: passive or adjective ("is given", "was held") -> leave alone
    if (BE_FORMS.has(lastAux ?? '') && lastAux !== 'been' && !HAVE_FORMS.has(auxs[0] ?? '') && cand.every((f) => f.kind === 'pp') && !VERBS.has(items[i].w)) return null;
    // "is finished", "am married": a regular -ed word after be is an adjective/passive
    if (lastAux && ['am', 'is', 'are', 'was', 'were', 'be', 'been'].includes(lastAux) && pick.kind !== 'ing' && pick.kind !== 'base' && pick.kind !== 'third' && (pick.kind === 'past' || pick.kind === 'pp') && isEdWord(items[i].w)) {
      // copula + adjective
      const lastBe = auxs.pop() as string;
      copula = true; lemma = 'be'; mainKind = beKind(lastBe); restStart = i;
    } else if (lastAux && BE_FORMS.has(lastAux) && lastAux !== 'been' && lastAux !== 'being' && pick.kind === 'pp' && !VERBS.has(items[i].w)) {
      return null;
    } else {
      takeMain(pick.base, pick.kind, i);
      // be going to + verb
      if (pick.base === 'go' && pick.kind === 'ing' && items[i + 1]?.w === 'to' && lastAux && ['am', 'is', 'are', 'was', 'were'].includes(lastAux)) {
        const after = items[i + 2]?.w ?? '';
        const f2 = verbForms(after);
        if (f2.length && !PLACE_AFTER_TO.has(after) && !DETERMINERS.has(after) && f2.some((f) => f.kind === 'base')) {
          goingTo = true; lemma = f2.find((f) => f.kind === 'base')?.base ?? lemma; mainKind = 'base'; restStart = i + 3;
        }
      }
    }
  } else if (lastAux && (BE_FORMS.has(lastAux))) {
    // copula: "is happy", "was a doctor", "have been to Chennai"
    const lastBe = auxs.pop() as string;
    copula = true; lemma = 'be'; mainKind = beKind(lastBe); restStart = i;
  } else if (lastAux && (HAVE_FORMS.has(lastAux) || DO_FORMS.has(lastAux)) && !(inverted && i >= n && false)) {
    // "I have a car", "I do homework": the helping verb is really the main verb
    const w = auxs.pop() as string;
    lemma = HAVE_FORMS.has(w) ? 'have' : 'do';
    mainKind = w === 'had' || w === 'did' ? 'past' : w === 'has' || w === 'does' ? 'third' : 'base';
    restStart = i;
    if (inverted && auxs.length === 0 && firstAux === w) {
      // "Do you ...?" with nothing after the subject
      if (i >= n) return null;
    }
  } else if (lastAux && modal) {
    return null;
  } else if (WILL.has(lastAux ?? '')) {
    return null;
  } else {
    return null; // no verb
  }

  const pastDo = auxs.includes('did');
  void pastDo;
  const groupEnd = restStart;
  const restItems = items.slice(groupEnd);
  const restFrom = restItems.length ? (items[groupEnd - 1] && items[groupEnd - 1].idx === restItems[0].idx ? restItems[0].idx + 1 : restItems[0].idx) : toks.length;
  const rest = toks.slice(restFrom);
  const groupItems = items.slice(g, groupEnd);
  if (firstAux) {
    // the group words in written order for an inverted question: aux first, then the rest of the group
  }
  const c: ParsedClause = {
    lead: leadToks, wh: tokensOf(toks, wh), whSubject, subject: subjectToks, person, advs: tokensOf(toks, advs), question: question || (isQuestionMark && inverted),
    neg, contractedNeg, auxs: auxs.slice(), lemma, copula, mainKind, modal, goingTo, rest, endPunct, inferred: 'present-simple',
    startsUpper: /^[A-Z]/.test(input[0].raw), groupWords: [...(firstAux ? [firstAux] : []), ...groupItems.map((x) => x.w)], allWords: items.map((x) => x.w), stativeContinuous: false,
  };
  void inverted; void nonInverted;
  c.inferred = inferTense(c);
  c.stativeContinuous = CONTINUOUS_TENSES.includes(c.inferred) && STATIVE.has(c.lemma) && !c.copula
    && !(c.lemma === 'have' && !STATIC_HAVE.has(firstNoun(c.rest)));
  return c;
}

function firstNoun(rest: Tok[]): string {
  for (const t of rest) if (!DETERMINERS.has(t.w) && !['good', 'nice', 'quick', 'hot', 'cold', 'long', 'short', 'big', 'small', 'lovely', 'great'].includes(t.w)) return t.w;
  return '';
}

function beKind(be: string): FormKind {
  if (be === 'was' || be === 'were') return 'past';
  if (be === 'been') return 'pp';
  if (be === 'being') return 'ing';
  if (be === 'be') return 'base';
  return 'third'; // am / is / are: the finite present of "be"
}

/** If a word can be several forms ("run" is base or past participle), choose the one that fits the helping verbs. */
function pickForm(cands: { base: string; kind: FormKind }[], auxs: string[]): { base: string; kind: FormKind } {
  const has = (k: FormKind) => cands.find((c) => c.kind === k);
  const lastAux = auxs[auxs.length - 1] ?? '';
  if (HAVE_FORMS.has(lastAux) || lastAux === 'been') return has('pp') ?? has('past') ?? has('ing') ?? cands[0];
  if (BE_FORMS.has(lastAux)) return has('ing') ?? has('base') ?? has('third') ?? has('pp') ?? cands[0];
  if (auxs.length === 0) return has('past') ?? has('third') ?? has('base') ?? has('ing') ?? has('pp') ?? cands[0];
  return has('base') ?? cands[0];
}

/** The tense the learner's verb group is written in (judged from the helping verbs first, the verb ending second). */
export function inferTense(c: Pick<ParsedClause, 'auxs' | 'mainKind' | 'copula' | 'goingTo' | 'modal' | 'lemma'>): TenseId {
  const a = c.auxs;
  const has = (w: string) => a.includes(w);
  const will = a.some((x) => WILL.has(x));
  const haveNow = has('have') || has('has');
  const had = has('had');
  const been = has('been');
  const beAux = a.some((x) => ['am', 'is', 'are', 'was', 'were', 'be'].includes(x));
  const ing = c.mainKind === 'ing' && !c.copula;
  const cont = ing || (beAux && !c.copula) || (been && !c.copula);
  if (c.goingTo) return 'future-simple';
  if (will) {
    if (haveNow || has('have')) return cont || been ? 'future-perfect-continuous' : 'future-perfect';
    if (cont || has('be')) return 'future-continuous';
    return 'future-simple';
  }
  if (c.modal) return ['could', 'would', 'might'].includes(c.modal) ? 'past-simple' : 'present-simple';
  if (had) return cont || been ? 'past-perfect-continuous' : 'past-perfect';
  if (haveNow) return cont ? 'present-perfect-continuous' : 'present-perfect';
  if (been && !c.copula) return cont && ing ? 'present-perfect-continuous' : 'present-perfect';
  if (beAux && !c.copula) return has('was') || has('were') ? 'past-continuous' : 'present-continuous';
  if (c.copula && a.length === 0) return c.mainKind === 'past' ? 'past-simple' : c.mainKind === 'pp' ? 'present-perfect' : 'present-simple';
  if (c.copula && c.mainKind === 'pp') return 'present-perfect';
  if (has('did')) return 'past-simple';
  if (has('do') || has('does')) return 'present-simple';
  if (a.length === 0) {
    if (c.mainKind === 'past') return 'past-simple';
    if (c.mainKind === 'pp') return 'past-simple';
    if (c.mainKind === 'ing') return 'present-continuous';
    return 'present-simple';
  }
  return 'present-simple';
}

// ------------------------------------------------------------------------------------------------------------------
// Writing the clause in a tense
// ------------------------------------------------------------------------------------------------------------------

const NEG_SHORT: Record<string, string> = { do: "don't", does: "doesn't", did: "didn't", is: "isn't", are: "aren't", was: "wasn't", were: "weren't", have: "haven't", has: "hasn't", had: "hadn't", will: "won't", can: "can't" };

export interface RenderOptions { contract?: boolean }

/** The words of the verb group in a tense. For questions the first word is split off so it can go before the subject. */
export function verbGroup(c: Pick<ParsedClause, 'person' | 'lemma' | 'copula' | 'neg' | 'question' | 'whSubject' | 'advs' | 'modal' | 'goingTo'>, tense: TenseId, opts: RenderOptions = {}): { first: string; rest: string[]; simple: boolean } {
  const { person, lemma, copula } = c;
  const be = (past: boolean) => (past ? (person === 'I' || person === 'sg' ? 'was' : 'were') : person === 'I' ? 'am' : person === 'sg' ? 'is' : 'are');
  const have = person === 'sg' ? 'has' : 'have';
  const ing = copula ? 'being' : ingForm(lemma);
  const pp = copula ? 'been' : participleForm(lemma);
  const baseW = copula ? 'be' : lemma;
  let words: string[];
  let simple = false;
  switch (tense) {
    case 'present-simple': words = copula ? [be(false)] : [lemma === 'have' ? have : person === 'sg' ? thirdPerson(lemma) : lemma]; simple = true; break;
    case 'present-continuous': words = [be(false), ing]; break;
    case 'present-perfect': words = [have, pp]; break;
    case 'present-perfect-continuous': words = [have, 'been', ing]; break;
    case 'past-simple': words = copula ? [be(true)] : [pastForm(lemma)]; simple = true; break;
    case 'past-continuous': words = [be(true), ing]; break;
    case 'past-perfect': words = ['had', pp]; break;
    case 'past-perfect-continuous': words = ['had', 'been', ing]; break;
    case 'future-simple': words = c.goingTo ? [be(false), 'going', 'to', baseW] : ['will', baseW]; break;
    case 'future-continuous': words = ['will', 'be', ing]; break;
    case 'future-perfect': words = ['will', 'have', pp]; break;
    case 'future-perfect-continuous': words = ['will', 'have', 'been', ing]; break;
  }
  // do-support: a simple tense of an ordinary verb needs do / does / did for "not" and for questions
  const needsDo = simple && !copula && (c.neg || (c.question && !c.whSubject));
  if (needsDo) {
    const aux = tense === 'past-simple' ? 'did' : person === 'sg' ? 'does' : 'do';
    words = [aux, baseW];
  } else if (simple && copula) {
    /* be is its own helping verb */
  }
  void opts;
  return { first: words[0], rest: words.slice(1), simple };
}

const SENT_START_LOWER = new Set(['you', 'he', 'she', 'it', 'we', 'they', 'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'some', 'any', 'every', 'each', 'everyone', 'everybody', 'who']);

const word = (w: string, raw = w): Tok => ({ w: w.toLowerCase(), raw });

/**
 * Writes the clause in the given tense. Subject, main verb and the rest of the sentence are copied as they were written.
 * `contract` keeps "doesn't"-style negatives when the learner used them.
 */
export function renderClause(c: ParsedClause, tense: TenseId): Tok[] {
  const g = verbGroup(c, tense);
  const out: Tok[] = [];
  const contract = c.contractedNeg;
  const negFor = (aux: string) => (contract && NEG_SHORT[aux] ? NEG_SHORT[aux] : aux === 'am' ? 'am' : '');
  let groupToks: Tok[] = [];
  const firstWord = g.first;
  const restWords = g.rest;
  const advToks = c.advs;

  const buildStatement = (): Tok[] => {
    const t: Tok[] = [];
    // frequency adverbs: after the first helping verb ("have never gone", "is always late"), before a plain verb ("always go")
    const simplePlain = g.simple && !c.copula && !c.neg;
    if (simplePlain) {
      t.push(...advToks, word(firstWord));
    } else {
      if (c.neg) {
        const short = negFor(firstWord);
        if (short && short !== firstWord) { t.push(word(short)); t.push(...advToks); }
        else { t.push(word(firstWord)); t.push(...advToks); t.push(word('not')); }
      } else { t.push(word(firstWord)); t.push(...advToks); }
    }
    for (const w of restWords) t.push(word(w));
    return t;
  };

  if (c.whSubject) {
    groupToks = buildStatement();
    out.push(...c.lead, ...c.wh, ...groupToks, ...c.rest);
  } else if (c.question) {
    // inverted: [wh] first-word subject [adverbs] [not] rest-of-group
    const t: Tok[] = [];
    const short = c.neg ? negFor(firstWord) : '';
    if (c.neg && short && short !== firstWord) {
      t.push(word(short), ...lowerFirst(c.subject), ...advToks, ...restWords.map((w) => word(w)));
    } else {
      t.push(word(firstWord), ...lowerFirst(c.subject), ...advToks);
      if (c.neg) t.push(word('not'));
      t.push(...restWords.map((w) => word(w)));
    }
    out.push(...c.lead, ...c.wh, ...t, ...c.rest);
  } else {
    groupToks = buildStatement();
    out.push(...c.lead, ...c.subject, ...groupToks, ...c.rest);
  }
  // sentence punctuation and capital letter
  if (out.length) {
    const lastIdx = out.length - 1;
    out[lastIdx] = { raw: out[lastIdx].raw + c.endPunct, w: out[lastIdx].w };
    if (c.startsUpper && out[0].w !== 'i') out[0] = { ...out[0], raw: cap(out[0].raw) };
    else if (out[0].w === 'i') out[0] = { ...out[0], raw: 'I' };
  }
  return out;
}

function lowerFirst(toks: Tok[]): Tok[] {
  if (!toks.length) return toks;
  const f = toks[0];
  if (/^[A-Z]/.test(f.raw) && SENT_START_LOWER.has(f.w)) return [{ ...f, raw: f.raw[0].toLowerCase() + f.raw.slice(1) }, ...toks.slice(1)];
  return toks;
}

/** Does the verb group already read as the target tense, built correctly? (Contractions and capital letters ignored.) */
export function renderedWords(toks: Tok[]): string[] {
  return expandItems(toks.map((t) => ({ ...t, raw: t.raw.replace(/[.!?]+$/, ''), w: t.w }))).map((x) => x.w.replace(/^can$/, 'can')).filter(Boolean);
}

export { IRREGULAR_VERBS };

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [NEG_CONTRACTION, SUBJ_CONTRACTION, NEG_SHORT] as object[]) Object.setPrototypeOf(table, null);
