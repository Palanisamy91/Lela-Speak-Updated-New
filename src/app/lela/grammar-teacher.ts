// Full-sentence grammar teacher. Pure functions, no Angular.
//
// It starts from the sentence the app's existing rule-based corrector already fixed (optional), applies more rules for tense
// formation, verb forms, agreement, articles, prepositions, plurals, spelling, missing words and word order, then lists
// every change as "incorrect word -> correct word". It never edits the learner's own sentence: `original` is returned as given.
//
// Honest limit: this is a rule-based checker, not an AI. It finds the common mistakes it has rules for, and it can miss others.

import { ADVERBS_BETWEEN, IRREGULAR_VERBS, NOUN_VERBS, VERBS, analyse, ingForm, participleForm, pastForm, thirdPerson } from './verb-forms';
import { TENSE_NAMES, mainTense } from './tense-check';
import type { TenseId } from './tense-data';
import { explainAll, tenseNote } from './mistake-explainer';
import type { Mistake, MistakeDetail, MistakeType, TypedMistake } from './mistake-explainer';
import { verbForms as engineForms } from './clause-engine';
import { cleanWords, extraRules, fixClauses } from './english-checker';
import type { FixContext } from './english-checker';
import { tenseLesson } from './tense-data';

export type { Mistake, MistakeDetail, MistakeType };

export interface Note { english: string; tamil: string }

export interface TeacherResult {
  original: string;
  corrected: string;
  mistakes: Mistake[];
  /** One explanation (type, simple English, simple Tamil) for each mistake, in the same order. */
  details: MistakeDetail[];
  correct: boolean;
  tense: TenseId | null;
  tenseName: string | null;
  /** The tense the learner chose in Tense Practice (never changed by the checker). */
  selectedTense?: TenseId;
  /** The tense the learner's own sentence is written in. */
  writtenTense?: TenseId | null;
  /** True when the sentence is in a different tense from the selected one. */
  tenseMismatch?: boolean;
  /** Extra explanation about the tense (mismatch, time-word conflict, verbs that cannot be continuous). */
  tenseNotes?: Note[];
  /** Set when the meaning is not clear enough to correct safely: a question to ask the learner. */
  clarify?: Note;
}

