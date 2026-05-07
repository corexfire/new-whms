import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/categories', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        const category = await prisma.category.create({ data: { name, description } });
        return res.status(201).json({ success: true, category });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/categories', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        const where: any = {};
        if (typeof search === 'string' && search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        const categories = await prisma.category.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { _count: { select: { items: true } } },
        });
        return res.json({ success: true, categories });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/categories/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const category = await prisma.category.findUnique({
            where: { id: String(req.params.id) },
            include: { items: { take: 20, orderBy: { name: 'asc' } } },
        });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        return res.json({ success: true, category });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/categories/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const category = await prisma.category.update({
            where: { id: String(req.params.id) },
            data: req.body,
        });
        return res.json({ success: true, category });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/categories/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await prisma.category.delete({ where: { id: String(req.params.id) } });
        return res.json({ success: true, message: 'Category deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/uoms', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { code, description } = req.body;
        const uom = await prisma.uoM.create({ data: { code, description } });
        return res.status(201).json({ success: true, uom });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/uoms', authMiddleware, async (req: Request, res: Response) => {
    try {
        const uoms = await prisma.uoM.findMany({
            orderBy: { code: 'asc' },
            include: { _count: { select: { items: true } } },
        });
        return res.json({ success: true, uoms });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/uoms/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const uom = await prisma.uoM.findUnique({
            where: { id: String(req.params.id) },
            include: {
                items: {
                    take: 20,
                    orderBy: { item: { name: 'asc' } },
                    include: { item: true },
                },
            },
        });
        if (!uom) return res.status(404).json({ error: 'UoM not found' });
        return res.json({ success: true, uom });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/uoms/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const uom = await prisma.uoM.update({
            where: { id: String(req.params.id) },
            data: req.body,
        });
        return res.json({ success: true, uom });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/uoms/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await prisma.uoM.delete({ where: { id: String(req.params.id) } });
        return res.json({ success: true, message: 'UoM deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/products', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { code, name, description, categoryId, isActive } = req.body;
        const product = await (prisma as any).product.create({
            data: { code, name, description, categoryId, isActive },
            include: { category: true, _count: { select: { items: true } } },
        });
        return res.status(201).json({ success: true, product });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/products', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, categoryId, isActive } = req.query;
        const where: any = {};
        if (typeof search === 'string' && search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (typeof categoryId === 'string' && categoryId) where.categoryId = categoryId;
        if (isActive === 'true') where.isActive = true;
        if (isActive === 'false') where.isActive = false;

        const products = await (prisma as any).product.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { category: true, _count: { select: { items: true } } },
        });
        return res.json({ success: true, products });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/products/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const product = await (prisma as any).product.findUnique({
            where: { id: String(req.params.id) },
            include: {
                category: true,
                items: {
                    take: 50,
                    orderBy: { sku: 'asc' },
                    include: { uoms: { include: { uom: true } } },
                },
            },
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        return res.json({ success: true, product });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/products/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const product = await (prisma as any).product.update({
            where: { id: String(req.params.id) },
            data: req.body,
            include: { category: true, _count: { select: { items: true } } },
        });
        return res.json({ success: true, product });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/products/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await (prisma.item as any).updateMany({ where: { productId: id }, data: { productId: null } });
        await (prisma as any).product.delete({ where: { id } });
        return res.json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
