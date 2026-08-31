import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { BufferJSON } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { normalizePhoneNumber, maskPhoneNumber } from '../utils/phone.js';
import {
  createSocket,
  requestPairingCode,
  sendSessionMessages,
  terminateSocket,
  isPermanentLogout
} from './baileys.js';

const TEMP_BASE_DIR = path.join(process.cwd(), 'temp');

// In-memory active session map: sessionId -> SessionState
const activeSessions = new Map();

// Active phone lock set: normalizedPhoneNumber -> sessionId
const activePhones = new Map();

/**
 * Startup initialization: Ensure temp base directory exists and clean stale folders.
 */
export function initSessionStorage() {
  try {
    if (!fs.existsSync(TEMP_BASE_DIR)) {
      fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
      logger.info({ dir: TEMP_BASE_DIR }, 'Created ephemeral temp base directory');
    } else {
      // Clean up orphaned session directories from previous restarts
      const entries = fs.readdirSync(TEMP_BASE_DIR);
      for (const entry of entries) {
        const fullPath = path.join(TEMP_BASE_DIR, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch (err) {
          logger.warn({ entry, err }, 'Failed to clean startup temp folder');
        }
      }
      logger.info('Cleaned stale temp session directories on startup');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to initialize session storage');
  }
}

/**
 * Format 8-character pairing code into XXXX-XXXX for presentation.
 * @param {string} code
 * @returns {string}
 */
export function formatPairingCode(code) {
  if (!code) return '';
  const clean = code.replace(/[^A-Za-z0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return code;
}

/**
 * Create and start a new WhatsApp pairing or QR session.
 *
 * @param {object} params
 * @param {'pairing' | 'qr'} params.mode
 * @param {string} [params.phoneNumber]
 * @returns {Promise<{ sessionId: string, status: string, expiresAt: number }>}
 */
export async function startSession({ mode = 'pairing', phoneNumber }) {
  let normalizedPhone = null;

  if (mode === 'pairing') {
    if (!phoneNumber) {
      throw new AppError(ErrorCodes.INVALID_PHONE_NUMBER, 'Phone number is required for pairing code mode.');
    }
    normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Single-flight lock: check if phone is already actively pairing
    const existingSessionId = activePhones.get(normalizedPhone);
    if (existingSessionId) {
      const existing = activeSessions.get(existingSessionId);
      if (existing && !['session_ready', 'failed', 'expired'].includes(existing.status)) {
        throw new AppError(
          ErrorCodes.PAIRING_IN_PROGRESS,
          'A pairing session is already in progress for this phone number. Please wait or try again later.'
        );
      }
    }
  }

  const sessionId = `TXG_${crypto.randomBytes(5).toString('hex')}`;
  const tempDir = path.join(TEMP_BASE_DIR, sessionId);
  fs.mkdirSync(tempDir, { recursive: true });

  const expiresAt = Date.now() + env.PAIRING_TIMEOUT_MS;

  const session = {
    id: sessionId,
    mode,
    phoneNumber: normalizedPhone,
    status: 'creating',
    pairingCode: null,
    rawPairingCode: null,
    qr: null,
    qrDataUrl: null,
    session: null,
    error: null,
    expiresAt,
    createdAt: Date.now(),
    sock: null,
    tempDir,
    timeoutTimer: null,
    generation: 1
  };

  activeSessions.set(sessionId, session);
  if (normalizedPhone) {
    activePhones.set(normalizedPhone, sessionId);
  }

  logger.info(
    { sessionId, mode, phone: normalizedPhone ? maskPhoneNumber(normalizedPhone) : 'N/A' },
    'Session created'
  );

  // Set expiration timeout
  session.timeoutTimer = setTimeout(() => {
    handleSessionTimeout(sessionId);
  }, env.PAIRING_TIMEOUT_MS);

  // Launch socket in background
  initiateSocket(session).catch((err) => {
    logger.error({ sessionId, err }, 'Unhandled error during socket initiation');
    failSession(sessionId, err.message || 'Failed to initialize session');
  });

  return {
    sessionId,
    status: session.status,
    expiresAt: session.expiresAt
  };
}

/**
 * Initiate Baileys socket for an active session.
 * @param {object} session
 */
async function initiateSocket(session) {
  const { id: sessionId, tempDir, mode, phoneNumber } = session;
  session.status = 'connecting';

  const { sock, saveCreds } = await createSocket(tempDir, {
    onQR: async (qrString) => {
      if (session.mode === 'qr' && !['session_ready', 'failed', 'expired'].includes(session.status)) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qrString, {
            margin: 2,
            width: 320,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          session.qr = qrString;
          session.qrDataUrl = qrDataUrl;
          session.status = 'qr_ready';
          logger.debug({ sessionId }, 'QR code generated and ready');
        } catch (err) {
          logger.error({ sessionId, err }, 'Failed to render QR Code');
        }
      }
    },
    onConnectionUpdate: async (update) => {
      await handleConnectionUpdate(sessionId, update);
    }
  });

  session.sock = sock;

  // If pairing code mode, request pairing code from Baileys
  if (mode === 'pairing' && phoneNumber) {
    try {
      session.status = 'connecting';
      const rawCode = await requestPairingCode(sock, phoneNumber);
      session.rawPairingCode = rawCode;
      session.pairingCode = formatPairingCode(rawCode);
      session.status = 'pairing_code_ready';
      logger.info({ sessionId }, 'Pairing code generated and ready for user');
    } catch (err) {
      failSession(sessionId, err.message || 'Failed to request pairing code');
    }
  }
}

/**
 * Handles Baileys connection updates.
 * @param {string} sessionId
 * @param {object} update
 */
async function handleConnectionUpdate(sessionId, update) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { connection, lastDisconnect } = update;

  if (connection === 'connecting') {
    if (session.status === 'pairing_code_ready' || session.status === 'qr_ready') {
      session.status = 'authenticating';
    }
  } else if (connection === 'open') {
    logger.info({ sessionId }, 'WhatsApp connection established successfully');
    session.status = 'connected';
    await finalizeSession(sessionId);
  } else if (connection === 'close') {
    const loggedOut = isPermanentLogout(lastDisconnect);
    logger.warn({ sessionId, loggedOut, lastDisconnect: lastDisconnect?.error?.message }, 'WhatsApp connection closed');

    if (session.status !== 'session_ready') {
      if (loggedOut) {
        failSession(sessionId, 'Logged out from WhatsApp device.');
      } else if (session.status === 'authenticating') {
        failSession(sessionId, 'Authentication was cancelled or failed. Please retry.');
      }
    }
  }
}

/**
 * Finalizes successful authentication: serializes creds.json, delivers WhatsApp DM, and sets session_ready.
 * @param {string} sessionId
 */
async function finalizeSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.status = 'session_generating';

  try {
    const credsPath = path.join(session.tempDir, 'creds.json');

    // Ensure creds.json is flushed to disk
    let attempts = 0;
    while (!fs.existsSync(credsPath) && attempts < 10) {
      await new Promise((r) => setTimeout(r, 400));
      attempts++;
    }

    if (!fs.existsSync(credsPath)) {
      throw new Error('Authentication credentials file (creds.json) was not written by Baileys.');
    }

    const credsRaw = fs.readFileSync(credsPath, 'utf8');
    const credsObj = JSON.parse(credsRaw);

    // Serialize creds using Baileys BufferJSON replacer
    const serialized = JSON.stringify(credsObj, BufferJSON.replacer);
    const base64Session = Buffer.from(serialized).toString('base64');
    const sessionString = `${env.SESSION_PREFIX}${base64Session}`;

    session.session = sessionString;
    session.status = 'session_ready';

    logger.info({ sessionId }, 'Tanu-XAI session generated successfully');

    // Deliver WhatsApp DMs to the connected account
    const userJid = session.sock?.user?.id;
    if (userJid) {
      // Normalize JID: e.g. 923001234567:1@s.whatsapp.net -> 923001234567@s.whatsapp.net
      const cleanJid = userJid.split(':')[0] + '@s.whatsapp.net';
      await sendSessionMessages(session.sock, cleanJid, sessionString);
    }

    // Terminate socket and schedule safe disk cleanup
    setTimeout(() => {
      cleanupSessionResources(sessionId);
    }, 2500);

  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to finalize Tanu-XAI session');
    failSession(sessionId, 'Failed to serialize session credentials.');
  }
}

/**
 * Mark session as failed and clean up.
 * @param {string} sessionId
 * @param {string} message
 */
export function failSession(sessionId, message) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  session.status = 'failed';
  session.error = message;

  logger.warn({ sessionId, message }, 'Session marked as failed');
  cleanupSessionResources(sessionId);
}

