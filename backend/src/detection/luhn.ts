/**
 * Luhn Algorithm for credit card number validation.
 */

/**
 * Validates a credit card number using the Luhn algorithm.
 * @param num - The card number string (digits and optional spaces/dashes stripped)
 * @returns true if the number passes Luhn check
 */
export function luhnValidate(num: string): boolean {
  const digits = num.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;

  // Reject repeating-digit sequences (trivially invalid as real card numbers)
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}
