// Word knowledge for the English checker: which words exist, how to spell them, and the word-form mistakes learners make most.
// Pure functions, no Angular. The word list itself is generated from the app's own data (see scripts/build-word-list.mjs).

import { COMMON_WORDS, OTHER_WORDS } from './word-list';
import { IRREGULAR_VERBS, VERBS } from './verb-forms';

/** Words that must always count as "known" even when the app data has not used them yet. */
const CORE = `a an the this that these those i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves
who whom whose which what where when why how whether if because although though unless until while since before after during about above across against along among around at behind below beneath beside between beyond by down for from in inside into like near of off on onto out outside over past through throughout to toward towards under up upon with within without
and or but so yet nor either neither both not no yes ok okay please thanks thank sorry hello hi bye goodbye
am is are was were be been being do does did done doing have has had having will would shall should can could may might must
one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion first second third fourth fifth
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december
today tomorrow yesterday tonight now then here there everywhere somewhere nowhere anywhere always never often usually sometimes ever already yet still just soon late early again too very quite really much many more most less least few little lot lots
some any every each all none nobody nothing everybody everything everyone anyone anything someone something somebody
good better best bad worse worst big bigger biggest small smaller smallest tall taller tallest short shorter shortest long longer longest old older oldest young younger youngest new newer newest high higher highest low lower lowest fast faster fastest slow slower slowest
easy easier easiest hard harder hardest happy happier happiest early earlier earliest cheap cheaper cheapest rich richer richest poor poorer poorest nice nicer nicest
people person man men woman women child children boy girl baby friend friends family father mother brother sister son daughter husband wife parents uncle aunt cousin grandfather grandmother teacher student students doctor nurse engineer manager boss driver farmer
morning afternoon evening night day days week weeks month months year years hour hours minute minutes second seconds time times
english tamil hindi india indian chennai delhi mumbai bangalore bengaluru hyderabad kolkata madurai coimbatore trichy salem tirunelveli erode vellore tiruppur pune kerala karnataka andhra telangana punjab gujarat
ravi kumar raja ram rahul arun vijay ajay anil sunil suresh ramesh mahesh ganesh murugan selvam senthil karthik kumaran priya divya lakshmi meena kavitha anitha sangeetha deepa sudha radha geetha latha uma mani raju babu siva shiva krishna kannan balaji prakash prabhu
tv ac pm am atm sms pdf cv hr it id ok wifi email emails online offline app apps mobile mobiles whatsapp facebook google youtube internet website websites software hardware laptop laptops
mr mrs ms dr sir madam
gonna wanna gotta lemme
`.split(/\s+/).filter(Boolean);

interface Dictionary { weight: Map<string, number>; byLen: Map<number, string[]> }
let built: Dictionary | null = null;

function dictionary(): Dictionary {
  if (built) return built;
  const weight = new Map<string, number>();
  const put = (words: string, w: number) => { for (const x of words.split(/\s+/)) if (x && (weight.get(x) ?? 0) < w) weight.set(x, w); };
  put(OTHER_WORDS, 1);
  put(COMMON_WORDS, 3);
  for (const w of CORE) weight.set(w, 5);
  for (const v of VERBS) if (!weight.has(v)) weight.set(v, 2);
  for (const [b, [p, pp]] of Object.entries(IRREGULAR_VERBS)) for (const w of [b, p, pp]) if (!weight.has(w)) weight.set(w, 2);
  const byLen = new Map<number, string[]>();
  for (const w of weight.keys()) { const l = byLen.get(w.length) ?? []; l.push(w); byLen.set(w.length, l); }
  built = { weight, byLen };
  return built;
}

const vowel = (c: string) => 'aeiou'.includes(c);

