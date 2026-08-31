import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { normalizePhoneNumber } from '../utils/phone.js';
import {
  startSession,
  getSessionPublic,
  getSessionStatus,
  stopSession,
  isPhoneNumberActive
} from '../services/session-manager.js';
import { AppError, ErrorCodes, toApiError } from '../utils/errors.js';
import { child } from '../utils/logger.js';

const log = child({ module: 'routes:sessions' });
const router = Router();

// Session creation is far more expensive and abuse-prone than a read, so it
// gets its own, much stricter limit on top of the general API limiter.
const createSessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: ErrorCodes.RATE_LIMITED, message: 'Too many session requests. Try again later.' } }
});

router.post('/session/start', createSessionLimiter, async (req, res) => {
  try {
    const normalized = normalizePhoneNumber(req.body?.phoneNumber);

    if (isPhoneNumberActive(normalized)) {
      throw new AppError(
        ErrorCodes.SESSION_ALREADY_ACTIVE,
        'A session for this phone number is already being paired.',
        409
      );
    }

    const result = await startSession(normalized);
    res.json({ success: true, ...result });
  } catch (err) {
    if (!(err instanceof AppError)) {
      log.error({ err: err.message }, 'Unexpected error in /session/start');
    }
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json(toApiError(err));
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await getSessionPublic(req.params.sessionId);
    res.json({ success: true, session });
  } catch (err) {
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json(toApiError(err));
  }
});

router.get('/session/:sessionId/status', async (req, res) => {
  try {
    const status = await getSessionStatus(req.params.sessionId);
    res.json(status);
  } catch (err) {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    res.status(statusCode).json(toApiError(err));
  }
});

router.delete('/session/:sessionId', async (req, res) => {
  try {
    await stopSession(req.params.sessionId, { deleteAuth: req.query.deleteAuth !== 'false' });
    res.json({ success: true });
  } catch (err) {
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json(toApiError(err));
  }
});

export default router;
