// Fill in the Blanks for the 12 English tenses: 4 questions for each level (beginner, intermediate, advanced) of each tense.
// Pure data, no Angular. Each row is [level, sentence with {answer|base verb} in braces, Tamil meaning].
// The wrong options are made from the other forms of the same verb (base, -s, -ing, past, participle).

import { TENSE_LESSONS } from './tense-data';
import { thirdPerson, ingForm, pastForm, participleForm } from './verb-forms';

export type BlankLevel = 'Beginner' | 'Intermediate' | 'Advanced';
type Row = [level: BlankLevel, sentence: string, ta: string];
const B: BlankLevel = 'Beginner', I: BlankLevel = 'Intermediate', A: BlankLevel = 'Advanced';

const ROWS: Record<string, Row[]> = {
  'present-simple': [
    [B, 'She {goes|go} to the office every day.', 'அவள் தினமும் அலுவலகத்திற்குச் செல்கிறாள்.'],
    [B, 'I {drink|drink} tea every morning.', 'நான் தினமும் காலையில் தேநீர் குடிக்கிறேன்.'],
    [B, 'My brother {plays|play} cricket on Sundays.', 'என் தம்பி ஞாயிற்றுக்கிழமைகளில் கிரிக்கெட் விளையாடுகிறான்.'],
    [B, 'The shop {opens|open} at nine o\'clock every day.', 'கடை தினமும் ஒன்பது மணிக்குத் திறக்கும்.'],
    [I, 'My father usually {watches|watch} the news before he goes to work.', 'என் அப்பா வழக்கமாக வேலைக்குச் செல்வதற்கு முன் செய்திகள் பார்ப்பார்.'],
    [I, 'Our teacher always {explains|explain} difficult words in simple English.', 'எங்கள் ஆசிரியர் எப்போதும் கடினமான சொற்களை எளிய ஆங்கிலத்தில் விளக்குவார்.'],
    [I, 'My sister never {eats|eat} food from the street shops.', 'என் தங்கை தெருக்கடை உணவை ஒருபோதும் சாப்பிடுவதில்லை.'],
    [I, 'The train to Chennai {leaves|leave} at six o\'clock every evening.', 'சென்னைக்குச் செல்லும் ரயில் தினமும் மாலை ஆறு மணிக்குப் புறப்படும்.'],
    [A, 'Although he lives far from the office, he {reaches|reach} there before everyone else every morning.', 'அலுவலகத்திலிருந்து தூரத்தில் வசித்தாலும், அவர் தினமும் காலையில் எல்லோருக்கும் முன்பே அங்கு சேர்கிறார்.'],
    [A, 'Whenever my mother cooks sambar, the whole house {smells|smell} wonderful.', 'என் அம்மா சாம்பார் வைக்கும்போதெல்லாம் வீடு முழுவதும் அருமையாக மணக்கும்.'],
    [A, 'The manager rarely {allows|allow} anyone to leave early unless there is an emergency.', 'அவசரநிலை இல்லாவிட்டால் மேலாளர் யாரையும் சீக்கிரம் செல்ல அனுமதிப்பது அரிது.'],
    [A, 'Every student who {practises|practise} speaking daily improves quickly.', 'தினமும் பேசிப் பயிற்சி செய்யும் ஒவ்வொரு மாணவரும் விரைவாக முன்னேறுகிறார்.'],
  ],
  'present-continuous': [
    [B, 'She is {cooking|cook} dinner now.', 'அவள் இப்போது இரவு உணவு சமைத்துக்கொண்டிருக்கிறாள்.'],
    [B, 'The children are {playing|play} in the garden right now.', 'குழந்தைகள் இப்போது தோட்டத்தில் விளையாடிக்கொண்டிருக்கிறார்கள்.'],
    [B, 'I am {writing|write} a letter at the moment.', 'நான் இந்த நேரத்தில் ஒரு கடிதம் எழுதிக்கொண்டிருக்கிறேன்.'],
    [B, 'Look! It is {raining|rain} outside.', 'பாருங்கள்! வெளியே மழை பெய்துகொண்டிருக்கிறது.'],
    [I, 'My brother is {studying|study} for his exam this week, so he is not watching TV.', 'என் தம்பி இந்த வாரம் தேர்வுக்குப் படித்துக்கொண்டிருக்கிறான், அதனால் தொலைக்காட்சி பார்க்கவில்லை.'],
    [I, 'We are {waiting|wait} for the bus, but it is already late.', 'நாங்கள் பேருந்துக்காகக் காத்திருக்கிறோம், ஆனால் அது ஏற்கெனவே தாமதமாகிவிட்டது.'],
    [I, 'Why are you {running|run} so fast? Is somebody following you?', 'ஏன் இவ்வளவு வேகமாக ஓடுகிறீர்கள்? யாராவது உங்களைப் பின்தொடர்கிறார்களா?'],
    [I, 'She is {learning|learn} English these days to get a better job.', 'நல்ல வேலை கிடைக்க அவள் இந்த நாட்களில் ஆங்கிலம் கற்றுக்கொண்டிருக்கிறாள்.'],
    [A, 'The company is {hiring|hire} new engineers this month because its business is growing quickly.', 'நிறுவனத்தின் தொழில் வேகமாக வளர்வதால் இந்த மாதம் புதிய பொறியாளர்களை வேலைக்கு எடுத்துக்கொண்டிருக்கிறது.'],
    [A, 'While the teacher is {explaining|explain} the lesson, please do not use your phones.', 'ஆசிரியர் பாடத்தை விளக்கிக்கொண்டிருக்கும்போது தயவுசெய்து தொலைபேசியைப் பயன்படுத்த வேண்டாம்.'],
    [A, 'I am {meeting|meet} my manager tomorrow at ten to discuss my promotion.', 'என் பதவி உயர்வு பற்றிப் பேச நாளை பத்து மணிக்கு என் மேலாளரைச் சந்திக்கிறேன்.'],
    [A, 'More and more people are {choosing|choose} online classes because they save time and money.', 'நேரத்தையும் பணத்தையும் சேமிப்பதால் மேலும் மேலும் மக்கள் ஆன்லைன் வகுப்புகளைத் தேர்ந்தெடுக்கிறார்கள்.'],
  ],
  'present-perfect': [
    [B, 'I have {finished|finish} my homework.', 'நான் என் வீட்டுப்பாடத்தை முடித்துவிட்டேன்.'],
    [B, 'She has {visited|visit} Madurai twice.', 'அவள் மதுரைக்கு இருமுறை சென்றிருக்கிறாள்.'],
    [B, 'They have {eaten|eat} lunch already.', 'அவர்கள் ஏற்கெனவே மதிய உணவு சாப்பிட்டுவிட்டார்கள்.'],
    [B, 'We have {seen|see} this film before.', 'நாங்கள் இந்தப் படத்தை முன்பே பார்த்திருக்கிறோம்.'],
    [I, 'I have {completed|complete} my assignment before the deadline.', 'காலக்கெடுவுக்கு முன்பே எனது பணியை முடித்துவிட்டேன்.'],
    [I, 'He has {lived|live} in Coimbatore since 2018, so he knows the city well.', 'அவர் 2018 முதல் கோயம்புத்தூரில் வசித்துவருகிறார், அதனால் அந்த நகரத்தை நன்றாக அறிவார்.'],
    [I, 'Have you ever {tried|try} Chettinad food?', 'நீங்கள் எப்போதாவது செட்டிநாட்டு உணவை சுவைத்திருக்கிறீர்களா?'],
    [I, 'My phone is not working because I have {lost|lose} the charger.', 'சார்ஜரைத் தொலைத்துவிட்டதால் என் தொலைபேசி வேலை செய்யவில்லை.'],
    [A, 'Since she joined the company, she has {received|receive} three awards for her excellent customer service.', 'நிறுவனத்தில் சேர்ந்ததிலிருந்து அவள் சிறந்த வாடிக்கையாளர் சேவைக்காக மூன்று விருதுகளைப் பெற்றிருக்கிறாள்.'],
    [A, 'I have never {spoken|speak} to a foreigner in English, but I would love to try.', 'நான் இதுவரை வெளிநாட்டவருடன் ஆங்கிலத்தில் பேசியதில்லை, ஆனால் முயற்சிக்க விரும்புகிறேன்.'],
    [A, 'The government has just {announced|announce} a new scheme that will help thousands of students.', 'ஆயிரக்கணக்கான மாணவர்களுக்கு உதவும் புதிய திட்டத்தை அரசு இப்போதுதான் அறிவித்திருக்கிறது.'],
    [A, 'We have already {booked|book} the tickets, so nobody needs to worry about the journey.', 'நாங்கள் ஏற்கெனவே டிக்கெட் பதிவு செய்துவிட்டோம், அதனால் பயணத்தைப் பற்றி யாரும் கவலைப்பட வேண்டாம்.'],
  ],
  'present-perfect-continuous': [
    [B, 'I have been {waiting|wait} for two hours.', 'நான் இரண்டு மணி நேரமாகக் காத்துக்கொண்டிருக்கிறேன்.'],
    [B, 'She has been {working|work} here since morning.', 'அவள் காலையிலிருந்து இங்கே வேலை செய்துகொண்டிருக்கிறாள்.'],
    [B, 'They have been {playing|play} football for an hour.', 'அவர்கள் ஒரு மணி நேரமாக கால்பந்து விளையாடிக்கொண்டிருக்கிறார்கள்.'],
    [B, 'It has been {raining|rain} since morning.', 'காலையிலிருந்து மழை பெய்துகொண்டிருக்கிறது.'],
    [I, 'I have been {learning|learn} English for three years, and I am getting more confident.', 'நான் மூன்று ஆண்டுகளாக ஆங்கிலம் கற்றுக்கொண்டிருக்கிறேன், என் தன்னம்பிக்கை கூடுகிறது.'],
    [I, 'He has been {studying|study} all night, so he looks very tired.', 'அவன் இரவு முழுவதும் படித்துக்கொண்டிருக்கிறான், அதனால் மிகவும் களைப்பாகத் தெரிகிறான்.'],
    [I, 'How long have you been {living|live} in Chennai?', 'நீங்கள் எவ்வளவு காலமாக சென்னையில் வசித்துக்கொண்டிருக்கிறீர்கள்?'],
    [I, 'My eyes are red because I have been {looking|look} at the phone for hours.', 'பல மணி நேரமாகத் தொலைபேசியைப் பார்த்துக்கொண்டிருப்பதால் என் கண்கள் சிவந்திருக்கின்றன.'],
    [A, 'The engineers have been {working|work} on this project for six months, and they are close to finishing it.', 'பொறியாளர்கள் ஆறு மாதங்களாக இந்தத் திட்டத்தில் வேலை செய்துகொண்டிருக்கிறார்கள், முடிக்கும் தருவாயில் உள்ளனர்.'],
    [A, 'She has been {preparing|prepare} for the interview since last week, so she feels ready.', 'அவள் கடந்த வாரத்திலிருந்து நேர்காணலுக்குத் தயாராகிக்கொண்டிருக்கிறாள், அதனால் தயாராக உணர்கிறாள்.'],
    [A, 'Prices have been {rising|rise} steadily this year, which is worrying many families.', 'இந்த ஆண்டு விலைகள் தொடர்ந்து உயர்ந்துகொண்டிருக்கின்றன, இது பல குடும்பங்களைக் கவலைப்படுத்துகிறது.'],
    [A, 'We have been {trying|try} to contact the customer all afternoon, but nobody answers the phone.', 'மதியம் முழுவதும் வாடிக்கையாளரைத் தொடர்புகொள்ள முயன்றுகொண்டிருக்கிறோம், ஆனால் யாரும் தொலைபேசியை எடுக்கவில்லை.'],
  ],
  'past-simple': [
    [B, 'I {visited|visit} my friend yesterday.', 'நான் நேற்று என் நண்பரைச் சந்தித்தேன்.'],
    [B, 'She {bought|buy} a new phone last week.', 'அவள் கடந்த வாரம் ஒரு புதிய தொலைபேசி வாங்கினாள்.'],
    [B, 'We {watched|watch} a movie last night.', 'நாங்கள் நேற்று இரவு ஒரு படம் பார்த்தோம்.'],
    [B, 'He {went|go} to Madurai two days ago.', 'அவன் இரண்டு நாட்களுக்கு முன் மதுரைக்குச் சென்றான்.'],
    [I, 'Although I was tired yesterday, I {finished|finish} all my office work before eight.', 'நேற்று களைப்பாக இருந்தாலும், எட்டு மணிக்கு முன் என் அலுவலக வேலைகள் அனைத்தையும் முடித்தேன்.'],
    [I, 'She {missed|miss} the bus this morning, so she took an auto.', 'இன்று காலை அவள் பேருந்தைத் தவறவிட்டாள், அதனால் ஆட்டோவில் சென்றாள்.'],
    [I, 'Did you {meet|meet} your manager last Friday?', 'கடந்த வெள்ளிக்கிழமை உங்கள் மேலாளரைச் சந்தித்தீர்களா?'],
    [I, 'The film started late, so we {reached|reach} home after midnight.', 'படம் தாமதமாகத் தொடங்கியதால் நாங்கள் நள்ளிரவுக்குப் பிறகு வீடு சேர்ந்தோம்.'],
    [A, 'Last night I {arrived|arrive} at the station very late, so I called my brother for help and he came to pick me up.', 'நேற்று இரவு நான் நிலையத்துக்கு மிகத் தாமதமாக வந்தேன், அதனால் உதவிக்கு என் அண்ணனை அழைத்தேன், அவர் என்னை அழைத்துச் செல்ல வந்தார்.'],
    [A, 'Last year, our company {launched|launch} a mobile app that helped customers book tickets in just a few minutes.', 'கடந்த ஆண்டு எங்கள் நிறுவனம் சில நிமிடங்களில் டிக்கெட் பதிவு செய்ய உதவும் செயலியை வெளியிட்டது.'],
    [A, 'He {decided|decide} to change his job after he realised that nobody appreciated his hard work.', 'தன் கடின உழைப்பை யாரும் மதிக்கவில்லை என்று உணர்ந்த பிறகு அவன் வேலையை மாற்ற முடிவு செய்தான்.'],
    [A, 'I {took|take} a deep breath, walked into the interview room, and answered every question politely.', 'நான் ஆழ்ந்த மூச்சு எடுத்து, நேர்காணல் அறைக்குள் நுழைந்து, எல்லாக் கேள்விகளுக்கும் பணிவாகப் பதிலளித்தேன்.'],
  ],
  'past-continuous': [
    [B, 'I was {watching|watch} television at eight.', 'எட்டு மணிக்கு நான் தொலைக்காட்சி பார்த்துக்கொண்டிருந்தேன்.'],
    [B, 'She was {cooking|cook} when I called her.', 'நான் அழைத்தபோது அவள் சமைத்துக்கொண்டிருந்தாள்.'],
    [B, 'They were {playing|play} cricket at five yesterday.', 'நேற்று ஐந்து மணிக்கு அவர்கள் கிரிக்கெட் விளையாடிக்கொண்டிருந்தார்கள்.'],
    [B, 'It was {raining|rain} when we left home.', 'நாங்கள் வீட்டை விட்டுப் புறப்பட்டபோது மழை பெய்துகொண்டிருந்தது.'],
    [I, 'While my mother was {cooking|cook} dinner, my father was reading the newspaper.', 'என் அம்மா இரவு உணவு சமைத்துக்கொண்டிருந்தபோது என் அப்பா செய்தித்தாள் படித்துக்கொண்டிருந்தார்.'],
    [I, 'I was {walking|walk} to the office when I met my old teacher.', 'நான் அலுவலகத்துக்கு நடந்துகொண்டிருந்தபோது என் பழைய ஆசிரியரைச் சந்தித்தேன்.'],
    [I, 'What were you {doing|do} at ten o\'clock last night?', 'நேற்று இரவு பத்து மணிக்கு நீங்கள் என்ன செய்துகொண்டிருந்தீர்கள்?'],
    [I, 'The students were {talking|talk} loudly when the principal entered the classroom.', 'முதல்வர் வகுப்பறைக்குள் நுழைந்தபோது மாணவர்கள் சத்தமாகப் பேசிக்கொண்டிருந்தார்கள்.'],
    [A, 'We were {discussing|discuss} the new project in the meeting room when the power suddenly went off.', 'நாங்கள் கூட்ட அறையில் புதிய திட்டத்தைப் பற்றி விவாதித்துக்கொண்டிருந்தபோது திடீரென மின்சாரம் போய்விட்டது.'],
    [A, 'She was {travelling|travel} to Bangalore for an interview while her friends were preparing a surprise party.', 'அவள் நேர்காணலுக்காக பெங்களூருக்குப் பயணம் செய்துகொண்டிருந்தபோது நண்பர்கள் ஆச்சரிய விருந்துக்குத் தயாராகிக்கொண்டிருந்தார்கள்.'],
    [A, 'He was {driving|drive} carefully because the road was wet and the traffic was heavy.', 'சாலை ஈரமாகவும் போக்குவரத்து அதிகமாகவும் இருந்ததால் அவன் கவனமாக ஓட்டிக்கொண்டிருந்தான்.'],
    [A, 'All afternoon the farmers were {working|work} in the fields, although the sun was extremely hot.', 'வெயில் மிகக் கடுமையாக இருந்தாலும் மதியம் முழுவதும் விவசாயிகள் வயல்களில் வேலை செய்துகொண்டிருந்தார்கள்.'],
  ],
  'past-perfect': [
    [B, 'I had {eaten|eat} before he arrived.', 'அவர் வருவதற்கு முன்பே நான் சாப்பிட்டிருந்தேன்.'],
    [B, 'The train had {left|leave} when we reached the station.', 'நாங்கள் நிலையம் சென்றடைந்தபோது ரயில் புறப்பட்டுவிட்டிருந்தது.'],
    [B, 'She had {finished|finish} her work before lunch.', 'மதிய உணவுக்கு முன்பே அவள் தன் வேலையை முடித்திருந்தாள்.'],
    [B, 'They had {gone|go} home before the rain started.', 'மழை தொடங்குவதற்கு முன்பே அவர்கள் வீட்டுக்குச் சென்றிருந்தார்கள்.'],
    [I, 'When I reached the cinema, the film had already {started|start}.', 'நான் திரையரங்குக்குச் சென்றபோது படம் ஏற்கெனவே தொடங்கிவிட்டிருந்தது.'],
    [I, 'He told me that he had never {seen|see} the sea before that trip.', 'அந்தப் பயணத்துக்கு முன் தான் கடலைப் பார்த்ததே இல்லை என்று அவன் என்னிடம் சொன்னான்.'],
    [I, 'After she had {washed|wash} the dishes, she sat down to watch TV.', 'பாத்திரங்களைக் கழுவிய பிறகு அவள் தொலைக்காட்சி பார்க்க அமர்ந்தாள்.'],
    [I, 'I could not open the door because I had {forgotten|forget} the key.', 'சாவியை மறந்துவிட்டிருந்ததால் என்னால் கதவைத் திறக்க முடியவில்லை.'],
    [A, 'By the time the manager arrived, the team had already {solved|solve} the problem and sent the report to the client.', 'மேலாளர் வருவதற்குள் குழு ஏற்கெனவே பிரச்சினையைத் தீர்த்து அறிக்கையை வாடிக்கையாளருக்கு அனுப்பிவிட்டிருந்தது.'],
    [A, 'She felt nervous in the interview because she had never {attended|attend} one in English before.', 'அதற்கு முன் ஆங்கிலத்தில் நேர்காணலுக்குச் சென்றதே இல்லை என்பதால் அவள் நேர்காணலில் பதற்றமாக உணர்ந்தாள்.'],
    [A, 'We had {planned|plan} a picnic for Sunday, but we cancelled it after the weather forecast warned about heavy rain.', 'ஞாயிற்றுக்கிழமைக்கு சுற்றுலா திட்டமிட்டிருந்தோம், ஆனால் கனமழை எச்சரிக்கை வந்ததால் ரத்து செய்தோம்.'],
    [A, 'Nobody realised that the thief had {entered|enter} the house through the back window until the police arrived.', 'போலீஸ் வரும்வரை திருடன் பின்பக்க ஜன்னல் வழியாக வீட்டுக்குள் நுழைந்திருந்தது யாருக்கும் தெரியவில்லை.'],
  ],
  'past-perfect-continuous': [
    [B, 'I had been {waiting|wait} for an hour.', 'நான் ஒரு மணி நேரமாகக் காத்துக்கொண்டிருந்தேன்.'],
    [B, 'She had been {sleeping|sleep} for two hours when I called.', 'நான் அழைத்தபோது அவள் இரண்டு மணி நேரமாகத் தூங்கிக்கொண்டிருந்தாள்.'],
    [B, 'They had been {playing|play} for an hour before it rained.', 'மழை பெய்வதற்கு முன் அவர்கள் ஒரு மணி நேரமாக விளையாடிக்கொண்டிருந்தார்கள்.'],
    [B, 'He had been {working|work} all day, so he was tired.', 'அவன் நாள் முழுவதும் வேலை செய்துகொண்டிருந்தான், அதனால் களைப்பாக இருந்தான்.'],
    [I, 'The ground was wet because it had been {raining|rain} since morning.', 'காலையிலிருந்து மழை பெய்துகொண்டிருந்ததால் தரை ஈரமாக இருந்தது.'],
    [I, 'I had been {studying|study} for three hours before my friend came to meet me.', 'என் நண்பர் என்னைச் சந்திக்க வருவதற்கு முன் நான் மூன்று மணி நேரமாகப் படித்துக்கொண்டிருந்தேன்.'],
    [I, 'How long had you been {living|live} in Salem before you moved to Chennai?', 'சென்னைக்கு மாறுவதற்கு முன் நீங்கள் எவ்வளவு காலமாக சேலத்தில் வசித்துக்கொண்டிருந்தீர்கள்?'],
    [I, 'She was angry because she had been {trying|try} to call him since morning.', 'காலையிலிருந்து அவனை அழைக்க முயன்றுகொண்டிருந்ததால் அவள் கோபமாக இருந்தாள்.'],
    [A, 'By the time the bus finally arrived, we had been {standing|stand} in the hot sun for almost two hours.', 'பேருந்து கடைசியாக வந்தபோது நாங்கள் கிட்டத்தட்ட இரண்டு மணி நேரமாக சுட்டெரிக்கும் வெயிலில் நின்றுகொண்டிருந்தோம்.'],
    [A, 'He had been {practising|practise} English every evening for a year before he got the job in Dubai.', 'துபாயில் வேலை கிடைப்பதற்கு முன் அவன் ஒரு ஆண்டு முழுவதும் தினமும் மாலை ஆங்கிலம் பயிற்சி செய்துகொண்டிருந்தான்.'],
    [A, 'The workers had been {repairing|repair} the road for weeks, so the traffic was terrible in our area.', 'தொழிலாளர்கள் வாரக்கணக்கில் சாலையைச் சரிசெய்துகொண்டிருந்ததால் எங்கள் பகுதியில் போக்குவரத்து மோசமாக இருந்தது.'],
    [A, 'My eyes were burning because I had been {staring|stare} at the computer screen without a break.', 'இடைவேளை இல்லாமல் கணினித் திரையையே பார்த்துக்கொண்டிருந்ததால் என் கண்கள் எரிந்தன.'],
  ],
  'future-simple': [
    [B, 'I will {call|call} you tomorrow.', 'நான் நாளை உங்களை அழைப்பேன்.'],
    [B, 'She will {visit|visit} her grandmother next week.', 'அவள் அடுத்த வாரம் தன் பாட்டியைப் பார்க்கச் செல்வாள்.'],
    [B, 'It will {rain|rain} tomorrow evening.', 'நாளை மாலை மழை பெய்யும்.'],
    [B, 'We will {meet|meet} again on Monday.', 'நாங்கள் திங்கட்கிழமை மீண்டும் சந்திப்போம்.'],
    [I, 'I think our team will {win|win} the match tomorrow because everyone is practising hard.', 'எல்லோரும் கடுமையாகப் பயிற்சி செய்வதால் நாளை நம் அணி போட்டியில் வெல்லும் என்று நினைக்கிறேன்.'],
    [I, 'If you study regularly, you will {pass|pass} the exam easily.', 'நீங்கள் தொடர்ந்து படித்தால் தேர்வில் எளிதாக வெற்றி பெறுவீர்கள்.'],
    [I, 'Don\'t worry, I will {help|help} you with your homework this evening.', 'கவலைப்படாதீர்கள், இன்று மாலை உங்கள் வீட்டுப்பாடத்தில் உதவுவேன்.'],
    [I, 'The meeting will {start|start} at ten o\'clock sharp tomorrow morning.', 'நாளை காலை சரியாகப் பத்து மணிக்குக் கூட்டம் தொடங்கும்.'],
    [A, 'Next year, I will {move|move} to Bangalore, find a better job, and send some money to my parents every month.', 'அடுத்த ஆண்டு நான் பெங்களூருக்குச் சென்று, நல்ல வேலை தேடி, ஒவ்வொரு மாதமும் பெற்றோருக்குப் பணம் அனுப்புவேன்.'],
    [A, 'I promise that I will {finish|finish} the report before you return from the meeting.', 'நீங்கள் கூட்டத்திலிருந்து திரும்புவதற்கு முன் அறிக்கையை முடித்துவிடுவேன் என்று உறுதியளிக்கிறேன்.'],
    [A, 'When the new metro line opens, travelling across the city will {become|become} much faster and cheaper.', 'புதிய மெட்ரோ பாதை திறக்கப்பட்டதும் நகரம் முழுவதும் பயணம் செய்வது மிக வேகமாகவும் மலிவாகவும் மாறும்.'],
    [A, 'The weather report says that the heavy rain will {continue|continue} for the next three days.', 'அடுத்த மூன்று நாட்களுக்கும் கனமழை தொடரும் என்று வானிலை அறிக்கை கூறுகிறது.'],
  ],
  'future-continuous': [
    [B, 'I will be {working|work} at ten.', 'பத்து மணிக்கு நான் வேலை செய்துகொண்டிருப்பேன்.'],
    [B, 'She will be {sleeping|sleep} at midnight.', 'நள்ளிரவில் அவள் தூங்கிக்கொண்டிருப்பாள்.'],
    [B, 'They will be {travelling|travel} to Delhi tomorrow morning.', 'அவர்கள் நாளை காலை டெல்லிக்குப் பயணம் செய்துகொண்டிருப்பார்கள்.'],
    [B, 'We will be {waiting|wait} for you at the gate.', 'நாங்கள் வாயிலில் உங்களுக்காகக் காத்துக்கொண்டிருப்போம்.'],
    [I, 'This time tomorrow, I will be {flying|fly} to Singapore for my first foreign trip.', 'நாளை இதே நேரத்தில் நான் என் முதல் வெளிநாட்டுப் பயணத்துக்காக சிங்கப்பூருக்குப் பறந்துகொண்டிருப்பேன்.'],
    [I, 'Don\'t call me at eight tonight because I will be {teaching|teach} a class.', 'இன்று இரவு எட்டு மணிக்கு என்னை அழைக்காதீர்கள், ஏனெனில் நான் வகுப்பு நடத்திக்கொண்டிருப்பேன்.'],
    [I, 'Will you be {using|use} the laptop tomorrow afternoon?', 'நாளை மதியம் நீங்கள் மடிக்கணினியைப் பயன்படுத்திக்கொண்டிருப்பீர்களா?'],
    [I, 'In June, my sister will be {studying|study} in London.', 'ஜூன் மாதத்தில் என் தங்கை லண்டனில் படித்துக்கொண்டிருப்பாள்.'],
    [A, 'When you reach the airport tomorrow evening, I will be {standing|stand} near the main entrance holding a blue board.', 'நாளை மாலை நீங்கள் விமான நிலையம் வரும்போது நான் நீல நிறப் பலகையுடன் முதன்மை நுழைவாயில் அருகே நின்றுகொண்டிருப்பேன்.'],
    [A, 'By this time next month, our team will be {testing|test} the new software with real customers.', 'அடுத்த மாதம் இதே நேரத்தில் எங்கள் குழு புதிய மென்பொருளை உண்மையான வாடிக்கையாளர்களுடன் சோதித்துக்கொண்டிருக்கும்.'],
    [A, 'Please do not disturb him between two and four because he will be {preparing|prepare} for his final interview.', 'இரண்டு முதல் நான்கு மணி வரை அவரைத் தொந்தரவு செய்யாதீர்கள், ஏனெனில் அவர் இறுதி நேர்காணலுக்குத் தயாராகிக்கொண்டிருப்பார்.'],
    [A, 'Next summer, while the rest of the family is on holiday, I will be {working|work} on my English speaking skills every day.', 'அடுத்த கோடையில் குடும்பத்தினர் விடுமுறையில் இருக்கும்போது நான் தினமும் என் ஆங்கிலப் பேச்சுத் திறனில் உழைத்துக்கொண்டிருப்பேன்.'],
  ],
  'future-perfect': [
    [B, 'I will have {completed|complete} it by Monday.', 'திங்கட்கிழமைக்குள் அதை முடித்திருப்பேன்.'],
    [B, 'She will have {left|leave} before you arrive.', 'நீங்கள் வருவதற்குள் அவள் புறப்பட்டிருப்பாள்.'],
    [B, 'They will have {finished|finish} the work by evening.', 'மாலைக்குள் அவர்கள் வேலையை முடித்திருப்பார்கள்.'],
    [B, 'We will have {eaten|eat} dinner by nine.', 'ஒன்பது மணிக்குள் நாங்கள் இரவு உணவு சாப்பிட்டிருப்போம்.'],
    [I, 'By the end of this year, I will have {saved|save} enough money to buy a new bike.', 'இந்த ஆண்டு முடிவதற்குள் புதிய பைக் வாங்கப் போதுமான பணத்தைச் சேமித்திருப்பேன்.'],
    [I, 'By the time you come home, I will have {cooked|cook} dinner.', 'நீங்கள் வீடு திரும்புவதற்குள் நான் இரவு உணவு சமைத்திருப்பேன்.'],
    [I, 'Will you have {written|write} the whole report by next Friday?', 'அடுத்த வெள்ளிக்கிழமைக்குள் நீங்கள் முழு அறிக்கையையும் எழுதியிருப்பீர்களா?'],
    [I, 'My brother will have {graduated|graduate} by this time next year.', 'அடுத்த ஆண்டு இதே நேரத்தில் என் அண்ணன் பட்டம் பெற்றிருப்பான்.'],
    [A, 'By the time the new manager joins us in April, we will have {launched|launch} the app and fixed most of its problems.', 'புதிய மேலாளர் ஏப்ரலில் எங்களுடன் சேரும்போது நாங்கள் செயலியை வெளியிட்டு பெரும்பாலான சிக்கல்களைச் சரிசெய்திருப்போம்.'],
    [A, 'If everything goes well, she will have {become|become} a fluent English speaker within two years.', 'எல்லாம் நன்றாக நடந்தால் இரண்டு ஆண்டுகளுக்குள் அவள் சரளமாக ஆங்கிலம் பேசுபவளாக மாறியிருப்பாள்.'],
    [A, 'By next Sunday, the builders will have {completed|complete} the entire ground floor, so we can start decorating.', 'அடுத்த ஞாயிற்றுக்கிழமைக்குள் கட்டுநர்கள் முழுத் தரைத்தளத்தையும் முடித்திருப்பார்கள், அதனால் நாங்கள் அலங்கரிக்கத் தொடங்கலாம்.'],
    [A, 'By the time we reach the theatre, the first half of the film will have {finished|finish}, so let us hurry.', 'நாம் திரையரங்கம் செல்வதற்குள் படத்தின் முதல் பாதி முடிந்திருக்கும், அதனால் விரைவாகச் செல்வோம்.'],
  ],
  'future-perfect-continuous': [
    [B, 'By June, I will have been {working|work} here for a year.', 'ஜூன் மாதத்திற்குள் நான் இங்கு ஒரு வருடமாக வேலை செய்துகொண்டிருப்பேன்.'],
    [B, 'By evening, she will have been {studying|study} for six hours.', 'மாலைக்குள் அவள் ஆறு மணி நேரமாகப் படித்துக்கொண்டிருப்பாள்.'],
    [B, 'By next month, we will have been {living|live} here for five years.', 'அடுத்த மாதத்திற்குள் நாங்கள் இங்கே ஐந்து ஆண்டுகளாக வசித்துக்கொண்டிருப்போம்.'],
    [B, 'By noon, they will have been {travelling|travel} for four hours.', 'நண்பகலுக்குள் அவர்கள் நான்கு மணி நேரமாகப் பயணம் செய்துகொண்டிருப்பார்கள்.'],
    [I, 'By next year, I will have been {learning|learn} English for five years.', 'அடுத்த ஆண்டுக்குள் நான் ஐந்து ஆண்டுகளாக ஆங்கிலம் கற்றுக்கொண்டிருப்பேன்.'],
    [I, 'By the time he retires, he will have been {teaching|teach} for thirty years.', 'அவர் ஓய்வு பெறும்போது முப்பது ஆண்டுகளாகக் கற்பித்துக்கொண்டிருப்பார்.'],
    [I, 'How long will you have been {waiting|wait} by the time the bus comes?', 'பேருந்து வரும்போது நீங்கள் எவ்வளவு நேரமாகக் காத்துக்கொண்டிருப்பீர்கள்?'],
    [I, 'By March, the company will have been {operating|operate} in this city for ten years.', 'மார்ச் மாதத்திற்குள் நிறுவனம் இந்த நகரத்தில் பத்து ஆண்டுகளாக இயங்கிக்கொண்டிருக்கும்.'],
    [A, 'By the time the project ends in December, our team will have been {working|work} on it day and night for almost eleven months.', 'திட்டம் டிசம்பரில் முடியும்போது எங்கள் குழு ஏறத்தாழ பதினொரு மாதங்களாக இரவும் பகலும் அதில் உழைத்துக்கொண்டிருக்கும்.'],
    [A, 'When she finally takes the exam, she will have been {preparing|prepare} for it for more than two years.', 'அவள் இறுதியாகத் தேர்வு எழுதும்போது இரண்டு ஆண்டுகளுக்கும் மேலாக அதற்குத் தயாராகிக்கொண்டிருப்பாள்.'],
    [A, 'By the end of this month, I will have been {commuting|commute} between two cities for an entire year.', 'இந்த மாத இறுதிக்குள் நான் முழு ஒரு ஆண்டாக இரண்டு நகரங்களுக்கு இடையே பயணம் செய்துகொண்டிருப்பேன்.'],
    [A, 'By next week, the villagers will have been {waiting|wait} for clean drinking water for almost a month.', 'அடுத்த வாரத்திற்குள் கிராம மக்கள் கிட்டத்தட்ட ஒரு மாதமாகச் சுத்தமான குடிநீருக்காகக் காத்துக்கொண்டிருப்பார்கள்.'],
  ],
};

