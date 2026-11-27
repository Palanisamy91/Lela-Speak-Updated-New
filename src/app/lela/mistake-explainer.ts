// Explains each correction: the type of mistake (Spelling, Grammar, Word Order or Tense), a simple English explanation
// and a simple Tamil explanation. Pure functions, no Angular.
//
// It works from the learner's sentence and the corrected sentence, so it explains whatever was changed, whichever rule changed it.

import { IRREGULAR_VERBS, analyse } from './verb-forms';
import { MISSPELLINGS, OVERREGULARISED, UNCOUNTABLE_PLURALS, WRONG_PLURALS, editDistance, isKnownWord, singularOf } from './english-lexicon';
import { TENSE_NAMES } from './tense-check';
import { tenseLesson } from './tense-data';
import type { TenseId } from './tense-data';

export type MistakeType = 'Spelling' | 'Grammar' | 'Word Order' | 'Tense';

export interface Mistake { found: string; replacement: string }

/** The explanation of one mistake, in the same position as the mistake in `TeacherResult.mistakes`. */
export interface MistakeDetail {
  type: MistakeType;
  /** A more exact label such as "Article" or "Subject-verb agreement". */
  topic: string;
  english: string;
  tamil: string;
}

/** A mistake the checker already knows the type of (for example a word-order change). */
export type TypedMistake = Mistake & { type?: MistakeType };

export interface ExplainContext {
  selected?: TenseId;
  /** The tense the learner's verb group is written in. */
  detected?: TenseId | null;
  /** The tense that was needed (the selected tense, or the tense the time words show). */
  intended?: TenseId | null;
  tenseChanged: boolean;
  originalWords: string[];
  question: boolean;
}

const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const DO = new Set(['do', 'does', 'did', "don't", "doesn't", "didn't"]);
const HAVE = new Set(['have', 'has', 'had']);
const MODAL = new Set(['will', 'shall', 'can', 'could', 'would', 'should', 'must', 'may', 'might']);
const PREP = new Set(['in', 'on', 'at', 'for', 'since', 'to', 'from', 'of', 'with', 'by', 'about', 'into', 'than', 'as', 'during', 'while', 'after', 'before', 'between', 'under', 'over', 'through']);
const SUBJECT_PRON = new Set(['i', 'he', 'she', 'we', 'they']);
const OBJECT_PRON = new Set(['me', 'him', 'her', 'us', 'them']);
const ALL_PRON = new Set(['i', 'me', 'my', 'mine', 'he', 'him', 'his', 'she', 'her', 'hers', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'you', 'your', 'yours', 'it', 'its']);
const POSSESSIVE_ALONE = new Set(['mine', 'yours', 'hers', 'ours', 'theirs']);
const CONFUSED: Record<string, { en: string; ta: string }> = {
  "its>it's": { en: '"it\'s" means "it is" or "it has". "its" shows ownership (its tail).', ta: '"it\'s" என்றால் "it is" / "it has". "its" உரிமையைக் குறிக்கும் (its tail).' },
  "it's>its": { en: '"its" shows ownership (its tail). "it\'s" means "it is".', ta: '"its" உரிமையைக் குறிக்கும் (its tail). "it\'s" என்றால் "it is".' },
  "your>you're": { en: '"you\'re" means "you are". "your" shows ownership (your book).', ta: '"you\'re" என்றால் "you are". "your" உரிமையைக் குறிக்கும் (your book).' },
  'their>there': { en: '"there is / there are" says that something exists. "their" shows ownership (their house).', ta: '"there is / there are" ஒன்று இருப்பதைக் குறிக்கும். "their" உரிமையைக் குறிக்கும் (their house).' },
  'then>than': { en: 'Use "than" to compare two things. "then" is about time.', ta: 'இரண்டு பொருட்களை ஒப்பிட "than" பயன்படுத்துங்கள். "then" என்பது நேரத்தைக் குறிக்கும்.' },
  'to>too': { en: '"too" means "more than needed" (too hot, too much). "to" is a preposition.', ta: '"too" என்றால் "அளவுக்கு அதிகம்" (too hot, too much). "to" ஒரு முன்னிடைச்சொல்.' },
};

const TA_TYPE: Record<string, string> = {};
void TA_TYPE;

const q = (s: string) => `"${s}"`;

function clean(s: string): string { return s.replace(/[.,!?;:]+$/g, '').replace(/^[.,!?;:]+/, ''); }
function wordsOf(s: string): string[] { return clean(s).toLowerCase().split(/\s+/).filter(Boolean); }