/**
 * Handle session timeout.
 * @param {string} sessionId
 */
function handleSessionTimeout(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  if (session.status !== 'session_ready') {
    session.status = 'expired';
    session.error = 'Session pairing timed out (5 minutes). Please try again.';
    logger.info({ sessionId }, 'Session expired due to timeout');
  }

  cleanupSessionResources(sessionId);
}

/**
 * Cancel an active session manually.
 * @param {string} sessionId
 */
export function cancelSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new AppError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found or already closed.');
  }

  session.status = 'failed';
  session.error = 'Session was cancelled by user.';
  cleanupSessionResources(sessionId);

  return { success: true };
}

/**
 * Safely cleans up socket, timer, temporary disk directory, and phone locks.
 * @param {string} sessionId
 */
function cleanupSessionResources(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  if (session.timeoutTimer) {
    clearTimeout(session.timeoutTimer);
    session.timeoutTimer = null;
  }

  if (session.phoneNumber) {
    activePhones.delete(session.phoneNumber);
  }

  if (session.sock) {
    terminateSocket(session.sock);
    session.sock = null;
  }

  if (session.tempDir && fs.existsSync(session.tempDir)) {
    try {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
      logger.debug({ sessionId, dir: session.tempDir }, 'Deleted temporary auth directory');
    } catch (err) {
      logger.warn({ sessionId, err }, 'Failed to delete temporary auth directory');
    }
  }
}

/**
 * Returns number of active in-memory sessions.
 * @returns {number}
 */
export function activeSessionCount() {
  return activeSessions.size;
}

/**
 * Get status of an active session.
 * @param {string} sessionId
 * @returns {object}
 */
export function getSessionStatus(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new AppError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found or expired.');
  }

  return {
    sessionId: session.id,
    mode: session.mode,
    status: session.status,
    pairingCode: session.pairingCode,
    qr: session.qr,
    qrDataUrl: session.qrDataUrl,
    session: session.session,
    error: session.error,
    expiresAt: session.expiresAt
  };
}
