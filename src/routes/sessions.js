import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { toApiError } from '../utils/errors.js';
import {
  startSession,
  getSessionStatus,
  cancelSession
} from '../services/session-manager.js';

export const sessionRouter = Router();

// Stricter rate limiter for creating new pairing sessions
const sessionCreateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.SESSION_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many session requests from this IP. Please try again in 15 minutes.'
    }
  }
});

/**
 * POST /api/session/start
 * Start a new pairing code or QR code session.
 */
sessionRouter.post('/start', sessionCreateLimiter, async (req, res) => {
  try {
    const { mode = 'pairing', phoneNumber } = req.body || {};
    const result = await startSession({ mode, phoneNumber });
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    const apiError = toApiError(err);
    res.status(err.statusCode || 400).json(apiError);
  }
});

/**
 * POST /api/pair (alias for /api/session/start with mode: 'pairing')
 */
sessionRouter.post('/pair', sessionCreateLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const result = await startSession({ mode: 'pairing', phoneNumber });
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    const apiError = toApiError(err);
    res.status(err.statusCode || 400).json(apiError);
  }
});

/**
 * GET /api/session/:id/status
 * Poll current status of an active session.
 */
sessionRouter.get('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const status = getSessionStatus(id);
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    const apiError = toApiError(err);
    res.status(err.statusCode || 404).json(apiError);
  }
});

/**
 * POST /api/session/:id/cancel
 * Cancel an ongoing session.
 */
sessionRouter.post('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const result = cancelSession(id);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    const apiError = toApiError(err);
    res.status(err.statusCode || 400).json(apiError);
  }
});
