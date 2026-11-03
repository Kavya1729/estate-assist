const SCRIPTS = [
  { language: 'hi', pattern: /\p{Script=Devanagari}/gu },
  { language: 'gu', pattern: /\p{Script=Gujarati}/gu },
  { language: 'en', pattern: /\p{Script=Latin}/gu },
];

/**
 * The buyer's language from the script they type in: Devanagari → Hindi,
 * Gujarati → Gujarati, Latin → English (Hinglish typed in Latin counts as
 * English; the prompt tells the model to mirror it). Returns null when the
 * message has no letters, e.g. "1" or "👍", so the saved preference is kept.
 */
export function detectLanguage(text) {
  let best = null;
  let bestCount = 0;
  for (const { language, pattern } of SCRIPTS) {
    const count = text.match(pattern)?.length ?? 0;
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }
  return best;
}
