import pino from 'pino';
import { env } from '../config/env.js';

// Fields that must never reach a log line, no matter which object shape they
// show up in (creds, keys, service role key, raw phone numbers, pairing codes).
const REDACT_PATHS = [
  'creds',
  'keys',
  'authState',
  'signalKeys',
  'supabaseServiceRoleKey',
  'SUPABASE_SERVICE_ROLE_KEY',
  'pairingCode',
  'phoneNumber',
  'phone',
  '*.creds',
  '*.keys',
  '*.authState'
];

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]'
  },
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export function child(bindings) {
  return logger.child(bindings);
}
