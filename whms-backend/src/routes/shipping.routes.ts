import { Router, Request, Response } from 'express';
import { shippingService } from '../services/shipping.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const shipment = await shippingService.create(req.body);
        return res.status(201).json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, carrier, startDate, endDate, page, limit } = req.query;
        const result = await shippingService.findAll({
            status: status as any,
            carrier: carrier as string,
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

router.get('/awb/:awbNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const shipment = await shippingService.findByAwb(String(req.params.awbNumber));
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const shipment = await shippingService.findById(String(req.params.id));
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/timeline', authMiddleware, async (req: Request, res: Response) => {
    try {
        const timeline = await shippingService.getTrackingTimeline(String(req.params.id));
        return res.json({ success: true, ...timeline });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/update-tracking', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, location, description } = req.body;
        const shipment = await shippingService.updateTracking(String(req.params.id), { status, location, description });
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/pickup', authMiddleware, async (req: Request, res: Response) => {
    try {
        const shipment = await shippingService.markPickedUp(String(req.params.id));
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/in-transit', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { location } = req.body;
        const shipment = await shippingService.markInTransit(String(req.params.id), location);
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/out-for-delivery', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { location } = req.body;
        const shipment = await shippingService.markOutForDelivery(String(req.params.id), location);
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/delivered', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { location } = req.body;
        const shipment = await shippingService.markDelivered(String(req.params.id), location);
        return res.json({ success: true, shipment, message: 'Shipment delivered, journal posted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        const shipment = await shippingService.cancel(String(req.params.id), reason || 'Cancelled by user');
        return res.json({ success: true, shipment });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/sync/:awbNumber', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { carrier } = req.body;
        const result = await shippingService.syncTrackingFromCarrier(String(req.params.awbNumber), carrier);
        return res.json({ success: true, result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
