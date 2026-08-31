import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { logger, child } from './utils/logger.js';
import { ErrorCodes } from './utils/errors.js';
import healthRouter from './routes/health.js';
import sessionsRouter from './routes/sessions.js';
import { shutdownAll } from './services/session-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = child({ module: 'server' });

const app = express();

// Railway sits behind a reverse proxy; trust exactly one hop so
// express-rate-limit and req.ip read the real client IP from X-Forwarded-For
// without blindly trusting arbitrary spoofed proxy chains.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '32kb' }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: ErrorCodes.RATE_LIMITED, message: 'Too many requests.' } }
});
app.use('/api', generalLimiter);

app.use('/api', healthRouter);
app.use('/api', sessionsRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

// Final safety net: never leak stack traces to the client.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  log.error({ err: err.message }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Something went wrong.' }
  });
});

const server = app.listen(env.port, '0.0.0.0', () => {
  log.info({ port: env.port, env: env.nodeEnv }, 'Tanu-XAI session generator listening');
});

async function gracefulShutdown(signal) {
  log.info({ signal }, 'Shutting down');
  await shutdownAll();
  server.close(() => process.exit(0));
  // Force-exit if something is still hanging after 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