/** Is this a real English word (or an ordinary -s / -ed / -ing / -ly / -er / -est form of one)? */
export function isKnownWord(raw: string): boolean {
  const w = raw.toLowerCase().replace(/[‘’]/g, "'");
  if (!w) return true;
  if (/\d/.test(w)) return true;
  const { weight } = dictionary();
  if (weight.has(w)) return true;
  if (w.includes("'")) {
    const stem = w.replace(/'(s|d|ll|re|ve|m)$/, '').replace(/n't$/, '');
    return stem !== w && (weight.has(stem) || ['ca', 'wo', 'sha', 'ai'].includes(stem) || isKnownWord(stem));
  }
  const has = (x: string) => x.length >= 2 && weight.has(x);
  if (w.length > 3 && w.endsWith('s')) {
    if (has(w.slice(0, -1))) return true;
    if (w.endsWith('es') && has(w.slice(0, -2))) return true;
    if (w.endsWith('ies') && has(`${w.slice(0, -3)}y`)) return true;
  }
  if (w.length > 4 && w.endsWith('ed')) {
    if (has(w.slice(0, -2)) || has(w.slice(0, -1))) return true;
    if (w.endsWith('ied') && has(`${w.slice(0, -3)}y`)) return true;
    if (w[w.length - 3] === w[w.length - 4] && VERBS.has(w.slice(0, -3))) return true;
  }
  if (w.length > 5 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    if (has(stem) || has(`${stem}e`)) return true;
    if (stem[stem.length - 1] === stem[stem.length - 2] && VERBS.has(stem.slice(0, -1))) return true;
    if (w.endsWith('ying') && has(`${stem.slice(0, -1)}ie`)) return true;
  }
  if (w.length > 4 && w.endsWith('ly')) {
    if (has(w.slice(0, -2)) || has(`${w.slice(0, -3)}y`) || has(`${w.slice(0, -2)}e`) || (w.endsWith('ally') && has(w.slice(0, -4)))) return true;
    if (w.endsWith('ily') && has(`${w.slice(0, -3)}y`)) return true;
  }
  if (w.length > 4 && w.endsWith('er') && (has(w.slice(0, -2)) || has(w.slice(0, -1)) || has(`${w.slice(0, -3)}y`))) return true;
  if (w.length > 5 && w.endsWith('est') && (has(w.slice(0, -3)) || has(w.slice(0, -2)) || has(`${w.slice(0, -4)}y`))) return true;
  if (w.length > 4 && w.endsWith('ier') && has(`${w.slice(0, -3)}y`)) return true;
  if (w.length > 5 && w.endsWith('iest') && has(`${w.slice(0, -4)}y`)) return true;
  return false;
}

/** Damerau-Levenshtein distance with an early stop; returns max+1 when the words are further apart than `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 99) + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function edits1(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length) out.push(w.slice(0, i) + w.slice(i + 1)); // delete
    if (i < w.length - 1) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // swap
    for (const c of LETTERS) {
      if (i < w.length) out.push(w.slice(0, i) + c + w.slice(i + 1)); // replace
      out.push(w.slice(0, i) + c + w.slice(i)); // insert
    }
  }
  return out;
}

/** How "wanted" a known word is: the weight of the word it is built from. */
function wordWeight(w: string): number {
  const { weight } = dictionary();
  const direct = weight.get(w);
  if (direct) return direct;
  for (const stem of [w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y'), w.replace(/ed$/, ''), w.replace(/d$/, ''), w.replace(/ied$/, 'y'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ly$/, '')]) {
    const x = weight.get(stem);
    if (x) return Math.max(1, x - 1);
  }
  return 1;
}

/** Only the typing slips that cannot turn one real word into another: two letters swapped ("frist"), a double letter written as one ("adress" -> "address", "begining" -> "beginning"). */
function typoForms(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < w.length; i++) {
    if (w[i] !== w[i + 1]) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  }
  for (let i = 0; i < w.length; i++) if (!'aeiou'.includes(w[i])) out.push(w.slice(0, i) + w[i] + w.slice(i)); // a doubled letter missing
  return out;
}

/**
 * Best correction for a word that is not in the dictionary, or null when there is no clear one.
 * It only answers when exactly one candidate is clearly best, so a correct word is never "fixed" into a guess.
 */
