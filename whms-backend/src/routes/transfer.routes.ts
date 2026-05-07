import { Router, Request, Response } from 'express';
import { transferService } from '../services/transfer.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const transfer = await transferService.create(req.body);
        return res.status(201).json({ success: true, transfer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const transfer = await transferService.update(String(req.params.id), req.body);
        return res.json({ success: true, transfer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await transferService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Transfer deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, warehouseId, startDate, endDate, page, limit } = req.query;
        const result = await transferService.findAll({
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
        const transfer = await transferService.findById(String(req.params.id));
        if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
        return res.json({ success: true, transfer });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/submit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const transfer = await transferService.submit(String(req.params.id));
        return res.json({ success: true, transfer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/start-transit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const transfer = await transferService.startTransit(String(req.params.id));
        return res.json({ success: true, transfer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const transfer = await transferService.complete(String(req.params.id), userId);
        return res.json({ success: true, transfer, message: 'Transfer completed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const transfer = await transferService.cancel(String(req.params.id), reason);
        return res.json({ success: true, transfer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
