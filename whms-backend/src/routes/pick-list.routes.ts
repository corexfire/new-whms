import { Router, Request, Response } from 'express';
import { pickListService } from '../services/pick-list.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { salesOrderId, assignedTo } = req.body;
        const pickList = await pickListService.create(salesOrderId, assignedTo);
        return res.status(201).json({ success: true, pickList });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, assignedTo, page, limit } = req.query;
        const result = await pickListService.findAll({
            status: status as any,
            assignedTo: assignedTo as string,
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
        const pickList = await pickListService.findById(String(req.params.id));
        if (!pickList) return res.status(404).json({ error: 'Pick list not found' });
        return res.json({ success: true, pickList });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/auto-allocate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { salesOrderId, warehouseId, prioritizeExpiry } = req.body;
        const allocations = await pickListService.autoAllocate({
            salesOrderId,
            warehouseId,
            prioritizeExpiry: prioritizeExpiry !== false,
        });
        return res.json({ success: true, allocations });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/create-with-allocation', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { salesOrderId, allocations, assignedTo } = req.body;
        const pickList = await pickListService.createFromAllocation(salesOrderId, allocations, assignedTo);
        return res.status(201).json({ success: true, pickList });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/assign', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const pickList = await pickListService.assignUser(String(req.params.id), userId);
        return res.json({ success: true, pickList });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/items/:itemId/confirm', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { pickedQty } = req.body;
        const item = await pickListService.confirmPick(String(req.params.itemId), pickedQty);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/scan', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { barcode, qty } = req.body;
        const userId = (req as any).user?.id;
        const item = await pickListService.scanAndConfirm(String(req.params.id), barcode, qty, userId);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/:id/validate-packing', authMiddleware, async (req: Request, res: Response) => {
    try {
        const validation = await pickListService.validatePacking(String(req.params.id));
        return res.json({ success: true, ...validation });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
    try {
        const pickList = await pickListService.complete(String(req.params.id));
        return res.json({ success: true, pickList, message: 'Pick list completed' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
