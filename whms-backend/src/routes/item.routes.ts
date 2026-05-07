import { Router, Request, Response } from 'express';
import express from 'express';
import { itemService } from '../services/item.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await itemService.create(req.body);
        return res.status(201).json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, categoryId, productId, color, page, limit } = req.query;
        const result = await itemService.findAll({
            search: search as string,
            categoryId: categoryId as string,
            productId: productId as string,
            color: color as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/sku/:sku', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await itemService.findBySku(String(req.params.sku));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/barcode/:barcode', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result: any = await itemService.findByBarcode(String(req.params.barcode));
        if (!result) return res.status(404).json({ error: 'Barcode not found' });
        return res.json({ success: true, item: result.item, uom: result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await itemService.findById(String(req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await itemService.update(String(req.params.id), req.body);
        return res.json({ success: true, item });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await itemService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Item deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/uoms', authMiddleware, async (req: Request, res: Response) => {
    try {
        const uom = await itemService.addUoM(String(req.params.id), req.body);
        return res.status(201).json({ success: true, uom });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.patch('/uoms/:uomId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const uom = await itemService.updateUoM(String(req.params.uomId), req.body);
        return res.json({ success: true, uom });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/uoms/:uomId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await itemService.deleteUoM(String(req.params.uomId));
        return res.json({ success: true, message: 'UoM deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/lots', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { lotNumber, expiryDate, manufactured, isActive } = req.body;
        const lot = await itemService.createLot(
            String(req.params.id),
            lotNumber,
            expiryDate ? new Date(expiryDate) : undefined,
            manufactured ? new Date(manufactured) : undefined,
            typeof isActive === 'boolean' ? isActive : true
        );
        return res.status(201).json({ success: true, lot });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/:id/lots', authMiddleware, async (req: Request, res: Response) => {
    try {
        const lots = await itemService.findLots(String(req.params.id));
        return res.json({ success: true, lots });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.patch('/lots/:lotId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const lot = await itemService.updateLot(String(req.params.lotId), {
            expiryDate: req.body.expiryDate === null ? null : req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
            manufactured: req.body.manufactured === null ? null : req.body.manufactured ? new Date(req.body.manufactured) : undefined,
            isActive: req.body.isActive,
        });
        return res.json({ success: true, lot });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/lots/:lotId', authMiddleware, async (req: Request, res: Response) => {
    try {
        await itemService.deleteLot(String(req.params.lotId));
        return res.json({ success: true, message: 'Lot deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/images', authMiddleware, express.raw({ type: 'image/webp', limit: '10mb' }), async (req: Request, res: Response) => {
    try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: 'Empty image body' });
        }
        const img = await itemService.addImage(String(req.params.id), req.body as Buffer);
        return res.status(201).json({ success: true, image: img });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/images/:imageId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const img = await itemService.deleteImage(String(req.params.imageId));
        if (!img) return res.status(404).json({ error: 'Image not found' });
        return res.json({ success: true, image: img });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
