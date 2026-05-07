import { Router, Request, Response } from 'express';
import { salesOrderService } from '../services/sales-order.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const so = await salesOrderService.create(req.body);
        return res.status(201).json({ success: true, so });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, customerId, search, startDate, endDate, page, limit } = req.query;
        const result = await salesOrderService.findAll({
            status: status as any,
            customerId: customerId as string,
            search: search as string,
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

router.get('/number/:soNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const so = await salesOrderService.findByNumber(String(req.params.soNumber));
        if (!so) return res.status(404).json({ error: 'SO not found' });
        return res.json({ success: true, so });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const so = await salesOrderService.findById(String(req.params.id));
        if (!so) return res.status(404).json({ error: 'SO not found' });
        return res.json({ success: true, so });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/allocation', authMiddleware, async (req: Request, res: Response) => {
    try {
        const summary = await salesOrderService.getAllocationSummary(String(req.params.id));
        return res.json({ success: true, summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const so = await salesOrderService.update(String(req.params.id), req.body);
        return res.json({ success: true, so });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/:id/status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const so = await salesOrderService.updateStatus(String(req.params.id), status);
        return res.json({ success: true, so });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await salesOrderService.addItem(String(req.params.id), req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await salesOrderService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await salesOrderService.removeItem(String(req.params.itemId));
        return res.json({ success: true, message: 'Item removed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await salesOrderService.delete(String(req.params.id));
        return res.json({ success: true, message: 'SO deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
