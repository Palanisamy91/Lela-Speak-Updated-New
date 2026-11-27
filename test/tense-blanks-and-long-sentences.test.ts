import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTenseBlanks } from '../src/app/lela/tense-blank-data';
import { longSentences } from '../src/app/lela/long-sentence-data';
import { checkTenseEnglish } from '../src/app/lela/practice-engine';
import { TENSE_LESSONS } from '../src/app/lela/tense-data';
import { teachSentence } from '../src/app/lela/grammar-teacher';

test('fill in the blanks: all 12 tenses x 3 levels, enough questions, valid options', () => {
  const q = buildTenseBlanks();
  for (const lesson of TENSE_LESSONS) for (const level of ['Beginner', 'Intermediate', 'Advanced']) {
    assert.ok(q.filter((x) => x.tense === lesson.id && x.level === level).length >= 4, `${lesson.id} ${level}`);
  }
  assert.equal(new Set(q.map((x) => x.full)).size, q.length, 'no duplicate questions');
  for (const x of q) {
    assert.equal(x.options.length, 4);
    assert.equal(new Set(x.options.map((o) => o.toLowerCase())).size, 4, x.blank);
    assert.ok(x.options.includes(x.answers[0]));
    assert.ok(x.blank.includes('____') && x.ta && x.explain && x.explainTa);
  }
});

test('the filled-in sentence of every blank question is itself correct English in its tense', () => {
  for (const x of buildTenseBlanks()) {
    const r = teachSentence(x.full);
    assert.ok(r.correct, `${x.full} -> ${r.corrected}`);
  }
});

test('long sentences: word counts match the level and each model answer is accepted in its tense', () => {
  const ranges = { Beginner: [8, 12], Intermediate: [12, 20], Advanced: [20, 30] } as const;
  const all = longSentences();
  assert.ok(all.length >= 80);
  for (const s of all) {
    const n = s.en.split(/\s+/).length;
    assert.ok(n >= ranges[s.level][0] && n <= ranges[s.level][1], s.en);
    const lesson = TENSE_LESSONS.find((l) => l.id === s.tense)!;
    assert.equal((checkTenseEnglish(s.en, lesson, null) as { grammarOk: boolean }).grammarOk, true, s.en);
  }
});

test('"have never + verb" and "is complete" are not rewritten', () => {
  for (const s of ['I have never tasted fish.', 'He had never seen the sea.', 'The testing is complete.']) assert.equal(teachSentence(s).corrected, s);
});
