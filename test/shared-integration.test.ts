import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedCorrection } from '../src/app/lela/shared-correction';

const corrector = () => ({ correct: async (s: string) => ({ original: s, base: s, ...sharedCorrection(s, s) }) });

test('chat and voice corrector uses the shared engine: original kept, mistakes explained in English and Tamil', async () => {
  const o = await corrector().correct('She dont know where you are going');
  assert.equal(o.original, 'She dont know where you are going');
  assert.equal(o.changed, true);
  assert.equal(o.corrected, "She doesn't know where you are going.");
  assert.ok(o.explanations.length >= 1 && o.explanations.every((e) => e.english && e.tamil));
  assert.equal(o.base, 'She dont know where you are going');
});

test('chat and voice corrector: spoken text without capitals or full stops is not marked wrong', async () => {
  for (const s of ['i am going to the office', 'how are you', 'my name is ravi', 'I like tea.']) {
    const o = await corrector().correct(s);
    assert.equal(o.changed, false, s);
    assert.equal(o.corrected, s);
  }
});

test('multiple mistakes in one spoken sentence', async () => {
  const o = await corrector().correct('i have two book and he go to school');
  assert.equal(o.changed, true);
  assert.match(o.corrected, /two books/);
  assert.match(o.corrected, /he goes to school/);
});
