import crypto from 'crypto';
import { supabase } from './supabase.js';
import { useSupabaseAuthState, deleteAuthState } from './auth-store.js';
import { createSocket, requestPairingCode, terminateSocket } from './baileys.js';
import { env } from '../config/env.js';
import { child } from '../utils/logger.js';
import { maskPhoneNumber } from '../utils/phone.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

const log = child({ module: 'session-manager' });

export const SessionStatus = Object.freeze({
  CREATED: 'created',
  CONNECTING: 'connecting',
  REQUESTING_PAIRING_CODE: 'requesting_pairing_code',
  WAITING_FOR_AUTH: 'waiting_for_auth',
  AUTHENTICATING: 'authenticating',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  LOGGED_OUT: 'logged_out',
  EXPIRED: 'expired',
  FAILED: 'failed'
});

// In-memory registry of live runtime objects, keyed by sessionId.
// Only ephemeral/runtime state lives here. Everything durable lives in
// Supabase (sessions / auth_credentials / auth_keys tables).
const runtimes = new Map();

function generateSessionId() {
  return `TX_${crypto.randomBytes(4).toString('hex')}`;
}

async function updateSessionRow(sessionId, fields) {
  const { error } = await supabase
    .from('sessions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (error) {
    log.error({ err: error.message, sessionId }, 'Failed to update session row');
  }
}

async function getSessionRow(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    log.error({ err: error.message, sessionId }, 'Failed to load session row');
    throw error;
  }
  return data;
}

function clearTimers(runtime) {
  if (runtime.pairingTimeout) {
    clearTimeout(runtime.pairingTimeout);
    runtime.pairingTimeout = null;
  }
}

function removeRuntime(sessionId) {
  const runtime = runtimes.get(sessionId);
  if (!runtime) return;
  clearTimers(runtime);
  terminateSocket(runtime.sock);
  runtimes.delete(sessionId);
}

/**
 * Start a brand-new session: create the DB row, build a Supabase-backed
 * auth state, open a socket, request a pairing code. Resolves as soon as
 * the pairing code is generated — it does NOT wait for authentication.
 */
export async function startSession(normalizedPhoneNumber) {
  const sessionId = generateSessionId();
  const log2 = child({ sessionId });

  const { error: insertError } = await supabase.from('sessions').insert({
    session_id: sessionId,
    phone_number: normalizedPhoneNumber,
    status: SessionStatus.CREATED
  });

  if (insertError) {
    log2.error({ err: insertError.message }, 'Failed to create session row');
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Unable to create session.', 500);
  }

  const runtime = {
    sessionId,
    phoneNumber: normalizedPhoneNumber,
    status: SessionStatus.CREATED,
    generation: 0,
    sock: null,
    pairingTimeout: null,
    welcomeSent: false
  };
  runtimes.set(sessionId, runtime);

  try {
    await updateSessionRow(sessionId, { status: SessionStatus.CONNECTING });
    runtime.status = SessionStatus.CONNECTING;

    const authState = await useSupabaseAuthState(sessionId);
    runtime.generation += 1;
    const generation = runtime.generation;

    const sock = createSocket({
      runtime,
      authState,
      generation,
      handlers: buildHandlers(runtime)
    });
    runtime.sock = sock;

    await updateSessionRow(sessionId, { status: SessionStatus.REQUESTING_PAIRING_CODE });
    runtime.status = SessionStatus.REQUESTING_PAIRING_CODE;

    const pairingCode = await requestPairingCode(sock, normalizedPhoneNumber);

    await updateSessionRow(sessionId, {
      status: SessionStatus.WAITING_FOR_AUTH,
      pairing_code: pairingCode,
      pairing_code_requested_at: new Date().toISOString()
    });
    runtime.status = SessionStatus.WAITING_FOR_AUTH;

    armPairingTimeout(runtime);

    log2.info('Pairing code generated, waiting for authentication');

    return { sessionId, pairingCode, status: SessionStatus.WAITING_FOR_AUTH };
  } catch (err) {
    log2.error({ err: err.message }, 'Failed to start session');
    await updateSessionRow(sessionId, {
      status: SessionStatus.FAILED,
      error_message: 'Failed to initialize session or request pairing code.'
    });
    removeRuntime(sessionId);
    throw new AppError(ErrorCodes.PAIRING_FAILED, 'Unable to generate a pairing code right now.', 502);
  }
}

function armPairingTimeout(runtime) {
  clearTimers(runtime);
  runtime.pairingTimeout = setTimeout(async () => {
    const current = runtimes.get(runtime.sessionId);
    if (!current || current.status !== SessionStatus.WAITING_FOR_AUTH) return;

    log.info({ sessionId: runtime.sessionId }, 'Pairing timed out');
    await updateSessionRow(runtime.sessionId, {
      status: SessionStatus.EXPIRED,
      error_message: 'Pairing code expired before authentication.'
    });
    removeRuntime(runtime.sessionId);
  }, env.pairingTimeoutMs);
}

