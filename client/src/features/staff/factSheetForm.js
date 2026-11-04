import { istDateKey } from '@/lib/format';

const LAKH = 100_000;
export const MAX_CONFIGURATIONS = 10;
export const MAX_FACTS = 60;
const FACT_KEY = /^[a-z0-9_]+$/;

let nextUid = 0;
const uid = () => `row-${(nextUid += 1)}`;

const text = (value) => (value == null ? '' : String(value));
const lakhs = (amount) => text(amount == null ? null : Number((amount / LAKH).toFixed(2)));

/** "Possession date" → "possession_date", the key the assistant looks facts up by. */
export const factKeyFrom = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

export const emptyConfiguration = () => ({
  uid: uid(),
  bhk: '',
  areaMin: '',
  areaMax: '',
  priceMin: '',
  priceMax: '',
  units: '',
});

export const emptyFact = () => ({ uid: uid(), key: '', label: '', value: '', isNew: true });

/** Editable strings for every field; prices are edited in lakh. */
export function toForm(project) {
  return {
    name: text(project.name),
    tagline: text(project.tagline),
    possessionDate: project.possessionDate ? istDateKey(project.possessionDate) : '',
    isActive: project.isActive !== false,
    configurations: project.configurations.map((c) => ({
      uid: uid(),
      bhk: text(c.bhk),
      areaMin: text(c.carpetAreaSqft.min),
      areaMax: text(c.carpetAreaSqft.max),
      priceMin: lakhs(c.priceRange.min),
      priceMax: lakhs(c.priceRange.max),
      units: text(c.unitsAvailable),
    })),
    facts: project.facts.map((f) => ({ uid: uid(), ...f, isNew: false })),
  };
}

/** Comparable snapshot for "unsaved changes", ignoring row ids. */
export const snapshot = (form) => JSON.stringify(toPayload(form));

export function toPayload(form) {
  return {
    name: form.name.trim(),
    tagline: form.tagline.trim(),
    ...(form.possessionDate && { possessionDate: `${form.possessionDate}T00:00:00+05:30` }),
    isActive: form.isActive,
    configurations: form.configurations.map((c) => ({
      bhk: Number(c.bhk),
      carpetAreaSqft: { min: Number(c.areaMin), max: Number(c.areaMax) },
      priceRange: {
        min: Math.round(Number(c.priceMin) * LAKH),
        max: Math.round(Number(c.priceMax) * LAKH),
      },
      ...(c.units.trim() !== '' && { unitsAvailable: Number(c.units) }),
    })),
    facts: form.facts.map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      value: f.value.trim(),
    })),
  };
}

const isNumber = (value) => value.trim() !== '' && Number.isFinite(Number(value));

const problem = (message, ...fields) => ({ message, fields });

function configurationError(c) {
  const bhk = Number(c.bhk);
  if (!Number.isInteger(bhk) || bhk < 1 || bhk > 6) {
    return problem('BHK is a whole number from 1 to 6.', 'bhk');
  }
  if (!isNumber(c.areaMin) || !isNumber(c.areaMax)) {
    return problem('Enter the carpet area range.', 'areaMin', 'areaMax');
  }
  if (Number(c.areaMax) < Number(c.areaMin)) {
    return problem('Largest carpet area is below the smallest.', 'areaMin', 'areaMax');
  }
  if (!isNumber(c.priceMin) || !isNumber(c.priceMax) || Number(c.priceMin) <= 0) {
    return problem('Enter the price range in lakh.', 'priceMin', 'priceMax');
  }
  if (Number(c.priceMax) < Number(c.priceMin)) {
    return problem('Highest price is below the lowest.', 'priceMin', 'priceMax');
  }
  if (c.units.trim() !== '' && !(Number.isInteger(Number(c.units)) && Number(c.units) >= 0)) {
    return problem('Units left is a whole number.', 'units');
  }
  return null;
}

function factError(fact, keyCounts) {
  if (!fact.label.trim()) return problem('Give the fact a label.', 'label');
  if (!fact.value.trim()) return problem('Write what the assistant may say.', 'value');
  if (!FACT_KEY.test(fact.key.trim())) {
    return problem('The key uses lowercase letters, digits and _.', 'key');
  }
  if (keyCounts.get(fact.key.trim()) > 1) {
    return problem('Another fact already uses this key.', 'key');
  }
  return null;
}

/**
 * Errors by field: `name` (a message), or a row's uid for configurations and
 * facts (`{ message, fields }`, the inputs to mark).
 */
export function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'The project needs a name.';

  for (const c of form.configurations) {
    const error = configurationError(c);
    if (error) errors[c.uid] = error;
  }

  const keyCounts = new Map();
  for (const f of form.facts) keyCounts.set(f.key.trim(), (keyCounts.get(f.key.trim()) ?? 0) + 1);
  for (const f of form.facts) {
    const error = factError(f, keyCounts);
    if (error) errors[f.uid] = error;
  }
  return errors;
}
