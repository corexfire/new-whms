import { Router, Request, Response } from 'express';
import { zplService } from '../services/zpl.service';
import { authMiddleware } from '../utils/jwt';
import { prisma } from '../index';

let printerQueue: any = null;

const getPrinterQueue = async () => {
    if (!printerQueue) {
        try {
            const module = await import('../queues/printer.queue');
            printerQueue = module.printerQueue;
        } catch (err) {
            console.warn('[PrintRoutes] Printer queue unavailable (Redis not connected)');
        }
    }
    return printerQueue;
};

const router = Router();

router.post('/print/product', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sku, name, barcode, price, batch, expiry, copies, printerIp, printerPort } = req.body;

        if (!barcode || !name) {
            return res.status(400).json({ 
                error: 'Missing required fields: barcode, name' 
            });
        }

        const { zpl } = zplService.generateProductLabel(
            { sku, name, barcode, price, batch, expiry },
            { copies: copies || 1 }
        );

        const queue = await getPrinterQueue();
        if (!queue) {
            return res.status(503).json({
                error: 'Print queue unavailable (Redis not connected)',
            });
        }

        const job = await queue.add('print-product', {
            zpl,
            printerIp: printerIp || 'localhost',
            printerPort: printerPort || 9100,
            labelType: 'product',
            metadata: { sku, barcode, copies },
        });

        return res.json({
            success: true,
            jobId: job.id,
            message: 'Print job queued',
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to queue print job',
            details: error.message,
        });
    }
});

router.post('/print/shipping', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { trackingNumber, recipient, address, phone, weight, copies, printerIp, printerPort } = req.body;

        if (!trackingNumber || !recipient || !address) {
            return res.status(400).json({
                error: 'Missing required fields: trackingNumber, recipient, address'
            });
        }

        const { zpl } = zplService.generateShippingLabel(
            { trackingNumber, recipient, address, phone, weight },
            { copies: copies || 1 }
        );

        const queue = await getPrinterQueue();
        if (!queue) {
            return res.status(503).json({
                error: 'Print queue unavailable (Redis not connected)',
            });
        }

        const job = await queue.add('print-shipping', {
            zpl,
            printerIp: printerIp || 'localhost',
            printerPort: printerPort || 9100,
            labelType: 'shipping',
            metadata: { trackingNumber, copies },
        });

        return res.json({
            success: true,
            jobId: job.id,
            message: 'Print job queued',
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to queue print job',
            details: error.message,
        });
    }
});

router.post('/print/custom', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { templateId, data, printerIp, printerPort, copies } = req.body;

        if (!templateId || !data) {
            return res.status(400).json({
                error: 'Missing required fields: templateId, data'
            });
        }

        const { labelTemplateService } = await import('../services/label-template.service');
        const result = await labelTemplateService.generateZPLFromTemplate(templateId, data);

        if (!result) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const queue = await getPrinterQueue();
        if (!queue) {
            return res.status(503).json({
                error: 'Print queue unavailable (Redis not connected)',
            });
        }

        const job = await queue.add('print-custom', {
            zpl: result.zpl,
            printerIp: printerIp || 'localhost',
            printerPort: printerPort || 9100,
            labelType: 'custom',
            copies: copies || 1,
            metadata: { templateId, data },
        });

        return res.json({
            success: true,
            jobId: job.id,
            zpl: result.zpl,
            message: 'Print job queued',
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to queue print job',
            details: error.message,
        });
    }
});

router.post('/print/zpl', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { zpl, printerIp, printerPort, copies } = req.body;

        if (!zpl) {
            return res.status(400).json({ error: 'ZPL content is required' });
        }

        const queue = await getPrinterQueue();
        if (!queue) {
            return res.status(503).json({
                error: 'Print queue unavailable (Redis not connected)',
            });
        }

        const job = await queue.add('print-zpl', {
            zpl,
            printerIp: printerIp || 'localhost',
            printerPort: printerPort || 9100,
            labelType: 'custom',
            copies: copies || 1,
        });

        return res.json({
            success: true,
            jobId: job.id,
            message: 'Print job queued',
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to queue print job',
            details: error.message,
        });
    }
});

router.get('/printers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const printers = await prisma.printerConfig.findMany({
            orderBy: { isDefault: 'desc' },
        });

        return res.json({
            success: true,
            printers,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to fetch printers',
            details: error.message,
        });
    }
});

router.post('/printers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, ipAddress, port, isDefault } = req.body;

        if (!name || !ipAddress) {
            return res.status(400).json({
                error: 'Missing required fields: name, ipAddress'
            });
        }

        if (isDefault) {
            await prisma.printerConfig.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const printer = await prisma.printerConfig.create({
            data: {
                name,
                ipAddress,
                port: port || 9100,
                isDefault: isDefault || false,
            },
        });

        return res.status(201).json({
            success: true,
            printer,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to create printer config',
            details: error.message,
        });
    }
});

router.get('/print/jobs/:jobId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const queue = await getPrinterQueue();

        if (!queue) {
            return res.status(503).json({
                error: 'Print queue unavailable (Redis not connected)',
            });
        }

        const job = await queue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        const progress = job.progress;

        return res.json({
            success: true,
            jobId: job.id,
            state,
            progress,
            data: job.data,
            failedReason: job.failedReason,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to fetch job status',
            details: error.message,
        });
    }
});

export default router;
