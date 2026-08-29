// ourin-baileys is an ESM module, so we need to handle it carefully
// We'll use a lazy loading pattern with async initialization

let baileysModule = null;

async function getBaileys() {
    if (!baileysModule) {
        baileysModule = await import('ourin-baileys');
    }
    return baileysModule;
}

const logger = require('../utils/logger');
const SupabaseService = require('./supabase');

/**
 * Custom auth state implementation using Supabase for persistence
 * Implements the Baileys AuthenticationState interface
 */
class SupabaseAuthState {
    constructor(sessionId, supabaseService) {
        this.sessionId = sessionId;
        this.supabase = supabaseService;
        this.creds = null;
        this.keys = {
            get: async (type, ids) => {
                return await this._getKeys(type, ids);
            },
            set: async (data) => {
                await this._setKeys(data);
            }
        };
    }

    /**
     * Initialize or load existing credentials
     */
    async init() {
        const existingCreds = await this.supabase.getAuthCreds(this.sessionId);
        
        if (existingCreds) {
            // Convert stored JSON back to proper format with Buffer support
            this.creds = this._deserializeCreds(existingCreds);
            logger.info('Loaded existing auth credentials', { sessionId: this.sessionId });
        } else {
            // Initialize new credentials
            this.creds = initAuthCreds();
            logger.info('Initialized new auth credentials', { sessionId: this.sessionId });
        }

        return {
            creds: this.creds,
            keys: this.keys
        };
    }

    /**
     * Save credentials to Supabase
     */
    async saveCreds() {
        if (!this.creds) {
            return;
        }

        try {
            // Serialize credentials for storage (handle Buffers)
            const serializedCreds = this._serializeCreds(this.creds);
            await this.supabase.storeAuthCreds(this.sessionId, serializedCreds);
            logger.debug('Credentials saved to Supabase', { sessionId: this.sessionId });
        } catch (error) {
            logger.error('Failed to save credentials', { sessionId: this.sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Get keys from Supabase
     * @param {string} type - Key type (pre-key, session, sender-key, etc.)
     * @param {string[]} ids - Array of key IDs
     */
    async _getKeys(type, ids) {
        const storedKeys = await this.supabase.getKeys(this.sessionId, type, ids);
        
        const result = {};
        for (const id of ids) {
            if (storedKeys[id]) {
                // Deserialize key data (handle base64 encoded buffers)
                result[id] = this._deserializeKeyData(storedKeys[id]);
            }
        }
        return result;
    }

    /**
     * Set keys in Supabase
     * @param {object} data - Keys data organized by type
     */
    async _setKeys(data) {
        for (const [type, keys] of Object.entries(data)) {
            for (const [id, keyData] of Object.entries(keys || {})) {
                if (keyData === null) {
                    // Delete the key
                    await this.supabase.deleteKey(this.sessionId, type, id);
                } else {
                    // Store/update the key
                    const serializedData = this._serializeKeyData(keyData);
                    await this.supabase.storeKey(this.sessionId, type, id, serializedData);
                }
            }
        }
    }

    /**
     * Serialize credentials for storage (convert Buffers to base64)
     */
    _serializeCreds(creds) {
        const serialized = {};
        for (const [key, value] of Object.entries(creds)) {
            if (value instanceof Buffer) {
                serialized[key] = { __buffer: value.toString('base64') };
            } else if (typeof value === 'object' && value !== null) {
                serialized[key] = this._serializeObject(value);
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    /**
     * Deserialize credentials from storage (restore Buffers)
     */
    _deserializeCreds(serialized) {
        const creds = {};
        for (const [key, value] of Object.entries(serialized)) {
            if (value && typeof value === 'object' && value.__buffer) {
                creds[key] = Buffer.from(value.__buffer, 'base64');
            } else if (typeof value === 'object' && value !== null) {
                creds[key] = this._deserializeObject(value);
            } else {
                creds[key] = value;
            }
        }
        return creds;
    }

    /**
     * Recursively serialize object with Buffer handling
     */
    _serializeObject(obj) {
        if (obj instanceof Buffer) {
            return { __buffer: obj.toString('base64') };
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._serializeObject(item));
        }
        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this._serializeObject(value);
            }
            return result;
        }
        return obj;
    }

    /**
     * Recursively deserialize object with Buffer restoration
     */
    _deserializeObject(obj) {
        if (obj && typeof obj === 'object' && obj.__buffer) {
            return Buffer.from(obj.__buffer, 'base64');
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._deserializeObject(item));
        }
        if (typeof obj === 'object' && obj !== null) {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this._deserializeObject(value);
            }
            return result;
        }
        return obj;
    }

    /**
     * Serialize key data for storage
     */
    _serializeKeyData(keyData) {
        return this._serializeObject(keyData);
    }

    /**
     * Deserialize key data from storage
     */
    _deserializeKeyData(serializedData) {
        return this._deserializeObject(serializedData);
    }
}

/**
 * Baileys service for managing WhatsApp connections
 */
class BaileysService {
    constructor() {
        this.sessions = new Map();
        this.supabase = new SupabaseService();
        
        // Branded pairing code pool - all codes must be exactly 8 characters
        this.BRANDED_CODES = ['HAXTAN13', 'HAXTAN21', 'HAXTAN12', 'HAXTANXZ', 'TANNUHAX'];
    }

    /**
     * Generate a unique session ID
     * @returns {string} - Session ID in format TX_xxxxx
     */
    generateSessionId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `TX_${result}`;
    }

    /**
     * Select a random branded pairing code from the pool
     * @returns {string} - Selected 8-character branded code
     */
    selectRandomBrandedCode() {
        const randomIndex = Math.floor(Math.random() * this.BRANDED_CODES.length);
        return this.BRANDED_CODES[randomIndex];
    }

    /**
     * Create a new session and start Baileys connection
     * @param {string} phoneNumber - Normalized phone number
     * @returns {Promise<{sessionId: string, pairingCode?: string}>}
     */
    async createSession(phoneNumber) {
        const baileys = await getBaileys();
        const sessionId = this.generateSessionId();
        
        // Create session record in Supabase
        await this.supabase.createSession(sessionId, phoneNumber);

        // Initialize auth state
        const authState = new SupabaseAuthState(sessionId, this.supabase);
        const state = await authState.init();

        // Get latest Baileys version
        const { version } = await baileys.fetchLatestBaileysVersion();

        // Create Baileys socket
        const sock = baileys.makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Tanu Xai Session', 'Chrome', '120.0.0'],
            markOnlineOnConnect: false
        });

