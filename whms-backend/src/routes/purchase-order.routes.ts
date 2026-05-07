import { Router, Request, Response } from 'express';
import { purchaseOrderService } from '../services/purchase-order.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const po = await purchaseOrderService.create(req.body);
        return res.status(201).json({ success: true, po });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, supplierId, search, startDate, endDate, page, limit } = req.query;
        const result = await purchaseOrderService.findAll({
            status: status as any,
            supplierId: supplierId as string,
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

router.get('/number/:poNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const po = await purchaseOrderService.findByNumber(String(req.params.poNumber));
        if (!po) return res.status(404).json({ error: 'PO not found' });
        return res.json({ success: true, po });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const po = await purchaseOrderService.findById(String(req.params.id));
        if (!po) return res.status(404).json({ error: 'PO not found' });
        return res.json({ success: true, po });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/summary', authMiddleware, async (req: Request, res: Response) => {
    try {
        const summary = await purchaseOrderService.getReceivedSummary(String(req.params.id));
        return res.json({ success: true, summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const po = await purchaseOrderService.update(String(req.params.id), req.body);
        return res.json({ success: true, po });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/:id/status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const po = await purchaseOrderService.updateStatus(String(req.params.id), status);
        return res.json({ success: true, po });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await purchaseOrderService.addItem(String(req.params.id), req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await purchaseOrderService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await purchaseOrderService.removeItem(String(req.params.itemId));
        return res.json({ success: true, message: 'Item removed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await purchaseOrderService.delete(String(req.params.id));
        return res.json({ success: true, message: 'PO deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
