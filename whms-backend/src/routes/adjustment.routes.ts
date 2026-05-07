import { Router, Request, Response } from 'express';
import { adjustmentService } from '../services/adjustment.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const adjustment = await adjustmentService.create(req.body, userId);
        return res.status(201).json({ success: true, adjustment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason, itemId, warehouseId, locationId, startDate, endDate, page, limit } = req.query;
        const result = await adjustmentService.findAll({
            reason: reason as any,
            itemId: itemId as string,
            warehouseId: warehouseId as string,
            locationId: locationId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const adjustment = await adjustmentService.findById(String(req.params.id));
        if (!adjustment) return res.status(404).json({ error: 'Adjustment not found' });
        return res.json({ success: true, adjustment });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const userId = (req as any).user?.id;
        await adjustmentService.void(String(req.params.id), reason, userId);
        return res.json({ success: true, message: 'Adjustment voided' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
