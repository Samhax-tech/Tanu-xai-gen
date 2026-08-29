const express = require('express');
const router = express.Router();
const { validatePhoneNumber } = require('../utils/phone');
const logger = require('../utils/logger');

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

                // Create session
                const result = await this.baileysService.createSession(validation.normalized);
                
                // Setup connection handlers immediately after session creation
                this.baileysService.setupConnectionHandlers(result.sessionId);

                logger.info('Session start requested', { sessionId: result.sessionId });

                res.json({
                    success: true,
                    sessionId: result.sessionId
                });
            } catch (error) {
                logger.error('Failed to start session', { error: error.message });
                res.status(500).json({
                    error: 'Failed to start session',
                    message: error.message
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

                // If already have pairing code, return it
                if (session.pairingCode) {
                    logger.info('Returning existing pairing code', { sessionId });
                    return res.json({
                        success: true,
                        pairingCode: session.pairingCode
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
                res.status(500).json({
                    error: 'Failed to request pairing code',
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

module.exports = SessionRoutes;
