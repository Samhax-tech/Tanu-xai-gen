import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Tanu Xai Session Generator',
        timestamp: new Date().toISOString()
    });
});

export default router;
