import { Router, Request, Response } from 'express';
import { barcodeService, BarcodeFormat } from '../services/barcode.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/barcode/generate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { data, format, options } = req.body;

        if (!data || !format) {
            return res.status(400).json({ 
                error: 'Missing required fields: data, format' 
            });
        }

        if (!barcodeService.validateBarcodeData(data, format)) {
            return res.status(400).json({
                error: `Invalid data for format ${format}. Check the data format requirements.`
            });
        }

        const result = barcodeService.generateBarcodeAsBuffer(data, { format, ...options });

        return res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        return res.status(500).json({ 
            error: 'Failed to generate barcode', 
            details: error.message 
        });
    }
});

router.post('/barcode/qrcode', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { data, options } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'Missing required field: data' });
        }

        const result = await barcodeService.generateQRCode(data, options);

        return res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to generate QR code',
            details: error.message,
        });
    }
});

router.post('/barcode/batch', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid items array' 
            });
        }

        const results = barcodeService.generateBatch(items);

        return res.json({
            success: true,
            count: results.length,
            items: results,
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to generate batch barcodes',
            details: error.message,
        });
    }
});

router.get('/barcode/formats', authMiddleware, (req: Request, res: Response) => {
    const formats: BarcodeFormat[] = [
        'CODE128', 'CODE128A', 'CODE128B', 'CODE128C',
        'EAN13', 'EAN8', 'UPC', 'CODE39', 'ITF14',
        'PHARMACODE', 'CODABAR'
    ];

    const formatInfo = {
        'CODE128': { description: 'Code 128 - General purpose', variableLength: true },
        'CODE128A': { description: 'Code 128 A - ASCII 0-95', variableLength: true },
        'CODE128B': { description: 'Code 128 B - ASCII 32-127', variableLength: true },
        'CODE128C': { description: 'Code 128 C - Numbers only', variableLength: true },
        'EAN13': { description: 'EAN-13 - Retail products', variableLength: false, pattern: '12-13 digits' },
        'EAN8': { description: 'EAN-8 - Short retail products', variableLength: false, pattern: '7-8 digits' },
        'UPC': { description: 'UPC-A - US retail products', variableLength: false, pattern: '11-12 digits' },
        'CODE39': { description: 'Code 39 - Industrial', variableLength: true },
        'ITF14': { description: 'ITF-14 - Shipping containers', variableLength: false, pattern: '13-14 digits' },
        'PHARMACODE': { description: 'Pharmaceutical code', variableLength: false, pattern: '2-6 digits' },
        'CODABAR': { description: 'Codabar - Libraries, blood banks', variableLength: true },
    };

    return res.json({
        formats,
        info: formatInfo,
    });
});

export default router;
