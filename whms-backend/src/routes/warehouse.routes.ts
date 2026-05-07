import { Router, Request, Response } from 'express';
import { warehouseService, locationService } from '../services/warehouse-location.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const warehouse = await warehouseService.create(req.body);
        return res.status(201).json({ success: true, warehouse });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, isActive } = req.query;
        const warehouses = await warehouseService.findAll({
            search: search as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        });
        return res.json({ success: true, warehouses });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/warehouses/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const warehouse = await warehouseService.findById(String(req.params.id));
        if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
        return res.json({ success: true, warehouse });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/warehouses/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const warehouse = await warehouseService.update(String(req.params.id), req.body);
        return res.json({ success: true, warehouse });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/warehouses/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await warehouseService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Warehouse deactivated' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/locations', authMiddleware, async (req: Request, res: Response) => {
    try {
        const location = await locationService.create(req.body);
        return res.status(201).json({ success: true, location });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/locations', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { warehouseId, zone, search, page, limit } = req.query;
        const result = await locationService.findAll({
            warehouseId: warehouseId as string,
            zone: zone as string,
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 50,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/locations/code/:code', authMiddleware, async (req: Request, res: Response) => {
    try {
        const location = await locationService.findByCode(String(req.params.code));
        if (!location) return res.status(404).json({ error: 'Location not found' });
        return res.json({ success: true, location });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/locations/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const location = await locationService.findById(String(req.params.id));
        if (!location) return res.status(404).json({ error: 'Location not found' });
        return res.json({ success: true, location });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/warehouses/:warehouseId/zones', authMiddleware, async (req: Request, res: Response) => {
    try {
        const zones = await locationService.getZones(String(req.params.warehouseId));
        return res.json({ success: true, zones });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/warehouses/:warehouseId/hierarchy', authMiddleware, async (req: Request, res: Response) => {
    try {
        const hierarchy = await locationService.getHierarchy(String(req.params.warehouseId));
        return res.json({ success: true, hierarchy });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/locations/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const location = await locationService.update(String(req.params.id), req.body);
        return res.json({ success: true, location });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/locations/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await locationService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Location deactivated' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
