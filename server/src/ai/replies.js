/** Fixed replies used when the model is not in control of the turn, in en / hi / gu. */

const HANDOFF_REPLIES = {
  price_or_discount: {
    en: (name) =>
      `Pricing and offers are best discussed with ${name ?? 'our sales team'}, who will call you shortly with the details.`,
    hi: (name) =>
      `कीमत और ऑफ़र के बारे में ${name ?? 'हमारी सेल्स टीम'} आपसे बात करेंगे, वे जल्द ही आपको कॉल करेंगे।`,
    gu: (name) =>
      `કિંમત અને ઓફર વિશે ${name ?? 'અમારી સેલ્સ ટીમ'} તમારી સાથે વાત કરશે, તેઓ ટૂંક સમયમાં તમને કોલ કરશે.`,
  },
  buyer_requested: {
    en: (name) => `Sure. ${name ?? 'Our sales team'} will call you shortly.`,
    hi: (name) => `ज़रूर। ${name ?? 'हमारी सेल्स टीम'} जल्द ही आपको कॉल करेंगे।`,
    gu: (name) => `ચોક્કસ. ${name ?? 'અમારી સેલ્સ ટીમ'} ટૂંક સમયમાં તમને કોલ કરશે.`,
  },
  default: {
    en: (name) =>
      `Let me connect you with ${name ?? 'our sales team'}, who will call you shortly and help with everything.`,
    hi: (name) =>
      `मैं आपको ${name ?? 'हमारी सेल्स टीम'} से जोड़ रहा हूँ, वे जल्द ही आपको कॉल करके पूरी मदद करेंगे।`,
    gu: (name) =>
      `હું તમને ${name ?? 'અમારી સેલ્સ ટીમ'} સાથે જોડું છું, તેઓ ટૂંક સમયમાં તમને કોલ કરીને પૂરી મદદ કરશે.`,
  },
};

const GREETINGS = {
  en: (name) =>
    `Hi${name ? ` ${name}` : ''}! I can answer questions about our projects and book a site visit for you. What are you looking for?`,
  hi: (name) =>
    `नमस्ते${name ? ` ${name}` : ''}! मैं हमारे प्रोजेक्ट्स के बारे में जानकारी दे सकता हूँ और साइट विज़िट बुक कर सकता हूँ। आप क्या ढूँढ रहे हैं?`,
  gu: (name) =>
    `નમસ્તે${name ? ` ${name}` : ''}! હું અમારા પ્રોજેક્ટ્સ વિશે માહિતી આપી શકું છું અને સાઇટ વિઝિટ બુક કરી શકું છું. તમે શું શોધી રહ્યા છો?`,
};

const FIXED = {
  /** Replaces a reply that failed the number check. */
  unverified: {
    en: 'I want to be sure I give you accurate details, so our sales executive will confirm this for you. Is there anything else I can help with?',
    hi: 'मैं आपको बिल्कुल सही जानकारी देना चाहता हूँ, इसलिए हमारे सेल्स एग्ज़िक्यूटिव इसकी पुष्टि करेंगे। क्या मैं और किसी चीज़ में मदद कर सकता हूँ?',
    gu: 'હું તમને એકદમ સાચી માહિતી આપવા માંગું છું, તેથી અમારા સેલ્સ એક્ઝિક્યુટિવ આની પુષ્ટિ કરશે. શું હું બીજી કોઈ મદદ કરી શકું?',
  },
  optedOut: {
    en: 'You will not receive any more messages from us. Reply START if you would like to chat again.',
    hi: 'अब आपको हमारी ओर से कोई संदेश नहीं मिलेगा। फिर से बात करने के लिए START लिखें।',
    gu: 'હવે તમને અમારા તરફથી કોઈ સંદેશ નહીં મળે. ફરી વાત કરવા માટે START લખો.',
  },
  stillOptedOut: {
    en: 'You have opted out of messages from us. Reply START if you would like to chat again.',
    hi: 'आपने हमारे संदेश बंद किए हुए हैं। फिर से बात करने के लिए START लिखें।',
    gu: 'તમે અમારા સંદેશા બંધ કરેલા છે. ફરી વાત કરવા માટે START લખો.',
  },
  optedIn: {
    en: 'Welcome back! How can I help you today?',
    hi: 'फिर से स्वागत है! मैं आपकी क्या मदद कर सकता हूँ?',
    gu: 'ફરી સ્વાગત છે! હું તમારી શું મદદ કરી શકું?',
  },
};

/** Written into the chat when the buyer books or cancels from the slot picker, not the model. */
const VISIT_REPLIES = {
  booked: {
    en: (v) =>
      `Your site visit to ${v.project} is booked for ${v.when}. We will send you a WhatsApp reminder a day before and 2 hours before.`,
    hi: (v) =>
      `${v.project} की आपकी साइट विज़िट ${v.when} के लिए बुक हो गई है। हम एक दिन पहले और 2 घंटे पहले WhatsApp पर याद दिलाएँगे।`,
    gu: (v) =>
      `${v.project} ની તમારી સાઇટ વિઝિટ ${v.when} માટે બુક થઈ ગઈ છે. અમે એક દિવસ પહેલાં અને 2 કલાક પહેલાં WhatsApp પર યાદ અપાવીશું.`,
  },
  cancelled: {
    en: (v) =>
      `Your site visit to ${v.project} on ${v.when} is cancelled. Book another time whenever you like.`,
    hi: (v) =>
      `${v.when} की ${v.project} की आपकी साइट विज़िट रद्द कर दी गई है। जब चाहें दूसरा समय बुक करें।`,
    gu: (v) =>
      `${v.when} ની ${v.project} ની તમારી સાઇટ વિઝિટ રદ કરવામાં આવી છે. ગમે ત્યારે બીજો સમય બુક કરો.`,
  },
};

const pick = (byLanguage, language) => byLanguage[language] ?? byLanguage.en;

/** @param {'booked' | 'cancelled'} kind */
export function visitReply(kind, language, vars) {
  return pick(VISIT_REPLIES[kind], language)(vars);
}

export function handoffReply(language, executiveName, reason) {
  return pick(HANDOFF_REPLIES[reason] ?? HANDOFF_REPLIES.default, language)(executiveName);
}

export function greeting(language, name) {
  return pick(GREETINGS, language)(name);
}

/** @param {'unverified' | 'optedOut' | 'stillOptedOut' | 'optedIn'} kind */
export function fixedReply(kind, language) {
  return pick(FIXED[kind], language);
}