        // Select a random branded pairing code for this session
        const selectedCode = this.selectRandomBrandedCode();

        // Store session info with enhanced state tracking
        this.sessions.set(sessionId, {
            sock,
            authState,
            phoneNumber,
            status: 'initializing',
            pairingCode: null,
            selectedBrandedCode: selectedCode,
            createdAt: Date.now(),
            connectionReady: false,
            pairingRequested: false,
            pairingInProgress: false,
            generation: 1
        });

        logger.info('Session created', { sessionId, selectedBrandedCode: selectedCode });

        return { sessionId };
    }

    /**
     * Request pairing code for a session
     * Waits for WebSocket connection to be ready before requesting
     * Uses the session's pre-selected branded code
     * @param {string} sessionId - Session identifier
     * @returns {Promise<string>} - Pairing code
     */
    async requestPairingCode(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }

        // If already have pairing code, return it (prevents regenerating)
        if (session.pairingCode) {
            logger.info('Returning existing pairing code', { sessionId });
            return session.pairingCode;
        }

        // Prevent concurrent pairing requests with lock
        if (session.pairingInProgress) {
            logger.warn('Pairing already in progress', { sessionId });
            throw new Error('Pairing code request already in progress');
        }

        // Check if pairing was already requested (stale socket protection)
        if (session.pairingRequested && !session.connectionReady) {
            logger.warn('Pairing already requested for this session', { sessionId });
            throw new Error('Pairing already requested, waiting for connection');
        }

        // Update status
        await this.supabase.updateSessionStatus(sessionId, 'requesting_pairing_code');
        session.status = 'requesting_pairing_code';
        session.pairingInProgress = true;
        session.pairingRequested = true;

        try {
            // Wait for connection to be ready using actual connection.update event
            // Timeout after 30 seconds to prevent hanging forever
            const timeoutMs = 30000;
            const startTime = Date.now();
            
            while (!session.connectionReady) {
                if (Date.now() - startTime > timeoutMs) {
                    throw new Error('Connection timeout. Please try again.');
                }
                
                // Check if socket is still valid (generation check)
                if (!session.sock || session.generation < 1) {
                    throw new Error('Socket invalidated during readiness wait');
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Final generation check before proceeding
            const currentGeneration = session.generation;
            
            // Request pairing code from Baileys using the session's selected branded code
            // The phone number should be without the leading +
            const phoneNumber = session.phoneNumber.replace(/^\+/, '');
            
            // Use the pre-selected branded code for this session
            // ourin-baileys v9.0.21 supports customPairingCode as second parameter (8 chars)
            const pairingCode = await session.sock.requestPairingCode(phoneNumber, session.selectedBrandedCode);
            
            // Verify we're still on the same generation (socket wasn't recreated)
            if (session.generation !== currentGeneration) {
                logger.warn('Socket generation changed during pairing request', { 
                    sessionId, 
                    originalGeneration: currentGeneration,
                    currentGeneration: session.generation 
                });
                // Don't throw - the pairing code is still valid, just log the event
            }
            
            session.pairingCode = pairingCode;
            session.status = 'waiting_for_auth';

            // Update status in Supabase
            await this.supabase.updateSessionStatus(sessionId, 'waiting_for_auth', {
                pairing_code_requested_at: new Date().toISOString()
            });

            logger.info('Pairing code requested successfully', { 
                sessionId, 
                selectedBrandedCode: session.selectedBrandedCode 
            });

            return pairingCode;
        } catch (error) {
            logger.error('Failed to request pairing code', { sessionId, error: error.message });
            await this.supabase.updateSessionStatus(sessionId, 'failed', {
                error_message: error.message
            });
            throw error;
        } finally {
            session.pairingInProgress = false;
        }
    }

    /**
     * Get session status
     * @param {string} sessionId - Session identifier
     * @returns {Promise<object>} - Session status info (safe, no credentials)
     */
    async getSessionStatus(sessionId) {
        const sessionData = await this.supabase.getSession(sessionId);
        
        if (!sessionData) {
            return null;
        }

        // Return only safe information
        return {
            sessionId: sessionData.session_id,
            status: sessionData.status,
            phone: this._maskPhone(sessionData.phone_number),
            whatsappJid: sessionData.whatsapp_jid ? this._maskJid(sessionData.whatsapp_jid) : null,
            whatsappName: sessionData.whatsapp_name,
            createdAt: sessionData.created_at,
            updatedAt: sessionData.updated_at
        };
    }

    /**
     * Mask phone number for safe display
     */
    _maskPhone(phoneNumber) {
        if (!phoneNumber) return '***';
        const digits = phoneNumber.replace(/\D/g, '');
        if (digits.length <= 4) return '***';
        return `***${digits.slice(-4)}`;
    }

    /**
     * Mask JID for safe display
     */
    _maskJid(jid) {
        if (!jid) return '***';
        const parts = jid.split('@');
        if (parts[0].length <= 4) return `***@${parts[1] || 's.whatsapp.net'}`;
        return `***${parts[0].slice(-4)}@${parts[1] || 's.whatsapp.net'}`;
    }

    /**
     * Stop and cleanup a session
     * @param {string} sessionId - Session identifier
     */
    async stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            try {
                session.sock.end(undefined);
            } catch (error) {
                logger.warn('Error ending socket', { sessionId, error: error.message });
            }
            this.sessions.delete(sessionId);
        }

        await this.supabase.markDisconnected(sessionId, 'disconnected');
        logger.info('Session stopped', { sessionId });
    }

    /**
     * Setup connection event handlers for a session
     * Includes generation tracking to prevent stale socket events from corrupting state
     * @param {string} sessionId - Session identifier
     * @param {number} generation - Socket generation number (default: 1)
     */
    setupConnectionHandlers(sessionId, generation = 1) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const { sock } = session;
        const currentGeneration = session.generation;

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            // Generation guard: ignore events from stale sockets
            if (session.generation !== currentGeneration) {
                logger.debug('Ignoring stale socket event', { 
                    sessionId, 
                    eventGeneration: currentGeneration,
                    currentGeneration: session.generation 
                });
                return;
            }

            logger.info('Connection update', { 
                sessionId, 
                connection, 
                hasLastDisconnect: !!lastDisconnect,
                hasQR: !!qr,
                isNewLogin,
                generation: currentGeneration
            });

            // Mark connection as ready when open
            if (connection === 'open') {
                session.connectionReady = true;
                session.status = 'waiting_for_pairing';
                logger.info('Connection ready for pairing', { sessionId, generation: currentGeneration });
            }

            if (connection === 'close') {
                const baileys = await getBaileys();
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== baileys.DisconnectReason.loggedOut;

                if (statusCode === baileys.DisconnectReason.loggedOut) {
                    // User logged out from WhatsApp
                    session.status = 'logged_out';
                    await this.supabase.markDisconnected(sessionId, 'logged_out');
                    logger.info('Session logged out', { sessionId });
                    
                    // Cleanup
                    this.sessions.delete(sessionId);
                    return;
                }

                if (shouldReconnect && statusCode !== baileys.DisconnectReason.restartRequired) {
                    // Attempt reconnect with incremented generation
                    session.status = 'reconnecting';
                    session.connectionReady = false;
                    await this.supabase.updateSessionStatus(sessionId, 'reconnecting');
                    
                    try {
                        // Increment generation before creating new socket
                        session.generation++;
                        const newGeneration = session.generation;
                        
                        // Reconnect with same auth state
                        const state = await session.authState.init();
                        const { version } = await baileys.fetchLatestBaileysVersion();
                        
                        const newSock = baileys.makeWASocket({
                            version,
                            auth: state,
                            printQRInTerminal: false,
                            browser: ['Tanu Xai Session', 'Chrome', '120.0.0'],
                            markOnlineOnConnect: false
                        });

                        session.sock = newSock;
                        // Setup handlers with new generation - old handlers will be ignored due to generation check
                        this.setupConnectionHandlers(sessionId, newGeneration);
                        
                        logger.info('Socket reconnected with new generation', { 
                            sessionId, 
                            oldGeneration: currentGeneration,
                            newGeneration 
                        });
                    } catch (error) {
                        logger.error('Reconnection failed', { sessionId, error: error.message });
                        await this.supabase.markDisconnected(sessionId, 'reconnect_failed');
                    }
                    return;
                } else {
                    session.status = 'disconnected';
                    session.connectionReady = false;
                    await this.supabase.markDisconnected(sessionId, 'disconnected');
                    this.sessions.delete(sessionId);
                    return;
                }
            }

            if (connection === 'open') {
                // Connection successful - only set connected if not already in pairing flow
                if (session.status !== 'waiting_for_auth' && session.status !== 'pairing_requested') {
                    session.status = 'connected';
                    
                    // Get user info
                    const me = sock.user;
                    if (me?.id) {
                        await this.supabase.setAuthenticatedUser(
                            sessionId, 
                            me.id, 
                            me.name || me.notify
                        );
                        logger.info('Authentication complete', { sessionId, jid: me.id });
                    }
                }
            }
        });

        // Handle credentials update
        sock.ev.on('creds.update', async () => {
            try {
                await session.authState.saveCreds();
            } catch (error) {
                logger.error('Failed to save credentials on update', { sessionId, error: error.message });
            }
        });
    }

    /**
     * Get all active sessions
     * @returns {Promise<Array>} - List of session statuses
     */
    async getAllSessions() {
        const sessions = [];
        for (const sessionId of this.sessions.keys()) {
            const status = await this.getSessionStatus(sessionId);
            if (status) {
                sessions.push(status);
            }
        }
        return sessions;
    }

    /**
     * Cleanup expired/inactive sessions
     */
    async cleanupExpiredSessions() {
        await this.supabase.cleanupExpiredSessions(7);
        
        // Also cleanup in-memory sessions older than 1 hour that never authenticated
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.createdAt > oneHour && session.status !== 'connected') {
                await this.stopSession(sessionId);
                logger.info('Cleaned up expired session', { sessionId });
            }
        }
    }
}

module.exports = BaileysService;