/** Words that were removed from `a` and words that were added to reach `b` (as multisets, in order). */
function difference(a: string[], b: string[]): { removed: string[]; added: string[] } {
  const bag = new Map<string, number>();
  for (const w of b) bag.set(w, (bag.get(w) ?? 0) + 1);
  const removed: string[] = [];
  for (const w of a) { const n = bag.get(w) ?? 0; if (n > 0) bag.set(w, n - 1); else removed.push(w); }
  const bag2 = new Map<string, number>();
  for (const w of a) bag2.set(w, (bag2.get(w) ?? 0) + 1);
  const added: string[] = [];
  for (const w of b) { const n = bag2.get(w) ?? 0; if (n > 0) bag2.set(w, n - 1); else added.push(w); }
  return { removed, added };
}

const isVerbish = (w: string): boolean => BE.has(w) || HAVE.has(w) || DO.has(w) || MODAL.has(w) || analyse(w).length > 0;

function lemmaOf(w: string): string | null {
  const f = analyse(w);
  if (f.length) return f[0].base;
  if (['am', 'is', 'are', 'was', 'were', 'been', 'being', 'be'].includes(w)) return 'be';
  if (['has', 'had', 'have'].includes(w)) return 'have';
  if (['does', 'did', 'do', 'done'].includes(w)) return 'do';
  return null;
}

type Detail = { type: MistakeType; topic: string; english: string; tamil: string };

const tenseName = (t: TenseId | null | undefined): string => (t ? TENSE_NAMES[t] : 'another tense');

function tenseDetail(found: string, replacement: string, ctx: ExplainContext): Detail {
  const to = ctx.selected ?? ctx.intended ?? null;
  const toName = tenseName(to);
  const fromName = ctx.detected ? tenseName(ctx.detected) : null;
  const structure = to ? tenseLesson(to)?.structure : undefined;
  if (ctx.selected) {
    return {
      type: 'Tense', topic: 'Tense',
      english: `You selected ${toName}${fromName ? `, but ${q(found)} belongs to ${fromName}` : `, but ${q(found)} does not fit it`}. Use ${q(replacement)}.${structure ? ` Pattern: ${structure}.` : ''}`,
      tamil: `நீங்கள் ${toName} தேர்ந்தெடுத்துள்ளீர்கள்${fromName ? `; ஆனால் ${q(found)} என்பது ${fromName} காலத்துக்கு உரியது` : `; ஆனால் ${q(found)} அதற்குப் பொருந்தவில்லை`}. எனவே ${q(replacement)} என்று எழுதுங்கள்.${structure ? ` அமைப்பு: ${structure}.` : ''}`,
    };
  }
  return {
    type: 'Tense', topic: 'Tense',
    english: `The time word in your sentence needs ${toName}. Use ${q(replacement)} instead of ${q(found)}.${structure ? ` Pattern: ${structure}.` : ''}`,
    tamil: `உங்கள் வாக்கியத்தில் உள்ள நேரச் சொல் ${toName} காலத்தைக் கேட்கிறது. எனவே ${q(found)} அல்ல, ${q(replacement)} என்று எழுதுங்கள்.${structure ? ` அமைப்பு: ${structure}.` : ''}`,
  };
}

function verbFormDetail(r: string, a: string, before: string, ctx: ExplainContext): Detail {
  const ra = analyse(r);
  const aa = analyse(a);
  const aKind = aa[0]?.kind;
  const lem = lemmaOf(a) ?? a;
  void ra; void ctx;
  if (DO.has(before) || MODAL.has(before) || before === 'to') {
    const aux = before === 'to' ? 'to' : before;
    return {
      type: 'Grammar', topic: 'Verb form',
      english: `After ${q(aux)} use the base verb (no -s, -ed or -ing): ${q(a)}.`,
      tamil: `${q(aux)}-க்குப் பிறகு வினைச்சொல்லின் அடிப்படை வடிவம் (-s, -ed, -ing இல்லாமல்) வரும்: ${q(a)}.`,
    };
  }
  if (HAVE.has(before) || before === 'been' && aKind === 'pp') {
    return {
      type: 'Grammar', topic: 'Verb form',
      english: `After ${q(before)} use the past participle (V3) of the verb: ${q(a)}.`,
      tamil: `${q(before)}-க்குப் பிறகு வினைச்சொல்லின் V3 (past participle) வடிவம் வரும்: ${q(a)}.`,
    };
  }
  if (aKind === 'ing' || BE.has(before)) {
    return {
      type: 'Grammar', topic: 'Verb form',
      english: `After am / is / are / was / were / been use the -ing form: ${q(a)}.`,
      tamil: `am / is / are / was / were / been-க்குப் பிறகு -ing வடிவம் வரும்: ${q(a)}.`,
    };
  }
  if (aKind === 'third' || (aa[0] && a === `${lem}s`) || a.endsWith('es') || a.endsWith('s')) {
    return {
      type: 'Grammar', topic: 'Subject-verb agreement',
      english: `A singular subject (he, she, it, one person or thing) takes the verb with -s / -es: ${q(a)}.`,
      tamil: `ஒருமை எழுவாய்க்கு (he, she, it, ஒருவர்/ஒன்று) வினைச்சொல்லுடன் -s / -es சேரும்: ${q(a)}.`,
    };
  }
  return {
    type: 'Grammar', topic: 'Subject-verb agreement',
    english: `I, you, we, they and plural subjects take the base verb without -s: ${q(a)}.`,
    tamil: `I, you, we, they மற்றும் பன்மை எழுவாய்க்கு -s இல்லாத அடிப்படை வடிவம் வரும்: ${q(a)}.`,
  };
}

