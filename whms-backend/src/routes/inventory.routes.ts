import { Router, Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemId, warehouseId, categoryId, search, lowStock, page, limit } = req.query;
        const result = await inventoryService.getSummary({
            itemId: itemId as string,
            warehouseId: warehouseId as string,
            categoryId: categoryId as string,
            search: search as string,
            lowStock: lowStock === 'true',
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/location/:locationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const inventories = await inventoryService.getByLocation(String(req.params.locationId));
        return res.json({ success: true, inventories });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/item/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const inventories = await inventoryService.getByItem(String(req.params.itemId));
        return res.json({ success: true, inventories });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/warehouse/:warehouseId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const inventories = await inventoryService.getByWarehouse(String(req.params.warehouseId));
        return res.json({ success: true, inventories });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/lot/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const inventories = await inventoryService.getStockByLot(String(req.params.itemId));
        return res.json({ success: true, inventories });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/lots', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { expiry, days, warehouseId, itemId, search, page, limit } = req.query;
        const result = await inventoryService.getLots({
            expiry: (expiry as any) || 'ALL',
            days: days ? Number(days) : 30,
            warehouseId: warehouseId as string,
            itemId: itemId as string,
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/lots/:lotId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await inventoryService.getLotDetail(String(req.params.lotId));
        if (!result) return res.status(404).json({ error: 'Lot not found' });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/movements', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemId, locationId, warehouseId, type, startDate, endDate, page, limit } = req.query;
        const result = await inventoryService.getMovements(
            {
                itemId: itemId as string,
                locationId: locationId as string,
                warehouseId: warehouseId as string,
                type: type as string,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
            },
            Number(page) || 1,
            Number(limit) || 50
        );
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/movements/summary/:itemId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = await inventoryService.getMovementSummary(
            String(req.params.itemId),
            startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate ? new Date(endDate as string) : new Date()
        );
        return res.json({ success: true, summary });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/reserve', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemId, locationId, quantity, referenceId } = req.body;
        const success = await inventoryService.reserveStock(itemId, locationId, quantity, referenceId);
        return res.json({ success, message: success ? 'Stock reserved' : 'Insufficient stock' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/release', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemId, locationId, quantity, referenceId } = req.body;
        const success = await inventoryService.releaseReservation(itemId, locationId, quantity, referenceId);
        return res.json({ success, message: success ? 'Reservation released' : 'Failed to release' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
