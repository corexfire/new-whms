import { Router, Request, Response } from 'express';
import { shiftService } from '../services/shift.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/open', authMiddleware, async (req: Request, res: Response) => {
    try {
        const cashierId = (req as any).user?.id;
        const shift = await shiftService.open(cashierId, req.body);
        return res.status(201).json({ success: true, shift });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/close', authMiddleware, async (req: Request, res: Response) => {
    try {
        const cashierId = (req as any).user?.id;
        const shift = await shiftService.close(String(req.params.id), cashierId, req.body);
        return res.json({ success: true, shift });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/active', authMiddleware, async (req: Request, res: Response) => {
    try {
        const cashierId = (req as any).user?.id;
        const shift = await shiftService.findActive(cashierId);
        return res.json({ success: true, shift });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { cashierId, status, startDate, endDate, page, limit } = req.query;
        const result = await shiftService.findAll({
            cashierId: cashierId as string,
            status: status as any,
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
        const summary = await shiftService.getShiftSummary(String(req.params.id));
        return res.json({ success: true, ...summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
