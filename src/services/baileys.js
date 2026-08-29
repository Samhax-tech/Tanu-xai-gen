const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    initAuthCreds
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
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
     * Create a new session and start Baileys connection
     * @param {string} phoneNumber - Normalized phone number
     * @returns {Promise<{sessionId: string, pairingCode?: string}>}
     */
    async createSession(phoneNumber) {
        const sessionId = this.generateSessionId();
        
        // Create session record in Supabase
        await this.supabase.createSession(sessionId, phoneNumber);

        // Initialize auth state
        const authState = new SupabaseAuthState(sessionId, this.supabase);
        const state = await authState.init();

        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();

        // Create Baileys socket
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Tanu Xai Session', 'Chrome', '120.0.0'],
            markOnlineOnConnect: false
        });

        // Store session info
        this.sessions.set(sessionId, {
            sock,
            authState,
            phoneNumber,
            status: 'created',
            pairingCode: null,
            createdAt: Date.now(),
            connectionReady: false
        });

        logger.info('Session created', { sessionId });

        return { sessionId };
    }

    /**
     * Request pairing code for a session
     * Waits for WebSocket connection to be ready before requesting
     * @param {string} sessionId - Session identifier
     * @returns {Promise<string>} - Pairing code
     */
    async requestPairingCode(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }

        if (session.pairingCode) {
            logger.info('Returning existing pairing code', { sessionId });
            return session.pairingCode;
        }

        // Prevent concurrent pairing requests
        if (session.pairingInProgress) {
            logger.warn('Pairing already in progress', { sessionId });
            throw new Error('Pairing code request already in progress');
        }

        // Update status
        await this.supabase.updateSessionStatus(sessionId, 'requesting_pairing_code');
        session.status = 'requesting_pairing_code';
        session.pairingInProgress = true;

        try {
            // Wait for connection to be ready (max 30 seconds)
            let attempts = 0;
            const maxAttempts = 300; // 30 seconds with 100ms intervals
            
            while (!session.connectionReady && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!session.connectionReady) {
                throw new Error('Connection not ready. Please try again.');
            }

            // Request pairing code from Baileys
            // The phone number should be without the leading +
            const phoneNumber = session.phoneNumber.replace(/^\+/, '');
            
            // Use custom pairing code identifier if supported by Baileys v7.0.0-rc14+
            // The second parameter is an optional 8-character companion display identifier
            // We use 'HAXTAN13' as our branding identifier
            const pairingCode = await session.sock.requestPairingCode(phoneNumber, 'HAXTAN13');
            
            session.pairingCode = pairingCode;
            session.status = 'waiting_for_auth';

            // Update status in Supabase
            await this.supabase.updateSessionStatus(sessionId, 'waiting_for_auth', {
                pairing_code_requested_at: new Date().toISOString()
            });

            logger.info('Pairing code requested successfully', { sessionId });

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
     * @param {string} sessionId - Session identifier
     */
    setupConnectionHandlers(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const { sock } = session;

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            logger.info('Connection update', { 
                sessionId, 
                connection, 
                hasLastDisconnect: !!lastDisconnect,
                hasQR: !!qr,
                isNewLogin 
            });

            // Mark connection as ready when open
            if (connection === 'open') {
                session.connectionReady = true;
                logger.info('Connection ready for pairing', { sessionId });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (statusCode === DisconnectReason.loggedOut) {
                    // User logged out from WhatsApp
                    session.status = 'logged_out';
                    await this.supabase.markDisconnected(sessionId, 'logged_out');
                    logger.info('Session logged out', { sessionId });
                    
                    // Cleanup
                    this.sessions.delete(sessionId);
                    return;
                }

                if (shouldReconnect && statusCode !== DisconnectReason.restartRequired) {
                    // Attempt reconnect
                    session.status = 'reconnecting';
                    session.connectionReady = false;
                    await this.supabase.updateSessionStatus(sessionId, 'reconnecting');
                    
                    try {
                        // Reconnect with same auth state
                        const state = await session.authState.init();
                        const { version } = await fetchLatestBaileysVersion();
                        
                        const newSock = makeWASocket({
                            version,
                            auth: state,
                            printQRInTerminal: false,
                            browser: ['Tanu Xai Session', 'Chrome', '120.0.0'],
                            markOnlineOnConnect: false
                        });

                        session.sock = newSock;
                        this.setupConnectionHandlers(sessionId);
                    } catch (error) {
                        logger.error('Reconnection failed', { sessionId, error: error.message });
                        await this.supabase.markDisconnected(sessionId, 'reconnect_failed');
                    }
                } else {
                    session.status = 'disconnected';
                    session.connectionReady = false;
                    await this.supabase.markDisconnected(sessionId, 'disconnected');
                    this.sessions.delete(sessionId);
                }
            }

            if (connection === 'open') {
                // Connection successful
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
