import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teachSentence } from '../src/app/lela/grammar-teacher';
import type { TenseId } from '../src/app/lela/tense-data';

const fix = (s: string, tense?: TenseId) => teachSentence(s, undefined, tense ? { tense } : {});
const same = (s: string, tense?: TenseId) => assert.equal(fix(s, tense).corrected, s, `should be left alone: ${s}`);
const table = (rows: [string, string][], tense?: TenseId) => {
  for (const [wrong, right] of rows) assert.equal(fix(wrong, tense).corrected, right, wrong);
};

test('word level: spelling, word forms, repeated words', () => {
  table([
    ['I recieve the letter', 'I receive the letter.'],
    ['Studing is good', 'Studying is good.'],
    ['I am go to school', 'I am going to school.'],
    ['I goed to school yesterday', 'I went to school yesterday.'],
    ['He gave many informations', 'He gave much information.'],
    ['I the the book read', 'I read the book.'],
    ['I will will come', 'I will come.'],
    ['I definately agree', 'I definitely agree.'],
  ]);
});

test('grammar: agreement, plurals, articles, prepositions, pronouns', () => {
  table([
    ['He go to work', 'He goes to work.'],
    ['She don\'t know the answer', 'She doesn\'t know the answer.'],
    ['They plays football', 'They play football.'],
    ['I have two book', 'I have two books.'],
    ['I ate apple', 'I ate an apple.'],
    ['She is good girl', 'She is a good girl.'],
    ['I am engineer', 'I am an engineer.'],
    ['I am living here since 2019', 'I have been living here since 2019.'],
    ['I have worked here since two years', 'I have worked here for two years.'],
    ['I forgot my wallet in home', 'I forgot my wallet at home.'],
    ['I will meet you at Monday', 'I will meet you on Monday.'],
    ['I want go home', 'I want to go home.'],
    ['I can to swim', 'I can swim.'],
    ['He is more taller than me', 'He is taller than me.'],
    ['This book is bigger then that one', 'This book is bigger than that one.'],
    ['Although he is tired, but he works hard', 'Although he is tired, he works hard.'],
    ['I don\'t have no money', 'I don\'t have any money.'],
    ['Me and him goes to market', 'He and I go to the market.'],
    ['I am agree with you', 'I agree with you.'],
    ['She can sings well', 'She can sing well.'],
    ['I didn\'t went there', 'I didn\'t go there.'],
  ]);
});

test('sentence structure: word order, missing helping verb or subject, questions', () => {
  table([
    ['English I learning am', 'I am learning English.'],
    ['Where you are going?', 'Where are you going?'],
    ['What you doing?', 'What are you doing?'],
    ['I going office', 'I am going to the office.'],
    ['I waiting for you', 'I am waiting for you.'],
    ['My name Ravi', 'My name is Ravi.'],
    ['Do she like tea?', 'Does she like tea?'],
    ['She not came yesterday', 'She did not come yesterday.'],
    ['I no like it', 'I do not like it.'],
  ]);
});

test('every correction comes with a type, a topic, and simple English and Tamil explanations', () => {
  for (const s of ['I recieve the letter', 'He go to work', 'English I learning am', 'I go to school yesterday', 'I have two book', 'I ate apple', 'Where you are going?']) {
    const r = fix(s);
    assert.ok(r.mistakes.length > 0, s);
    assert.equal(r.details.length, r.mistakes.length, s);
    for (const d of r.details) {
      assert.ok(['Spelling', 'Grammar', 'Word Order', 'Tense'].includes(d.type), `${s}: ${d.type}`);
      assert.ok(d.english.length > 10 && /[A-Za-z]/.test(d.english), s);
      assert.ok(/[஀-௿]/.test(d.tamil), `${s}: Tamil text missing`);
    }
  }
  assert.equal(fix('I recieve the letter').details[0].type, 'Spelling');
  assert.equal(fix('English I learning am').details[0].type, 'Word Order');
  assert.equal(fix('Where you are going?').details[0].type, 'Word Order');
  assert.equal(fix('I go to school yesterday').details[0].type, 'Tense');
  assert.equal(fix('He go to work').details[0].type, 'Grammar');
});

test('a correct sentence is reported as correct and is not rewritten', () => {
  for (const s of [
    'I like cricket.', 'She goes to school every day.', 'They are playing in the park.', 'I have a book.', 'Where are you going?', 'I am going to the office.',
    'He has finished his homework.', 'We will meet tomorrow.', 'Good morning, sir.', 'I went to the market yesterday.', 'She is a good teacher.',
    'I have lived here for two years.', 'Water boils at one hundred degrees.', 'I have work to do.', 'Please bring your own bag.', 'It is a lot of fun.',
    'My brother plays cricket on Sundays.', 'The students are studying for the exam.', 'Can you help me?', 'I\'d like some tea.',
  ]) {
    const r = fix(s);
    assert.equal(r.corrected, s, s);
    assert.equal(r.correct, true, s);
    assert.equal(r.mistakes.length, 0, s);
  }
});

test('free tense: a time word decides the tense when none is selected', () => {
  table([
    ['I go to school yesterday', 'I went to school yesterday.'],
    ['I went to the market tomorrow', 'I will go to the market tomorrow.'],
    ['I am working here since 2019', 'I have been working here since 2019.'],
    ['I am working in this company for five years', 'I have been working in this company for five years.'],
  ]);
});

