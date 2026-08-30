import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

import { validatePhoneNumber } from '../utils/phone.js';
import logger from '../utils/logger.js';

/**
 * Session routes for managing WhatsApp pairing code sessions
 */
class SessionRoutes {
    constructor(baileysService) {
        this.baileysService = baileysService;
        this.setupRoutes();
    }

    setupRoutes() {
        /**
         * POST /api/session/start
         * Start a new session with phone number
         * Handlers are attached in createSession automatically
         */
        this.router.post('/start', async (req, res) => {
            try {
                const { phoneNumber } = req.body;

                if (!phoneNumber) {
                    return res.status(400).json({
                        error: 'Phone number is required'
                    });
                }

                // Validate phone number
                const validation = validatePhoneNumber(phoneNumber);
                if (!validation.valid) {
                    return res.status(400).json({
                        error: validation.error
                    });
                }

                // Create session (handlers attached automatically inside createSession)
                const result = await this.baileysService.createSession(validation.normalized);

                logger.info('Session start requested', { sessionId: result.sessionId });

                res.json({
                    success: true,
                    sessionId: result.sessionId
                });
            } catch (error) {
                logger.error('Failed to start session', { error: error.message });
                res.status(500).json({
                    error: 'SESSION_START_FAILED',
                    message: 'Failed to initialize WhatsApp session. Please try again.'
                });
            }
        });

        /**
         * POST /api/session/:sessionId/pairing-code
         * Request pairing code for an existing session
         * Automatically triggers pairing code request when socket is ready
         */
        this.router.post('/:sessionId/pairing-code', async (req, res) => {
            try {
                const { sessionId } = req.params;

                // Check if session exists in memory
                const session = this.baileysService.sessions.get(sessionId);
                if (!session) {
                    return res.status(404).json({
                        error: 'Session not found or expired'
                    });
                }

                // If already connected, don't generate another code
                if (session.status === 'connected') {
                    logger.info('Session already connected', { sessionId });
                    return res.status(400).json({
                        error: 'SESSION_ALREADY_CONNECTED',
                        message: 'This session is already connected. No new pairing code needed.'
                    });
                }

                // If already have pairing code, return it
                if (session.pairingCode) {
                    logger.info('Returning existing pairing code', { sessionId });
                    return res.json({
                        success: true,
                        pairingCode: session.pairingCode
                    });
                }

                // Check if pairing is currently being generated
                if (session.pairingInProgress) {
                    logger.info('Pairing already in progress', { sessionId });
                    return res.status(409).json({
                        error: 'PAIRING_IN_PROGRESS',
                        message: 'Pairing code generation is already in progress. Please wait.'
                    });
                }

                // Request pairing code (waits for socket readiness internally)
                const pairingCode = await this.baileysService.requestPairingCode(sessionId);

                logger.info('Pairing code requested', { sessionId });

                res.json({
                    success: true,
                    pairingCode
                });
            } catch (error) {
                logger.error('Failed to request pairing code', { 
                    sessionId: req.params.sessionId, 
                    error: error.message 
                });
                
                // Handle specific error types with appropriate status codes
                let statusCode = 500;
                let errorCode = 'PAIRING_REQUEST_FAILED';
                
                if (error.message.includes('timeout')) {
                    statusCode = 408;
                    errorCode = 'PAIRING_TIMEOUT';
                } else if (error.message.includes('not found')) {
                    statusCode = 404;
                    errorCode = 'SESSION_NOT_FOUND';
                } else if (error.message.includes('Socket invalidated')) {
                    statusCode = 409;
                    errorCode = 'STALE_SOCKET';
                } else if (error.message.includes('already requested')) {
                    statusCode = 409;
                    errorCode = 'PAIRING_ALREADY_REQUESTED';
                }
                
                res.status(statusCode).json({
                    error: errorCode,
                    message: error.message
                });
            }
        });

        /**
         * GET /api/session/:sessionId/status
         * Get session status
         */
        this.router.get('/:sessionId/status', async (req, res) => {
            try {
                const { sessionId } = req.params;

                const status = await this.baileysService.getSessionStatus(sessionId);

                if (!status) {
                    return res.status(404).json({
                        error: 'Session not found'
                    });
                }

                res.json(status);
            } catch (error) {
                logger.error('Failed to get session status', { 
                    sessionId: req.params.sessionId, 
                    error: error.message 
                });
                res.status(500).json({
                    error: 'Failed to get session status',
                    message: error.message
                });
            }
        });

        /**
         * POST /api/session/:sessionId/stop
         * Stop and cleanup a session
         */
        this.router.post('/:sessionId/stop', async (req, res) => {
            try {
                const { sessionId } = req.params;

                await this.baileysService.stopSession(sessionId);

                logger.info('Session stopped', { sessionId });

                res.json({
                    success: true,
                    message: 'Session stopped'
                });
            } catch (error) {
                logger.error('Failed to stop session', { 
                    sessionId: req.params.sessionId, 
                    error: error.message 
                });
                res.status(500).json({
                    error: 'Failed to stop session',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/session/list
         * List all active sessions
         */
        this.router.get('/list', async (req, res) => {
            try {
                const sessions = await this.baileysService.getAllSessions();

                res.json({
                    success: true,
                    count: sessions.length,
                    sessions
                });
            } catch (error) {
                logger.error('Failed to list sessions', { error: error.message });
                res.status(500).json({
                    error: 'Failed to list sessions',
                    message: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

// Initialize router
SessionRoutes.prototype.router = router;

export default SessionRoutes;
