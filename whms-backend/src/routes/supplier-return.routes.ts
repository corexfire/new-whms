import { Router, Request, Response } from 'express';
import { supplierReturnService } from '../services/supplier-return.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await supplierReturnService.create(req.body);
        return res.status(201).json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, supplierId, page, limit } = req.query;
        const result = await supplierReturnService.findAll({
            status: status as any,
            supplierId: supplierId as string,
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
        const ret = await supplierReturnService.findById(String(req.params.id));
        if (!ret) return res.status(404).json({ error: 'Return not found' });
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await supplierReturnService.update(String(req.params.id), req.body);
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/submit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await supplierReturnService.submit(String(req.params.id));
        return res.json({ success: true, return: ret });
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

        const ret = await supplierReturnService.complete(String(req.params.id), locationId, userId);
        return res.json({ success: true, return: ret, message: 'Return completed, stock reduced' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const ret = await supplierReturnService.cancel(String(req.params.id), reason || 'Cancelled');
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await supplierReturnService.addItem(String(req.params.id), req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await supplierReturnService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await supplierReturnService.removeItem(String(req.params.itemId));
        return res.json({ success: true, message: 'Item removed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await supplierReturnService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Return deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
