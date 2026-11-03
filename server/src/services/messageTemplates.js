import { formatVisitTime } from '../lib/time.js';

/**
 * Outgoing WhatsApp texts in the buyer's language. Plain functions rather than
 * an i18n library: there are four short templates and three languages.
 */
const TEMPLATES = {
  visit_confirmation: {
    en: (v) =>
      `Hi${v.name ? ` ${v.name}` : ''}, your site visit to ${v.project} is confirmed for ${v.when}. Address: ${v.address}. Reply here if you need to change it.`,
    hi: (v) =>
      `नमस्ते${v.name ? ` ${v.name}` : ''}, ${v.project} की साइट विज़िट ${v.when} के लिए पक्की हो गई है। पता: ${v.address}। बदलाव के लिए यहीं जवाब दें।`,
    gu: (v) =>
      `નમસ્તે${v.name ? ` ${v.name}` : ''}, ${v.project} ની સાઇટ વિઝિટ ${v.when} માટે નક્કી થઈ ગઈ છે. સરનામું: ${v.address}. ફેરફાર માટે અહીં જવાબ આપો.`,
  },
  reminder_24h: {
    en: (v) => `Reminder: your site visit to ${v.project} is on ${v.when}. Address: ${v.address}.`,
    hi: (v) => `याद दिलाना: ${v.project} की आपकी साइट विज़िट ${v.when} को है। पता: ${v.address}।`,
    gu: (v) =>
      `યાદ અપાવીએ: ${v.project} ની તમારી સાઇટ વિઝિટ ${v.when} એ છે. સરનામું: ${v.address}.`,
  },
  reminder_2h: {
    en: (v) =>
      `See you soon! Your visit to ${v.project} starts at ${v.when}. Location: ${v.location}.`,
    hi: (v) =>
      `जल्द मिलते हैं! ${v.project} की आपकी विज़िट ${v.when} पर शुरू होगी। लोकेशन: ${v.location}।`,
    gu: (v) =>
      `જલ્દી મળીએ! ${v.project} ની તમારી વિઝિટ ${v.when} એ શરૂ થશે. લોકેશન: ${v.location}.`,
  },
  handoff_notice: {
    en: (v) => `${v.executive} from our sales team will call you shortly about ${v.project}.`,
    hi: (v) =>
      `हमारी सेल्स टीम से ${v.executive} ${v.project} के बारे में जल्द ही आपको कॉल करेंगे।`,
    gu: (v) => `અમારી સેલ્સ ટીમમાંથી ${v.executive} ${v.project} વિશે ટૂંક સમયમાં તમને કોલ કરશે.`,
  },
};

/** Variables every visit message needs, taken from the lead, project and visit. */
export function visitMessageVars({ lead, project, visit }) {
  const address = [project.location?.address, project.location?.city].filter(Boolean).join(', ');
  return {
    name: lead.name,
    project: project.name,
    when: formatVisitTime(visit.startsAt, lead.language),
    address,
    location: project.location?.mapUrl ?? address,
  };
}

export function renderMessage(template, language, vars) {
  const byLanguage = TEMPLATES[template];
  if (!byLanguage) throw new Error(`Unknown message template: ${template}`);
  return (byLanguage[language] ?? byLanguage.en)(vars);
}
