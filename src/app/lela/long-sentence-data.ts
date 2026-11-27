// Longer practice sentences (with Tamil) for Tamil → English Sentence Practice and Tense Practice.
// Beginner 8–12 words, Intermediate 12–20 words, Advanced 20–30 words. Each row: [topic, tense, level, English, Tamil].
// Pure data, no Angular. The 12-tense fill-in-the-blank sentences are added too (see tense-blank-data.ts).

import type { TenseId } from './tense-data';
import { buildTenseBlanks } from './tense-blank-data';

export type SentenceLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export interface LongSentence { topic: string; tense: TenseId; level: SentenceLevel; en: string; ta: string }

type Row = [topic: string, tense: TenseId, level: SentenceLevel, en: string, ta: string];
const B = 'Beginner' as const, I = 'Intermediate' as const, A = 'Advanced' as const;

const ROWS: Row[] = [
  ['Daily life', 'present-simple', B, 'I wake up at six and drink a cup of tea.', 'நான் ஆறு மணிக்கு எழுந்து ஒரு கோப்பை தேநீர் குடிக்கிறேன்.'],
  ['Daily life', 'past-simple', B, 'Yesterday I cleaned my room and washed all my clothes.', 'நேற்று நான் என் அறையைச் சுத்தம் செய்து எல்லா உடைகளையும் துவைத்தேன்.'],
  ['Daily life', 'present-continuous', I, 'My mother is cooking lunch in the kitchen while my father is reading the newspaper.', 'என் அம்மா சமையலறையில் மதிய உணவு சமைத்துக்கொண்டிருக்கிறார், என் அப்பா செய்தித்தாள் படித்துக்கொண்டிருக்கிறார்.'],
  ['Daily life', 'future-simple', I, 'If the weather is good tomorrow, we will go to the beach after lunch.', 'நாளை வானிலை நன்றாக இருந்தால் மதிய உணவுக்குப் பிறகு நாங்கள் கடற்கரைக்குச் செல்வோம்.'],
  ['Daily life', 'past-simple', A, 'Although I was very tired after completing my office work, I decided to spend some time learning English because I want to improve my communication skills.', 'அலுவலக வேலையை முடித்த பிறகு மிகவும் களைப்பாக இருந்தாலும், என் தொடர்புத் திறனை மேம்படுத்த விரும்புவதால் சிறிது நேரம் ஆங்கிலம் கற்க முடிவு செய்தேன்.'],
  ['Daily life', 'present-perfect-continuous', A, 'I have been trying to wake up early for a month, and now I finally feel more energetic and focused during the day.', 'ஒரு மாதமாக சீக்கிரம் எழ முயன்று வருகிறேன், இப்போது பகல் நேரத்தில் அதிக சுறுசுறுப்பாகவும் கவனத்துடனும் உணர்கிறேன்.'],

  ['Friends & Family', 'present-simple', B, 'My sister always helps me with my English homework.', 'என் தங்கை எப்போதும் என் ஆங்கில வீட்டுப்பாடத்தில் எனக்கு உதவுகிறாள்.'],
  ['Friends & Family', 'past-simple', B, 'We visited our grandparents in the village last Sunday.', 'நாங்கள் கடந்த ஞாயிற்றுக்கிழமை கிராமத்தில் உள்ள தாத்தா பாட்டியைப் பார்க்கச் சென்றோம்.'],
  ['Friends & Family', 'past-continuous', I, 'My friends were playing cricket in the street when it suddenly started to rain.', 'திடீரென மழை பெய்யத் தொடங்கியபோது என் நண்பர்கள் தெருவில் கிரிக்கெட் விளையாடிக்கொண்டிருந்தார்கள்.'],
  ['Friends & Family', 'future-simple', I, 'My cousin will come to our house next week, and we will celebrate his birthday together.', 'என் மாமா மகன் அடுத்த வாரம் எங்கள் வீட்டுக்கு வருவான், நாங்கள் ஒன்றாக அவன் பிறந்தநாளைக் கொண்டாடுவோம்.'],
  ['Friends & Family', 'past-perfect', A, 'When I reached my hometown after five years, my old friends had already planned a surprise party for me at the community hall.', 'ஐந்து ஆண்டுகளுக்குப் பிறகு என் சொந்த ஊருக்குச் சென்றபோது, என் பழைய நண்பர்கள் சமூகக் கூடத்தில் எனக்கு ஆச்சரிய விருந்தை ஏற்கெனவே ஏற்பாடு செய்திருந்தார்கள்.'],
  ['Friends & Family', 'present-perfect', A, 'My parents have always supported my decisions, even when they did not completely understand why I wanted to study something so different.', 'நான் ஏன் இவ்வளவு வித்தியாசமான ஒன்றைப் படிக்க விரும்புகிறேன் என்பதை முழுவதும் புரிந்துகொள்ளாத போதும் என் பெற்றோர் எப்போதும் என் முடிவுகளை ஆதரித்திருக்கிறார்கள்.'],

  ['Workplace', 'present-simple', B, 'Our manager checks all the reports before every meeting.', 'எங்கள் மேலாளர் ஒவ்வொரு கூட்டத்துக்கும் முன் எல்லா அறிக்கைகளையும் சரிபார்க்கிறார்.'],
  ['Workplace', 'past-simple', B, 'I sent the final report to the client this morning.', 'நான் இன்று காலை இறுதி அறிக்கையை வாடிக்கையாளருக்கு அனுப்பினேன்.'],
  ['Workplace', 'present-perfect', I, 'We have finished the first part of the project, but the testing is still not complete.', 'திட்டத்தின் முதல் பகுதியை முடித்துவிட்டோம், ஆனால் சோதனை இன்னும் முடியவில்லை.'],
  ['Workplace', 'future-continuous', I, 'I will be attending a training session tomorrow afternoon, so please send me the details by email.', 'நாளை மதியம் நான் ஒரு பயிற்சி அமர்வில் கலந்துகொண்டிருப்பேன், அதனால் விவரங்களை மின்னஞ்சலில் அனுப்புங்கள்.'],
  ['Workplace', 'future-perfect', A, 'By the time the new manager joins our team next month, we will have completed the software update and trained all the staff members.', 'அடுத்த மாதம் புதிய மேலாளர் எங்கள் குழுவில் சேரும்போது, நாங்கள் மென்பொருள் புதுப்பிப்பை முடித்து எல்லாப் பணியாளர்களுக்கும் பயிற்சி அளித்திருப்போம்.'],
  ['Workplace', 'past-continuous', A, 'While we were discussing the budget in the meeting room, the director walked in and asked us to explain the delay in the project.', 'நாங்கள் கூட்ட அறையில் வரவு செலவுத் திட்டம் பற்றி விவாதித்துக்கொண்டிருந்தபோது, இயக்குநர் உள்ளே வந்து திட்டத்தின் தாமதத்தை விளக்கச் சொன்னார்.'],

  ['Job Interview', 'present-simple', B, 'I work as a software tester in a small company.', 'நான் ஒரு சிறிய நிறுவனத்தில் மென்பொருள் சோதனையாளராகப் பணிபுரிகிறேன்.'],
  ['Job Interview', 'future-simple', B, 'I will work hard and learn quickly in this job.', 'இந்த வேலையில் நான் கடினமாக உழைத்து விரைவாகக் கற்றுக்கொள்வேன்.'],
  ['Job Interview', 'present-perfect', I, 'I have worked in customer service for three years, and I enjoy helping people solve problems.', 'நான் மூன்று ஆண்டுகளாக வாடிக்கையாளர் சேவையில் பணிபுரிந்திருக்கிறேன், மக்களின் பிரச்சினைகளைத் தீர்க்க உதவுவதில் எனக்கு மகிழ்ச்சி.'],
  ['Job Interview', 'past-simple', I, 'In my previous job, I led a small team and completed every project before the deadline.', 'என் முந்தைய வேலையில் நான் ஒரு சிறிய குழுவை வழிநடத்தி ஒவ்வொரு திட்டத்தையும் காலக்கெடுவுக்கு முன் முடித்தேன்.'],
  ['Job Interview', 'present-perfect-continuous', A, 'I have been preparing for this position for the last six months by taking online courses and practising my communication skills every single day.', 'கடந்த ஆறு மாதங்களாக ஆன்லைன் படிப்புகளை எடுத்தும் தினமும் என் தொடர்புத் திறனைப் பயிற்சி செய்தும் இந்தப் பதவிக்குத் தயாராகிக்கொண்டிருக்கிறேன்.'],
  ['Job Interview', 'future-simple', A, 'If you give me this opportunity, I will use my skills and experience to help the company grow and I will always respect its values.', 'இந்த வாய்ப்பை நீங்கள் எனக்குக் கொடுத்தால், நிறுவனம் வளர என் திறமையையும் அனுபவத்தையும் பயன்படுத்துவேன், அதன் மதிப்புகளை எப்போதும் மதிப்பேன்.'],

  ['Travel', 'present-simple', B, 'The bus to Madurai leaves from this stand at seven.', 'மதுரைக்குச் செல்லும் பேருந்து இந்தப் பேருந்து நிலையத்திலிருந்து ஏழு மணிக்குப் புறப்படும்.'],
  ['Travel', 'past-simple', B, 'We reached the airport two hours before our flight.', 'நாங்கள் விமானம் புறப்படுவதற்கு இரண்டு மணி நேரம் முன்பே விமான நிலையம் சென்றடைந்தோம்.'],
  ['Travel', 'present-continuous', I, 'We are travelling to Kerala by train this weekend, and we are carrying only small bags.', 'நாங்கள் இந்த வார இறுதியில் ரயிலில் கேரளாவுக்குப் பயணம் செய்கிறோம், சிறிய பைகளை மட்டுமே எடுத்துச் செல்கிறோம்.'],
  ['Travel', 'past-perfect', I, 'When we arrived at the station, the train had already left the platform.', 'நாங்கள் நிலையத்துக்கு வந்தபோது ரயில் ஏற்கெனவே நடைமேடையை விட்டுப் புறப்பட்டுவிட்டிருந்தது.'],
  ['Travel', 'past-simple', A, 'Because the flight was delayed by three hours, we missed the connecting train and had to book a hotel near the station for the night.', 'விமானம் மூன்று மணி நேரம் தாமதமானதால் இணைப்பு ரயிலைத் தவறவிட்டோம், இரவுக்கு நிலையம் அருகே ஒரு விடுதியை முன்பதிவு செய்ய வேண்டியிருந்தது.'],
  ['Travel', 'future-continuous', A, 'This time next week, we will be walking along the beautiful beach in Goa and enjoying the sunset after a long and tiring year.', 'அடுத்த வாரம் இதே நேரத்தில் நாங்கள் ஒரு நீண்ட களைப்பான ஆண்டுக்குப் பிறகு கோவாவின் அழகிய கடற்கரையில் நடந்துகொண்டும் சூரிய அஸ்தமனத்தை ரசித்துக்கொண்டும் இருப்போம்.'],

  ['Shopping', 'present-simple', B, 'This shop sells fresh vegetables at a very low price.', 'இந்தக் கடை புதிய காய்கறிகளை மிகக் குறைந்த விலையில் விற்கிறது.'],
  ['Shopping', 'past-simple', B, 'I bought a new pair of shoes for my brother.', 'நான் என் தம்பிக்கு ஒரு புதிய ஜோடி காலணிகள் வாங்கினேன்.'],
  ['Shopping', 'present-perfect', I, 'I have already checked three shops, but I have not found the shirt I want.', 'நான் ஏற்கெனவே மூன்று கடைகளைப் பார்த்துவிட்டேன், ஆனால் எனக்கு வேண்டிய சட்டை கிடைக்கவில்லை.'],
  ['Shopping', 'future-simple', I, 'If the price comes down next week, I will buy the new phone online.', 'அடுத்த வாரம் விலை குறைந்தால் நான் புதிய தொலைபேசியை ஆன்லைனில் வாங்குவேன்.'],
  ['Shopping', 'past-simple', A, 'While I was waiting in the long queue at the supermarket, I realised that I had forgotten my wallet at home and had to leave without buying anything.', 'நான் பல்பொருள் அங்காடியில் நீண்ட வரிசையில் காத்திருந்தபோது, என் பணப்பையை வீட்டிலேயே மறந்துவிட்டேன் என்பதை உணர்ந்து எதுவும் வாங்காமல் செல்ல வேண்டியிருந்தது.'],
  ['Shopping', 'future-perfect', A, 'By the time the festival season starts next month, the shop will have received all the new stock and will have reduced the prices on older items.', 'அடுத்த மாதம் பண்டிகைக் காலம் தொடங்கும்போது, கடை எல்லாப் புதிய சரக்குகளையும் பெற்று, பழைய பொருள்களின் விலைகளைக் குறைத்திருக்கும்.'],

  ['Restaurant', 'present-simple', B, 'This restaurant serves the best chicken biryani in the city.', 'இந்த உணவகம் நகரத்திலேயே சிறந்த சிக்கன் பிரியாணியைப் பரிமாறுகிறது.'],
  ['Restaurant', 'future-simple', B, 'I will have a plate of idlis and a coffee.', 'நான் ஒரு தட்டு இட்லியும் ஒரு காபியும் சாப்பிடுவேன்.'],
  ['Restaurant', 'past-simple', I, 'We ordered two dosas and a vegetable curry, but the waiter brought the wrong dish.', 'நாங்கள் இரண்டு தோசையும் காய்கறிக் குழம்பும் ஆர்டர் செய்தோம், ஆனால் பரிமாறுபவர் தவறான உணவைக் கொண்டுவந்தார்.'],
  ['Restaurant', 'present-continuous', I, 'The chef is preparing a special dish for our table, so please wait for a few minutes.', 'சமையல்காரர் எங்கள் மேசைக்காக ஒரு சிறப்பு உணவைத் தயாரித்துக்கொண்டிருக்கிறார், அதனால் சில நிமிடங்கள் காத்திருங்கள்.'],
  ['Restaurant', 'past-perfect-continuous', A, 'By the time we got a table at the crowded restaurant, we had been waiting outside for almost an hour and everyone was extremely hungry.', 'நெரிசலான உணவகத்தில் எங்களுக்கு மேசை கிடைத்தபோது, நாங்கள் வெளியே ஏறத்தாழ ஒரு மணி நேரம் காத்திருந்தோம், எல்லோரும் மிகவும் பசியுடன் இருந்தார்கள்.'],
  ['Restaurant', 'present-perfect', A, 'I have never tasted such delicious fish curry before, and I would like to ask the cook how she prepares it with so few spices.', 'இவ்வளவு சுவையான மீன் குழம்பை நான் இதுவரை சுவைத்ததில்லை, இவ்வளவு குறைந்த மசாலாவுடன் எப்படிச் செய்கிறார் என்று சமையல்காரரிடம் கேட்க விரும்புகிறேன்.'],

  ['Telephone', 'present-continuous', B, 'I am calling to ask about my order.', 'என் ஆர்டரைப் பற்றிக் கேட்பதற்காக நான் அழைக்கிறேன்.'],
  ['Telephone', 'future-simple', B, 'I will call you back in ten minutes.', 'நான் பத்து நிமிடங்களில் உங்களை மீண்டும் அழைப்பேன்.'],
  ['Telephone', 'past-simple', I, 'I called you three times this morning, but your phone was switched off.', 'நான் இன்று காலை மூன்று முறை உங்களை அழைத்தேன், ஆனால் உங்கள் தொலைபேசி அணைக்கப்பட்டிருந்தது.'],
  ['Telephone', 'future-continuous', I, 'Please call me after six because I will be travelling in the train until then.', 'தயவுசெய்து ஆறு மணிக்குப் பிறகு அழையுங்கள், அதுவரை நான் ரயிலில் பயணம் செய்துகொண்டிருப்பேன்.'],
  ['Telephone', 'present-perfect', A, 'I have already tried to contact your customer care number twice today, but nobody has answered my call or solved my problem yet.', 'இன்று இரண்டு முறை உங்கள் வாடிக்கையாளர் சேவை எண்ணைத் தொடர்புகொள்ள முயன்றுவிட்டேன், ஆனால் யாரும் என் அழைப்புக்குப் பதிலளிக்கவோ என் பிரச்சினையைத் தீர்க்கவோ இல்லை.'],
  ['Telephone', 'past-continuous', A, 'I was talking to my manager on the phone when the signal suddenly disappeared, so I had to send him a message to explain everything.', 'நான் என் மேலாளருடன் தொலைபேசியில் பேசிக்கொண்டிருந்தபோது சிக்னல் திடீரென மறைந்துவிட்டது, அதனால் எல்லாவற்றையும் விளக்கி அவருக்குச் செய்தி அனுப்ப வேண்டியிருந்தது.'],
];

const wordCount = (s: string): number => s.trim().split(/\s+/).length;

function levelFits(level: SentenceLevel, n: number): boolean {
  return level === 'Beginner' ? n >= 8 && n <= 12 : level === 'Intermediate' ? n >= 12 && n <= 20 : n >= 20 && n <= 30;
}

/** Every long sentence: the topic list above plus the 12-tense fill-in sentences (those belong to a tense, not to a topic). */
export function longSentences(): LongSentence[] {
  const topic = ROWS.map(([t, tense, level, en, ta]) => ({ topic: t, tense, level, en, ta }));
  const tenseOnly = buildTenseBlanks().map((q) => ({
    topic: '', tense: q.tense as TenseId, level: q.level, en: q.full, ta: q.ta,
  }));
  return [...topic, ...tenseOnly].filter((s) => levelFits(s.level, wordCount(s.en)));
}
