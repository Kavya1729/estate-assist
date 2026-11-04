/**
 * Finds the fact-sheet entries that answer a buyer's question. Used by the
 * demo provider (no LLM key) so it can still answer from the approved facts;
 * a question that matches nothing is handed to a sales executive.
 *
 * Two passes: known topics (English, Hinglish, Hindi and Gujarati wording) map
 * to fact keys or core project fields; if none match, meaningful words in the
 * question are looked up in fact labels and values, which also covers facts the
 * sales head adds later under new keys.
 */

const TOPICS = [
  {
    words:
      /swim|pool|gym|club ?house|garden|lawn|\bplay|amenit|facilit|sport|jogging|indoor games|पूल|स्विमिंग|जिम|सुविधा|ક્લબ|પૂલ|સ્વિમિંગ|જિમ|સુવિધા/iu,
    keys: ['amenities'],
  },
  {
    words: /flooring|\btiles?\b|vitrified|marble|फ्लोरिंग|टाइल|ફ્લોરિંગ|ટાઇલ/iu,
    keys: ['flooring'],
  },
  {
    words:
      /bath|toilet|washroom|\bwc\b|sanitary|\btaps?\b|shower|geyser|commode|बाथरूम|टॉयलेट|શૌચાલય|બાથરૂમ|ટોઇલેટ/iu,
    keys: ['bathroom'],
  },
  { words: /kitchen|platform|\bsink\b|chimney|किचन|रसोई|કિચન|રસોડ/iu, keys: ['kitchen'] },
  {
    words:
      /furni|furnish|wardrobe|almirah|cupboard|modular|interior|\bbeds?\b|sofa|फर्नीचर|फर्निश|ફર્નિચર/iu,
    keys: ['furniture_fittings'],
  },
  {
    words: /\bdoors?\b|windows?|upvc|aluminium|digital lock|दरवाज|खिड़की|દરવાજ|બારી/iu,
    keys: ['doors_windows'],
  },
  { words: /paint|\bwalls?\b|putty|plaster|पेंट|દીવાલ|પેઇન્ટ/iu, keys: ['walls_paint'] },
  {
    words:
      /electric(al)?\b|wiring|switch|\bac\b|air ?condition|socket|3.phase|बिजली की वायरिंग|वायरिंग|વાયરિંગ/iu,
    keys: ['electrical'],
  },
  {
    words: /plumb|water ?(pipe|line)|\bpipes?\b|pipeline|cpvc|drainage|पाइप|પાઇપ/iu,
    keys: ['plumbing'],
  },
  { words: /\bgas\b|\bpng\b|cylinder|गैस|ગેસ/iu, keys: ['gas_pipeline'] },
  {
    words: /structure|earthquake|seismic|\brcc\b|quality|cement|steel|मजबूत|ભૂકંપ|ક્વોલિટી/iu,
    keys: ['structure'],
  },
  { words: /\blifts?\b|elevator|लिफ्ट|લિફ્ટ/iu, keys: ['lifts'] },
  {
    words: /secur|cctv|guard|\bsafe\b|gated|intercom|सुरक्षा|સુરક્ષા|સિક્યુરિટી/iu,
    keys: ['security'],
  },
  { words: /\bfire\b|sprinkler|hydrant|आग|આગ/iu, keys: ['fire_safety'] },
  {
    words: /solar|rain ?water|\bev\b|electric vehicle|charging|green feature|eco.?friendly/iu,
    keys: ['green_features'],
  },
  {
    words: /maintenance|society charge|monthly charge|मेंटेनेंस|મેન્ટેનન્સ|મેઇન્ટેનન્સ/iu,
    keys: ['maintenance'],
  },
  {
    words:
      /\bgst\b|stamp|registration|extra charge|hidden|other charge|all.?inclusive|total cost|\btax(es)?\b|स्टांप|रजिस्ट्री|સ્ટેમ્પ|રજિસ્ટ્રેશન/iu,
    keys: ['other_charges', 'price_note'],
  },
  { words: /parking|\bcar\b|garage|\bbike\b|पार्किंग|પાર્કિંગ/iu, keys: ['parking'] },
  {
    words: /construction status|progress|built up|kitna bana|स्टेटस|કેટલું બન્યું/iu,
    keys: ['construction_status'],
  },
  {
    words:
      /possession|handover|hand over|\bready\b|move in|\bkeys\b|पज़ेशन|पजेशन|कब मिलेगा|પઝેશન|ક્યારે મળશે/iu,
    fields: ['possession'],
    keys: ['possession_process'],
  },
  {
    words:
      /location|where|address|distance|how far|\bkm\b|airport|railway|station|highway|ring road|brts|\bbus\b|metro|gift city|connect|commute|reach|kaha|kahan|कहाँ|कहां|लोकेशन|ક્યાં|લોકેશન/iu,
    fields: ['location'],
    keys: ['connectivity'],
  },
  {
    words:
      /school|hospital|college|universit|\bmall|market|shop|grocery|restaurant|nearby|आसपास|स्कूल|अस्पताल|આસપાસ|સ્કૂલ|હોસ્પિટલ/iu,
    keys: ['nearby'],
  },
  { words: /\bloans?\b|\bbanks?\b|\bemi\b|financ|लोन|બેંક|લોન/iu, keys: ['home_loans'] },
  {
    words: /payment|instal|down ?payment|booking amount|\btoken\b|पेमेंट|किस्त|પેમેન્ટ|હપ્તા/iu,
    keys: ['payment_plan'],
  },
  {
    words: /how (to|do i|can i) (book|buy)|booking process|procedure|steps|agreement for sale/iu,
    keys: ['booking_process'],
  },
  {
    words: /document|\bkyc\b|\bpan\b|aadhaar|aadhar|papers|कागज|दस्तावेज|ડોક્યુમેન્ટ|દસ્તાવેજ/iu,
    keys: ['documents_needed'],
  },
  {
    words: /approv|legal|\btitle\b|\bnoc\b|auda|\bna land|permission|लीगल|कानूनी|કાયદેસર|લીગલ/iu,
    keys: ['approvals_legal'],
  },
  { words: /\brera\b|रेरा|રેરા/iu, fields: ['rera'], keys: ['approvals_legal'] },
  { words: /cancel|refund|रिफंड|રિફંડ/iu, keys: ['cancellation'] },
  { words: /\bnri\b|abroad|overseas|foreign|विदेश|વિદેશ/iu, keys: ['nri'] },
  {
    words: /resale|\brent\b|rental|\blease\b|sell later|investment|किराय|ભાડે/iu,
    keys: ['resale_rental'],
  },
  {
    words: /custom|modif|alteration|change the (layout|design)|बदलाव|ફેરફાર/iu,
    keys: ['customization'],
  },
  { words: /warrant|guarantee|defect|leakage|seepage/iu, keys: ['warranty'] },
  { words: /\bpets?\b|\bdogs?\b|\bcats?\b|पालतू|પાલતુ/iu, keys: ['pets'] },
  { words: /vastu|facing|direction|वास्तु|વાસ્તુ/iu, keys: ['vastu'] },
  {
    words: /tower|how many floors|storey|how many (flats|apartments|units)|\bwings?\b|टावर|ટાવર/iu,
    keys: ['towers'],
  },
  {
    words: /water(?! ?(pipe|line))|power backup|electricity|generator|\bbackup\b|पानी|પાણી|લાઇટ/iu,
    keys: ['water_power'],
  },
  {
    words: /site office|sample flat|show flat|timing|sunday|office hours/iu,
    keys: ['site_office'],
  },
  { words: /floor ?plan|layout|brochure/iu, keys: ['floor_plans'] },
  { words: /tax benefit|80c|24 ?\(?b\)?|income tax/iu, keys: ['tax_benefits'] },
  {
    words: /price|cost|\brate\b|kitn|budget|kimat|keemat|lakh|crore|कीमत|दाम|કિંમત|ભાવ/iu,
    fields: ['prices'],
  },
  {
    words: /\bsize|carpet|sq\.? ?ft|square feet|\barea\b|\bbig\b|\bbhk\b|साइज|એરિયા|સાઇઝ/iu,
    fields: ['sizes'],
  },
];

