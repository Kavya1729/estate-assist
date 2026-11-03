/**
 * Checks on the model's reply before the buyer sees it. The rule: every number
 * in a reply must appear in something the model was given (fact sheet, tool
 * results, the buyer's own messages, the prompt). A price or date the model
 * made up is the most damaging mistake it can make, and the easiest to catch.
 */

const LAKH = 1e5;
const CRORE = 1e7;

const NUMBER_WITH_UNIT =
  /(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|लाख|करोड़|करोड|લાખ|કરોડ)?/giu;
/** "1) ..." or "2. ..." at the start of a line or after a space: list numbering, not a claim. */
const LIST_MARKER = /(^|\s)\d[).](?=\s)/gmu;

/** Devanagari and Gujarati digits to ASCII so "₹६५ लाख" is checked like "₹65 लाख". */
function asciiDigits(text) {
  return text
    .replace(/[\u0966-\u096F]/gu, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[\u0AE6-\u0AEF]/gu, (d) => String(d.charCodeAt(0) - 0x0ae6));
}

const key = (value) => String(Math.round(value * 10_000) / 10_000);

/** Every way a matched number may legitimately be restated (65 lakh = 6500000 = 0.65 crore). */
function equivalents(value, unit) {
  const u = unit?.toLowerCase() ?? '';
  if (/^(lakh|lac|लाख|લાખ)/u.test(u)) return [value, value * LAKH, value / 100];
  if (/^(crore|cr|करोड|કરોડ)/u.test(u)) return [value, value * CRORE, value * 100];
  if (value >= LAKH) return [value, value / LAKH, value / CRORE];
  return [value];
}

function extract(text) {
  const found = [];
  for (const match of asciiDigits(text).matchAll(NUMBER_WITH_UNIT)) {
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) found.push({ raw: match[0].trim(), value, unit: match[2] });
  }
  return found;
}

/** All numbers (and their equivalents) present in the material the model was given. */
export function knownNumbers(sources) {
  const known = new Set();
  for (const source of sources) {
    for (const { value, unit } of extract(source)) {
      for (const equivalent of equivalents(value, unit)) known.add(key(equivalent));
    }
  }
  return known;
}

/** Numbers in the reply that are not backed by any source. Empty array means the reply is safe. */
export function findUnverifiedNumbers(reply, known) {
  const claims = extract(reply.replace(LIST_MARKER, '$1'));
  return claims.filter(({ value }) => !known.has(key(value))).map(({ raw }) => raw);
}
