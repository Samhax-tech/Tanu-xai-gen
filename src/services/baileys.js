import makeWASocket, { Browsers, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { child } from '../utils/logger.js';
import { maskPhoneNumber } from '../utils/phone.js';

const log = child({ module: 'baileys' });

/**
 * Create a brand-new Baileys socket for one session and wire exactly one
 * connection.update handler. Callers pass a `runtime` object (from
 * session-manager) that owns the current `generation` counter; every event
 * checks it belongs to the still-current generation before acting, so a
 * stale/replaced socket can never mutate the session that superseded it.
 *
 * `handlers` is a small set of callbacks the session-manager supplies:
 *   onPairingCode(code)
 *   onConnecting()
 *   onConnected({ jid, name })
 *   onReconnecting()
 *   onLoggedOut()
 *   onExpiredOrFailed(reason)
 *   onCredsUpdate()  -- must call state.saveCreds internally, we just notify
 */
export function createSocket({ runtime, authState, generation, handlers }) {
  const sock = makeWASocket({
    auth: authState.state,
    // Canonical, known-supported browser identity. Cosmetic branding is a
    // separate concern from pairing reliability and is deliberately not
    // touched here.
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  const isCurrentGeneration = () => runtime.generation === generation;

  sock.ev.on('creds.update', async () => {
    if (!isCurrentGeneration()) return;
    try {
      await authState.saveCreds();
    } catch (err) {
      log.error({ err: err.message, sessionId: runtime.sessionId }, 'Failed to persist creds.update');
    }
  });

  // Exactly one connection.update handler for this socket generation.
  sock.ev.on('connection.update', async (update) => {
    if (!isCurrentGeneration()) return;

    const { connection, lastDisconnect, isNewLogin } = update;

    try {
      if (connection === 'connecting') {
        await handlers.onConnecting?.();
        return;
      }

      if (connection === 'open') {
        // This is the ONLY point at which we trust that WhatsApp has
        // genuinely authenticated the socket. creds.me being populated
        // earlier (e.g. during pairing-code request) is NOT sufficient.
        const jid = sock.user?.id ?? null;
        const name = sock.user?.name ?? sock.user?.verifiedName ?? null;
        await handlers.onConnected?.({ jid, name, isNewLogin: Boolean(isNewLogin) });
        return;
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          await handlers.onLoggedOut?.();
          return;
        }

        // Any other close while the session was already authenticated is a
        // recoverable disconnect; let the session-manager decide whether to
        // reconnect. If the session never finished pairing, the pairing
        // timeout (owned by session-manager) governs cleanup instead of an
        // endless reconnect loop here.
        await handlers.onReconnecting?.(statusCode);
      }
    } catch (err) {
      log.error(
        { err: err.message, sessionId: runtime.sessionId },
        'Error handling connection.update'
      );
      await handlers.onExpiredOrFailed?.('handler_error');
    }
  });

  return sock;
}

/**
 * Request a pairing code for a freshly-created socket. Resolution of this
 * call means "WhatsApp generated a code", nothing more — it is explicitly
 * NOT proof of authentication.
 */
export async function requestPairingCode(sock, normalizedPhoneNumber) {
  log.info({ phone: maskPhoneNumber(normalizedPhoneNumber) }, 'Requesting pairing code');
  const code = await sock.requestPairingCode(normalizedPhoneNumber);
  return code;
}

export function terminateSocket(sock) {
  if (!sock) return;
  try {
    sock.ev.removeAllListeners();
  } catch {
    // no-op
  }
  try {
    sock.end(undefined);
  } catch {
    // no-op
  }
}
