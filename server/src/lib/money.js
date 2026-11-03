const LAKH = 100_000;
const CRORE = 100 * LAKH;

function trim(value) {
  return Number(value.toFixed(2)).toString();
}

/** Indian-style amounts: 6500000 → "₹65 lakh", 12000000 → "₹1.2 crore". */
export function formatRupees(amount) {
  if (amount >= CRORE) return `₹${trim(amount / CRORE)} crore`;
  if (amount >= LAKH) return `₹${trim(amount / LAKH)} lakh`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatRupeeRange({ min, max }) {
  return min === max ? formatRupees(min) : `${formatRupees(min)} – ${formatRupees(max)}`;
}
