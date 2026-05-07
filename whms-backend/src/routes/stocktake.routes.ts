import { Router, Request, Response } from 'express';
import { stocktakeService } from '../services/stocktake.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const stocktake = await stocktakeService.create(req.body);
        return res.status(201).json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, warehouseId, startDate, endDate, page, limit } = req.query;
        const result = await stocktakeService.findAll({
            status: status as any,
            warehouseId: warehouseId as string,
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
        const stocktake = await stocktakeService.findById(String(req.params.id));
        if (!stocktake) return res.status(404).json({ error: 'Stocktake not found' });
        return res.json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/discrepancies', authMiddleware, async (req: Request, res: Response) => {
    try {
        const discrepancies = await stocktakeService.getDiscrepancies(String(req.params.id));
        return res.json({ success: true, discrepancies });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const stocktake = await stocktakeService.startCounting(String(req.params.id));
        return res.json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/submit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { counts } = req.body;
        const stocktake = await stocktakeService.submitCount(String(req.params.id), counts);
        return res.json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/approve', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const stocktake = await stocktakeService.approve(String(req.params.id), String(userId));
        return res.json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/reject', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const stocktake = await stocktakeService.reject(String(req.params.id), reason);
        return res.json({ success: true, stocktake });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/apply', authMiddleware, async (req: Request, res: Response) => {
    try {
        const stocktake = await stocktakeService.applyAdjustments(String(req.params.id));
        return res.json({ success: true, stocktake, message: 'Adjustments applied' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