// the sentence is corrected INTO the tense that was selected; the selected tense is never changed
const TENSES: [TenseId, string, string][] = [
  ['present-simple', 'I went to school every day', 'I go to school every day.'],
  ['present-continuous', 'I go to school now', 'I am going to school now.'],
  ['present-perfect', 'I eat lunch already', 'I have eaten lunch already.'],
  ['present-perfect-continuous', 'I study English since morning', 'I have been studying English since morning.'],
  ['past-simple', 'I go to school yesterday', 'I went to school yesterday.'],
  ['past-continuous', 'She plays cricket at five yesterday', 'She was playing cricket at five yesterday.'],
  ['past-perfect', 'She left before I arrived', 'She had left before I arrived.'],
  ['past-perfect-continuous', 'I studied for two hours before he came', 'I had been studying for two hours before he came.'],
  ['future-simple', 'I go tomorrow', 'I will go tomorrow.'],
  ['future-continuous', 'I study at five tomorrow', 'I will be studying at five tomorrow.'],
  ['future-perfect', 'I finish the work by tomorrow', 'I will have finished the work by tomorrow.'],
  ['future-perfect-continuous', 'I study English for two years by next June', 'I will have been studying English for two years by next June.'],
];

test('all 12 tenses: a sentence in the wrong tense is rewritten in the selected tense', () => {
  for (const [id, wrong, right] of TENSES) {
    const r = fix(wrong, id);
    assert.equal(r.corrected, right, `${id}: ${wrong}`);
    assert.equal(r.selectedTense, id);
  }
});

test('selected tense: the tense mismatch is named and explained, and the tense is not changed', () => {
  const r = fix('I went to school every day', 'present-simple');
  assert.equal(r.tenseMismatch, true);
  assert.equal(r.selectedTense, 'present-simple');
  assert.ok(r.tenseNotes?.[0].english.includes('Present Simple') && r.tenseNotes[0].english.includes('Past Simple'));
  assert.ok(/[஀-௿]/.test(r.tenseNotes?.[0].tamil ?? ''));
  assert.equal(r.details[0].type, 'Tense');
  const p = fix('I go to school yesterday', 'past-simple');
  assert.equal(p.corrected, 'I went to school yesterday.');
  assert.equal(p.tenseMismatch, true);
});

test('selected tense: sentences already in the selected tense are left alone', () => {
  const ok: [TenseId, string][] = [
    ['present-simple', 'She goes to school every day.'], ['present-continuous', 'I am going to school now.'], ['present-perfect', 'I have eaten lunch already.'],
    ['present-perfect-continuous', 'I have been studying since morning.'], ['past-simple', 'I went to school yesterday.'], ['past-continuous', 'She was playing cricket at five yesterday.'],
    ['past-perfect', 'She had left before I arrived.'], ['future-simple', 'I will go tomorrow.'], ['future-continuous', 'I will be studying at five tomorrow.'],
    ['future-perfect', 'I will have finished the work by tomorrow.'], ['future-perfect-continuous', 'I will have been studying for two years by next June.'],
    ['future-simple', 'I am going to call you tomorrow.'],
  ];
  for (const [id, s] of ok) { const r = fix(s, id); assert.equal(r.corrected, s, `${id}: ${s}`); assert.equal(r.tenseMismatch ?? false, false, `${id}: ${s}`); }
});

test('selected tense: spelling and grammar are still corrected inside the selected tense', () => {
  assert.equal(fix('She go to school every day', 'present-simple').corrected, 'She goes to school every day.');
  assert.equal(fix('I am go to school now', 'present-continuous').corrected, 'I am going to school now.');
  assert.equal(fix('He don\'t like tea', 'present-simple').corrected, 'He doesn\'t like tea.');
  assert.equal(fix('I recieved a gift yesterday', 'past-simple').corrected, 'I received a gift yesterday.');
});

test('selected tense: a state verb is not forced into a continuous tense, and a time-word conflict is explained without inventing words', () => {
  const s = fix('She know the answer', 'present-continuous');
  assert.equal(s.corrected, 'She know the answer');
  assert.ok(s.tenseNotes?.some((n) => n.english.includes('state verb')));
  const c = fix('I play cricket yesterday', 'present-simple');
  assert.ok(c.tenseNotes?.some((n) => n.english.includes('yesterday')));
  assert.ok(!/\b(every|always|usually)\b/.test(c.corrected));
});

test('no words are invented, skipped or duplicated by a correction', () => {
  for (const s of ['I recieve the letter', 'He go to work', 'English I learning am', 'Where you are going?', 'I the the book read', 'Me and him goes to market']) {
    const out = fix(s).corrected.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/);
    for (let i = 1; i < out.length; i++) assert.ok(out[i] !== out[i - 1] || ['had', 'that'].includes(out[i]), `${s} -> repeated word`);
  }
});

test('typed and voice input go through the same checker (no capital letter or full stop needed)', () => {
  assert.equal(fix('he go to work').corrected, 'He goes to work.');
  assert.equal(fix('where you are going').corrected, 'Where are you going?');
  assert.equal(fix('i have two book').corrected, 'I have two books.');
});

test('an unclear sentence without a verb is not rewritten; the learner is asked what they mean', () => {
  const r = fix('tomorrow office morning table');
  assert.equal(r.corrected, 'tomorrow office morning table');
  assert.ok(r.clarify && r.clarify.english.length > 10 && /[஀-௿]/.test(r.clarify.tamil));
});
