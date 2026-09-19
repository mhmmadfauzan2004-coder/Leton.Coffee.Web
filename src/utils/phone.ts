/**
 * Indonesian Phone Number Normalization and Validation Utility
 * Standardizes Indonesian phone numbers into E.164 (+628xxxxxxxxxx) format.
 * Used uniformly across registration, login lookup, profile updates, and orders.
 */

/**
 * Normalizes any Indonesian phone number format into standard E.164 (+628xxxxxxxxxx).
 * Examples:
 *   085761519565    -> +6285761519565
 *   +6285761519565  -> +6285761519565
 *   6285761519565   -> +6285761519565
 *   85761519565     -> +6285761519565
 *   0857-6151-9565  -> +6285761519565
 */
export function normalizeIndonesianPhone(phone: string): string {
  if (!phone) return '';
  // Strip all non-digit characters
  let digits = phone.trim().replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('62')) {
    // already starts with 62
  } else {
    // e.g. 85761519565 -> prefix with 62
    digits = '62' + digits;
  }

  return '+' + digits;
}

/**
 * Validates whether the given phone string conforms to a valid Indonesian mobile number.
 * Requires 9 to 13 digits after 62 (total 11 to 15 digits, starting with 628).
 */
export function isValidIndonesianPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.trim().replace(/[^0-9]/g, '');
  // Must be between 10 and 15 digits
  if (digits.length < 10 || digits.length > 15) return false;
  
  const normalized = normalizeIndonesianPhone(phone);
  // Indonesian mobile numbers start with +628 and have 11 to 16 characters in E.164
  return normalized.startsWith('+628') && normalized.length >= 12 && normalized.length <= 16;
}

/**
 * Generates a stable, unique internal email address for Supabase Email + Password Auth.
 * Never shown to or requested from the customer.
 * Uses a universally compatible standard domain format (e.g. cust_6285761519565@letoncoffee.com).
 */
export function generateCustomerInternalEmail(phone: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  const cleanDigits = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return `cust_${cleanDigits}@letoncoffee.com`;
}
