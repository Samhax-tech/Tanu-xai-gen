import { AppError, ErrorCodes } from './errors.js';

/**
 * Normalize a user-supplied phone number into the bare digit string
 * Baileys/WhatsApp expects (no +, spaces, dashes, or parentheses).
 *
 * Accepts:  +92 300 1234567 | 923001234567 | +923001234567 | 03001234567
 * Produces: 923001234567
 */
export function normalizePhoneNumber(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new AppError(ErrorCodes.INVALID_PHONE_NUMBER, 'Phone number is required.');
  }

  // Strip everything except digits.
  let digits = raw.replace(/[^\d]/g, '');

  if (digits.length === 0) {
    throw new AppError(ErrorCodes.INVALID_PHONE_NUMBER, 'Phone number must contain digits.');
  }

  // Local Pakistani mobile numbers start with a trunk 0, e.g. 03001234567.
  // Convert to international form only when it unambiguously matches that
  // pattern (11 digits, leading 0, mobile prefix 3xx).
  if (/^03\d{9}$/.test(digits)) {
    digits = '92' + digits.slice(1);
  }

  // Final sanity check: E.164-ish, 10-15 digits, no leading zero.
  if (!/^[1-9]\d{9,14}$/.test(digits)) {
    throw new AppError(
      ErrorCodes.INVALID_PHONE_NUMBER,
      'Phone number must be a valid number with country code, e.g. 923001234567.'
    );
  }

  return digits;
}

/** Mask a normalized phone number for safe display/logging: 923001234567 -> ***4567 */
export function maskPhoneNumber(digits) {
  if (!digits || digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}
