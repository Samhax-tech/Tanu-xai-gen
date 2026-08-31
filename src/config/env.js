import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_PREFIX: process.env.SESSION_PREFIX || 'Tanu-XAI~',
  BOT_NAME: process.env.BOT_NAME || 'Tanu-XAI',
  PAIRING_TIMEOUT_MS: parseInt(process.env.PAIRING_TIMEOUT_MS || '300000', 10), // 5 minutes
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  SESSION_RATE_LIMIT_MAX: parseInt(process.env.SESSION_RATE_LIMIT_MAX || '10', 10),
};

export function validateEnv() {
  // Zero external database requirement - only validate ranges
  if (isNaN(env.PORT) || env.PORT < 1 || env.PORT > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }
}
