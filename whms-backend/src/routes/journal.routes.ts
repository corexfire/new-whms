import { Router, Request, Response } from 'express';
import { journalService } from '../services/journal.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.get('/accounts/:accountId/ledger', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const lines = await journalService.getLedger(
            String(req.params.accountId),
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
        );
        return res.json({ success: true, lines });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/reports/trial-balance', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const result = await journalService.getTrialBalanceDetailed(new Date(startDate as string), new Date(endDate as string));
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const entry = await journalService.create(req.body);
        return res.status(201).json({ success: true, entry });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { status, source, startDate, endDate, search, page, limit } = req.query;
        const result = await journalService.findAll({
            status: status as any,
            source: source as any,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            search: search as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const entry = await journalService.findById(String(req.params.id));
        if (!entry) return res.status(404).json({ error: 'Entry not found' });
        return res.json({ success: true, entry });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const entry = await journalService.update(String(req.params.id), req.body);
        return res.json({ success: true, entry });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await journalService.delete(String(req.params.id));
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/post', authMiddleware, async (req: Request, res: Response) => {
    try {
        const entry = await journalService.post(String(req.params.id));
        return res.json({ success: true, entry, message: 'Journal posted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/:id/void', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { reason } = req.body;
        await journalService.void(String(req.params.id), reason || 'Voided by user');
        return res.json({ success: true, message: 'Entry voided' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

export default router;
