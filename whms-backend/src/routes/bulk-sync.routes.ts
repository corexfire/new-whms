import { Router, Request, Response } from 'express';
import { bulkSyncService } from '../services/bulk-sync.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await bulkSyncService.processBulkSync(req.body);
        return res.json(result);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { items } = req.body;
        const result = await bulkSyncService.syncItems(items);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/customers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { customers } = req.body;
        const result = await bulkSyncService.syncCustomers(customers);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/prices', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { prices } = req.body;
        const result = await bulkSyncService.syncPrices(prices);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/inventory', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { inventory } = req.body;
        const result = await bulkSyncService.syncInventory(inventory);
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/version', authMiddleware, async (req: Request, res: Response) => {
    try {
        const version = await bulkSyncService.getMasterDataVersion();
        return res.json({ success: true, ...version });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
