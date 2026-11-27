// Verb forms used by the grammar teacher. Pure data and functions, no Angular.

/** base: [past, past participle] */
export const IRREGULAR_VERBS: Record<string, [string, string]> = {
  be: ['was', 'been'], begin: ['began', 'begun'], break: ['broke', 'broken'], bring: ['brought', 'brought'], build: ['built', 'built'],
  buy: ['bought', 'bought'], catch: ['caught', 'caught'], choose: ['chose', 'chosen'], come: ['came', 'come'], cost: ['cost', 'cost'],
  cut: ['cut', 'cut'], do: ['did', 'done'], draw: ['drew', 'drawn'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feel: ['felt', 'felt'], find: ['found', 'found'], fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten'], get: ['got', 'got'], give: ['gave', 'given'], go: ['went', 'gone'], grow: ['grew', 'grown'],
  have: ['had', 'had'], hear: ['heard', 'heard'], hide: ['hid', 'hidden'], hold: ['held', 'held'], keep: ['kept', 'kept'],
  know: ['knew', 'known'], leave: ['left', 'left'], lend: ['lent', 'lent'], let: ['let', 'let'], lose: ['lost', 'lost'],
  make: ['made', 'made'], mean: ['meant', 'meant'], meet: ['met', 'met'], pay: ['paid', 'paid'], put: ['put', 'put'],
  read: ['read', 'read'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'], rise: ['rose', 'risen'], run: ['ran', 'run'],
  say: ['said', 'said'], see: ['saw', 'seen'], sell: ['sold', 'sold'], send: ['sent', 'sent'], set: ['set', 'set'],
  shut: ['shut', 'shut'], sing: ['sang', 'sung'], sit: ['sat', 'sat'], sleep: ['slept', 'slept'], speak: ['spoke', 'spoken'],
  spend: ['spent', 'spent'], stand: ['stood', 'stood'], steal: ['stole', 'stolen'], swim: ['swam', 'swum'], take: ['took', 'taken'],
  teach: ['taught', 'taught'], tell: ['told', 'told'], think: ['thought', 'thought'], throw: ['threw', 'thrown'],
  understand: ['understood', 'understood'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won', 'won'], write: ['wrote', 'written'],
  hurt: ['hurt', 'hurt'], lead: ['led', 'led'], light: ['lit', 'lit'], hit: ['hit', 'hit'], shake: ['shook', 'shaken'], forgive: ['forgave', 'forgiven'],
  bear: ['bore', 'borne'], bite: ['bit', 'bitten'], blow: ['blew', 'blown'], bend: ['bent', 'bent'], bet: ['bet', 'bet'], bind: ['bound', 'bound'], 
  burst: ['burst', 'burst'], deal: ['dealt', 'dealt'], dig: ['dug', 'dug'],  feed: ['fed', 'fed'], fight: ['fought', 'fought'],
  freeze: ['froze', 'frozen'], hang: ['hung', 'hung'], lay: ['laid', 'laid'], overcome: ['overcame', 'overcome'], quit: ['quit', 'quit'], seek: ['sought', 'sought'],
  shine: ['shone', 'shone'], shoot: ['shot', 'shot'], shrink: ['shrank', 'shrunk'], sink: ['sank', 'sunk'], slide: ['slid', 'slid'], spin: ['spun', 'spun'],
  split: ['split', 'split'], spread: ['spread', 'spread'], stick: ['stuck', 'stuck'], strike: ['struck', 'struck'], swear: ['swore', 'sworn'], sweep: ['swept', 'swept'],
  tear: ['tore', 'torn'], wind: ['wound', 'wound'], withdraw: ['withdrew', 'withdrawn'], undergo: ['underwent', 'undergone'], become: ['became', 'become'],
  forbid: ['forbade', 'forbidden'], overtake: ['overtook', 'overtaken'], rebuild: ['rebuilt', 'rebuilt'], redo: ['redid', 'redone'], rewrite: ['rewrote', 'rewritten'],
  misunderstand: ['misunderstood', 'misunderstood'],
};

/** Regular verbs the checker knows. Verbs that are also very common nouns are kept in AMBIGUOUS. */
const REGULAR = `accept add agree allow answer appear arrive ask attend bake believe belong borrow call carry change check clean clear climb close collect complete continue cook copy count cover create cry dance decide deliver describe discuss dress enjoy enter exercise explain fix finish follow help hope invite join jump kill laugh learn like listen live look love manage marry miss move need offer open order paint park pass plan play practise practice prefer prepare promise reach receive remember repair reply return save shout show smile start stay stop study talk touch travel try turn use visit wait walk want wash watch wish work worry achieve act adapt admire admit advise afford announce apologise apologize apply approve argue arrange attack avoid balance behave bother brush burn calculate cancel care celebrate challenge chat chase cheat cheer clap clean climb collect combine communicate compare compete complain concentrate confirm connect consider contact control convince cross damage deal decorate delay depend design destroy develop disagree discover divide download dream drop earn edit employ encourage engage enjoy ensure escape examine exist expect experience fail fasten fill film finish fish flash float focus fold forward gather guess guide handle hang happen hate heat hire hug hurry identify imagine improve include increase inform inspect install introduce invent invest iron joke judge kick kiss knock label land last lift lock log manage mark match matter measure mention mind mix multiply name notice obey observe occur operate organise organize own pack pause perform persuade pick plant point polish pour practise practice praise present press pretend prevent print produce protect prove publish pull push race raise rain realise realize record reduce refuse relax release rely remind remove rent repeat replace report request respect rest result retire reuse review rise roll rub rush sail satisfy scare schedule score scratch search seem select separate serve settle shop sign skip slip smell snow sort sound spell spend spill spoil stare steal stir store suffer suggest supply support suppose surprise survive suspect switch taste tend test thank tick tie tip tire track train translate trap trust type unlock update upload value vary view vote warn waste wave wear weigh welcome whisper wonder wrap yell zoom`.split(/\s+/);

/** Words that are often nouns too: "I have work", "a walk". They are not changed after have/has/had. */
export const NOUN_VERBS = new Set(['check', 'break', 'ride', 'comment', 'review', 'view', 'sleep', 'climb', 'download', 'light', 'reply', 'pass', 'test', 'answer', 'question', 'cause', 'pause', 'post', 'rest', 'stay', 'trip', 'turn', 'use', 'wish', 'watch', 'wave', 'bite', 'bill', 'rule', 'sign', 'support', 'supply', 'surprise', 'touch', 'trust', 'drink', 'drive', 'smell', 'start', 'stop', 'change', 'visit', 'mind', 'face', 'place', 'point', 'show', 'step', 'text', 'tour', 'train', 'travel', 'wash', 'wait', 'dream', 'cook', 'count', 'cover', 'cry', 'dance', 'design', 'fight', 'finish', 'guess', 'hope', 'increase', 'jump', 'kick', 'kiss', 'laugh', 'lie', 'lift', 'list', 'march', 'mark', 'order', 'park', 'phone', 'plant', 'push', 'race', 'record', 'return', 'rise', 'rub', 'sail', 'save', 'search', 'shop', 'sound', 'spell', 'spot', 'stamp', 'swim', 'taste', 'thank', 'thought', 'tip', 'treat', 'twist', 'visit', 'vote', 'water', 'work', 'play', 'walk', 'call', 'help', 'need', 'love', 'look', 'plan', 'study', 'drink', 'cook', 'use', 'start', 'stop', 'show', 'visit', 'order', 'answer', 'change', 'park', 'rest', 'watch', 'wish', 'hope', 'dance', 'laugh', 'smile', 'cry', 'talk', 'trip', 'miss', 'paint', 'cut', 'run', 'set', 'hit', 'cost', 'read', 'let', 'put', 'shut', 'hurt', 'water', 'name', 'test', 'plant', 'point', 'rain', 'snow', 'fish', 'film', 'label', 'mark', 'present', 'record', 'report', 'request', 'result', 'race', 'rest', 'score', 'sign', 'smell', 'sound', 'store', 'view', 'vote', 'value', 'tip', 'type', 'wave', 'update', 'increase', 'practice', 'dream', 'care', 'chat', 'cheat', 'drop', 'guess', 'hug', 'joke', 'kick', 'kiss', 'knock', 'land', 'lift', 'lock', 'log', 'match', 'mix', 'pack', 'pause', 'pick', 'praise', 'press', 'print', 'pull', 'push', 'rush', 'search', 'spill', 'stir', 'taste', 'track', 'train', 'trust', 'turn', 'matter', 'light', 'fight', 'hand', 'iron', 'balance', 'control', 'delay', 'design', 'experience', 'focus', 'handle', 'improve', 'bet', 'bite', 'blow', 'dig', 'feed', 'lay', 'rise', 'spin', 'split', 'spread', 'stick', 'strike', 'swear', 'tear', 'wind', 'deal', 'burst', 'bend', 'bind', 'bear', 'quit', 'hang', 'seek']);

export const VERBS = new Set<string>([...REGULAR, ...Object.keys(IRREGULAR_VERBS)]);

const PAST_TO_BASE = new Map<string, string>();
const PP_TO_BASE = new Map<string, string>();
for (const [b, [p, pp]] of Object.entries(IRREGULAR_VERBS)) {
  if (p !== b) PAST_TO_BASE.set(p, b);
  if (pp !== b) PP_TO_BASE.set(pp, b);
}
// "was/were/had/did" are handled as helping verbs, never as main-verb forms here.
for (const w of ['was', 'had', 'did']) PAST_TO_BASE.delete(w);

const VOWELS = 'aeiou';
const isConsonant = (c: string) => !!c && /[a-z]/.test(c) && !VOWELS.includes(c);

export function thirdPerson(base: string): string {
  if (base === 'have') return 'has';
  if (base === 'be') return 'is';
  if (base === 'do') return 'does';
  if (base === 'go') return 'goes';
  if (/(s|sh|ch|x|z|o)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

/** Longer verbs that double the last consonant (stress on the last syllable): splitting, admitted, controlled. */
const DOUBLES = new Set(['begin', 'forget', 'prefer', 'admit', 'commit', 'submit', 'permit', 'omit', 'occur', 'refer', 'transfer', 'control', 'regret', 'equip', 'split', 'upset', 'forbid', 'rebel', 'compel', 'propel', 'expel', 'patrol', 'format', 'target', 'unplug', 'outrun', 'overtake'].filter((w) => w !== 'target' && w !== 'format' && w !== 'overtake'));

export function ingForm(base: string): string {
  if (base === 'be') return 'being';
  if (base === 'die') return 'dying';
  if (base === 'lie') return 'lying';
  if (/[^aeiou]e$/.test(base) && !/(ee|oe|ye)$/.test(base)) return `${base.slice(0, -1)}ing`;
  const shortCvc = base.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(base) && base !== 'open' && base !== 'visit';
  if (shortCvc) return `${base}${base[base.length - 1]}ing`;
  if (DOUBLES.has(base) || /^(be|for|re|un|over|under)?(get|put|set|let|run|sit|cut|shut)$/.test(base) && base.length > 4) return `${base}${base[base.length - 1]}ing`;
  return `${base}ing`;
}

export function pastForm(base: string): string {
  if (IRREGULAR_VERBS[base]) return IRREGULAR_VERBS[base][0];
  return regularEd(base);
}

export function participleForm(base: string): string {
  if (IRREGULAR_VERBS[base]) return IRREGULAR_VERBS[base][1];
  return regularEd(base);
}

function regularEd(base: string): string {
  if (base.endsWith('e')) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  if (base.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(base) && base !== 'open' && base !== 'visit') return `${base}${base[base.length - 1]}ed`;
  if (DOUBLES.has(base)) return `${base}${base[base.length - 1]}ed`;
  return `${base}ed`;
}

export type FormKind = 'base' | 'third' | 'past' | 'pp' | 'ing';
export interface VerbForm { base: string; kind: FormKind }

/** Which verb (and which form of it) is this word? Returns every possibility; null when it is not a known verb form. */
export function analyse(word: string): VerbForm[] {
  const w = word.toLowerCase();
  const out: VerbForm[] = [];
  const add = (base: string, kind: FormKind) => { if (VERBS.has(base) && !out.some((o) => o.base === base && o.kind === kind)) out.push({ base, kind }); };
  if (VERBS.has(w)) add(w, 'base');
  for (const b of VERBS) {
    if (b === w) continue;
    if (thirdPerson(b) === w) add(b, 'third');
    if (ingForm(b) === w) add(b, 'ing');
    if (!IRREGULAR_VERBS[b] && regularEd(b) === w) { add(b, 'past'); add(b, 'pp'); }
  }
  const p = PAST_TO_BASE.get(w); if (p) add(p, 'past');
  const pp = PP_TO_BASE.get(w); if (pp) add(pp, 'pp');
  for (const [b, [past, part]] of Object.entries(IRREGULAR_VERBS)) {
    if (past === w && !['was', 'had', 'did'].includes(w)) add(b, 'past');
    if (part === w) add(b, 'pp');
  }
  return out;
}

export const ADVERBS_BETWEEN = new Set(['not', 'never', 'always', 'already', 'just', 'still', 'also', 'ever', 'really', 'often', 'usually', 'sometimes', 'only', 'even', 'probably', 'definitely', 'quickly', 'slowly', 'early', 'late', 'hardly']);

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [IRREGULAR_VERBS] as object[]) Object.setPrototypeOf(table, null);
