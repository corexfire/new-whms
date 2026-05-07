import { Router, Request, Response } from 'express';
import { authMiddleware } from '../utils/jwt';
import { shopifyService } from '../services/shopify.service';
import { shopifySyncService } from '../services/shopify-sync.service';

let shopifySyncQueue: any = null;
let shopifySyncQueueLoadError: string | null = null;

const getShopifySyncQueue = async () => {
    if (!shopifySyncQueue) {
        try {
            const module = await import('../queues/shopify-sync.queue');
            shopifySyncQueue = module.shopifySyncQueue;
            shopifySyncQueueLoadError = null;
        } catch {
            shopifySyncQueue = null;
            shopifySyncQueueLoadError = 'Failed to load ShopifySyncQueue (Redis not connected or module not available)';
        }
    }
    return shopifySyncQueue;
};

const router = Router();

router.get('/oauth/start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const shop = String(req.query.shop || '');
        const base =
            process.env.BACKEND_PUBLIC_URL ||
            process.env.BACKEND_URL ||
            `${req.protocol}://${req.get('host')}`;
        const envRedirect = String(process.env.SHOPIFY_REDIRECT_URI || '').trim();
        const computedRedirect = new URL('/api/integrations/shopify/oauth/callback', base).toString();

        let redirectUri = envRedirect || computedRedirect;
        if (envRedirect) {
            try {
                const envHost = new URL(envRedirect).host;
                const baseHost = new URL(base).host;
                if (envHost !== baseHost) {
                    redirectUri = computedRedirect;
                }
            } catch {
                redirectUri = computedRedirect;
            }
        }

        const result = await shopifyService.startOAuth(shop, { redirectUri });
        return res.json({ success: true, ...result, redirectUri, base });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/oauth/callback', async (req: Request, res: Response) => {
    try {
        const shop = String(req.query.shop || '');
        const code = String(req.query.code || '');
        const state = String(req.query.state || '');

        const result = await shopifyService.completeOAuth({
            shop,
            code,
            state,
            query: req.query as any,
        });

        const redirectBase = process.env.FRONTEND_URL || 'http://localhost:3000';
        const url = new URL('/integrations/shopify/connection', redirectBase);
        url.searchParams.set('connected', '1');
        url.searchParams.set('shop', result.shop);
        return res.redirect(url.toString());
    } catch (error: any) {
        const redirectBase = process.env.FRONTEND_URL || 'http://localhost:3000';
        const url = new URL('/integrations/shopify/connection', redirectBase);
        url.searchParams.set('connected', '0');
        url.searchParams.set('error', error.message || 'OAuth failed');
        return res.redirect(url.toString());
    }
});

