import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

const silentLogger = pino({ level: 'silent' });

/**
 * Creates an ephemeral Baileys socket instance utilizing temporary multi-file auth.
 *
 * @param {string} tempDir - Path to temporary session directory
 * @param {object} callbacks - Connection lifecycle listeners
 * @returns {Promise<{ sock: any, saveCreds: Function, state: any }>}
 */
export async function createSocket(tempDir, callbacks = {}) {
  const { onConnectionUpdate, onCredsUpdate, onQR } = callbacks;

  const { state, saveCreds } = await useMultiFileAuthState(tempDir);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307],
    isLatest: true
  }));

  logger.debug({ version, isLatest }, 'Initializing Baileys ephemeral socket');

  const sock = makeWASocket({
    version,
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ['Tanu-XAI', 'Chrome', '20.0.04'],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    fireInitQueries: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    getMessage: async () => undefined
  });

  // Track credentials update
  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
      if (onCredsUpdate) onCredsUpdate();
    } catch (err) {
      logger.error({ err }, 'Error saving credentials in ephemeral multi-file state');
    }
  });

  // Track connection lifecycle
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && onQR) {
      onQR(qr);
    }

    if (onConnectionUpdate) {
      onConnectionUpdate(update);
    }
  });

  return { sock, saveCreds, state };
}

/**
 * Request an 8-character pairing code for a normalized phone number.
 *
 * @param {any} sock
 * @param {string} normalizedPhoneNumber
 * @returns {Promise<string>} 8-character pairing code
 */
export async function requestPairingCode(sock, normalizedPhoneNumber) {
  try {
    // Wait briefly for socket readiness if necessary
    await delay(2000);
    const code = await sock.requestPairingCode(normalizedPhoneNumber);
    return code;
  } catch (err) {
    logger.error({ err }, 'Failed to request Baileys pairing code');
    throw new AppError(
      ErrorCodes.PAIRING_FAILED,
      'Failed to generate pairing code from WhatsApp. Verify phone number and try again.'
    );
  }
}

/**
 * Sends the authenticated session token and branded guide card directly to the user's WhatsApp DM.
 *
 * @param {any} sock
 * @param {string} jid - User's WhatsApp JID (e.g. 923001234567@s.whatsapp.net)
 * @param {string} sessionString - Full Tanu-XAI session token string
 */
export async function sendSessionMessages(sock, jid, sessionString) {
  try {
    // Message 1: Raw session string for effortless single-tap copy on mobile WhatsApp
    await sock.sendMessage(jid, {
      text: sessionString
    });

    await delay(1000);

    // Message 2: Branded Tanu-XAI card
    const cardMessage =
`*╔══════════════════════════╗*
*   ✦ TANU-XAI SESSION GENERATOR ✦   *
*╚══════════════════════════╝*

*Status:* ✅ Connected Successfully
*Session:* Generated & Ready for Deployment

*⚠️ SECURITY WARNING:*
Do NOT share this session ID with anyone. Anyone with this key has access to authenticate with your WhatsApp account.

*🚀 HOW TO USE IN YOUR BOT:*
1. Copy the raw session string sent above.
2. Add it as an environment variable in your deployment:
   \`SESSION_ID=${sessionString}\`
3. Start your Tanu-XAI Bot.

_Powered by Tanu-XAI Architecture_`;

    await sock.sendMessage(jid, {
      text: cardMessage
    });
    
    logger.info('WhatsApp session messages delivered to user DM');
  } catch (err) {
    logger.warn({ err }, 'Failed to deliver WhatsApp DM message to user (session remains available in UI)');
  }
}

/**
 * Terminate a socket cleanly.
 *
 * @param {any} sock
 */
export function terminateSocket(sock) {
  if (!sock) return;
  try {
    sock.ev.removeAllListeners('connection.update');
    sock.ev.removeAllListeners('creds.update');
    if (sock.ws) {
      sock.ws.close();
    }
    if (typeof sock.end === 'function') {
      sock.end(new Error('Session terminated'));
    }
  } catch (err) {
    logger.debug({ err }, 'Socket termination cleanup notice');
  }
}

/**
 * Determine if a disconnect reason is permanent logout.
 *
 * @param {any} lastDisconnect
 * @returns {boolean}
 */
export function isPermanentLogout(lastDisconnect) {
  const statusCode = (lastDisconnect?.error instanceof Boom)
    ? lastDisconnect.error.output?.statusCode
    : lastDisconnect?.error?.output?.statusCode;

  return statusCode === DisconnectReason.loggedOut;
}
