import { Router, Request, Response } from 'express';
import { posService } from '../services/pos.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
    try {
        const cashierId = (req as any).user?.id;
        const result = await posService.checkout(req.body, cashierId);
        return res.status(201).json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const cashierId = (req as any).user?.id;
        const { receiptNumber, reason } = req.body;
        await posService.void(receiptNumber, reason, cashierId);
        return res.json({ success: true, message: 'Transaction voided' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/transactions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, cashierId, shiftId, startDate, endDate, page, limit } = req.query;
        const result = await posService.findAll({
            status: status as any,
            cashierId: cashierId as string,
            shiftId: shiftId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/receipt/:receiptNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const transaction = await posService.findByReceipt(String(req.params.receiptNumber));
        if (!transaction) return res.status(404).json({ error: 'Receipt not found' });
        return res.json({ success: true, transaction });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/daily-summary', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { shiftId, date } = req.query;
        const summary = await posService.getDailySummary(
            shiftId as string,
            date ? new Date(date as string) : undefined
        );
        return res.json({ success: true, ...summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/catalog', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { warehouseId, search, categoryId, color, inStockOnly, page, limit } = req.query;
        const result = await posService.getCatalog({
            warehouseId: String(warehouseId || ''),
            search: search as string,
            categoryId: categoryId as string,
            color: color as string,
            inStockOnly: inStockOnly === undefined ? true : inStockOnly === 'true',
            page: Number(page) || 1,
            limit: Number(limit) || 60,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
