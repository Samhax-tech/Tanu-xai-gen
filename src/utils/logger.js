const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label.toUpperCase() })
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

const logLevels = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60
};

/**
 * Structured logger with safe logging
 * Never logs sensitive data like pairing codes, auth credentials, or keys
 */
module.exports = {
    /**
     * Log an info message
     * @param {string} message 
     * @param {object} [data] - Additional safe data to log
     */
    info(message, data = {}) {
        // Filter out any sensitive keys from data
        const safeData = this._sanitizeData(data);
        logger.info(safeData, message);
    },

    /**
     * Log a warning message
     * @param {string} message 
     * @param {object} [data] - Additional safe data to log
     */
    warn(message, data = {}) {
        const safeData = this._sanitizeData(data);
        logger.warn(safeData, message);
    },

    /**
     * Log an error message
     * @param {string} message 
     * @param {object} [data] - Additional safe data to log
     */
    error(message, data = {}) {
        const safeData = this._sanitizeData(data);
        logger.error(safeData, message);
    },

    /**
     * Log a debug message
     * @param {string} message 
     * @param {object} [data] - Additional safe data to log
     */
    debug(message, data = {}) {
        const safeData = this._sanitizeData(data);
        logger.debug(safeData, message);
    },

    /**
     * Sanitize data to remove sensitive information
     * @param {object} data 
     * @returns {object} - Sanitized data
     */
    _sanitizeData(data) {
        if (!data || typeof data !== 'object') {
            return {};
        }

        const sensitiveKeys = [
            'creds',
            'keys',
            'auth',
            'credentials',
            'privateKey',
            'publicKey',
            'signalIdentityKey',
            'noiseKey',
            'pairingEphemeralKeyPair',
            'advSecretKey',
            'preKey',
            'session',
            'senderKey',
            'appStateSyncKey',
            'serviceRoleKey',
            'SUPABASE_SERVICE_ROLE_KEY',
            'SESSION_ENCRYPTION_KEY',
            'pairingCode'
        ];

        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this._sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    },

    /**
     * Create a child logger with additional context
     * @param {object} bindings 
     * @returns {object} - Child logger
     */
    child(bindings) {
        const safeBindings = this._sanitizeData(bindings);
        return logger.child(safeBindings);
    }
};