export interface TenseBlank {
  id: string;
  tense: string;
  tenseName: string;
  level: BlankLevel;
  blank: string;
  full: string;
  ta: string;
  options: string[];
  answers: string[];
  explain: string;
  explainTa: string;
}

/** A small fixed shuffle so the correct option is not always in the same place (same result every run). */
function mix<T>(seed: number, items: T[]): T[] {
  const out = [...items];
  let s = seed * 2654435761 % 4294967296;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildTenseBlanks(): TenseBlank[] {
  const out: TenseBlank[] = [];
  let n = 0;
  for (const lesson of TENSE_LESSONS) {
    const rows = ROWS[lesson.id] ?? [];
    rows.forEach(([level, sentence, ta], i) => {
      const m = /\{([^|}]+)\|([^}]+)\}/.exec(sentence);
      if (!m) return;
      const [, answer, base] = m;
      // One candidate per form kind; the kind the answer already has is left out, so a spelling variant
      // (travelled / traveled) can never appear as a "wrong" option.
      const forms: [string, string][] = [['base', base], ['s', thirdPerson(base)], ['ing', ingForm(base)], ['past', pastForm(base)], ['pp', participleForm(base)]];
      const lower = answer.toLowerCase();
      const own = forms.find(([, w]) => w.toLowerCase() === lower)?.[0] ?? (lower.endsWith('ing') ? 'ing' : lower.endsWith('ed') ? 'past' : '');
      const wrong = forms.filter(([k, w], idx, a) => k !== own && w.toLowerCase() !== lower && a.findIndex(([, x]) => x === w) === idx).map(([, w]) => w).slice(0, 3);
      if (wrong.length < 3) return;
      n++;
      out.push({
        id: `tb-${lesson.id}-${String(i + 1).padStart(2, '0')}`,
        tense: lesson.id, tenseName: lesson.name, level,
        blank: sentence.replace(/\{[^}]+\}/, '____'),
        full: sentence.replace(/\{([^|}]+)\|[^}]+\}/, '$1'),
        ta,
        options: mix(n, [answer, ...wrong]),
        answers: [answer],
        explain: `${lesson.name}: ${lesson.structure}. ${lesson.usage}`,
        explainTa: `${lesson.name} – ${lesson.usageTa}`,
      });
    });
  }
  return out;
}