function singleSubstitution(r: string, a: string, before: string, ctx: ExplainContext, verbContext: boolean): Detail | null {
  // spelling and word forms first
  if (OVERREGULARISED.has(r)) {
    const base = OVERREGULARISED.get(r) ?? r;
    return {
      type: 'Grammar', topic: 'Word form',
      english: `${q(r)} is not a correct word. The irregular form of ${q(base)} is ${q(a)}.`,
      tamil: `${q(r)} சரியான சொல் அல்ல. ${q(base)}-ன் ஒழுங்கற்ற (irregular) வடிவம் ${q(a)}.`,
    };
  }
  if (UNCOUNTABLE_PLURALS[r] === a) {
    return {
      type: 'Grammar', topic: 'Uncountable noun',
      english: `${q(a)} is uncountable. It has no plural form, so do not add -s.`,
      tamil: `${q(a)} எண்ண முடியாத பெயர்ச்சொல் (uncountable). அதற்குப் பன்மை (-s) இல்லை.`,
    };
  }
  if (WRONG_PLURALS[r] === a) {
    const base = singularOf(r) ?? r;
    return {
      type: 'Grammar', topic: 'Word form',
      english: `The plural of ${q(base)} is ${q(a)}. It is an irregular plural.`,
      tamil: `${q(base)}-ன் பன்மை ${q(a)}. இது ஒழுங்கற்ற (irregular) பன்மை.`,
    };
  }
  if (r.replace("'", '') === a.replace("'", '') && a.includes("'")) {
    return {
      type: 'Spelling', topic: 'Apostrophe',
      english: `Short forms need an apostrophe: write ${q(a)}, not ${q(r)}.`,
      tamil: `சுருக்க வடிவங்களில் அப்போஸ்ட்ரபி (') வேண்டும்: ${q(r)} அல்ல, ${q(a)} என்று எழுதுங்கள்.`,
    };
  }
  const key = `${r}>${a}`;
  if (CONFUSED[key]) return { type: 'Grammar', topic: 'Confused words', english: CONFUSED[key].en, tamil: CONFUSED[key].ta };
  if (MISSPELLINGS[r] === a || (!isKnownWord(r) && isKnownWord(a) && editDistance(r, a, 3) <= 3 && !PREP.has(r))) {
    return {
      type: 'Spelling', topic: 'Spelling',
      english: `${q(r)} is spelled wrongly. The correct spelling is ${q(a)}.`,
      tamil: `${q(r)} என்பதன் எழுத்துக்கூட்டல் (spelling) தவறு. சரியான எழுத்துக்கூட்டல் ${q(a)}.`,
    };
  }
  if ((r === 'a' && a === 'an') || (r === 'an' && a === 'a')) {
    return {
      type: 'Grammar', topic: 'Article',
      english: `Use "an" before a vowel sound (a, e, i, o, u) and "a" before a consonant sound. So write ${q(a)}.`,
      tamil: `உயிர் ஒலியில் (a, e, i, o, u) தொடங்கும் சொல்லுக்கு முன் "an", மெய் ஒலிக்கு முன் "a". எனவே ${q(a)} என்று எழுதுங்கள்.`,
    };
  }
  if (PREP.has(r) && PREP.has(a)) return prepositionDetail(r, a);
  if (ALL_PRON.has(r) && ALL_PRON.has(a)) return pronounDetail(r, a);
  if (BE.has(r) && BE.has(a) && !(verbContext && ctx.tenseChanged)) {
    return {
      type: 'Grammar', topic: 'Subject-verb agreement',
      english: `Use "am" with I, "is" with he / she / it / one person, and "are" with you / we / they / plural nouns. Here: ${q(a)}.`,
      tamil: `I-க்கு "am", he / she / it / ஒருவருக்கு "is", you / we / they / பன்மைக்கு "are". இங்கே ${q(a)} சரியானது.`,
    };
  }
  if (DO.has(r) && DO.has(a) && !(ctx.tenseChanged)) {
    return {
      type: 'Grammar', topic: 'Auxiliary verb',
      english: `Use "does / doesn't" with he / she / it, and "do / don't" with I / you / we / they. Here: ${q(a)}.`,
      tamil: `he / she / it-க்கு "does / doesn't", I / you / we / they-க்கு "do / don't". இங்கே ${q(a)} சரியானது.`,
    };
  }
  if (HAVE.has(r) && HAVE.has(a) && !ctx.tenseChanged) {
    return {
      type: 'Grammar', topic: 'Subject-verb agreement',
      english: `Use "has" with he / she / it / one person, and "have" with I / you / we / they. Here: ${q(a)}.`,
      tamil: `he / she / it / ஒருவருக்கு "has", I / you / we / they-க்கு "have". இங்கே ${q(a)} சரியானது.`,
    };
  }
  if (verbContext && lemmaOf(r) && lemmaOf(r) === lemmaOf(a)) {
    return ctx.tenseChanged ? tenseDetail(r, a, ctx) : verbFormDetail(r, a, before, ctx);
  }
  if (verbContext && ctx.tenseChanged && (isVerbish(r) && isVerbish(a))) return tenseDetail(r, a, ctx);
  // singular / plural
  if (singularOf(a) === r || a === `${r}s` || a === `${r}es`) {
    return {
      type: 'Grammar', topic: 'Singular and plural',
      english: `Use the plural form here (after a number or "many / several / few"): ${q(a)}.`,
      tamil: `இங்கே பன்மை வடிவம் வேண்டும் (எண்ணுக்குப் பிறகு அல்லது many / several / few-க்குப் பிறகு): ${q(a)}.`,
    };
  }
  if (singularOf(r) === a) {
    return {
      type: 'Grammar', topic: 'Singular and plural',
      english: `Use the singular form here (after "every / each / one / this / that" or "a / an"): ${q(a)}.`,
      tamil: `இங்கே ஒருமை வடிவம் வேண்டும் ("every / each / one / this / that" அல்லது "a / an"-க்குப் பிறகு): ${q(a)}.`,
    };
  }
  if (r === 'many' && a === 'much') return { type: 'Grammar', topic: 'Word usage', english: 'Use "much" with uncountable nouns (much water) and "many" with countable nouns (many books).', tamil: 'எண்ண முடியாத பெயர்ச்சொல்லுக்கு "much" (much water), எண்ணக்கூடியதற்கு "many" (many books).' };
  if (r === 'much' && a === 'many') return { type: 'Grammar', topic: 'Word usage', english: 'Use "many" with countable nouns (many books) and "much" with uncountable nouns (much water).', tamil: 'எண்ணக்கூடிய பெயர்ச்சொல்லுக்கு "many" (many books), எண்ண முடியாததற்கு "much" (much water).' };
  return null;
}

