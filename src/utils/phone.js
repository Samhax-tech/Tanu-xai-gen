/**
 * Phone number validation and normalization utilities
 * Ensures phone numbers are in correct format for Baileys pairing code
 */

/**
 * Normalize a phone number by removing spaces, dashes, and other non-digit characters
 * @param {string} phoneNumber - Raw phone number input
 * @returns {string} - Normalized phone number (digits only, with leading + if present)
 */
function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return '';
    }

    // Trim whitespace
    let normalized = phoneNumber.trim();

    // Check if starts with +
    const hasPlus = normalized.startsWith('+');

    // Remove all non-digit characters except the leading +
    normalized = normalized.replace(/[^\d]/g, '');

    // Add back the + if it was present
    if (hasPlus) {
        normalized = '+' + normalized;
    }

    return normalized;
}

/**
 * Validate a phone number for WhatsApp pairing code
 * @param {string} phoneNumber - Phone number to validate
 * @returns {{valid: boolean, error?: string, normalized?: string}} - Validation result
 */
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return {
            valid: false,
            error: 'Phone number is required'
        };
    }

    const normalized = normalizePhoneNumber(phoneNumber);

    // Remove leading + for digit count
    const digitsOnly = normalized.replace(/^\+/, '');

    // Check minimum length (country code + at least 7 digits)
    if (digitsOnly.length < 8) {
        return {
            valid: false,
            error: 'Phone number is too short. Include country code.'
        };
    }

    // Check maximum length (international format max is 15 digits)
    if (digitsOnly.length > 15) {
        return {
            valid: false,
            error: 'Phone number is too long'
        };
    }

    // Ensure all remaining characters are digits
    if (!/^\d+$/.test(digitsOnly)) {
        return {
            valid: false,
            error: 'Phone number must contain only digits'
        };
    }

    // Must have a country code (not start with 0)
    if (digitsOnly.startsWith('0')) {
        return {
            valid: false,
            error: 'Phone number must include country code (do not start with 0)'
        };
    }

    return {
        valid: true,
        normalized: '+' + digitsOnly
    };
}

/**
 * Format phone number for display (mask sensitive parts)
 * @param {string} phoneNumber - Full phone number
 * @returns {string} - Masked phone number for safe display
 */
function maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        return '***';
    }

    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length <= 4) {
        return '***';
    }

    // Show last 4 digits, mask the rest
    const lastFour = digits.slice(-4);
    return `***${lastFour}`;
}

module.exports = {
    normalizePhoneNumber,
    validatePhoneNumber,
    maskPhoneNumber
};