export function suggestSpelling(raw: string): string | null {
  const w = raw.toLowerCase();
  if (w.length < 4 || !/^[a-z]+$/.test(w) || isKnownWord(w)) return null;
  const found = new Map<string, number>();
  for (const c of typoForms(w)) if (c.length >= 2 && !found.has(c) && isKnownWord(c) && wordWeight(c) >= 3) found.set(c, 1);
  if (!found.size) return null;
  const ranked = [...found.entries()].map(([c, d]) => ({ c, d, w: wordWeight(c), same: c[0] === w[0] ? 1 : 0 }))
    .sort((a, b) => a.d - b.d || b.same - a.same || b.w - a.w || a.c.length - b.c.length);
  const best = ranked[0];
  const next = ranked[1];
  if (!best) return null;
  if (best.same === 0 && w.length < 7) return null;
  if (next && next.d === best.d && next.same === best.same && next.w === best.w) return null; // two equally good guesses: do not guess
  return best.c;
}

/** Spelling mistakes that are so common that they are listed by hand. */
export const MISSPELLINGS: Record<string, string> = {
  recieve: 'receive', recieved: 'received', reciept: 'receipt', definately: 'definitely', definatly: 'definitely', beautifull: 'beautiful', begining: 'beginning', wich: 'which', becuase: 'because', becouse: 'because', becasue: 'because', beacuse: 'because', bcoz: 'because', cuz: 'because',
  tommorow: 'tomorrow', tomorow: 'tomorrow', tommorrow: 'tomorrow', tomarrow: 'tomorrow', freind: 'friend', freinds: 'friends', goverment: 'government', enviroment: 'environment', adress: 'address', seperate: 'separate',
  occured: 'occurred', untill: 'until', wensday: 'Wednesday', wednessday: 'Wednesday', thier: 'their', realy: 'really', littel: 'little', diffrent: 'different', intresting: 'interesting',
  intrested: 'interested', comming: 'coming', writting: 'writing', refering: 'referring', sucess: 'success', succesful: 'successful', successfull: 'successful', neccessary: 'necessary',
  necesary: 'necessary', accomodation: 'accommodation', appartment: 'apartment', arguement: 'argument', calender: 'calendar', collegue: 'colleague', commitee: 'committee',
  excercise: 'exercise', experiance: 'experience', familar: 'familiar', foriegn: 'foreign', grammer: 'grammar', happend: 'happened', harrass: 'harass', immediatly: 'immediately',
  independant: 'independent', knowlege: 'knowledge', libary: 'library', lenght: 'length', mispell: 'misspell', noticable: 'noticeable', occassion: 'occasion',
  paralel: 'parallel', persue: 'pursue', posible: 'possible', prefered: 'preferred', priviledge: 'privilege', probly: 'probably', reccomend: 'recommend', recomend: 'recommend',
  relevent: 'relevant', resturant: 'restaurant', restarant: 'restaurant', rythm: 'rhythm', shedule: 'schedule', sincerly: 'sincerely', speach: 'speech',
  strenght: 'strength', suprise: 'surprise', tecnology: 'technology', techer: 'teacher', tounge: 'tongue', truely: 'truly', usefull: 'useful', vaccum: 'vacuum',
  wierd: 'weird', whith: 'with', yeild: 'yield', alot: 'a lot', afternoom: 'afternoon', morining: 'morning', eveing: 'evening', scool: 'school', skul: 'school',
  studing: 'studying', stuent: 'student', lerning: 'learning', englsh: 'English', inglish: 'English', halp: 'help', plese: 'please', pleace: 'please', frend: 'friend',
  yestarday: 'yesterday', yesterady: 'yesterday', yeserday: 'yesterday', yesturday: 'yesterday', wnat: 'want', thnk: 'think', goood: 'good', goodd: 'good', verry: 'very', ofice: 'office', offcie: 'office',
  compnay: 'company', comapny: 'company', moblie: 'mobile', compter: 'computer', computar: 'computer', sofware: 'software', develper: 'developer', buisness: 'business',
  bussiness: 'business', importent: 'important', improvment: 'improvement', fimily: 'family', famly: 'family', hospitel: 'hospital', docter: 'doctor', medecine: 'medicine',
  dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", shouldnt: "shouldn't", wouldnt: "wouldn't", couldnt: "couldn't",
  im: "I'm", ive: "I've", youre: "you're", theyre: "they're", thats: "that's", whats: "what's",
  u: 'you', plz: 'please', pls: 'please', thx: 'thanks', ur: 'your', wat: 'what', whn: 'when', abt: 'about', tmrw: 'tomorrow', gud: 'good', gd: 'good',
  convinient: 'convenient', conveniant: 'convenient', excellant: 'excellent', exellent: 'excellent', fourty: 'forty', ninty: 'ninety', twelth: 'twelfth', wether: 'weather', weeked: 'weekend', wekend: 'weekend',
  vegitable: 'vegetable', vegetabel: 'vegetable', tomatoe: 'tomato', potatos: 'potatoes', tomatos: 'tomatoes', mangoe: 'mango', chocolat: 'chocolate', chocolete: 'chocolate', brekfast: 'breakfast', breakfest: 'breakfast', dinnar: 'dinner', luch: 'lunch',
  mornig: 'morning', evning: 'evening', nite: 'night', todey: 'today', toady: 'today', tody: 'today', hellow: 'hello', helo: 'hello', thanx: 'thanks', thankyou: 'thank you', welcom: 'welcome', sory: 'sorry', soory: 'sorry',
  peple: 'people', poeple: 'people', pepole: 'people', childrens: 'children', chidren: 'children', fammily: 'family', brothar: 'brother', sistar: 'sister', mothar: 'mother', fathar: 'father',
  langauge: 'language', languge: 'language', laguage: 'language', lanuage: 'language', sentance: 'sentence', sentense: 'sentence', questoin: 'question', quesiton: 'question', anwser: 'answer', answar: 'answer', ansewr: 'answer',
  tought: 'thought', thougth: 'thought', throught: 'thought', thruogh: 'through', altough: 'although', allthough: 'although', thoug: 'though', enogh: 'enough', enuf: 'enough', enought: 'enough', anoter: 'another', anothr: 'another',
  everytime: 'every time', infront: 'in front', incase: 'in case', aswell: 'as well', atleast: 'at least', inspite: 'in spite', eachother: 'each other', nowdays: 'nowadays', nowdayz: 'nowadays',
  wokr: 'work', wrok: 'work', woking: 'working', wroking: 'working', lisen: 'listen', listning: 'listening', speek: 'speak', speeking: 'speaking', speking: 'speaking', studdy: 'study', studyed: 'studied',
  bycycle: 'bicycle', cycel: 'cycle', trvel: 'travel', travell: 'travel', jurney: 'journey', jouney: 'journey', cllege: 'college', colege: 'college', univercity: 'university', univeristy: 'university', universty: 'university',
  teh: 'the', hte: 'the', adn: 'and', nad: 'and', taht: 'that', waht: 'what', whta: 'what', jsut: 'just', liek: 'like', konw: 'know', kown: 'know',
};