function prepositionDetail(r: string, a: string): Detail {
  const set = new Set([r, a]);
  if (set.has('on') || set.has('at') || set.has('in')) {
    return {
      type: 'Grammar', topic: 'Preposition',
      english: `Use "on" with days and dates, "at" with clock times and "night", and "in" with months, years, cities and parts of the day (in the morning). Here: ${q(a)}.`,
      tamil: `நாள், தேதிக்கு "on"; மணி நேரம், "night"-க்கு "at"; மாதம், ஆண்டு, ஊர், காலை/மாலைக்கு "in". இங்கே ${q(a)} சரியானது.`,
    };
  }
  if (set.has('for') && set.has('since')) {
    return {
      type: 'Grammar', topic: 'Preposition',
      english: 'Use "since" with a starting point (since 2019, since Monday) and "for" with a length of time (for two years).',
      tamil: 'தொடக்கப் புள்ளிக்கு "since" (since 2019, since Monday); கால அளவுக்கு "for" (for two years).',
    };
  }
  return {
    type: 'Grammar', topic: 'Preposition',
    english: `The correct preposition here is ${q(a)}, not ${q(r)}.`,
    tamil: `இங்கே சரியான முன்னிடைச்சொல் (preposition) ${q(a)}; ${q(r)} அல்ல.`,
  };
}

