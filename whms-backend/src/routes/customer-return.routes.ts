import { Router, Request, Response } from 'express';
import { customerReturnService } from '../services/customer-return.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await customerReturnService.create(req.body);
        return res.status(201).json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, customerId, salesOrderId, page, limit } = req.query;
        const result = await customerReturnService.findAll({
            status: status as any,
            customerId: customerId as string,
            salesOrderId: salesOrderId as string,
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
        const ret = await customerReturnService.findById(String(req.params.id));
        if (!ret) return res.status(404).json({ error: 'Return not found' });
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await customerReturnService.update(String(req.params.id), req.body);
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/submit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ret = await customerReturnService.submit(String(req.params.id));
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { locationId } = req.body;
        const ret = await customerReturnService.complete(String(req.params.id), locationId);
        return res.json({ success: true, return: ret, message: 'Return completed, stock increased' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const ret = await customerReturnService.cancel(String(req.params.id), reason || 'Cancelled');
        return res.json({ success: true, return: ret });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await customerReturnService.addItem(String(req.params.id), req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await customerReturnService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await customerReturnService.removeItem(String(req.params.itemId));
        return res.json({ success: true, message: 'Item removed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await customerReturnService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Return deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
