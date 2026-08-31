import { Router } from 'express';
import { activeSessionCount } from '../services/session-manager.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tanu-xai-session-generator',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessionCount()
  });
});

export default router;
