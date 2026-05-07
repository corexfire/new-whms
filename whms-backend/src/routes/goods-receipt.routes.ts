import { Router, Request, Response } from 'express';
import { goodsReceiptService } from '../services/goods-receipt.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const grn = await goodsReceiptService.create(req.body);
        return res.status(201).json({ success: true, grn });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, purchaseOrderId, startDate, endDate, page, limit } = req.query;
        const result = await goodsReceiptService.findAll({
            status: status as any,
            purchaseOrderId: purchaseOrderId as string,
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

router.get('/number/:grnNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const grn = await goodsReceiptService.findByNumber(String(req.params.grnNumber));
        if (!grn) return res.status(404).json({ error: 'GRN not found' });
        return res.json({ success: true, grn });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const grn = await goodsReceiptService.findById(String(req.params.id));
        if (!grn) return res.status(404).json({ error: 'GRN not found' });
        return res.json({ success: true, grn });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const grn = await goodsReceiptService.update(String(req.params.id), req.body);
        return res.json({ success: true, grn });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await goodsReceiptService.delete(String(req.params.id));
        return res.json({ success: true, message: 'GRN deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { locationId } = req.body;
        const userId = (req as any).user?.id;

        if (!locationId) {
            return res.status(400).json({ error: 'locationId is required' });
        }

        const grn = await goodsReceiptService.complete(String(req.params.id), locationId, userId);
        return res.json({ success: true, grn, message: 'GRN completed, stock updated, journal posted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const userId = (req as any).user?.id;

        if (!reason) {
            return res.status(400).json({ error: 'Reason is required' });
        }

        await goodsReceiptService.void(String(req.params.id), reason, userId);
        return res.json({ success: true, message: 'GRN voided' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await goodsReceiptService.addItem(String(req.params.id), req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await goodsReceiptService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await goodsReceiptService.removeItem(String(req.params.itemId));
        return res.json({ success: true, message: 'Item removed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