const MAX_TOPICS = 2;

const STOPWORDS = new Set(
  'about also and any apartment apartments are available buy can could does do flat flats for from give have here home homes how is it its know like many much need me my near of on or please project projects tell that the there this want what when where which will with would you your hai hain ka ki ke ko kya hoga milega'.split(
    ' ',
  ),
);

/** Topics the question touches, in the order the buyer mentions them. */
export function topicsOf(question) {
  return TOPICS.map((topic) => ({ topic, at: question.search(topic.words) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_TOPICS)
    .map(({ topic }) => topic);
}

/** Fact values are joined into one reply, so each must end like a sentence. */
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

function fieldText(project, field) {
  switch (field) {
    case 'prices':
      return project.configurations.map((c) => `${c.bhk} BHK at ${c.priceRange}`).join(', ');
    case 'sizes':
      return project.configurations
        .map((c) => `${c.bhk} BHK of ${c.carpetAreaSqft} carpet area`)
        .join(', ');
    case 'possession':
      return project.possession ? `Possession is planned for ${project.possession}.` : null;
    case 'location':
      return `Address: ${project.location}.`;
    case 'rera':
      return `GujRERA registration number ${project.reraNumber}.`;
    default:
      return null;
  }
}

const words = (text) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));

/** Facts sharing a meaningful word with the question, best first. */
function wordMatches(question, facts) {
  const asked = new Set(words(question));
  if (!asked.size) return [];
  return facts
    .map((fact) => ({
      fact,
      score: words(`${fact.label} ${fact.value}`).filter((word) => asked.has(word)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map(({ fact }) => fact);
}

/**
 * What one project's fact sheet says about the question, as sentences.
 * `project` is the shape get_facts returns (see describeProject).
 * @returns {string[]} empty when the fact sheet does not cover it
 */
export function answerFromProject(question, project) {
  const facts = project.facts ?? [];
  const topics = topicsOf(question);

  if (topics.length) {
    const parts = [];
    for (const topic of topics) {
      for (const field of topic.fields ?? []) {
        const text = fieldText(project, field);
        if (text) parts.push(text);
      }
      for (const key of topic.keys ?? []) {
        const fact = facts.find((f) => f.key === key);
        if (fact) parts.push(fact.value);
      }
    }
    return [...new Set(parts)].map(sentence);
  }

  return wordMatches(question, facts).map((fact) => sentence(`${fact.label}: ${fact.value}`));
}
