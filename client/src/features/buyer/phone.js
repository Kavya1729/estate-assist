/** Same rule as the server: "+91 98250-12345", "09825012345" and "9825012345" are all valid. */
export function isIndianMobile(input) {
  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits);
}
