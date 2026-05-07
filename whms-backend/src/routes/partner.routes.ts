import { Router, Request, Response } from 'express';
import { customerService, supplierService } from '../services/customer-supplier.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/customers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const customer = await customerService.create(req.body);
        return res.status(201).json({ success: true, customer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/customers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, page, limit } = req.query;
        const result = await customerService.findAll({
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/customers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const customer = await customerService.findById(String(req.params.id));
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        return res.json({ success: true, customer });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/customers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const customer = await customerService.update(String(req.params.id), req.body);
        return res.json({ success: true, customer });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/customers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await customerService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Customer deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/suppliers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const supplier = await supplierService.create(req.body);
        return res.status(201).json({ success: true, supplier });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/suppliers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, page, limit } = req.query;
        const result = await supplierService.findAll({
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/suppliers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const supplier = await supplierService.findById(String(req.params.id));
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        return res.json({ success: true, supplier });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/suppliers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const supplier = await supplierService.update(String(req.params.id), req.body);
        return res.json({ success: true, supplier });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/suppliers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await supplierService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Supplier deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
