/**
 * Checks that run before the model sees a message. They are deliberately
 * rule-based: these decisions must not depend on the model behaving.
 */

const OPT_OUT = /^\s*(stop|unsubscribe|opt[\s-]?out|बंद करो|બંધ કરો)\s*[.!]*\s*$/iu;
const OPT_IN = /^\s*(start|resume|opt[\s-]?in)\s*[.!]*\s*$/iu;

const PRICE_NEGOTIATION = [
  /\b(discounts?|negotiat\w*|bargain\w*|cash\s?back|freebies?|waive\w*)\b/i,
  // "lowest/minimum price" is a fact-sheet question, so only negotiation phrasing is matched.
  /\b(best|final|last|special)\s+(price|rate|deal|offer|cost|quote)\b/i,
  /\b(any|special|festive|diwali|current|launch)\s+offers?\b/i,
  /\b(aakhri|akhri|final)\s+(rate|price|kimat|keemat|bhav)\b/i,
  /\b(thoda|kuch)\s+kam\b/i,
  /\bkam\s+(karo|kar\s+do|kijiye|ho\s+sakta)\b/i,
  /(छूट|डिस्काउंट|ऑफर|मोलभाव|फाइनल\s*(प्राइस|रेट|कीमत)|आखिरी\s*(कीमत|रेट|दाम)|कम\s*(करो|कर\s*दो|कीजिए|हो\s*सकता))/u,
  /(ડિસ્કાઉન્ટ|ઓફર|છૂટ|ફાઇનલ\s*(પ્રાઇસ|ભાવ|કિંમત)|છેલ્લો\s*ભાવ|ઓછું\s*(કરો|કરી\s*આપો|થાય))/u,
];

const WANTS_PERSON = [
  /\b(talk|speak|chat|connect)\s+(to|with|me\s+(to|with))\s+(a\s+|your\s+)?(human|person|someone|agent|executive|manager|sales\s*(person|team|executive)?|representative)\b/i,
  /\b(call\s+me|call\s+back|callback|real\s+person|human\s+agent|customer\s+care)\b/i,
  /\b(baat\s+(karni|karna|karao|karwao|karwa\s+do)|call\s+(karo|kariye|kar\s+do|karwao)|insaan\s+se)\b/i,
  /(बात\s*(करनी|करना|कराओ|करवाओ|करवा\s*दो)|कॉल\s*(करो|कीजिए|कर\s*दो)|किसी\s*(व्यक्ति|इंसान)\s*से)/u,
  /(વાત\s*(કરવી|કરવી\s*છે|કરાવો)|કોલ\s*(કરો|કરજો)|ફોન\s*(કરો|કરજો))/u,
];

const matchesAny = (patterns, text) => patterns.some((pattern) => pattern.test(text));

/**
 * @returns {null | { type: 'opt_out' | 'opt_in' | 'blocked' } | { type: 'handoff', reason: string }}
 *   null means the message can go to the model.
 */
export function runPreChecks({ text, lead }) {
  if (lead.optedOut) return OPT_IN.test(text) ? { type: 'opt_in' } : { type: 'blocked' };
  if (OPT_OUT.test(text)) return { type: 'opt_out' };
  if (matchesAny(PRICE_NEGOTIATION, text)) return { type: 'handoff', reason: 'price_or_discount' };
  if (matchesAny(WANTS_PERSON, text)) return { type: 'handoff', reason: 'buyer_requested' };
  return null;
}
