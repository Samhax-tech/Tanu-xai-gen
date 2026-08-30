import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Supabase client for persistent authentication state storage
 */
class SupabaseService {
    constructor() {
        if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
        }

        this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            global: {
                fetch: (...args) => {
                    const headers = args[1]?.headers || {};
                    return fetch(...args);
                }
            },
            realtime: {
                transport: ws
            }
        });

        logger.info('Supabase client initialized', { 
            url: config.supabaseUrl ? '[configured]' : '[missing]' 
        });
    }

    /**
     * Create a new session record
     * @param {string} sessionId - Unique session identifier
     * @param {string} phoneNumber - Normalized phone number
     * @returns {Promise<{id: string, created_at: string}>}
     */
    async createSession(sessionId, phoneNumber) {
        try {
            const { data, error } = await this.client
                .from('sessions')
                .insert({
                    session_id: sessionId,
                    phone_number: phoneNumber,
                    status: 'created'
                })
                .select('id, created_at')
                .single();

            if (error) {
                logger.error('Failed to create session in Supabase', { error: error.message });
                throw error;
            }

            logger.info('Session created in Supabase', { sessionId });
            return data;
        } catch (error) {
            logger.error('Error creating session', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Update session status
     * @param {string} sessionId - Session identifier
     * @param {string} status - New status
     * @param {object} [metadata] - Optional metadata to update
     */
    async updateSessionStatus(sessionId, status, metadata = {}) {
        try {
            const updateData = {
                status,
                updated_at: new Date().toISOString(),
                ...metadata
            };

            const { error } = await this.client
                .from('sessions')
                .update(updateData)
                .eq('session_id', sessionId);

            if (error) {
                logger.error('Failed to update session status', { sessionId, error: error.message });
                throw error;
            }

            logger.info('Session status updated', { sessionId, status });
        } catch (error) {
            logger.error('Error updating session status', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Get session by ID
     * @param {string} sessionId - Session identifier
     * @returns {Promise<object|null>}
     */
    async getSession(sessionId) {
        try {
            const { data, error } = await this.client
                .from('sessions')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Row not found
                    return null;
                }
                logger.error('Failed to get session', { sessionId, error: error.message });
                throw error;
            }

            return data;
        } catch (error) {
            logger.error('Error getting session', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Store Baileys auth credentials (creds)
     * Uses upsert to handle concurrent updates safely
     * @param {string} sessionId - Session identifier
     * @param {object} creds - Baileys authentication credentials
     */
    async storeAuthCreds(sessionId, creds) {
        try {
            const { error } = await this.client
                .from('auth_credentials')
                .upsert({
                    session_id: sessionId,
                    creds: creds,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'session_id'
                });

            if (error) {
                logger.error('Failed to store auth credentials', { sessionId, error: error.message });
                throw error;
            }

            logger.info('Auth credentials stored', { sessionId });
        } catch (error) {
            logger.error('Error storing auth credentials', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Get Baileys auth credentials
     * @param {string} sessionId - Session identifier
     * @returns {Promise<object|null>}
     */
    async getAuthCreds(sessionId) {
        try {
            const { data, error } = await this.client
                .from('auth_credentials')
                .select('creds')
                .eq('session_id', sessionId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                logger.error('Failed to get auth credentials', { sessionId, error: error.message });
                throw error;
            }

            return data?.creds || null;
        } catch (error) {
            logger.error('Error getting auth credentials', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Store a single key type (pre-key, session, sender-key, etc.)
     * Uses targeted upsert to avoid race conditions
     * @param {string} sessionId - Session identifier
     * @param {string} keyType - Type of key (pre-key, session, sender-key, etc.)
     * @param {string} keyId - Key identifier
     * @param {object} keyData - Key data
     */
    async storeKey(sessionId, keyType, keyId, keyData) {
        try {
            const { error } = await this.client
                .from('auth_keys')
                .upsert({
                    session_id: sessionId,
                    key_type: keyType,
                    key_id: keyId,
                    key_data: keyData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'session_id, key_type, key_id'
                });

            if (error) {
                logger.error('Failed to store key', { sessionId, keyType, keyId, error: error.message });
                throw error;
            }
        } catch (error) {
            logger.error('Error storing key', { sessionId, keyType, keyId, error: error.message });
            throw error;
        }
    }

    /**
     * Get keys by type for a session
     * @param {string} sessionId - Session identifier
     * @param {string} keyType - Type of key
     * @param {string[]} keyIds - Array of key IDs to retrieve
     * @returns {Promise<object>} - Map of keyId -> keyData
     */
    async getKeys(sessionId, keyType, keyIds) {
        try {
            const { data, error } = await this.client
                .from('auth_keys')
                .select('key_id, key_data')
                .eq('session_id', sessionId)
                .eq('key_type', keyType)
                .in('key_id', keyIds);

            if (error) {
                logger.error('Failed to get keys', { sessionId, keyType, error: error.message });
                throw error;
            }

            const result = {};
            for (const row of data || []) {
                result[row.key_id] = row.key_data;
            }
            return result;
        } catch (error) {
            logger.error('Error getting keys', { sessionId, keyType, error: error.message });
            throw error;
        }
    }

    /**
     * Delete a key
     * @param {string} sessionId - Session identifier
     * @param {string} keyType - Type of key
     * @param {string} keyId - Key identifier
     */
    async deleteKey(sessionId, keyType, keyId) {
        try {
            const { error } = await this.client
                .from('auth_keys')
                .delete()
                .eq('session_id', sessionId)
                .eq('key_type', keyType)
                .eq('key_id', keyId);

            if (error) {
                logger.error('Failed to delete key', { sessionId, keyType, keyId, error: error.message });
                throw error;
            }
        } catch (error) {
            logger.error('Error deleting key', { sessionId, keyType, keyId, error: error.message });
            throw error;
        }
    }

    /**
     * Get all keys for a session
     * @param {string} sessionId - Session identifier
     * @returns {Promise<object>} - Keys organized by type
     */
    async getAllKeys(sessionId) {
        try {
            const { data, error } = await this.client
                .from('auth_keys')
                .select('key_type, key_id, key_data')
                .eq('session_id', sessionId);

            if (error) {
                logger.error('Failed to get all keys', { sessionId, error: error.message });
                throw error;
            }

            const result = {};
            for (const row of data || []) {
                if (!result[row.key_type]) {
                    result[row.key_type] = {};
                }
                result[row.key_type][row.key_id] = row.key_data;
            }
            return result;
        } catch (error) {
            logger.error('Error getting all keys', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Update session with authenticated user info
     * @param {string} sessionId - Session identifier
     * @param {string} jid - WhatsApp JID
     * @param {string} name - Display name (optional)
     */
    async setAuthenticatedUser(sessionId, jid, name = null) {
        try {
            const { error } = await this.client
                .from('sessions')
                .update({
                    whatsapp_jid: jid,
                    whatsapp_name: name,
                    status: 'connected',
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId);

            if (error) {
                logger.error('Failed to set authenticated user', { sessionId, error: error.message });
                throw error;
            }

            logger.info('Authenticated user stored', { sessionId, jid });
        } catch (error) {
            logger.error('Error setting authenticated user', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Mark session as expired or disconnected
     * @param {string} sessionId - Session identifier
     * @param {string} reason - Reason for disconnection
     */
    async markDisconnected(sessionId, reason = 'disconnected') {
        try {
            const { error } = await this.client
                .from('sessions')
                .update({
                    status: reason,
                    disconnected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId);

            if (error) {
                logger.error('Failed to mark session disconnected', { sessionId, error: error.message });
                throw error;
            }

            logger.info('Session marked disconnected', { sessionId, reason });
        } catch (error) {
            logger.error('Error marking session disconnected', { sessionId, error: error.message });
            throw error;
        }
    }

    /**
     * Clean up old expired sessions
     * @param {number} daysOld - Sessions older than this many days will be deleted
     */
    async cleanupExpiredSessions(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { error } = await this.client
                .from('sessions')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .in('status', ['created', 'requesting_pairing_code', 'waiting_for_auth']);

            if (error) {
                logger.error('Failed to cleanup expired sessions', { error: error.message });
                throw error;
            }

            logger.info('Expired sessions cleaned up', { daysOld });
        } catch (error) {
            logger.error('Error cleaning up expired sessions', { error: error.message });
            throw error;
        }
    }
}

export default SupabaseService;
