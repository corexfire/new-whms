import { Router, Request, Response } from 'express';
import { labelTemplateService } from '../services/label-template.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/templates', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, type, config } = req.body;

        if (!name || !type || !config) {
            return res.status(400).json({
                error: 'Missing required fields: name, type, config'
            });
        }

        const validTypes = ['product', 'shipping', 'custom', 'receipt'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const userId = (req as any).user?.id;
        const template = await labelTemplateService.create({ name, type, config }, userId);

        return res.status(201).json({
            success: true,
            template,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to create template',
            details: error.message,
        });
    }
});

router.get('/templates', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { type } = req.query;
        const templates = await labelTemplateService.findAll(type as any);

        return res.json({
            success: true,
            count: templates.length,
            templates,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to fetch templates',
            details: error.message,
        });
    }
});

router.get('/templates/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await labelTemplateService.findById(id);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        return res.json({
            success: true,
            template,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to fetch template',
            details: error.message,
        });
    }
});

router.put('/templates/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, config } = req.body;

        const template = await labelTemplateService.update(id, { name, config });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        return res.json({
            success: true,
            template,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to update template',
            details: error.message,
        });
    }
});

router.delete('/templates/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const deleted = await labelTemplateService.delete(id);

        if (!deleted) {
            return res.status(404).json({ error: 'Template not found' });
        }

        return res.json({
            success: true,
            message: 'Template deleted',
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to delete template',
            details: error.message,
        });
    }
});

router.post('/templates/:id/duplicate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'New template name is required' });
        }

        const template = await labelTemplateService.duplicate(id, name);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        return res.status(201).json({
            success: true,
            template,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to duplicate template',
            details: error.message,
        });
    }
});

router.post('/templates/:id/generate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data } = req.body;

        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Data object is required' });
        }

        const result = await labelTemplateService.generateZPLFromTemplate(id, data);

        if (!result) {
            return res.status(404).json({ error: 'Template not found' });
        }

        return res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to generate ZPL',
            details: error.message,
        });
    }
});

export default router;