const MODALS = new Set(['will', 'shall', 'can', 'could', 'would', 'should', 'must', 'may', 'might', 'won\'t', 'can\'t', 'cannot', 'couldn\'t', 'wouldn\'t', 'shouldn\'t', 'mustn\'t']);
const DO_AUX = new Set(['do', 'does', 'did', 'don\'t', 'doesn\'t', 'didn\'t']);
const PRONOUN_BE: Record<string, string> = { i: 'am', you: 'are', we: 'are', they: 'are', he: 'is', she: 'is', it: 'is' };
const SUBJECTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);
const PLURAL_SUBJ = new Set(['i', 'you', 'we', 'they']);
const SINGULAR_SUBJ = new Set(['he', 'she', 'it']);
const NOUN_SUBJ = new Set(['mother', 'father', 'brother', 'sister', 'friend', 'teacher', 'boss', 'manager', 'everyone', 'someone', 'nobody', 'doctor', 'wife', 'husband', 'son', 'daughter', 'colleague']);
const PAST_MARKER = /\b(yesterday|ago|last (night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|time|summer|winter)|in (19|20)\d\d|when i was|when he was|when she was)\b/i;
const FUTURE_MARKER = /\b(tomorrow|next|will|shall|going to|tonight)\b/i;
const NUMBER_WORDS = new Set(['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'many', 'several', 'few', 'hundred', 'thousand']);
const TIME_UNITS = /^(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|decade|decades)$/;

const MISSPELLINGS: Record<string, string> = {
  recieve: 'receive', definately: 'definitely', beautifull: 'beautiful', begining: 'beginning', wich: 'which', becuase: 'because', becouse: 'because',
  tommorow: 'tomorrow', tomorow: 'tomorrow', freind: 'friend', goverment: 'government', enviroment: 'environment', adress: 'address', seperate: 'separate',
  occured: 'occurred', untill: 'until', wensday: 'Wednesday', thier: 'their', realy: 'really', littel: 'little', diffrent: 'different', intresting: 'interesting',
  intrested: 'interested', comming: 'coming', writting: 'writing', refering: 'referring', sucess: 'success', succesful: 'successful', neccessary: 'necessary',
  necesary: 'necessary', accomodation: 'accommodation', appartment: 'apartment', arguement: 'argument', calender: 'calendar', collegue: 'colleague', commitee: 'committee',
  excercise: 'exercise', experiance: 'experience', familar: 'familiar', foriegn: 'foreign', grammer: 'grammar', happend: 'happened', harrass: 'harass', immediatly: 'immediately',
  independant: 'independent', knowlege: 'knowledge', libary: 'library', lenght: 'length', mispell: 'misspell', noticable: 'noticeable', occassion: 'occasion',
  paralel: 'parallel', persue: 'pursue', posible: 'possible', prefered: 'preferred', priviledge: 'privilege', probly: 'probably', reccomend: 'recommend', recomend: 'recommend',
  relevent: 'relevant', resturant: 'restaurant', restarant: 'restaurant', rythm: 'rhythm', shedule: 'schedule', sincerly: 'sincerely', speach: 'speech',
  strenght: 'strength', suprise: 'surprise', tecnology: 'technology', techer: 'teacher', tounge: 'tongue', truely: 'truly', usefull: 'useful', vaccum: 'vacuum',
  wierd: 'weird', whith: 'with', wich_: 'which', yeild: 'yield', alot: 'a lot', afternoom: 'afternoon', morining: 'morning', eveing: 'evening', scool: 'school', skul: 'school',
  studing: 'studying', stuent: 'student', lerning: 'learning', englsh: 'English', inglish: 'English', halp: 'help', plese: 'please', pleace: 'place', frend: 'friend',
  yestarday: 'yesterday', yesterady: 'yesterday', yeserday: 'yesterday', wnat: 'want', thnk: 'think', goood: 'good', goodd: 'good', verry: 'very', ofice: 'office', offcie: 'office',
  compnay: 'company', comapny: 'company', moblie: 'mobile', compter: 'computer', computar: 'computer', sofware: 'software', develper: 'developer', buisness: 'business',
  bussiness: 'business', importent: 'important', improvment: 'improvement', fimily: 'family', famly: 'family', hospitel: 'hospital', docter: 'doctor', medecine: 'medicine',
};

const ARTICLE_PLACES = new Set(['office', 'market', 'bank', 'hospital', 'station', 'airport', 'supermarket', 'shop', 'mall', 'cinema', 'library', 'park', 'beach', 'doctor', 'dentist', 'bus stand', 'post office', 'pharmacy', 'temple', 'theatre', 'theater', 'restaurant']);
const COUNTABLE = new Set(['car', 'bike', 'book', 'pen', 'phone', 'laptop', 'house', 'job', 'idea', 'question', 'problem', 'meeting', 'shirt', 'bag', 'watch', 'cat', 'dog', 'test', 'exam', 'ticket', 'friend', 'brother', 'sister', 'child', 'student', 'teacher', 'day', 'week', 'month', 'year', 'hour', 'minute', 'person', 'man', 'woman', 'room', 'table', 'chair', 'letter', 'email', 'message', 'mobile', 'computer', 'camera', 'plan', 'game', 'movie', 'film', 'song', 'story', 'bus', 'train', 'flat', 'apartment', 'company', 'project']);
const IRREGULAR_PLURAL: Record<string, string> = { child: 'children', man: 'men', woman: 'women', person: 'people', company: 'companies', story: 'stories', bus: 'buses', watch: 'watches', box: 'boxes' };
const ADJ_AFTER_PRONOUN = new Set(['happy', 'sad', 'tired', 'busy', 'hungry', 'thirsty', 'ready', 'late', 'sick', 'angry', 'fine', 'good', 'bad', 'free', 'sorry', 'afraid', 'excited', 'worried', 'nervous', 'confused', 'lazy', 'poor', 'rich', 'ok', 'okay', 'well']);
const FREQ = new Set(['always', 'never', 'usually', 'often', 'sometimes', 'seldom']);

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

interface Tok { w: string; raw: string }

function tokenise(sentence: string): Tok[] {
  return sentence.replace(/[‘’]/g, "'").split(/\s+/).filter(Boolean).map((raw) => ({ raw, w: raw.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '') }));
}

/** A token's edge punctuation (",", ".", "?") is kept when its word is replaced. */
function withPunct(raw: string, word: string): string {
  const lead = raw.match(/^[^A-Za-z0-9']+/)?.[0] ?? '';
  const trail = raw.match(/[^A-Za-z0-9']+$/)?.[0] ?? '';
  return `${lead}${word}${trail}`;
}

function set(toks: Tok[], i: number, word: string): void {
  const upper = /^[A-Z]/.test(toks[i].raw.replace(/^[^A-Za-z]+/, ''));
  toks[i] = { raw: withPunct(toks[i].raw, upper ? cap(word) : word), w: word.toLowerCase() };
}

function insertBefore(toks: Tok[], i: number, word: string): void {
  const first = i === 0 && /^[A-Z]/.test(toks[0].raw);
  if (first) { toks[0] = { raw: toks[0].raw[0].toLowerCase() + toks[0].raw.slice(1), w: toks[0].w }; }
  toks.splice(i, 0, { raw: first ? cap(word) : word, w: word.toLowerCase() });
}

const kinds = (w: string) => analyse(w);
const isBaseVerb = (w: string) => VERBS.has(w);

/** Index of the next word that is not a filler adverb. */
function skipAdv(toks: Tok[], i: number): number {
  let j = i;
  while (j < toks.length && ADVERBS_BETWEEN.has(toks[j].w)) j++;
  return j;
}

function agreeHave(toks: Tok[], i: number): 'have' | 'has' {
  const p = i > 0 ? toks[i - 1].w : '';
  return SINGULAR_SUBJ.has(p) || NOUN_SUBJ.has(p) ? 'has' : 'have';
}

/** All the extra rules. They run on word tokens and change one thing at a time. */
function applyRules(input: Tok[], skipVerbs = false): Tok[] {
  const toks = input.map((t) => ({ ...t }));
  const text = toks.map((t) => t.w).join(' ');
  // "since last week", "than yesterday": the time word is not the time of the action
  const hasPast = PAST_MARKER.test(text.replace(/\b(since|than|like|as|until|till|before|after|about|of|from|for) (yesterday|(?:the )?last \w+|the other day)\b/g, '$1_'));
  const hasFuture = FUTURE_MARKER.test(text);

  // 1. spelling
  for (let i = 0; i < toks.length; i++) {
    const fix = MISSPELLINGS[toks[i].w];
    if (fix) { toks[i] = { raw: withPunct(toks[i].raw, /^[A-Z]/.test(toks[i].raw) ? cap(fix) : fix), w: fix.toLowerCase() }; }
  }

  // 2. "am agree" -> "agree"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (['am', 'is', 'are'].includes(toks[i].w) && toks[i + 1].w === 'agree') {
      const subj = i > 0 ? toks[i - 1].w : '';
      toks.splice(i, 1);
      if (SINGULAR_SUBJ.has(subj)) set(toks, i, 'agrees');
      if (i === 0) { toks[0] = { raw: cap(toks[0].raw), w: toks[0].w }; }
    }
  }

  if (!skipVerbs) {
  // 3. helping verb + wrong verb form
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    if (MODALS.has(w) || DO_AUX.has(w) || w === 'to') {
      let j = skipAdv(toks, i + 1);
      // "will not" etc. is covered by ADVERBS_BETWEEN; questions put the subject in between ("Did you went?")
      if ((DO_AUX.has(w) || MODALS.has(w)) && j < toks.length && SUBJECTS.has(toks[j].w) && i === 0) j = skipAdv(toks, j + 1);
      if (j >= toks.length) continue;
      const cur = toks[j].w;
      if (w === 'to' && (j !== i + 1)) continue;
      if (cur === 'be' || cur === 'have' || cur === 'do') continue;
      const forms = kinds(cur).filter((f) => f.kind !== 'base');
      if (!forms.length || VERBS.has(cur)) continue;
      if (w === 'to') {
        // "to goes"/"to went" are wrong; "to meeting" (-ing after to) can be right, so only third-person/past forms change here.
        const f = forms.find((x) => x.kind === 'third' || x.kind === 'past');
        if (f && i > 0 && VERBS.has(toks[i - 1].w) || (f && i > 0 && ['want', 'wants', 'wanted', 'need', 'needs', 'needed', 'going', 'like', 'likes', 'liked', 'try', 'tries', 'tried', 'have', 'has', 'had', 'able', 'wish', 'hope', 'decide', 'decided', 'plan', 'planned'].includes(toks[i - 1].w))) set(toks, j, f!.base);
        continue;
      }
      set(toks, j, forms[0].base);
    }
  }

  // 4. have / has / had + wrong verb form -> past participle ; been + verb -> -ing ; be + base verb -> -ing
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].w;
    if (w === 'have' || w === 'has' || w === 'had') {
      const j = skipAdv(toks, i + 1);
      if (j >= toks.length) continue;
      const cur = toks[j].w;
      if (cur === 'been') {
        const k = skipAdv(toks, j + 1);
        if (k < toks.length) {
          const f = kinds(toks[k].w).find((x) => x.kind === 'base' || x.kind === 'third' || x.kind === 'past');
          if (f && !NOUN_VERBS.has(toks[k].w) || (f && NOUN_VERBS.has(toks[k].w) && k + 1 <= toks.length)) {
            if (f) set(toks, k, ingForm(f.base));
          }
        }
        continue;
      }
      if (cur === 'being') { set(toks, j, 'been'); continue; }
      if (cur === 'to') continue;
      const forms = kinds(cur);
      if (!forms.length) continue;
      const base = forms[0].base;
      if (forms.some((f) => f.kind === 'pp') && !VERBS.has(cur)) continue; // already a participle
      if (VERBS.has(cur) && IRREGULAR_VERBS_PP_DIFFERS(base)) { set(toks, j, participleForm(base)); continue; }
      if (VERBS.has(cur) && !NOUN_VERBS.has(cur) && !IRREGULAR_VERBS_PP_DIFFERS(base)) { set(toks, j, participleForm(base)); continue; }
      const past = forms.find((f) => f.kind === 'past');
      if (past && !forms.some((f) => f.kind === 'pp')) set(toks, j, participleForm(past.base));
    }
    if (w === 'be' && i > 0 && MODALS.has(toks[i - 1].w)) {
      const j = skipAdv(toks, i + 1);
      if (j < toks.length) { const f = kinds(toks[j].w).find((x) => x.kind === 'base' || x.kind === 'third'); if (f) set(toks, j, ingForm(f.base)); }
    }
    if (['am', 'is', 'are', 'was', 'were'].includes(w)) {
      const j = skipAdv(toks, i + 1);
      if (j >= toks.length) continue;
      const cur = toks[j].w;
      if (['agree'].includes(cur)) continue;
      const all = kinds(cur);
      const passive = all.some((x) => x.kind === 'pp') && !VERBS.has(cur); // was held, were found, is given
      if (passive) continue;
      const f = all.find((x) => x.kind === 'base' || (x.kind === 'past' && !toks[j].w.endsWith('ed')) || x.kind === 'third');
      if (f && (VERBS.has(cur) || f.kind !== 'base')) {
        const nxt = toks[j + 1]?.w ?? '';
        // "is open", "was close" are adjectives; "am work", "was eat", "is went" are not.
        if (['open', 'close', 'clear', 'free', 'like', 'worry', 'complete', 'empty', 'correct', 'perfect', 'separate', 'equal', 'fit', 'fine', 'right', 'wrong', 'present', 'content', 'final', 'total', 'secure', 'alive', 'ready'].includes(cur)) continue;
        if (f.kind === 'third' && NOUN_VERBS.has(f.base)) continue; // "were tears of joy": a plural noun, not a verb
        if (cur === 'go' && nxt === 'to' && ['am', 'is', 'are'].includes(w) && false) continue;
        set(toks, j, ingForm(f.base));
      }
    }
    if (w === 'will' || w === 'shall') {
      const j = skipAdv(toks, i + 1);
      if (j < toks.length && toks[j].w === 'have') {
        const k = skipAdv(toks, j + 1);
        if (k < toks.length && toks[k].w === 'been') {
          const m = skipAdv(toks, k + 1);
          if (m < toks.length) { const f = kinds(toks[m].w).find((x) => x.kind === 'base' || x.kind === 'third' || x.kind === 'past'); if (f) set(toks, m, ingForm(f.base)); }
        } else if (k < toks.length) {
          const f = kinds(toks[k].w).find((x) => x.kind === 'base' || x.kind === 'third' || x.kind === 'past');
          if (f && !NOUN_VERBS.has(toks[k].w) && toks[k].w !== 'to') set(toks, k, participleForm(f.base));
        }
      }
    }
  }

  // 5. duration with for/since: present continuous -> present perfect continuous ("I am working here for five years")
  if (!hasFuture) {
    for (let i = 0; i + 1 < toks.length; i++) {
      if (!['am', 'is', 'are'].includes(toks[i].w)) continue;
      const j = skipAdv(toks, i + 1);
      const ingOf = j < toks.length ? kinds(toks[j].w).find((f) => f.kind === 'ing') : undefined;
      if (!ingOf) continue;
      const rest = toks.slice(j + 1).map((t) => t.w);
      const forIdx = rest.indexOf('for');
      const sinceIdx = rest.indexOf('since');
      const durationFor = forIdx >= 0 && (NUMBER_WORDS.has(rest[forIdx + 1]) || /^\d+$/.test(rest[forIdx + 1] ?? '') || ['a', 'an', 'one'].includes(rest[forIdx + 1])) && TIME_UNITS.test(rest[forIdx + 2] ?? '');
      if (durationFor || sinceIdx >= 0) {
        const aux = toks[i].w === 'am' || toks[i].w === 'are' ? 'have' : 'has';
        const subjHas = i > 0 && (SINGULAR_SUBJ.has(toks[i - 1].w) || NOUN_SUBJ.has(toks[i - 1].w));
        const finalAux = subjHas ? 'has' : 'have';
        void aux;
        set(toks, i, finalAux);
        toks.splice(i + 1, 0, { raw: 'been', w: 'been' });
      }
    }
  }

  // 6. past time marker with a present verb
  if (hasPast) {
    const hasPastVerb = toks.some((t, i) => ['was', 'were', 'did', 'had', 'would', 'could'].includes(t.w) || (i > 0 && kinds(t.w).some((f) => f.kind === 'past' && t.w.endsWith('ed')) ) || (i > 0 && kinds(t.w).some((f) => f.kind === 'past' && f.base in { } === false && t.w !== kinds(t.w)[0]?.base && !VERBS.has(t.w))));
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].w;
      const prev = i > 0 ? toks[skipBack(toks, i)].w : '';
      const prevIsSubject = SUBJECTS.has(prev) || NOUN_SUBJ.has(prev) || (i > 1 && /^[A-Z]/.test(toks[skipBack(toks, i)].raw) && skipBack(toks, i) > 0);
      if (!prevIsSubject) continue;
      if (w === 'am') { set(toks, i, 'was'); break; }
      if (w === 'is') { set(toks, i, 'was'); break; }
      if (w === 'are') { set(toks, i, 'were'); break; }
      if (w === 'have' || w === 'has') { set(toks, i, 'had'); break; }
      if (hasPastVerb) break;
      const f = kinds(w).find((x) => x.kind === 'base' || x.kind === 'third');
      if (f && !(MODALS.has(w) || DO_AUX.has(w))) { set(toks, i, pastForm(f.base)); break; }
    }
  }

  // 6b. "...woke up early and go office" -> "...and went ...": a verb joined by and/then/but follows the past verb
  if (hasPast) {
    for (let i = 1; i < toks.length; i++) {
      if (!['and', 'then', 'but'].includes(toks[i - 1].w)) continue;
      const f = kinds(toks[i].w).find((x) => x.kind === 'base' || x.kind === 'third');
      const earlierPast = toks.slice(0, i - 1).some((t) => ['was', 'were', 'had'].includes(t.w) || kinds(t.w).some((k) => k.kind === 'past' && !VERBS.has(t.w)));
      if (f && earlierPast && !MODALS.has(toks[i].w) && !NOUN_VERBS.has(toks[i].w) || (f && earlierPast && ['work', 'play', 'walk', 'call', 'visit', 'cook', 'study'].includes(toks[i].w) && toks[i + 1] && !['and', 'to'].includes(toks[i + 1].w) && false)) set(toks, i, pastForm(f!.base));
    }
  }

  // 7. subject-verb agreement in the present simple
  if (!hasPast) {
    for (let i = 1; i < toks.length; i++) {
      const prev = toks[i - 1].w;
      const prevPrev = i > 1 ? toks[i - 2].w : '';
      if (MODALS.has(prevPrev) || DO_AUX.has(prevPrev) || prevPrev === 'to') continue;
      const w = toks[i].w;
      if (PLURAL_SUBJ.has(prev)) {
        const f = kinds(w).find((x) => x.kind === 'third' && !VERBS.has(w));
        if (f && !['is', 'was'].includes(w) && w !== 'has') set(toks, i, f.base);
      } else if (SINGULAR_SUBJ.has(prev) && !MODALS.has(w)) {
        if (VERBS.has(w) && !NOUN_VERBS.has(w) && !['be'].includes(w) && !(toks[i + 1] && toks[i + 1].w === 'to' && w === 'going')) set(toks, i, thirdPerson(w));
        else if (NOUN_VERBS.has(w) && !['it'].includes(prev) && toks[i + 1] && !['to', 'a', 'the'].includes('')) { /* "she work" */ set(toks, i, thirdPerson(w)); }
      }
    }
  }

  }

  // 8. articles after place prepositions: "go to office" -> "go to the office"
  for (let i = 0; i + 1 < toks.length; i++) {
    if (!['to', 'at', 'in', 'from', 'near', 'into'].includes(toks[i].w)) continue;
    const two = `${toks[i + 1].w} ${toks[i + 2]?.w ?? ''}`.trim();
    const place = ARTICLE_PLACES.has(two) ? two : ARTICLE_PLACES.has(toks[i + 1].w) ? toks[i + 1].w : '';
    if (!place) continue;
    if (['temple', 'park', 'restaurant', 'beach', 'theatre', 'theater', 'shop', 'doctor', 'dentist', 'pharmacy', 'mall', 'cinema', 'library'].includes(place) && toks[i].w === 'in') { /* "in park" also needs "the" */ }
    insertBefore(toks, i + 1, 'the');
    i++;
  }

  // 8b. "go office" -> "go to the office"; "leave to work" -> "leave for work"; "wash face" -> "wash my face"
  for (let i = 0; i + 1 < toks.length; i++) {
    const w = toks[i].w;
    if (['go', 'goes', 'went', 'going', 'gone', 'come', 'comes', 'came', 'coming', 'reach', 'reached'].includes(w)) {
      const two = `${toks[i + 1].w} ${toks[i + 2]?.w ?? ''}`.trim();
      const place = ARTICLE_PLACES.has(two) ? two : ARTICLE_PLACES.has(toks[i + 1].w) ? toks[i + 1].w : '';
      if (place && !['reach', 'reached'].includes(w)) { insertBefore(toks, i + 1, 'to'); insertBefore(toks, i + 2, 'the'); i += 2; continue; }
    }
    if (['leave', 'leaves', 'left', 'leaving'].includes(w) && toks[i + 1].w === 'to' && /^(work|school|office|college|home)$/.test(toks[i + 2]?.w ?? '')) set(toks, i + 1, 'for');
    if (['wash', 'washes', 'washed', 'washing', 'brush', 'brushes', 'brushed', 'brushing'].includes(w) && /^(face|teeth|hands|hair)$/.test(toks[i + 1].w)) {
      const subj = toks.slice(0, i).map((t) => t.w).reverse().find((x) => x in PRONOUN_BE) ?? 'i';
      const poss = ({ i: 'my', you: 'your', he: 'his', she: 'her', we: 'our', they: 'their', it: 'its' } as Record<string, string>)[subj];
      insertBefore(toks, i + 1, poss);
      i++;
    }
  }

  // 9. "a/an" before a singular countable noun after a verb
  for (let i = 0; i + 1 < toks.length; i++) {
    if (!['have', 'has', 'had', 'bought', 'buy', 'saw', 'need', 'needs', 'want', 'wants', 'own', 'got', 'get', 'is', 'was'].includes(toks[i].w)) continue;
    if (toks[i].w === 'own' && i > 0 && ['my', 'your', 'his', 'her', 'our', 'their', 'its'].includes(toks[i - 1].w)) continue;
    const n = toks[i + 1].w;
    if (!COUNTABLE.has(n) || ['day', 'week', 'month', 'year', 'hour', 'minute'].includes(n)) continue;
    if (['is', 'was'].includes(toks[i].w) && !['job', 'student', 'teacher', 'idea', 'problem', 'friend'].includes(n)) continue;
    if (i > 0 && ['there', 'here'].includes(toks[i - 1].w)) { /* "there is car" also needs a/an */ }
    insertBefore(toks, i + 1, /^[aeiou]/.test(n) ? 'an' : 'a');
    i++;
  }

  // 10. plural after a number: "five year" -> "five years"
  for (let i = 0; i + 1 < toks.length; i++) {
    const n = toks[i].w;
    const isNum = NUMBER_WORDS.has(n) || (/^\d+$/.test(n) && Number(n) > 1);
    if (!isNum) continue;
    const noun = toks[i + 1].w;
    if (!COUNTABLE.has(noun)) continue;
    set(toks, i + 1, IRREGULAR_PLURAL[noun] ?? (/(s|x|ch|sh)$/.test(noun) ? `${noun}es` : /[^aeiou]y$/.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`));
  }

  // 11. missing "am/is/are"
  for (let i = 0; i + 1 < toks.length; i++) {
    const p = toks[i].w;
    if (!(p in PRONOUN_BE)) continue;
    if (i > 0 && ['am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'will', 'can', 'could', 'would', 'should', 'have', 'has', 'had'].includes(toks[i - 1].w)) continue; // question word order: "Are you going?"
    const j = i + 1;
    const nxt = toks[j].w;
    const ing = kinds(nxt).find((f) => f.kind === 'ing');
    if (ing && !VERBS.has(nxt)) { insertBefore(toks, j, PRONOUN_BE[p]); i++; continue; }
    const k = ['very', 'so', 'too', 'really'].includes(nxt) ? j + 1 : j;
    if (k < toks.length && ADJ_AFTER_PRONOUN.has(toks[k].w) && !VERBS.has(toks[k].w)) { insertBefore(toks, j, PRONOUN_BE[p]); i++; continue; }
    if (nxt === 'a' || nxt === 'an') { if (toks[j + 1] && !VERBS.has(toks[j + 1].w) && !['have', 'has'].includes(toks[j + 1].w)) { insertBefore(toks, j, PRONOUN_BE[p]); i++; } }
  }

  // 12. word order
  for (let i = 0; i + 2 < toks.length; i++) {
    if (SUBJECTS.has(toks[i].w) && FREQ.has(toks[i + 2].w) && (VERBS.has(toks[i + 1].w) || kinds(toks[i + 1].w).length) && !['is', 'am', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did'].includes(toks[i + 1].w)) {
      const verb = toks[i + 1]; const adv = toks[i + 2];
      toks[i + 1] = { raw: withPunct(adv.raw, adv.w), w: adv.w };
      toks[i + 2] = { raw: withPunct(verb.raw, verb.w), w: verb.w };
    }
    if (i === 0 && (toks.length <= 6 || /\?$/.test(toks[toks.length - 1].raw)) && ['what', 'where', 'why', 'when', 'how', 'who'].includes(toks[i].w) && SUBJECTS.has(toks[i + 1].w) && ['am', 'is', 'are', 'was', 'were'].includes(toks[i + 2].w)) {
      const subj = toks[i + 1]; const be = toks[i + 2];
      toks[i + 1] = { raw: be.raw, w: be.w }; toks[i + 2] = { raw: subj.raw, w: subj.w };
    }
  }

  // 13. prepositions
  for (let i = 0; i + 1 < toks.length; i++) {
    const a = toks[i].w, b = toks[i + 1].w;
    if (a === 'in' && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(b)) set(toks, i, 'on');
    else if ((a === 'on' || a === 'at' || a === 'in') && /^(morning|afternoon|evening)$/.test(b) && !(i > 0 && toks[i - 1].w === 'the')) { set(toks, i, 'in'); insertBefore(toks, i + 1, 'the'); }
    else if (a === 'in' && b === 'night') set(toks, i, 'at');
    else if (a === 'at' && b === 'the' && /^(morning|afternoon|evening)$/.test(toks[i + 2]?.w ?? '')) set(toks, i, 'in');
    else if (a === 'for' && /^(yesterday|monday|tuesday|morning|january|february|march|april|may|june|july|august|september|october|november|december)$/.test(b) && !hasFuture) set(toks, i, 'since');
    else if (a === 'married' && b === 'with') set(toks, i + 1, 'to');
    else if (a === 'good' && b === 'in' && toks[i + 2] && /^(english|maths|math|science|tamil|singing|cooking|drawing|sports)$/.test(toks[i + 2].w)) set(toks, i + 1, 'at');
    else if (a === 'angry' && b === 'on') set(toks, i + 1, 'with');
    else if (a === 'different' && b === 'than') set(toks, i + 1, 'from');
    else if (a === 'listen' && /^(music|song|songs|radio|news)$/.test(b)) insertBefore(toks, i + 1, 'to');
    else if (a === 'reach' && b === 'to') toks.splice(i + 1, 1);
    else if (a === 'enter' && b === 'into') toks.splice(i + 1, 1);
  }
  return toks;
}

function IRREGULAR_VERBS_PP_DIFFERS(base: string): boolean {
  return base in IRREGULAR_VERBS && participleForm(base) !== base;
}

function skipBack(toks: Tok[], i: number): number {
  let j = i - 1;
  while (j > 0 && ADVERBS_BETWEEN.has(toks[j].w)) j--;
  return Math.max(0, j);
}

// ------------------------------------------------------------------------------------------------------------------
// Turning two sentences into a short list of mistakes
// ------------------------------------------------------------------------------------------------------------------

const clean = (s: string) => s.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');
const norm = (s: string) => clean(s).toLowerCase();

/** Word-level difference between the learner's sentence and the corrected one. Capital letters and punctuation are ignored. */
export function diffMistakes(original: string, corrected: string): Mistake[] {
  const a = original.replace(/[‘’]/g, "'").split(/\s+/).filter((t) => norm(t));
  const b = corrected.replace(/[‘’]/g, "'").split(/\s+/).filter((t) => norm(t));
  const swaps: Mistake[] = [];
  const lcsLen = (u: string[], v: string[]): number => {
    const t = Array.from({ length: u.length + 1 }, () => Array<number>(v.length + 1).fill(0));
    for (let i = u.length - 1; i >= 0; i--) for (let j = v.length - 1; j >= 0; j--) t[i][j] = norm(u[i]) === norm(v[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    return t[0][0];
  };
  for (let x = 0; x + 1 < a.length; x++) {
    if (norm(a[x]) === norm(a[x + 1])) continue;
    const y = b.findIndex((_, k) => k + 1 < b.length && norm(b[k]) === norm(a[x + 1]) && norm(b[k + 1]) === norm(a[x]));
    if (y < 0) continue;
    const swapped = [...a]; swapped[x] = a[x + 1]; swapped[x + 1] = a[x];
    // a real word-order mistake: swapping the two words makes the sentence match the corrected one clearly better
    if (lcsLen(swapped, b) >= lcsLen(a, b) + 2) {
      swaps.push({ found: `${clean(a[x])} ${clean(a[x + 1])}`, replacement: `${clean(b[y])} ${clean(b[y + 1])}` });
      a[x] = swapped[x]; a[x + 1] = swapped[x + 1];
      x++;
    }
  }
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: Mistake[] = [];
  let i = 0, j = 0;
  let del: string[] = [], ins: string[] = [];
  let leftCtx = '';
  const flush = (rightCtx: string) => {
    if (!del.length && !ins.length) return;
    if (del.length && ins.length) {
      if (del.length === ins.length) del.forEach((d, k) => out.push({ found: clean(d), replacement: clean(ins[k]) }));
      else {
        // "go → went to the" reads better with the word it belongs to: "go office → went to the office"
        const needsRight = rightCtx && ['the', 'a', 'an', 'to', 'my', 'your', 'his', 'her', 'our', 'their'].includes(clean(ins[ins.length - 1]).toLowerCase());
        out.push({ found: [...del.map(clean), needsRight ? rightCtx : ''].filter(Boolean).join(' '), replacement: [...ins.map(clean), needsRight ? rightCtx : ''].filter(Boolean).join(' ') });
      }
    } else if (ins.length) {
      out.push({ found: [leftCtx, rightCtx].filter(Boolean).join(' '), replacement: [leftCtx, ins.map(clean).join(' '), rightCtx].filter(Boolean).join(' ') });
    } else {
      out.push({ found: del.map(clean).join(' '), replacement: '(remove)' });
    }
    del = []; ins = [];
  };
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) { flush(clean(a[i])); leftCtx = clean(a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) del.push(a[i++]);
    else ins.push(b[j++]);
  }
  while (i < n) del.push(a[i++]);
  while (j < m) ins.push(b[j++]);
  flush('');
  out.unshift(...swaps);
  return out.filter((x) => x.found || x.replacement);
}

/** Capital letter at the start and a full stop at the end, copying the learner's own final punctuation when there is one. */
function tidy(sentence: string, original: string): string {
  let s = sentence.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  s = cap(s.replace(/\bi\b(?!')/g, 'I'));
  const end = original.trim().match(/[.!?]$/)?.[0];
  if (!/[.!?]$/.test(s)) s += end ?? '.';
  return s;
}

const WH = /^(what|where|when|why|who|whom|whose|which|how)$/i;
const INVERT = /^(do|does|did|is|are|am|was|were|have|has|had|can|could|will|would|shall|should|may|might)$/i;

/** A question the learner wrote without a question mark gets one ("where you are going" -> "Where are you going?"). */
function questionMark(said: string, corrected: string): string {
  if (/[.!?]$/.test(said.trim()) && !/\.$/.test(said.trim()) || !/\.$/.test(corrected)) return corrected;
  if (/\.$/.test(said.trim())) return corrected;
  const w = corrected.split(/\s+/);
  const isQ = WH.test(w[0] ?? '') ? INVERT.test(w[1] ?? '') : INVERT.test(w[0] ?? '') && /^(i|you|he|she|it|we|they|there|this|that|the|my|your|his|her|our|their)$/i.test(w[1] ?? '');
  return isQ ? corrected.replace(/\.$/, '?') : corrected;
}

const GREETING = /^(good (morning|afternoon|evening|night)|thank you|thanks|hello|hi|hey|bye|goodbye|welcome|sorry|please|excuse me|congratulations|happy (birthday|new year|pongal|diwali)|see you|take care|well done|good luck|nice to meet you|no problem|of course|me too|not at all)\b/i;

function hasVerb(words: string[]): boolean {
  return words.some((w) => ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'can', 'could', 'would', 'should', 'must', 'may', 'might', "don't", "doesn't", "didn't", "i'm", "he's", "she's", "it's", "we're", "they're", "you're", "that's", "there's", "what's", "let's"].includes(w) || analyse(w).length > 0);
}

/**
 * Word order: the words the learner used and the corrected sentence share are compared in order. If the order differs, one
 * "Word Order" mistake is reported for the part that moved, and the other mistakes are found on the sentence with that part moved.
 */
function splitOrder(said: string, corrected: string): { order: TypedMistake | null; aligned: string } {
  const a = said.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  const b = corrected.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  const na = a.map(norm);
  const nb = b.map(norm);
  // longest common subsequence: the words that stayed where they were
  const L: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = na[i] === nb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const matchA = new Set<number>();
  const matchB = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (na[i] === nb[j]) { matchA.add(i); matchB.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  // words that were removed in one place and added in another have moved
  const freeB = new Map<string, number[]>();
  nb.forEach((w, j) => { if (!matchB.has(j)) freeB.set(w, [...(freeB.get(w) ?? []), j]); });
  const keepA: number[] = [];
  const keepB: number[] = [];
  a.forEach((_, i) => {
    if (matchA.has(i)) return;
    const slots = freeB.get(na[i]);
    if (slots?.length) { keepA.push(i); keepB.push(slots.shift() as number); }
  });
  if (!keepA.length) return { order: null, aligned: said };
  const posA = [...[...matchA], ...keepA].sort((x, y) => x - y);
  const posB = [...[...matchB], ...keepB].sort((x, y) => x - y);
  const ca = posA.map((i) => a[i]);
  const cb = posB.map((j) => b[j]);
  if (ca.length < 3 || ca.map(norm).join(' ') === cb.map(norm).join(' ')) return { order: null, aligned: said };
  let l = 0;
  while (l < ca.length && norm(ca[l]) === norm(cb[l])) l++;
  let r = ca.length - 1;
  while (r > l && norm(ca[r]) === norm(cb[r])) r--;
  const aligned = [...a];
  posA.forEach((pos, k) => { aligned[pos] = cb[k]; });
  const end = said.trim().match(/[.!?]+$/)?.[0] ?? '';
  return { order: { found: ca.slice(l, r + 1).map(clean).join(' '), replacement: cb.slice(l, r + 1).map(clean).join(' '), type: 'Word Order' }, aligned: aligned.join(' ') + end };
}

/**
 * Checks one sentence. `baseCorrected` is the sentence after the app's existing corrector (optional).
 * `original` is returned exactly as the learner wrote or said it. `opts.tense` is the tense chosen in Tense Practice:
 * the sentence is corrected INTO that tense and the selected tense is never changed.
 */
export function teachSentence(original: string, baseCorrected?: string, opts: { tense?: TenseId } = {}): TeacherResult {
  const said = original.trim();
  const start = (baseCorrected ?? said).trim() || said;
  const broken = /\b(am|is|are|was|were)\s+\w+\s+\1\b/i.test(start) && !/\b(am|is|are|was|were)\s+\w+\s+\1\b/i.test(said);
  let toks = tokenise(broken ? said : start);
  toks = cleanWords(toks);
  const fx = fixClauses(toks, { tense: opts.tense });
  toks = fx.tokens;
  for (let pass = 0; pass < 3; pass++) {
    const before = toks.map((t) => t.w).join(' ');
    toks = applyRules(toks, fx.ctx.parsed);
    toks = extraRules(toks);
    if (toks.map((t) => t.w).join(' ') === before) break;
  }
  const corrected = tidy(toks.map((t) => t.raw).join(' '), said);
  const split = splitOrder(said, corrected);
  const typed: TypedMistake[] = diffMistakes(split.aligned, corrected);
  if (split.order) typed.unshift(split.order);
  const mistakes: Mistake[] = typed.map((m) => ({ found: m.found, replacement: m.replacement }));
  const correct = mistakes.length === 0;
  const finalSentence = correct ? said : questionMark(said, corrected);
  const tense = mainTense(finalSentence);
  const writtenTense = fx.ctx.detected ?? mainTense(said);
  const sel = opts.tense;
  const tenseChanged = !!sel && !!writtenTense && writtenTense !== sel && fx.ctx.changedVerbs;
  const saidWords = said.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
  const details = explainAll(typed, { selected: sel, detected: writtenTense, intended: sel ?? tense, tenseChanged: tenseChanged || (!sel && fx.ctx.changedVerbs && !!writtenTense && writtenTense !== tense), originalWords: saidWords, question: /\?\s*$/.test(said) });

  const notes: Note[] = [];
  let tenseMismatch = false;
  if (sel) {
    const sentenceTense = fx.ctx.detected ?? mainTense(said);
    if (sentenceTense && sentenceTense !== sel && !(sel === 'future-simple' && /\b(am|is|are) going to\b/i.test(said))) {
      tenseMismatch = true;
      const n = tenseNote(sel, sentenceTense);
      if (n) notes.push(n);
    }
    const lesson = tenseLesson(sel);
    if (fx.ctx.stative) {
      const v = fx.ctx.stative.lemma;
      notes.push({
        english: `"${v}" is a state verb. It is not normally used in a continuous tense, so I have not changed it. You can use ${lesson?.name ?? 'this tense'} with a different action verb, or choose the simple tense for "${v}".`,
        tamil: `"${v}" ஒரு நிலை வினை (state verb). இது பொதுவாக continuous tense-ல் வராது, அதனால் நான் மாற்றவில்லை. வேறு செயல் வினையுடன் இந்தக் காலத்தைப் பயன்படுத்துங்கள், அல்லது "${v}"-க்கு simple tense பயன்படுத்துங்கள்.`,
      });
    }
    if (fx.ctx.conflict) {
      const c = fx.ctx.conflict;
      const what = c.kind === 'past' ? 'the past' : c.kind === 'future' ? 'the future' : 'a time that started in the past and continues now';
      const whatTa = c.kind === 'past' ? 'கடந்த காலத்தை' : c.kind === 'future' ? 'எதிர்காலத்தை' : 'கடந்த காலத்தில் தொடங்கி இப்போதும் தொடரும் நேரத்தை';
      notes.push({
        english: `"${c.marker}" shows ${what}, but you selected ${lesson?.name ?? 'this tense'}. I kept your time words. Use a time word that fits ${lesson?.name ?? 'this tense'}, or choose a tense that fits "${c.marker}".`,
        tamil: `"${c.marker}" என்பது ${whatTa} குறிக்கிறது; ஆனால் நீங்கள் ${lesson?.name ?? 'இந்தக் காலம்'} தேர்ந்தெடுத்துள்ளீர்கள். உங்கள் நேரச் சொற்களை நான் மாற்றவில்லை. ${lesson?.name ?? 'இந்தக் காலத்துக்கு'} பொருந்தும் நேரச் சொல்லைப் பயன்படுத்துங்கள், அல்லது "${c.marker}"-க்குப் பொருந்தும் காலத்தைத் தேர்ந்தெடுங்கள்.`,
      });
    }
  }

  let clarify: Note | undefined;
  if (correct && saidWords.length >= 3 && !hasVerb(saidWords) && !saidWords.some((w) => engineForms(w).length > 0) && !GREETING.test(said) && !/\?\s*$/.test(said)) {
    clarify = {
      english: 'I am not sure what you want to say. This sentence has no verb (an action or "is / am / are"). Can you tell me what you mean, or write the full sentence?',
      tamil: 'நீங்கள் என்ன சொல்ல வருகிறீர்கள் என்று எனக்குத் தெளிவாகத் தெரியவில்லை. இந்த வாக்கியத்தில் வினைச்சொல் (செயல் அல்லது "is / am / are") இல்லை. என்ன சொல்ல வருகிறீர்கள் என்று சொல்லுங்கள், அல்லது முழு வாக்கியத்தை எழுதுங்கள்.',
    };
  }
  const res: TeacherResult = { original: said, corrected: finalSentence, mistakes, details, correct: correct && !tenseMismatch, tense, tenseName: tense ? TENSE_NAMES[tense] : null };
  if (sel) { res.selectedTense = sel; res.writtenTense = writtenTense ?? null; res.tenseMismatch = tenseMismatch; }
  if (notes.length) res.tenseNotes = notes;
  if (clarify) res.clarify = clarify;
  return res;
}

/** "wake -> woke" lines for the short correction format. */
export function mistakeLines(mistakes: Mistake[]): string[] {
  return mistakes.map((m) => `${m.found} → ${m.replacement}`);
}

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [PRONOUN_BE, MISSPELLINGS, IRREGULAR_PLURAL] as object[]) Object.setPrototypeOf(table, null);
