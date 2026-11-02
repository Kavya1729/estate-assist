/**
 * Normalises an Indian mobile number to its 10-digit form so the same buyer is
 * recognised across sources: "+91 98250-12345", "09825012345" and "9825012345"
 * all become "9825012345". Returns null when the input is not a valid mobile.
 */
export function normalizeIndianMobile(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;

  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function maskPhone(normalized) {
  if (!normalized) return null;
  return `${normalized.slice(0, 2)}xxxxxx${normalized.slice(-2)}`;
}
