import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import config from './config/env.js';
import logger from './utils/logger.js';
import BaileysService from './services/baileys.js';
import healthRoutes from './routes/health.js';
import SessionRoutes from './routes/sessions.js';

/**
 * Main Express server for Tanu Xai Session Generator
 */
class Server {
    constructor() {
        this.app = express();
        this.baileysService = new BaileysService();
        this.server = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupGracefulShutdown();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Trust Railway's reverse proxy with explicit loopback + unique configuration
        // This prevents ERR_ERL_PERMISSIVE_TRUST_PROXY while maintaining correct IP detection
        this.app.set('trust proxy', ['loopback', 'uniquelocal']);

        // Security headers
        this.app.use(helmet({
            contentSecurityPolicy: false, // Allow inline styles/scripts for simple frontend
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: false
        }));

        // Rate limiting - configured AFTER trust proxy
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests, please try again later'
            },
            standardHeaders: true,
            legacyHeaders: false,
            validate: { xForwardedForHeader: true } // Explicit validation for Railway proxy
        });
        this.app.use(limiter);

        // Stricter rate limit for session creation
        const sessionLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10, // Limit each IP to 10 session creations per hour
            message: {
                error: 'Too many session creation attempts, please try again later'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: ipKeyGenerator(), // Properly handle IPv6 addresses
            validate: { xForwardedForHeader: false } // Disable X-Forwarded-For validation since we use specific trust proxy
        });

        // Body parsing
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Static files
        this.app.use(express.static(join(__dirname, '../public')));

        // Apply session limiter to session start endpoint only
        this.app.use('/api/session/start', sessionLimiter);
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check
        this.app.use('/api/health', healthRoutes);

        // Session routes
        const sessionRoutes = new SessionRoutes(this.baileysService);
        this.app.use('/api/session', sessionRoutes.getRouter());

        // Serve index.html for root
        this.app.get('/', (req, res) => {
            res.sendFile(join(__dirname, '../public/index.html'));
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not found'
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            logger.error('Unhandled error', { error: err.message, stack: err.stack });
            
            if (config.nodeEnv === 'development') {
                res.status(500).json({
                    error: err.message,
                    stack: err.stack
                });
            } else {
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);

            // Stop accepting new connections
            if (this.server) {
                this.server.close(async () => {
                    logger.info('HTTP server closed');

                    // Cleanup all active sessions
                    logger.info('Cleaning up active sessions...');
                    for (const sessionId of this.baileysService.sessions.keys()) {
                        try {
                            await this.baileysService.stopSession(sessionId);
                        } catch (error) {
                            logger.warn('Error stopping session during shutdown', { sessionId, error: error.message });
                        }
                    }

                    // Exit process
                    process.exit(0);
                });

                // Force close after timeout
                setTimeout(() => {
                    logger.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 30000);
            } else {
                process.exit(0);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }

    /**
     * Start the server
     */
    start() {
        const port = config.port;

        this.server = this.app.listen(port, () => {
            logger.info('Tanu Xai Session Generator started', { 
                port, 
                env: config.nodeEnv 
            });
            logger.info('Server ready', { 
                url: `http://localhost:${port}` 
            });
        });

        // Periodic cleanup of expired sessions
        setInterval(() => {
            this.baileysService.cleanupExpiredSessions().catch(err => {
                logger.error('Cleanup error', { error: err.message });
            });
        }, 60 * 60 * 1000); // Every hour

        return this.server;
    }

    /**
     * Get the Express app instance
     */
    getApp() {
        return this.app;
    }
}

export default Server;

// Start the server when run directly
const server = new Server();
server.start();
