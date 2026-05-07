import { Router, Request, Response } from 'express';
import { promotionService } from '../services/promotion.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

// --- Bundles ---
router.get('/bundles', authMiddleware, async (req: Request, res: Response) => {
    try {
        const bundles = await promotionService.findAllBundles();
        return res.json({ success: true, bundles });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/bundles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const bundle = await promotionService.findBundleById(req.params.id);
        if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
        return res.json({ success: true, bundle });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/bundles', authMiddleware, async (req: Request, res: Response) => {
    try {
        const bundle = await promotionService.createBundle(req.body);
        return res.status(201).json({ success: true, bundle });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/bundles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const bundle = await promotionService.updateBundle(req.params.id, req.body);
        return res.json({ success: true, bundle });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/bundles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await promotionService.deleteBundle(req.params.id);
        return res.json({ success: true, message: 'Bundle deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// --- Discount Rules ---
router.get('/discounts', authMiddleware, async (req: Request, res: Response) => {
    try {
        const rules = await promotionService.findAllDiscountRules();
        return res.json({ success: true, discounts: rules });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/discounts/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const rule = await promotionService.findDiscountRuleById(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Discount rule not found' });
        return res.json({ success: true, discount: rule });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/discounts', authMiddleware, async (req: Request, res: Response) => {
    try {
        const rule = await promotionService.createDiscountRule(req.body);
        return res.status(201).json({ success: true, discount: rule });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/discounts/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const rule = await promotionService.updateDiscountRule(req.params.id, req.body);
        return res.json({ success: true, discount: rule });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/discounts/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await promotionService.deleteDiscountRule(req.params.id);
        return res.json({ success: true, message: 'Discount rule deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
