import { Router, Request, Response } from 'express';
import { chartOfAccountsService, AccountType } from '../services/chart-of-accounts.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const account = await chartOfAccountsService.create(req.body);
        return res.status(201).json({ success: true, account });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { type, isActive, search } = req.query;
        const accounts = await chartOfAccountsService.findAll({
            type: type as AccountType,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            search: search as string,
        });
        return res.json({ success: true, accounts });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/tree', authMiddleware, async (req: Request, res: Response) => {
    try {
        const tree = await chartOfAccountsService.getTree();
        return res.json({ success: true, tree });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const account = await chartOfAccountsService.findById(String(req.params.id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        return res.json({ success: true, account });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/:id/balance', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { asOfDate } = req.query;
        const balance = await chartOfAccountsService.getAccountBalance(
            String(req.params.id),
            asOfDate ? new Date(asOfDate as string) : undefined
        );
        return res.json({ success: true, ...balance });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const account = await chartOfAccountsService.update(String(req.params.id), req.body);
        return res.json({ success: true, account });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await chartOfAccountsService.delete(String(req.params.id));
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/seed', authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await chartOfAccountsService.seedDefaultAccounts();
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
