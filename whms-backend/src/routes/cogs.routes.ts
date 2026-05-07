import { Router } from 'express';
import { cogsService } from '../services/cogs.service';

const router = Router();

// GET /api/inventory/cogs/overhead/:period
router.get('/overhead/:period', async (req, res) => {
    try {
        const overheads = await cogsService.getOverhead(req.params.period);
        res.json({ success: true, overheads });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/inventory/cogs/overhead
router.post('/overhead', async (req, res) => {
    try {
        const { period, items } = req.body;
        if (!period) throw new Error('Period is required');
        const overheads = await cogsService.saveOverhead(period, items || []);
        res.json({ success: true, overheads });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/inventory/cogs/report
router.get('/report', async (req, res) => {
    try {
        const { period, categoryId, allocationMethod } = req.query;
        if (!period) throw new Error('Period is required');
        
        const result = await cogsService.calculate({
            period: period as string,
            categoryId: categoryId as string,
            allocationMethod: (allocationMethod as any) || 'QTY'
        });
        
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/inventory/cogs/settle
router.post('/settle', async (req, res) => {
    try {
        const { period, summary, rows } = req.body;
        if (!period) throw new Error('Period is required');
        const settlement = await cogsService.saveSettlement(period, summary, rows);
        res.json({ success: true, settlement });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/inventory/cogs/settlement/:period
router.get('/settlement/:period', async (req, res) => {
    try {
        const settlement = await cogsService.getSettlement(req.params.period);
        res.json({ success: true, settlement });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