function pronounDetail(r: string, a: string): Detail {
  if (POSSESSIVE_ALONE.has(r)) {
    return {
      type: 'Grammar', topic: 'Pronoun',
      english: `Before a noun use ${q(a)} (my, your, her, our, their), not ${q(r)}.`,
      tamil: `பெயர்ச்சொல்லுக்கு முன் ${q(a)} (my, your, her, our, their) பயன்படுத்துங்கள்; ${q(r)} அல்ல.`,
    };
  }
  if (OBJECT_PRON.has(r) && SUBJECT_PRON.has(a)) {
    return {
      type: 'Grammar', topic: 'Pronoun',
      english: `${q(r)} is an object pronoun. Before a verb we use the subject pronoun ${q(a)}.`,
      tamil: `${q(r)} என்பது செயப்படுபொருள் வடிவம். வினைச்சொல்லுக்கு முன் எழுவாய் வடிவம் ${q(a)} வரும்.`,
    };
  }
  if (SUBJECT_PRON.has(r) && OBJECT_PRON.has(a)) {
    return {
      type: 'Grammar', topic: 'Pronoun',
      english: `After a preposition (with, for, to ...) we use the object pronoun ${q(a)}, not ${q(r)}.`,
      tamil: `முன்னிடைச்சொல்லுக்குப் (with, for, to ...) பிறகு செயப்படுபொருள் வடிவம் ${q(a)} வரும்; ${q(r)} அல்ல.`,
    };
  }
  return {
    type: 'Grammar', topic: 'Pronoun',
    english: `Use the pronoun ${q(a)} here instead of ${q(r)}.`,
    tamil: `இங்கே ${q(r)} அல்ல, ${q(a)} என்ற பிரதிப்பெயர்ச்சொல் (pronoun) வேண்டும்.`,
  };
}

function deletionDetail(found: string[], originalWords: string[], ctx: ExplainContext): Detail {
  const f = found.join(' ');
  const first = found[0];
  const idx = originalWords.indexOf(first);
  const prev = idx > 0 ? originalWords[idx - 1] : '';
  const next = idx >= 0 ? originalWords[idx + 1] ?? '' : '';
  if (found.length === 1 && (prev === first || next === first)) {
    return { type: 'Grammar', topic: 'Repeated word', english: `The word ${q(f)} is repeated. Write it only once.`, tamil: `${q(f)} என்ற சொல் இரண்டு முறை வந்துள்ளது. ஒருமுறை மட்டும் எழுதுங்கள்.` };
  }
  if (found.length === 1 && ['a', 'an', 'the'].includes(first)) {
    const sportsMeal = /^(cricket|football|tennis|chess|hockey|badminton|volleyball|basketball|carrom|kabaddi|golf|breakfast|lunch|dinner|supper)$/.test(next);
    return {
      type: 'Grammar', topic: 'Article',
      english: sportsMeal ? `We do not use "the" before sports and meals: play cricket, have breakfast.` : `${q(f)} is not needed here (for example, not before uncountable nouns such as information or advice).`,
      tamil: sportsMeal ? `விளையாட்டுகள் மற்றும் உணவு வேளைகளுக்கு முன் "the" வராது: play cricket, have breakfast.` : `இங்கே ${q(f)} தேவையில்லை (information, advice போன்ற எண்ண முடியாத பெயர்ச்சொற்களுக்கு முன் வராது).`,
    };
  }
  if (found.length === 1 && first === 'to' && (MODAL.has(prev) || ['let', 'make', 'made', 'lets', 'me', 'him', 'her', 'us', 'them'].includes(prev) || originalWords.some((w) => MODAL.has(w)))) {
    return { type: 'Grammar', topic: 'Helping verb', english: 'After can / could / should / must / will (and after "let me", "make him") do not use "to" before the verb.', tamil: 'can / could / should / must / will-க்குப் பிறகும், "let me", "make him" போன்றவற்றுக்குப் பிறகும் வினைக்கு முன் "to" வராது.' };
  }
  if (found.length === 1 && ['more', 'most'].includes(first)) {
    return { type: 'Grammar', topic: 'Comparison', english: `Do not use ${q(first)} with a word that already shows comparison (taller, best). Use only one.`, tamil: `ஏற்கனவே ஒப்பீட்டு வடிவம் உள்ள சொல்லுடன் (taller, best) ${q(first)} சேர்க்கக் கூடாது; ஒன்று மட்டும் போதும்.` };
  }
  if (found.length === 1 && ['but', 'so'].includes(first)) {
    return { type: 'Grammar', topic: 'Conjunction', english: `Do not use ${q(first)} together with "although / though / because". Use only one connecting word.`, tamil: `"although / though / because"-உடன் ${q(first)} சேர்க்கக் கூடாது; ஒரு இணைப்புச் சொல் மட்டும் போதும்.` };
  }
  if (found.length === 1 && first === 'will') {
    return { type: 'Grammar', topic: 'Conjunction', english: 'After "if / when / until / before / after" use the present tense for the future meaning, not "will".', tamil: '"if / when / until / before / after"-க்குப் பிறகு எதிர்காலப் பொருளுக்கும் நிகழ்காலம் (present) பயன்படுத்துங்கள்; "will" வேண்டாம்.' };
  }
  if (found.length === 1 && ['about', 'back', 'up', 'of', 'from', 'with', 'in', 'at', 'on'].includes(first)) {
    return { type: 'Grammar', topic: 'Word usage', english: `${q(f)} is not needed here. The verb already has this meaning (for example: discuss the plan, return home).`, tamil: `இங்கே ${q(f)} தேவையில்லை. வினைச்சொல்லிலேயே அந்தப் பொருள் உள்ளது (எ.கா. discuss the plan, return home).` };
  }
  if (found.length === 1 && BE.has(first)) {
    return { type: 'Grammar', topic: 'Helping verb', english: `${q(f)} is not needed here. Do not use am / is / are before a simple verb.`, tamil: `இங்கே ${q(f)} தேவையில்லை. எளிய வினைக்கு முன் am / is / are சேர்க்கக் கூடாது.` };
  }
  void ctx;
  return { type: 'Grammar', topic: 'Extra word', english: `${q(f)} is not needed in this sentence. Remove it.`, tamil: `இந்த வாக்கியத்தில் ${q(f)} தேவையில்லை. அதை நீக்குங்கள்.` };
}