router.get('/connection', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.json({ success: true, connected: false });
        return res.json({
            success: true,
            connected: true,
            store: {
                id: store.id,
                shop: store.shop,
                scope: store.scope,
                settings: store.settings || {},
            },
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/connection/disconnect', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        await shopifyService.disconnect(store.id);
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/connection/manual', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { shop, accessToken } = req.body || {};
        const result = await shopifyService.connectManual({
            shop: String(shop || ''),
            accessToken: String(accessToken || ''),
            scope: 'custom_app',
        });
        return res.status(201).json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.get('/connection/test', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.getShop(store as any);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });

        const { prisma } = await import('../index');
        const [warehouseList, locationMappings, shopifyLocations] = await Promise.all([
            (prisma as any).warehouse.findMany({ orderBy: { name: 'asc' } }),
            (prisma as any).shopifyLocationMapping.findMany({ where: { storeId: store.id } }),
            shopifyService.listLocations(store),
        ]);

        return res.json({
            success: true,
            store: { id: store.id, shop: store.shop, settings: store.settings || {} },
            warehouses: warehouseList,
            locationMappings,
            shopifyLocations: (shopifyLocations as any).locations || [],
        });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.put('/settings', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });

        const { defaultWarehouseId, autoCreateItemsFromShopify, autoCreateOrdersFromShopify, locationMappings } = req.body || {};
        const updated = await shopifyService.updateSettings(store.id, {
            defaultWarehouseId: defaultWarehouseId ?? undefined,
            autoCreateItemsFromShopify: autoCreateItemsFromShopify ?? undefined,
            autoCreateOrdersFromShopify: autoCreateOrdersFromShopify ?? undefined,
        });

        const { prisma } = await import('../index');
        if (Array.isArray(locationMappings)) {
            const normalized = locationMappings
                .filter((m: any) => m?.warehouseId && m?.shopifyLocationId)
                .map((m: any) => ({
                    warehouseId: String(m.warehouseId),
                    shopifyLocationId: String(m.shopifyLocationId),
                }));

            const dupMap = new Map<string, string[]>();
            for (const m of normalized) {
                const arr = dupMap.get(m.shopifyLocationId) || [];
                arr.push(m.warehouseId);
                dupMap.set(m.shopifyLocationId, arr);
            }
            const duplicates = Array.from(dupMap.entries())
                .filter(([, warehouseIds]) => warehouseIds.length > 1)
                .map(([shopifyLocationId, warehouseIds]) => ({ shopifyLocationId, warehouseIds }));

            if (duplicates.length) {
                return res.status(400).json({
                    error: 'Duplicate Shopify location mapping. One Shopify location can only be mapped to one warehouse.',
                    duplicates,
                });
            }

            const existing: any[] = await (prisma as any).shopifyLocationMapping.findMany({ where: { storeId: store.id } });
            const existingByLocation = new Map<string, string>();
            for (const row of existing) existingByLocation.set(String(row.shopifyLocationId), String(row.warehouseId));

            const warehousesInRequest = new Set(normalized.map((m) => m.warehouseId));
            const conflicts = normalized
                .map((m) => {
                    const currentWarehouse = existingByLocation.get(m.shopifyLocationId);
                    if (!currentWarehouse) return null;
                    if (currentWarehouse === m.warehouseId) return null;
                    if (warehousesInRequest.has(currentWarehouse)) return null;
                    return { shopifyLocationId: m.shopifyLocationId, warehouseId: m.warehouseId, currentlyMappedToWarehouseId: currentWarehouse };
                })
                .filter(Boolean);

            if (conflicts.length) {
                return res.status(400).json({
                    error: 'Shopify location is already mapped to another warehouse.',
                    conflicts,
                });
            }

            await (prisma as any).$transaction(async (tx: any) => {
                await tx.shopifyLocationMapping.deleteMany({
                    where: { storeId: store.id, warehouseId: { in: Array.from(warehousesInRequest) } },
                });
                for (const m of normalized) {
                    await tx.shopifyLocationMapping.create({
                        data: { storeId: store.id, warehouseId: m.warehouseId, shopifyLocationId: m.shopifyLocationId },
                    });
                }
            });
        }

        return res.json({ success: true, store: updated });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.post('/webhooks/inventory_levels_update', async (req: Request, res: Response) => {
    try {
        const webhookId = String(req.headers['x-shopify-webhook-id'] || '');

        const rawBody = (req as any).rawBody as Buffer | undefined;
        if (!rawBody) return res.status(400).json({ error: 'Missing raw body' });

        const validated = await shopifyService.validateWebhook({ rawBody, rawRequest: req, rawResponse: res });
        if (!validated?.valid) return res.status(401).json({ error: 'Invalid webhook HMAC' });

        const shopDomain = String((validated as any).domain || req.headers['x-shopify-shop-domain'] || '');
        const topic = String((validated as any).topic || req.headers['x-shopify-topic'] || 'inventory_levels/update');

        const { prisma } = await import('../index');
        const store = await (prisma as any).shopifyStore.findUnique({ where: { shop: shopDomain } });
        if (!store) return res.status(404).json({ error: 'Shop not found' });

        const queue = await getShopifySyncQueue();
        if (!queue) {
            await shopifySyncService.applyInventoryWebhook(store.id, { webhookId, topic, body: req.body });
            return res.json({ success: true, mode: 'inline' });
        }

        const syncJob = await shopifySyncService.createJob({
            storeId: store.id,
            direction: 'PULL',
            type: 'WEBHOOK_INVENTORY',
            payload: { webhookId, topic, body: req.body },
            maxAttempts: 5,
        });

        const job = await queue.add(
            'shopify-webhook-inventory',
            { syncJobId: syncJob.id },
            { attempts: syncJob.maxAttempts, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
        );
        await shopifySyncService.setBullJobId(syncJob.id, String(job.id || ''));

        return res.json({ success: true });
    } catch {
        return res.json({ success: true });
    }
});

router.post('/webhooks/app_uninstalled', async (req: Request, res: Response) => {
    try {
        const rawBody = (req as any).rawBody as Buffer | undefined;
        if (!rawBody) return res.status(400).json({ error: 'Missing raw body' });

        const validated = await shopifyService.validateWebhook({ rawBody, rawRequest: req, rawResponse: res });
        if (!validated?.valid) return res.status(401).json({ error: 'Invalid webhook HMAC' });

        const shopDomain = String((validated as any).domain || req.headers['x-shopify-shop-domain'] || '');

        const store = await shopifyService.getActiveStore();
        if (store?.shop === shopDomain) {
            await shopifyService.disconnect(store.id);
        } else {
            const { prisma } = await import('../index');
            const found = await (prisma as any).shopifyStore.findUnique({ where: { shop: shopDomain } });
            if (found) await shopifyService.disconnect(found.id);
        }

        return res.json({ success: true });
    } catch {
        return res.json({ success: true });
    }
});

router.post('/sync/pull', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });

        const queue = await getShopifySyncQueue();

        const type = String(req.body?.type || 'PRODUCTS');
        const allowed = new Set([
            'PRODUCTS',
            'INVENTORY',
            'ORDERS',
            'CUSTOMERS',
            'DISCOUNTS',
            'COLLECTIONS',
            'LOCATIONS',
            'GIFT_CARDS',
            'COMPANIES',
        ]);
        if (!allowed.has(type)) return res.status(400).json({ error: 'Invalid sync type' });
        const payload = req.body?.payload || {};

        const syncJob = await shopifySyncService.createJob({
            storeId: store.id,
            direction: 'PULL',
            type: type as any,
            payload,
            userId: req.user?.id,
        });

        if (!queue) {
            await shopifySyncService.process(syncJob.id);
            const { prisma } = await import('../index');
            const latest = await (prisma as any).shopifySyncJob.findUnique({ where: { id: syncJob.id } });
            return res.json({ success: true, mode: 'inline', warning: shopifySyncQueueLoadError, job: latest || syncJob });
        }

        const job = await queue.add(
            'shopify-sync-pull',
            { syncJobId: syncJob.id },
            { attempts: syncJob.maxAttempts, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
        );
        await shopifySyncService.setBullJobId(syncJob.id, String(job.id || ''));

        const { prisma } = await import('../index');
        const latest = await (prisma as any).shopifySyncJob.findUnique({ where: { id: syncJob.id } });
        return res.json({ success: true, mode: 'queue', job: latest || syncJob });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.post('/sync/push', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });

        const queue = await getShopifySyncQueue();

        const type = String(req.body?.type || 'PRODUCTS');
        const allowed = new Set(['PRODUCTS', 'INVENTORY', 'ORDERS', 'DISCOUNTS', 'COLLECTIONS', 'GIFT_CARDS']);
        if (!allowed.has(type)) return res.status(400).json({ error: 'Invalid sync type' });
        const payload = req.body?.payload || {};

        const syncJob = await shopifySyncService.createJob({
            storeId: store.id,
            direction: 'PUSH',
            type: type as any,
            payload,
            userId: req.user?.id,
        });

        if (!queue) {
            await shopifySyncService.process(syncJob.id);
            const { prisma } = await import('../index');
            const latest = await (prisma as any).shopifySyncJob.findUnique({ where: { id: syncJob.id } });
            return res.json({ success: true, mode: 'inline', warning: shopifySyncQueueLoadError, job: latest || syncJob });
        }

        const job = await queue.add(
            'shopify-sync-push',
            { syncJobId: syncJob.id },
            { attempts: syncJob.maxAttempts, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
        );
        await shopifySyncService.setBullJobId(syncJob.id, String(job.id || ''));

        const { prisma } = await import('../index');
        const latest = await (prisma as any).shopifySyncJob.findUnique({ where: { id: syncJob.id } });
        return res.json({ success: true, mode: 'queue', job: latest || syncJob });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.get('/sync/jobs', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.json({ success: true, jobs: [] });

        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const take = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

        const where: any = { storeId: store.id };
        if (status) where.status = status;
        if (type) where.type = type;

        const { prisma } = await import('../index');
        const jobs = await (prisma as any).shopifySyncJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
        });
        return res.json({ success: true, jobs });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/sync/summary', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.json({ success: true, storeId: null, summary: {} });

        const { prisma } = await import('../index');
        const take = Math.min(1000, Math.max(1, Number(req.query.limit || 500)));

        const jobs = await (prisma as any).shopifySyncJob.findMany({
            where: { storeId: store.id },
            orderBy: { createdAt: 'desc' },
            take,
        });

        const byType: Record<string, any> = {};
        for (const j of jobs) {
            const k = `${j.direction}:${j.type}`;
            if (!byType[k]) byType[k] = j;
        }

        const counts: Record<string, Record<string, number>> = {};
        for (const j of jobs) {
            const k = `${j.direction}:${j.type}`;
            counts[k] = counts[k] || {};
            counts[k][j.status] = (counts[k][j.status] || 0) + 1;
        }

        return res.json({ success: true, storeId: store.id, latest: byType, counts });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.json({ success: true, logs: [] });

        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const take = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

        const where: any = { storeId: store.id };
        if (status) where.status = status;

        const { prisma } = await import('../index');
        const logs = await (prisma as any).shopifyAuditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
        });

        return res.json({ success: true, logs });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/products', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const limit = Math.min(250, Math.max(1, Number(req.query.limit || 50)));
        const since_id = typeof req.query.since_id === 'string' ? req.query.since_id : undefined;
        const data = await shopifyService.listProducts(store, { limit, since_id });
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.post('/products', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const result = await shopifyService.createProduct(store, req.body);
        return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.put('/products/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const result = await shopifyService.updateProduct(store, String(req.params.id), req.body);
        return res.json({ success: true, data: result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.delete('/products/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const result = await shopifyService.deleteProduct(store, String(req.params.id));
        return res.json({ success: true, data: result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.get('/collections', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.listCollections(store);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.post('/collections', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.createCollection(store, req.body);
        return res.status(201).json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.put('/collections/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.updateCollection(store, String(req.params.id), req.body);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.delete('/collections/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.deleteCollection(store, String(req.params.id));
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.get('/orders', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const limit = Math.min(250, Math.max(1, Number(req.query.limit || 50)));
        const since_id = typeof req.query.since_id === 'string' ? req.query.since_id : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : 'any';
        const data = await shopifyService.listOrders(store, { limit, since_id, status });
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.post('/orders', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.createOrder(store, req.body);
        return res.status(201).json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.get('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.getOrder(store, String(req.params.id));
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.put('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.updateOrder(store, String(req.params.id), req.body);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.post('/orders/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.cancelOrder(store, String(req.params.id), req.body || {});
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.post('/orders/:id/close', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.closeOrder(store, String(req.params.id));
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.delete('/orders/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const data = await shopifyService.deleteOrder(store, String(req.params.id));
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

router.get('/inventory-items/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Missing inventoryItemId' });
        const data = await shopifyService.resolveInventoryItem(store as any, id);
        return res.json({ success: true, inventoryItemId: id, data });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.put('/inventory-items/:id/tracked', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Missing inventoryItemId' });
        const tracked = req.body?.tracked === undefined ? true : !!req.body.tracked;
        const data = await shopifyService.setInventoryItemTracked(store as any, id, tracked);
        return res.json({ success: true, inventoryItemId: id, tracked, data });
    } catch (error: any) {
        return res.status(400).json({
            error: error?.message || 'Unknown error',
            statusCode: error?.statusCode,
            details: error?.details || null,
        });
    }
});

router.post('/webhooks/ensure', authMiddleware, async (req: Request, res: Response) => {
    try {
        const store = await shopifyService.getActiveStore();
        if (!store) return res.status(404).json({ error: 'Shopify store not connected' });

        const base = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
        const inventoryUrl = new URL('/api/integrations/shopify/webhooks/inventory_levels_update', base).toString();
        const uninstallUrl = new URL('/api/integrations/shopify/webhooks/app_uninstalled', base).toString();

        const results = await shopifyService.ensureWebhooks(store, [
            { topic: 'inventory_levels/update', address: inventoryUrl },
            { topic: 'app/uninstalled', address: uninstallUrl },
        ]);

        return res.json({ success: true, results });
    } catch (error: any) {
        return res.status(400).json({ error: error.message, details: error.details || null });
    }
});

export default router;
