import pino from 'pino';
import { env } from '../config/env.js';

// Fields that must never reach a log line (creds, keys, raw phone numbers, pairing codes)
const REDACT_PATHS = [
  'creds',
  'keys',
  'authState',
  'signalKeys',
  'noiseKey',
  'pairingCode',
  'rawPairingCode',
  'session',
  'sessionString',
  'phoneNumber',
  'phone',
  '*.creds',
  '*.keys',
  '*.authState'
];

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
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
