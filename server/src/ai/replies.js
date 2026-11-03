/** Fixed replies used when the model is not in control of the turn. */

const HANDOFF_REPLIES = {
  en: (name) =>
    `Let me connect you with ${name ?? 'our sales team'}, who will call you shortly and help with everything.`,
  hi: (name) =>
    `मैं आपको ${name ?? 'हमारी सेल्स टीम'} से जोड़ रहा हूँ, वे जल्द ही आपको कॉल करके पूरी मदद करेंगे।`,
  gu: (name) =>
    `હું તમને ${name ?? 'અમારી સેલ્સ ટીમ'} સાથે જોડું છું, તેઓ ટૂંક સમયમાં તમને કોલ કરીને પૂરી મદદ કરશે.`,
};

const GREETINGS = {
  en: (name) =>
    `Hi${name ? ` ${name}` : ''}! I can answer questions about our projects and book a site visit for you. What are you looking for?`,
  hi: (name) =>
    `नमस्ते${name ? ` ${name}` : ''}! मैं हमारे प्रोजेक्ट्स के बारे में जानकारी दे सकता हूँ और साइट विज़िट बुक कर सकता हूँ। आप क्या ढूँढ रहे हैं?`,
  gu: (name) =>
    `નમસ્તે${name ? ` ${name}` : ''}! હું અમારા પ્રોજેક્ટ્સ વિશે માહિતી આપી શકું છું અને સાઇટ વિઝિટ બુક કરી શકું છું. તમે શું શોધી રહ્યા છો?`,
};

export function handoffReply(language, executiveName) {
  return (HANDOFF_REPLIES[language] ?? HANDOFF_REPLIES.en)(executiveName);
}

export function greeting(language, name) {
  return (GREETINGS[language] ?? GREETINGS.en)(name);
}