function insertionDetail(added: string[], found: string, originalWords: string[], ctx: ExplainContext): Detail {
  const a = added.join(' ');
  const first = added[0];
  if (added.length === 1 && ['a', 'an', 'the'].includes(first)) {
    return first === 'the'
      ? { type: 'Grammar', topic: 'Article', english: 'Use "the" for a particular or well-known place or thing (the office, the sun, the market). Add "the".', tamil: 'குறிப்பிட்ட அல்லது அனைவரும் அறிந்த இடம்/பொருளுக்கு "the" வரும் (the office, the sun, the market). "the" சேருங்கள்.' }
      : { type: 'Grammar', topic: 'Article', english: `A singular countable noun needs "a", "an" or "the" before it. Add ${q(first)}.`, tamil: `ஒருமை, எண்ணக்கூடிய பெயர்ச்சொல்லுக்கு முன் "a", "an" அல்லது "the" வேண்டும். ${q(first)} சேருங்கள்.` };
  }
  const verbAdded = added.filter((w) => BE.has(w) || HAVE.has(w) || DO.has(w) || MODAL.has(w));
  if (verbAdded.length && ctx.tenseChanged && added.every((w) => isVerbish(w))) return tenseDetail(found, `${found} → ${a}`, ctx);
  if (added.length === 1 && BE.has(first)) {
    const q2 = ctx.question;
    return {
      type: q2 ? 'Grammar' : 'Grammar', topic: 'Helping verb',
      english: q2 ? `A question needs the helping verb ${q(first)}: ${q(a)}.` : `A sentence needs a helping verb. Use am / is / are before an -ing verb or a describing word. Add ${q(first)}.`,
      tamil: q2 ? `கேள்விக்கு ${q(first)} என்ற துணை வினை வேண்டும்.` : `வாக்கியத்தில் துணை வினை வேண்டும். -ing வினைக்கு அல்லது விளக்கும் சொல்லுக்கு முன் am / is / are வரும். ${q(first)} சேருங்கள்.`,
    };
  }
  if (added.length === 1 && DO.has(first)) {
    return { type: 'Grammar', topic: 'Auxiliary verb', english: `Questions and negative sentences in the simple tenses need do / does / did. Add ${q(first)}.`, tamil: `Simple tense-ல் கேள்வி, மறுப்பு வாக்கியங்களுக்கு do / does / did வேண்டும். ${q(first)} சேருங்கள்.` };
  }
  if (added.length === 1 && first === 'to') {
    const prev = originalWords.find((w) => /^(want|wants|wanted|need|needs|needed|hope|decide|decided|plan|wish|try|tried|learn|forgot)$/.test(w));
    return prev
      ? { type: 'Grammar', topic: 'Missing word', english: `After ${q(prev)} we use "to" + verb. Add "to".`, tamil: `${q(prev)}-க்குப் பிறகு "to + வினை" வரும். "to" சேருங்கள்.` }
      : { type: 'Grammar', topic: 'Preposition', english: 'This verb needs the preposition "to". Add "to".', tamil: 'இந்த வினைக்கு "to" என்ற முன்னிடைச்சொல் வேண்டும். "to" சேருங்கள்.' };
  }
  if (added.length === 1 && first === 'than') return { type: 'Grammar', topic: 'Comparison', english: 'Use "than" when you compare two things (taller than me).', tamil: 'இரண்டு பொருட்களை ஒப்பிடும்போது "than" வரும் (taller than me).' };
  if (added.length === 1 && PREP.has(first)) {
    return { type: 'Grammar', topic: 'Preposition', english: `This word needs the preposition ${q(first)} (for example: wait for, listen to, look at, talk to). Add ${q(first)}.`, tamil: `இந்த வினைக்கு ${q(first)} என்ற முன்னிடைச்சொல் வேண்டும் (wait for, listen to, look at, talk to). ${q(first)} சேருங்கள்.` };
  }
  if (added.length === 1 && ['i', 'it', 'he', 'she', 'we', 'they', 'you'].includes(first)) {
    return { type: 'Grammar', topic: 'Missing subject', english: `Every English sentence needs a subject. Add ${q(first === 'i' ? 'I' : first)}.`, tamil: `ஒவ்வொரு ஆங்கில வாக்கியத்துக்கும் எழுவாய் (subject) வேண்டும். ${q(first === 'i' ? 'I' : first)} சேருங்கள்.` };
  }
  if (added.length === 1 && ['my', 'your', 'his', 'her', 'our', 'their'].includes(first)) {
    return { type: 'Grammar', topic: 'Missing word', english: `Say whose it is: add ${q(first)} (wash my face, brush my teeth).`, tamil: `யாருடையது என்று சொல்ல வேண்டும்: ${q(first)} சேருங்கள் (wash my face, brush my teeth).` };
  }
  if (added.length > 1 && added.some((w) => PREP.has(w)) && added.some((w) => w === 'the' || w === 'a' || w === 'an')) {
    return { type: 'Grammar', topic: 'Preposition and article', english: `Add ${q(a)}: after a verb of movement use a preposition and the article (go to the office).`, tamil: `${q(a)} சேருங்கள்: இயக்க வினைக்குப் பிறகு முன்னிடைச்சொல்லும் article-உம் வரும் (go to the office).` };
  }
  return { type: 'Grammar', topic: 'Missing word', english: `A word is missing. Add ${q(a)}.`, tamil: `ஒரு சொல் விடுபட்டுள்ளது. ${q(a)} சேருங்கள்.` };
}

