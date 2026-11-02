export const ROLES = Object.freeze({
  SALES_EXECUTIVE: 'sales_executive',
  SALES_HEAD: 'sales_head',
});

export const LEAD_SOURCES = Object.freeze(['portal', 'social_ad', 'website', 'hoarding_call']);

export const LEAD_STATUSES = Object.freeze([
  'new',
  'engaged',
  'visit_booked',
  'visited',
  'no_show',
  'lost',
]);

export const LEAD_TEMPERATURES = Object.freeze(['hot', 'warm', 'cold']);

export const LANGUAGES = Object.freeze(['en', 'hi', 'gu']);

export const BUYING_TIMELINES = Object.freeze(['0-3m', '3-6m', '6m+', 'unknown']);

export const HANDOFF_REASONS = Object.freeze([
  'buyer_requested',
  'price_or_discount',
  'missing_fact',
  'hot_lead',
  'assistant_error',
  'tool_limit',
]);

export const CONVERSATION_CHANNELS = Object.freeze(['web', 'whatsapp']);

export const MESSAGE_ROLES = Object.freeze(['buyer', 'assistant', 'staff', 'system']);

export const VISIT_STATUSES = Object.freeze(['booked', 'visited', 'no_show', 'cancelled']);

export const OUTBOX_TEMPLATES = Object.freeze([
  'visit_confirmation',
  'reminder_24h',
  'reminder_2h',
  'handoff_notice',
]);

export const OUTBOX_STATUSES = Object.freeze(['queued', 'sent', 'failed', 'skipped_opt_out']);
