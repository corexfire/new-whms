import { Router, Request, Response } from 'express';
import { offlineSyncService } from '../services/offline-sync.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/queue', authMiddleware, async (req: Request, res: Response) => {
    try {
        const action = await offlineSyncService.queueAction(req.body);
        return res.status(201).json({ success: true, action });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/queue-bulk', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { actions } = req.body;
        if (!Array.isArray(actions)) {
            return res.status(400).json({ error: 'Actions must be an array' });
        }
        const result = await offlineSyncService.queueBulk(actions);
        return res.status(201).json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/process', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { maxBatch } = req.body;
        const result = await offlineSyncService.processPending(maxBatch);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/retry-failed', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { maxRetries } = req.body;
        const result = await offlineSyncService.retryFailed(maxRetries);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/cleanup', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { daysOld } = req.body;
        const result = await offlineSyncService.cleanup(daysOld);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { since } = req.query;
        const status = await offlineSyncService.getStatus(
            since ? new Date(since as string) : undefined
        );
        return res.json({ success: true, ...status });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/resolve', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { resolution } = req.body;
        if (!['APPLY', 'DISCARD'].includes(resolution)) {
            return res.status(400).json({ error: 'Invalid resolution. Use APPLY or DISCARD' });
        }
        const result = await offlineSyncService.resolveConflict(req.params.id, resolution);
        return res.json({ success: true, result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
