import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { warehouseId } = req.query;
        const summary = await monitoringService.getDashboardSummary(warehouseId as string);
        return res.json({ success: true, ...summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/alerts', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { warehouseId } = req.query;
        const alerts = await monitoringService.checkLowStock(warehouseId as string);
        return res.json({ success: true, alerts });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/alerts/emit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { warehouseId } = req.body;
        await monitoringService.emitStockAlerts(warehouseId);
        return res.json({ success: true, message: 'Alerts emitted' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/daily-summary', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { days, warehouseId } = req.query;
        const summaries = await monitoringService.getDailySummary(
            Number(days) || 7,
            warehouseId as string
        );
        return res.json({ success: true, summaries });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/top-moving', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { days, limit, type, warehouseId } = req.query;
        const items = await monitoringService.getTopMovingItems(
            Number(days) || 7,
            Number(limit) || 10,
            (type as any) || 'ALL'
        );
        return res.json({ success: true, items });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