/** Verbs that learners "regularise": goed, eated, buyed ... -> the real irregular form. */
const NOT_OVERREG = new Set(['lighted', 'hanged', 'shined', 'winded', 'ringed', 'leaded', 'wounded', 'founded', 'bounded', 'grounded', 'sunk']);

export const OVERREGULARISED: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const base of Object.keys(IRREGULAR_VERBS)) {
    if (['be', 'have', 'do', 'light', 'hang', 'wind', 'ring', 'lead', 'find', 'bound'].includes(base)) continue;
    const cands = new Set<string>();
    cands.add(base.endsWith('e') ? `${base}d` : /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ied` : `${base}ed`);
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base) && base.length <= 4) cands.add(`${base}${base[base.length - 1]}ed`);
    for (const c of cands) if (!NOT_OVERREG.has(c) && !Object.values(IRREGULAR_VERBS[base]).includes(c)) m.set(c, base);
  }
  for (const [w, b] of Object.entries({ wented: 'go', boughted: 'buy', broughted: 'bring', thoughted: 'think', gaved: 'give', taked: 'take', comed: 'come', writed: 'write', speaked: 'speak', knowed: 'know', throwed: 'throw', drawed: 'draw', growed: 'grow', flyed: 'fly', swimmed: 'swim', drinked: 'drink', maked: 'make', seed: 'see', falled: 'fall', finded: 'find', sleeped: 'sleep', leaved: 'leave', buyed: 'buy', payed: 'pay', sayed: 'say', teached: 'teach', catched: 'catch' })) m.set(w, b);
  m.delete('seed');
  return m;
})();

/** Uncountable nouns that learners put an -s on. */
export const UNCOUNTABLE_PLURALS: Record<string, string> = {
  informations: 'information', advices: 'advice', furnitures: 'furniture', luggages: 'luggage', baggages: 'baggage', equipments: 'equipment', homeworks: 'homework', knowledges: 'knowledge',
  feedbacks: 'feedback', staffs: 'staff', peoples: 'people', moneys: 'money', traffics: 'traffic', weathers: 'weather', jewelleries: 'jewellery', jewelries: 'jewellery', machineries: 'machinery', scenerys: 'scenery',
  researches: 'research', progresses: 'progress', accommodations: 'accommodation', breads: 'bread', rices: 'rice', musics: 'music', newses: 'news', softwares: 'software', hardwares: 'hardware',
  vocabularies: 'vocabulary', grammars: 'grammar', trainings: 'training',
};

/** Wrong plural forms of irregular nouns. */
export const WRONG_PLURALS: Record<string, string> = {
  childs: 'children', childrens: 'children', mans: 'men', mens: 'men', womans: 'women', womens: 'women', foots: 'feet', tooths: 'teeth', teeths: 'teeth', mouses: 'mice', gooses: 'geese', persons: 'people', sheeps: 'sheep', oxes: 'oxen', leafs: 'leaves', knifes: 'knives', wifes: 'wives', lifes: 'lives', thiefs: 'thieves', halfs: 'halves', shelfs: 'shelves', potatos: 'potatoes', tomatos: 'tomatoes',
};

/** Common nouns and their regular plural, so "two book" can be fixed. Irregular plurals first. */
export const IRREGULAR_PLURAL: Record<string, string> = { child: 'children', man: 'men', woman: 'women', person: 'people', foot: 'feet', tooth: 'teeth', mouse: 'mice', leaf: 'leaves', knife: 'knives', wife: 'wives', life: 'lives', half: 'halves', fish: 'fish', sheep: 'sheep', potato: 'potatoes', tomato: 'tomatoes', hero: 'heroes', mango: 'mangoes' };

export function pluralOf(noun: string): string {
  const irregular = IRREGULAR_PLURAL[noun];
  if (irregular) return irregular;
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export function singularOf(plural: string): string | null {
  for (const [s, p] of Object.entries(IRREGULAR_PLURAL)) if (p === plural && s !== p) return s;
  if (/[^aeiou]ies$/.test(plural)) return `${plural.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(plural)) return plural.slice(0, -2);
  if (/oes$/.test(plural)) return plural.slice(0, -2);
  if (/s$/.test(plural) && !/ss$/.test(plural)) return plural.slice(0, -1);
  return null;
}

/** "a" or "an" for the word that follows, by sound (an hour, a university). */
export function articleFor(word: string): 'a' | 'an' {
  const w = word.toLowerCase();
  if (/^(hour|honest|honour|honor|heir)/.test(w) || /^(mba|mri|sms|fm|x-ray|xray|rsvp|html|fir|lcd|led|hr|nri|sql|faq|mp|mla|nsa|ssc|hsc|fbi|nda|rto|atm|ngo|emi|sip|ifsc)$/.test(w)) return 'an';
  if (/^(uni|use|usu|uti|eu|euro|one|once|ubiq|ufo|uk|usa|url|u-|ukulele|uranium|urea)/.test(w)) return 'a';
  return vowel(w[0] ?? '') ? 'an' : 'a';
}

// Plain-object word tables are looked up with learner words ("constructor", "toString"), so they must not inherit from Object.
for (const table of [MISSPELLINGS, UNCOUNTABLE_PLURALS, WRONG_PLURALS, IRREGULAR_PLURAL] as object[]) Object.setPrototypeOf(table, null);