function orderDetail(m: Mistake, ctx: ExplainContext): Detail {
  return ctx.question
    ? { type: 'Word Order', topic: 'Question formation', english: `In a question the helping verb comes before the subject. Write: ${q(m.replacement)}.`, tamil: `கேள்வியில் துணை வினை (am / is / are / do / does ...) எழுவாய்க்கு முன் வரும். இப்படி எழுதுங்கள்: ${q(m.replacement)}.` }
    : { type: 'Word Order', topic: 'Word order', english: `English word order is Subject + Verb + Object ("I read the book"), not Subject + Object + Verb. Write: ${q(m.replacement)}.`, tamil: `ஆங்கில வாக்கிய வரிசை: எழுவாய் + வினை + செயப்படுபொருள் ("I read the book"). தமிழ் போல் வினை கடைசியில் வராது. இப்படி எழுதுங்கள்: ${q(m.replacement)}.` };
}

/** Explains one correction. `found` / `replacement` are the lines shown to the learner. */
export function explainMistake(m: TypedMistake, ctx: ExplainContext): MistakeDetail {
  const fw = wordsOf(m.found);
  const rw = m.replacement === '(remove)' ? [] : wordsOf(m.replacement);
  const before = (() => { const i = ctx.originalWords.indexOf(fw[0] ?? ''); return i > 0 ? ctx.originalWords[i - 1] : ''; })();
  const { removed, added } = difference(fw, rw);

  let d: Detail | null = null;
  if (m.type === 'Word Order') d = orderDetail(m, ctx);
  else if (m.replacement === '(remove)') d = deletionDetail(fw, ctx.originalWords, ctx);
  else if (fw.length === rw.length && fw.length >= 2 && removed.length === 0 && added.length === 0) {
    d = ctx.question || /^(what|where|why|when|how|who)$/.test(fw[0] ?? '') && true
      ? { type: 'Word Order', topic: 'Question formation', english: `In a question the helping verb comes before the subject: ${q(m.replacement)}.`, tamil: `கேள்வியில் துணை வினை (am / is / are / do / does ...) எழுவாய்க்கு முன் வரும்: ${q(m.replacement)}.` }
      : { type: 'Word Order', topic: 'Word order', english: `English word order is Subject + Verb + Object, and adverbs like "always" go before the main verb. Write ${q(m.replacement)}.`, tamil: `ஆங்கில வரிசை: எழுவாய் + வினை + செயப்படுபொருள்; "always" போன்ற சொற்கள் முக்கிய வினைக்கு முன் வரும். ${q(m.replacement)} என்று எழுதுங்கள்.` };
  } else if (removed.length === 0 && added.length > 0) d = insertionDetail(added, m.found, ctx.originalWords, ctx);
  else if (removed.length === 1 && added.length === 1) d = singleSubstitution(removed[0], added[0], before, ctx, isVerbish(removed[0]) || isVerbish(added[0]));
  else if (removed.length > 0 && added.length > 0) {
    const verbs = removed.concat(added).every((w) => isVerbish(w) || w === 'not' || w === 'to' || w === 'going');
    if (verbs && ctx.tenseChanged) d = tenseDetail(m.found, m.replacement, ctx);
    else if (verbs) {
      d = { type: 'Grammar', topic: 'Verb form', english: `The verb group is not correct. Write ${q(m.replacement)} instead of ${q(m.found)}.`, tamil: `வினைச்சொல் அமைப்பு சரியல்ல. ${q(m.found)} அல்ல, ${q(m.replacement)} என்று எழுதுங்கள்.` };
    } else if (added.some((w) => PREP.has(w) || w === 'the')) {
      d = { type: 'Grammar', topic: 'Preposition and article', english: `Write ${q(m.replacement)}: after a verb of movement use a preposition and the article (go to the office).`, tamil: `${q(m.replacement)} என்று எழுதுங்கள்: இயக்க வினைக்குப் பிறகு முன்னிடைச்சொல்லும் article-உம் வரும் (go to the office).` };
    } else d = { type: 'Grammar', topic: 'Word usage', english: `In English we say ${q(m.replacement)}, not ${q(m.found)}.`, tamil: `ஆங்கிலத்தில் ${q(m.found)} அல்ல, ${q(m.replacement)} என்றே சொல்வோம்.` };
  }
  if (!d) d = { type: 'Grammar', topic: 'Word usage', english: `In English we say ${q(m.replacement)}, not ${q(m.found)}.`, tamil: `ஆங்கிலத்தில் ${q(m.found)} அல்ல, ${q(m.replacement)} என்றே சொல்வோம்.` };
  return d;
}

export function explainAll(mistakes: TypedMistake[], ctx: ExplainContext): MistakeDetail[] {
  return mistakes.map((m) => explainMistake(m, ctx));
}

/** One short note about the tense of the whole sentence (shown once, not once per word). */
export function tenseNote(selected: TenseId | undefined, detected: TenseId | null | undefined): { english: string; tamil: string } | null {
  if (!selected || !detected || selected === detected) return null;
  const lesson = tenseLesson(selected);
  const S = tenseName(selected);
  const D = tenseName(detected);
  return {
    english: `You selected ${S}, but your sentence is in ${D}. ${lesson?.usage ? lesson.usage : ''}${lesson?.structure ? ` Pattern: ${lesson.structure}.` : ''}`,
    tamil: `நீங்கள் ${S} தேர்ந்தெடுத்துள்ளீர்கள்; ஆனால் உங்கள் வாக்கியம் ${D} காலத்தில் உள்ளது. ${lesson?.usageTa ?? ''}${lesson?.structure ? ` அமைப்பு: ${lesson.structure}.` : ''}`,
  };
}

export { IRREGULAR_VERBS as _irregular };

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [CONFUSED, TA_TYPE] as object[]) Object.setPrototypeOf(table, null);
