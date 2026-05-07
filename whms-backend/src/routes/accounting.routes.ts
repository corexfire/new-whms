import { Router, Request, Response } from 'express';
import { accountingService, ARStatus, APStatus, RecordPaymentDto } from '../services/accounting.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/ar', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ar = await accountingService.createAR(req.body);
        return res.status(201).json({ success: true, ar });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/ar', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { customerId, status, overdue, search, startDate, endDate, page, limit } = req.query;
        const result = await accountingService.findAR({
            customerId: customerId as string,
            status: status as ARStatus,
            overdue: overdue === 'true',
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

router.get('/ar/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ar = await accountingService.findARById(String(req.params.id));
        if (!ar) return res.status(404).json({ error: 'AR not found' });
        return res.json({ success: true, ar });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/ar/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ar = await accountingService.updateAR(String(req.params.id), req.body);
        return res.json({ success: true, ar });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/ar/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await accountingService.deleteAR(String(req.params.id));
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/ar/:id/payment', authMiddleware, async (req: Request, res: Response) => {
    try {
        const payment = await accountingService.recordARPayment(String(req.params.id), req.body as RecordPaymentDto);
        return res.status(201).json({ success: true, payment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/ar/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const ar = await accountingService.voidAR(String(req.params.id), reason || 'Voided by user');
        return res.json({ success: true, ar });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/ar/reports/aging', authMiddleware, async (req: Request, res: Response) => {
    try {
        const aging = await accountingService.getARAging();
        return res.json({ success: true, aging });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/ap', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ap = await accountingService.createAP(req.body);
        return res.status(201).json({ success: true, ap });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/ap', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { supplierId, status, overdue, search, startDate, endDate, page, limit } = req.query;
        const result = await accountingService.findAP({
            supplierId: supplierId as string,
            status: status as APStatus,
            overdue: overdue === 'true',
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

router.get('/ap/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ap = await accountingService.findAPById(String(req.params.id));
        if (!ap) return res.status(404).json({ error: 'AP not found' });
        return res.json({ success: true, ap });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/ap/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const ap = await accountingService.updateAP(String(req.params.id), req.body);
        return res.json({ success: true, ap });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/ap/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await accountingService.deleteAP(String(req.params.id));
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/ap/:id/payment', authMiddleware, async (req: Request, res: Response) => {
    try {
        const payment = await accountingService.recordAPPayment(String(req.params.id), req.body as RecordPaymentDto);
        return res.status(201).json({ success: true, payment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/ap/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const ap = await accountingService.voidAP(String(req.params.id), reason || 'Voided by user');
        return res.json({ success: true, ap });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/ap/reports/aging', authMiddleware, async (req: Request, res: Response) => {
    try {
        const aging = await accountingService.getAPAging();
        return res.json({ success: true, aging });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