function buildHandlers(runtime) {
  const log2 = child({ sessionId: runtime.sessionId });

  return {
    async onConnecting() {
      if (runtime.status === SessionStatus.WAITING_FOR_AUTH) {
        runtime.status = SessionStatus.AUTHENTICATING;
        await updateSessionRow(runtime.sessionId, { status: SessionStatus.AUTHENTICATING });
        log2.info('Authenticating');
      }
    },

    async onConnected({ jid, name }) {
      clearTimers(runtime);

      const alreadyConnected = runtime.status === SessionStatus.CONNECTED;
      runtime.status = SessionStatus.CONNECTED;

      await updateSessionRow(runtime.sessionId, {
        status: SessionStatus.CONNECTED,
        whatsapp_jid: jid,
        whatsapp_name: name,
        authenticated_at: new Date().toISOString(),
        error_message: null
      });

      log2.info({ jid: jid ? '[present]' : null }, 'Session connected');

      // Send the welcome message exactly once per authentication, even
      // across reconnect events that also report connection === 'open'.
      if (!runtime.welcomeSent && !alreadyConnected) {
        runtime.welcomeSent = true;
        await sendWelcomeMessage(runtime, jid).catch((err) => {
          log2.error({ err: err.message }, 'Failed to send welcome message');
        });
      }
    },

    async onReconnecting(statusCode) {
      if (runtime.status === SessionStatus.CONNECTED) {
        runtime.status = SessionStatus.RECONNECTING;
        await updateSessionRow(runtime.sessionId, { status: SessionStatus.RECONNECTING });
        log2.info({ statusCode }, 'Reconnecting after disconnect');
        await reconnect(runtime);
        return;
      }

      // A disconnect while still pairing is not a normal authenticated
      // reconnect. Let the pairing timeout govern cleanup instead of
      // looping reconnect attempts here.
      log2.info({ statusCode, status: runtime.status }, 'Disconnected before authentication completed');
    },

    async onLoggedOut() {
      clearTimers(runtime);
      runtime.status = SessionStatus.LOGGED_OUT;
      await updateSessionRow(runtime.sessionId, {
        status: SessionStatus.LOGGED_OUT,
        disconnected_at: new Date().toISOString()
      });
      log2.info('Session logged out');
      removeRuntime(runtime.sessionId);
    },

    async onExpiredOrFailed(reason) {
      clearTimers(runtime);
      runtime.status = SessionStatus.FAILED;
      await updateSessionRow(runtime.sessionId, {
        status: SessionStatus.FAILED,
        error_message: String(reason)
      });
      removeRuntime(runtime.sessionId);
    }
  };
}

async function reconnect(runtime) {
  try {
    const authState = await useSupabaseAuthState(runtime.sessionId);
    runtime.generation += 1;
    const generation = runtime.generation;

    terminateSocket(runtime.sock);

    const sock = createSocket({
      runtime,
      authState,
      generation,
      handlers: buildHandlers(runtime)
    });
    runtime.sock = sock;
  } catch (err) {
    log.error({ err: err.message, sessionId: runtime.sessionId }, 'Reconnect failed');
    await updateSessionRow(runtime.sessionId, {
      status: SessionStatus.FAILED,
      error_message: 'Reconnect failed.'
    });
    removeRuntime(runtime.sessionId);
  }
}

async function sendWelcomeMessage(runtime, jid) {
  if (!jid) return;
  const sock = runtime.sock;
  if (!sock) return;

  const text =
    `╔══════════════════════════════════════╗\n` +
    `║       🌟 TANU-XAI CONNECTED 🌟      ║\n` +
    `╚══════════════════════════════════════╝\n\n` +
    `✅ Connected to WhatsApp successfully!\n\n` +
    `📱 Number: +${runtime.phoneNumber}\n` +
    `🤖 Device: Tanu-XAI\n` +
    `🆔 Session ID:\n${runtime.sessionId}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Save this Session ID.\n\n` +
    `Use this Session ID in your Tanu-XAI bot configuration.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⚡ Powered by Tanu-XAI`;

  await sock.sendMessage(jid, { text });
}

/** Safe, public-facing view of a session (no secrets, masked phone). */
export async function getSessionPublic(sessionId) {
  const row = await getSessionRow(sessionId);
  if (!row) {
    throw new AppError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found.', 404);
  }

  return {
    sessionId: row.session_id,
    status: row.status,
    phone: maskPhoneNumber(row.phone_number),
    whatsappName: row.whatsapp_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Lightweight polling payload. */
export async function getSessionStatus(sessionId) {
  const row = await getSessionRow(sessionId);
  if (!row) {
    throw new AppError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found.', 404);
  }

  return {
    sessionId: row.session_id,
    status: row.status,
    authenticated: row.status === SessionStatus.CONNECTED,
    whatsappName: row.whatsapp_name || null
  };
}

/** Whether a start request for this phone number is currently in flight or active. */
export function isPhoneNumberActive(normalizedPhoneNumber) {
  for (const runtime of runtimes.values()) {
    if (
      runtime.phoneNumber === normalizedPhoneNumber &&
      ![SessionStatus.LOGGED_OUT, SessionStatus.EXPIRED, SessionStatus.FAILED].includes(runtime.status)
    ) {
      return true;
    }
  }
  return false;
}

export async function stopSession(sessionId, { deleteAuth = true } = {}) {
  removeRuntime(sessionId);

  if (deleteAuth) {
    await deleteAuthState(sessionId);
  }

  const { error } = await supabase.from('sessions').delete().eq('session_id', sessionId);
  if (error) {
    log.error({ err: error.message, sessionId }, 'Failed to delete session row');
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Failed to delete session.', 500);
  }
}

export function activeSessionCount() {
  return runtimes.size;
}

export async function shutdownAll() {
  log.info({ count: runtimes.size }, 'Shutting down all active sessions');
  for (const sessionId of Array.from(runtimes.keys())) {
    removeRuntime(sessionId);
  }
}
