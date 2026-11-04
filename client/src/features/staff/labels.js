/** Display names and colours for the domain values the API returns. */

export const SOURCES = {
  portal: { label: 'Property portal', short: 'Portal', dot: 'bg-[oklch(0.45_0.07_160)]' },
  social_ad: { label: 'Social media ad', short: 'Social ad', dot: 'bg-[oklch(0.72_0.12_70)]' },
  website: { label: 'Website form', short: 'Website', dot: 'bg-[oklch(0.58_0.09_240)]' },
  hoarding_call: {
    label: 'Hoarding call',
    short: 'Hoarding call',
    dot: 'bg-[oklch(0.6_0.13_35)]',
  },
};

export const SOURCE_KEYS = Object.keys(SOURCES);

export const TEMPERATURES = {
  hot: { label: 'Hot', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  warm: { label: 'Warm', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  cold: { label: 'Cold', className: 'border-sky-200 bg-sky-50 text-sky-800' },
};

export const STATUSES = {
  new: { label: 'New', className: 'bg-secondary text-secondary-foreground' },
  engaged: { label: 'Engaged', className: 'bg-accent text-accent-foreground' },
  visit_booked: { label: 'Visit booked', className: 'bg-primary text-primary-foreground' },
  visited: { label: 'Visited', className: 'bg-emerald-100 text-emerald-800' },
  no_show: { label: 'No-show', className: 'bg-orange-100 text-orange-800' },
  lost: { label: 'Lost', className: 'bg-muted text-muted-foreground' },
};

export const VISIT_STATUSES = {
  booked: { label: 'Booked', className: 'bg-primary text-primary-foreground' },
  visited: { label: 'Visited', className: 'bg-emerald-100 text-emerald-800' },
  no_show: { label: 'No-show', className: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export const HANDOFF_REASONS = {
  buyer_requested: 'Buyer asked for a person',
  price_or_discount: 'Price or discount question',
  missing_fact: 'Question the fact sheet does not answer',
  hot_lead: 'Hot lead, ready to talk',
  assistant_error: 'Assistant could not reply',
  tool_limit: 'Assistant got stuck',
};

export const DUPLICATE_REASONS = {
  similar_name: 'Similar name',
  same_email: 'Same email',
};

export const TIMELINES = {
  '0-3m': 'Within 3 months',
  '3-6m': 'In 3–6 months',
  '6m+': 'After 6 months',
  unknown: 'Not known yet',
};

export const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };

export const OUTBOX_TEMPLATES = {
  visit_confirmation: 'Visit confirmation',
  reminder_24h: 'Reminder, a day before',
  reminder_2h: 'Reminder, 2 hours before',
  handoff_notice: 'Handoff notice',
};

export const OUTBOX_STATUSES = {
  queued: { label: 'Queued', className: 'bg-secondary text-secondary-foreground' },
  sent: { label: 'Sent', className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Failed', className: 'bg-rose-100 text-rose-700' },
  skipped_opt_out: { label: 'Skipped, opted out', className: 'bg-muted text-muted-foreground' },
};

export const BOOKED_VIA = { assistant: 'Booked in chat', staff: 'Booked by staff' };

export const PROJECTS = [
  { code: 'P1', name: 'Project 1' },
  { code: 'P2', name: 'Project 2' },
];
