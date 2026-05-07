import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';

export const prisma = new PrismaClient();

const lastShopifyInventoryPushMsByItemId = new Map<string, number>();
prisma.$use(async (params, next) => {
    const result = await next(params);

    if (params.model === 'StockMovement' && params.action === 'create') {
        const itemId = (result as any)?.itemId ? String((result as any).itemId) : '';
        if (!itemId) return result;

        const now = Date.now();
        const last = lastShopifyInventoryPushMsByItemId.get(itemId) || 0;
        if (now - last < 5000) return result;
        lastShopifyInventoryPushMsByItemId.set(itemId, now);

        try {
            const { shopifyService } = await import('./services/shopify.service');
            const { shopifySyncService } = await import('./services/shopify-sync.service');
            const store = await shopifyService.getActiveStore();
            if (!store) return result;

            const mapping = await (prisma as any).shopifyItemMapping.findUnique({
                where: { storeId_itemId: { storeId: store.id, itemId } },
            });
            if (!mapping?.shopifyInventoryItemId) return result;

            const syncJob = await shopifySyncService.createJob({
                storeId: store.id,
                direction: 'PUSH',
                type: 'INVENTORY' as any,
                payload: { itemIds: [itemId], mode: 'realtime' },
                userId: undefined,
            });

            try {
                const module = await import('./queues/shopify-sync.queue');
                const queue = module.shopifySyncQueue;
                const job = await queue.add(
                    'shopify-sync-push',
                    { syncJobId: syncJob.id },
                    { attempts: syncJob.maxAttempts, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
                );
                await shopifySyncService.setBullJobId(syncJob.id, String(job.id || ''));
            } catch {
                await shopifySyncService.process(syncJob.id);
            }
        } catch {
            return result;
        }
    }

    return result;
});

app.use(helmet());
const allowedOrigins = new Set(
    [
        process.env.FRONTEND_URL,
        'http://0.0.0.0:3000',
        'http://0.0.0.0:3001',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3010',
        'http://localhost:3011',
        'http://localhost:3012',
    ].filter(Boolean) as string[]
);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.has(origin)) return callback(null, true);
            if (/^http:\/\/(localhost|0\.0\.0\.0):\d+$/.test(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    })
);
app.use(
    express.json({
        verify(req, _res, buf) {
            const url = (req as any).originalUrl || (req as any).url;
            if (typeof url === 'string' && url.startsWith('/api/integrations/shopify/webhooks')) {
                (req as any).rawBody = buf;
            }
        },
    })
);
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

import itemRoutes from './routes/item.routes';
import masterRoutes from './routes/master.routes';
import partnerRoutes from './routes/partner.routes';
import authRoutes from './routes/auth.routes';
import warehouseRoutes from './routes/warehouse.routes';
import userRoutes from './routes/user.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import goodsReceiptRoutes from './routes/goods-receipt.routes';
import putawayRoutes from './routes/putaway.routes';
import supplierReturnRoutes from './routes/supplier-return.routes';
import customerReturnRoutes from './routes/customer-return.routes';
import salesOrderRoutes from './routes/sales-order.routes';
import pickListRoutes from './routes/pick-list.routes';
import shippingRoutes from './routes/shipping.routes';
import inventoryRoutes from './routes/inventory.routes';
import cogsRoutes from './routes/cogs.routes';
import stocktakeRoutes from './routes/stocktake.routes';
import adjustmentRoutes from './routes/adjustment.routes';
import transferRoutes from './routes/transfer.routes';
import posRoutes from './routes/pos.routes';
import shiftRoutes from './routes/shift.routes';
import coaRoutes from './routes/coa.routes';
import journalRoutes from './routes/journal.routes';
import accountingRoutes from './routes/accounting.routes';
import promotionRoutes from './routes/promotion.routes';
import shopifyRoutes from './routes/shopify.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { initializeSocketIO } from './services/socket.service';

app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use('/api/items', itemRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/goods-receipts', goodsReceiptRoutes);
app.use('/api/putaway', putawayRoutes);
app.use('/api/supplier-returns', supplierReturnRoutes);
app.use('/api/customer-returns', customerReturnRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/pick-lists', pickListRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory/cogs', cogsRoutes);
app.use('/api/stocktakes', stocktakeRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/coa', coaRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/integrations/shopify', shopifyRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
    res.json(swaggerSpec);
});

const { httpServer } = initializeSocketIO(app);
httpServer.listen(Number(port), host, () => {
    console.log(`[WHMS Backend] Server is running at http://${host}:${port}`);
    console.log(`[WHMS Backend] Socket.IO ready for connections`);
});
