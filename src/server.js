import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { sessionRouter } from './routes/sessions.js';
import healthRouter from './routes/health.js';
import { initSessionStorage } from './services/session-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Validate environment variables
validateEnv();

// Initialize temporary directory cleanup on startup
initSessionStorage();

const app = express();

// Security middleware with custom CSP for React + Vite SPA
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global API rate limiter
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.'
    }
  }
});

// Mount health and API routes FIRST
app.use('/api', healthRouter);
app.use('/api/session', sessionRouter);
app.use('/api/pair', sessionRouter); // Direct pairing alias

// Serve frontend: Use Vite middleware in development, or compiled dist/ in production
if (process.env.NODE_ENV !== 'production' && !process.env.SERVE_STATIC_ONLY) {
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    logger.info('Vite development middleware integrated into Express');
  } catch (err) {
    logger.warn({ err }, 'Vite middleware unavailable, serving dist/');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }
} else if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      service: 'Tanu-XAI Session Generator API (Baileys v7.0.0-rc14)',
      status: 'online',
      message: 'Run npm run build to compile the React frontend.'
    });
  });
}

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err, url: req.originalUrl }, 'Unhandled Express server error');
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected internal server error occurred.'
    }
  });
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `⚡ Tanu-XAI Session Generator (Baileys v7.0.0-rc14) running on http://0.0.0.0:${env.PORT}`
  );
});

// Graceful shutdown handlers
function handleGracefulShutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcing process shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
