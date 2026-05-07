import { Router, Request, Response } from 'express';
import { putawayService } from '../services/putaway.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const task = await putawayService.createFromGRN(req.body, userId);
        return res.status(201).json({ success: true, task });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, goodsReceiptId, page, limit } = req.query;
        const result = await putawayService.findAll({
            status: status as any,
            goodsReceiptId: goodsReceiptId as string,
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
        const task = await putawayService.findById(String(req.params.id));
        if (!task) return res.status(404).json({ error: 'Putaway not found' });
        return res.json({ success: true, task });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const task = await putawayService.update(String(req.params.id), req.body);
        return res.json({ success: true, task });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await putawayService.updateItem(String(req.params.itemId), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const task = await putawayService.complete(String(req.params.id), userId);
        return res.json({ success: true, task, message: 'Putaway completed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body || {};
        const task = await putawayService.void(String(req.params.id), reason);
        return res.json({ success: true, task, message: 'Putaway voided' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await putawayService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Putaway deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
