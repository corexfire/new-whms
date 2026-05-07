import { prisma } from '../index';
import { shopifyService, ShopifySettings } from './shopify.service';

type SyncDirection = 'PULL' | 'PUSH';
type SyncType =
    | 'PRODUCTS'
    | 'INVENTORY'
    | 'ORDERS'
    | 'CUSTOMERS'
    | 'DISCOUNTS'
    | 'COLLECTIONS'
    | 'LOCATIONS'
    | 'GIFT_CARDS'
    | 'COMPANIES'
    | 'WEBHOOK_INVENTORY';
type SyncStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

const asNumber = (v: any, fallback = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

export class ShopifySyncService {
    private formatError(err: any) {
        const statusCode = err?.statusCode ? Number(err.statusCode) : undefined;
        const message = String(err?.message || 'Unknown error');
        const details = err?.details;
        const suffix = statusCode ? ` (status ${statusCode})` : '';
        const compact = `${message}${suffix}`;
        return { compact, statusCode, details };
    }

    async createJob(params: {
        storeId: string;
        direction: SyncDirection;
        type: SyncType;
        payload?: any;
        userId?: string;
        maxAttempts?: number;
    }) {
        const store = await shopifyService.getStoreById(params.storeId);
        if (!store || !store.isActive) throw new Error('Shopify store not connected');

        const job = await (prisma as any).shopifySyncJob.create({
            data: {
                storeId: params.storeId,
                direction: params.direction,
                type: params.type,
                status: 'QUEUED',
                maxAttempts: params.maxAttempts ?? 5,
                payload: params.payload ?? undefined,
            },
        });

        await (prisma as any).shopifyAuditLog.create({
            data: {
                storeId: params.storeId,
                userId: params.userId || null,
                action: 'SYNC_QUEUED',
                direction: params.direction,
                type: params.type,
                status: 'QUEUED',
                data: { syncJobId: job.id },
            },
        });

        return job;
    }

    async setBullJobId(syncJobId: string, bullJobId: string) {
        return await (prisma as any).shopifySyncJob.update({
            where: { id: syncJobId },
            data: { bullJobId: String(bullJobId) },
        });
    }

    async process(syncJobId: string) {
        const syncJob = await (prisma as any).shopifySyncJob.findUnique({
            where: { id: syncJobId },
            include: { store: true },
        });
        if (!syncJob) throw new Error('Sync job not found');
        if (!syncJob.store?.isActive) throw new Error('Shopify store not connected');

        const store = syncJob.store;
        const jobType = syncJob.type as SyncType;
        const direction = syncJob.direction as SyncDirection;
        const payload = syncJob.payload || {};

        await (prisma as any).shopifySyncJob.update({
            where: { id: syncJobId },
            data: { status: 'RUNNING', startedAt: new Date() },
        });

        await (prisma as any).shopifyAuditLog.create({
            data: {
                storeId: store.id,
                action: 'SYNC_STARTED',
                direction,
                type: jobType,
                status: 'RUNNING',
                data: { syncJobId },
            },
        });

        try {
            if (direction === 'PULL' && jobType === 'PRODUCTS') {
                await this.pullProducts(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'ORDERS') {
                await this.pullOrders(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'INVENTORY') {
                await this.pullInventory(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'CUSTOMERS') {
                await this.pullCustomers(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'COLLECTIONS') {
                await this.pullCollections(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'DISCOUNTS') {
                await this.pullDiscounts(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'LOCATIONS') {
                await this.pullLocations(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'GIFT_CARDS') {
                await this.pullGiftCards(store.id, payload);
            } else if (direction === 'PULL' && jobType === 'COMPANIES') {
                await this.pullCompanies(store.id, payload);
            } else if (jobType === 'WEBHOOK_INVENTORY') {
                await this.applyInventoryWebhook(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'PRODUCTS') {
                await this.pushProducts(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'INVENTORY') {
                await this.pushInventory(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'ORDERS') {
                await this.pushOrders(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'COLLECTIONS') {
                await this.pushCollections(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'DISCOUNTS') {
                await this.pushDiscounts(store.id, payload);
            } else if (direction === 'PUSH' && jobType === 'GIFT_CARDS') {
                await this.pushGiftCards(store.id, payload);
            } else {
                throw new Error('Unsupported sync job');
            }

            await (prisma as any).shopifySyncJob.update({
                where: { id: syncJobId },
                data: { status: 'SUCCESS', finishedAt: new Date(), lastError: null, attempts: syncJob.attempts ?? 0 },
            });

            await (prisma as any).shopifyAuditLog.create({
                data: {
                    storeId: store.id,
                    action: 'SYNC_FINISHED',
                    direction,
                    type: jobType,
                    status: 'SUCCESS',
                    data: { syncJobId },
                },
            });
        } catch (err: any) {
            const formatted = this.formatError(err);
            const nextAttempts = (syncJob.attempts ?? 0) + 1;
            const isRetryableRateLimit = formatted.statusCode === 429 && nextAttempts < (syncJob.maxAttempts ?? 5);
            const nextStatus: SyncStatus = isRetryableRateLimit ? 'QUEUED' : 'FAILED';

            await (prisma as any).shopifySyncJob.update({
                where: { id: syncJobId },
                data: {
                    status: nextStatus,
                    finishedAt: isRetryableRateLimit ? null : new Date(),
                    lastError: formatted.compact,
                    attempts: nextAttempts,
                },
            });

            await (prisma as any).shopifyAuditLog.create({
                data: {
                    storeId: store.id,
                    action: isRetryableRateLimit ? 'SYNC_RETRY_SCHEDULED' : 'SYNC_FAILED',
                    direction,
                    type: jobType,
                    status: nextStatus,
                    message: formatted.compact,
                    data: {
                        syncJobId,
                        error: formatted.details || null,
                        statusCode: formatted.statusCode || null,
                        retryable: isRetryableRateLimit,
                    },
                },
            });

            throw err;
        } finally {
            await (prisma as any).shopifyStore.update({
                where: { id: store.id },
                data: { lastSyncAt: new Date() },
            });
        }
    }

    private async getSettings(storeId: string): Promise<ShopifySettings> {
        const store = await (prisma as any).shopifyStore.findUnique({ where: { id: storeId } });
        return (store?.settings || {}) as ShopifySettings;
    }

    private async getStoreOrThrow(storeId: string) {
        const store = await shopifyService.getStoreById(storeId);
        if (!store || !store.isActive) throw new Error('Shopify store not connected');
        return store;
    }

    private async ensureUomId() {
        const existing = await (prisma as any).uoM.findFirst({ where: { code: 'PCS' } });
        if (existing) return existing.id as string;
        const created = await (prisma as any).uoM.create({ data: { code: 'PCS', description: 'Piece' } });
        return created.id as string;
    }

    async pullProducts(storeId: string, payload: { limit?: number; sinceId?: string } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const settings = await this.getSettings(storeId);
        const limit = payload.limit || 50;

        const data = await shopifyService.listProducts(store, { limit, since_id: payload.sinceId });
        const products: any[] = data.products || [];

        const uomId = await this.ensureUomId();

        for (const p of products) {
            const productCode = `SHOPIFY-${String(p.id || '').trim()}`;
            let categoryId: string | null = null;

            try {
                const collectsResp = await shopifyService.listCollectsByProductId(store, String(p.id), { limit: 50 });
                const collects: any[] = (collectsResp as any)?.collects || [];
                const firstCollectionId = collects.length ? String(collects[0]?.collection_id || '').trim() : '';
                if (firstCollectionId) {
                    const mapping = await (prisma as any).shopifyCollectionMapping.findUnique({
                        where: { storeId_shopifyCollectionId: { storeId, shopifyCollectionId: firstCollectionId } },
                    });
                    if (mapping?.categoryId) categoryId = String(mapping.categoryId);
                }
            } catch {
                categoryId = null;
            }

            if (!categoryId && p.product_type) {
                const categoryName = String(p.product_type || '').trim();
                if (categoryName) {
                    const category = await (prisma.category as any).upsert({
                        where: { name: categoryName },
                        create: { name: categoryName, description: null },
                        update: {},
                    });
                    categoryId = category.id;
                }
            }

            const wmsProduct = await (prisma as any).product.upsert({
                where: { code: productCode },
                create: {
                    code: productCode,
                    name: String(p.title || productCode),
                    description: typeof p.body_html === 'string' ? p.body_html : null,
                    categoryId,
                    isActive: true,
                    dataSource: 'SHOPIFY',
                },
                update: {
                    name: String(p.title || productCode),
                    description: typeof p.body_html === 'string' ? p.body_html : null,
                    dataSource: 'SHOPIFY',
                    ...(categoryId ? { categoryId } : {}),
                },
            });

            if (!categoryId && wmsProduct?.categoryId) categoryId = String(wmsProduct.categoryId);

            const variants: any[] = p.variants || [];
            for (const v of variants) {
                const rawSku = String(v.sku || '').trim();
                const fallbackSku = v.id ? `SHOPIFY-VAR-${String(v.id)}` : v.inventory_item_id ? `SHOPIFY-INV-${String(v.inventory_item_id)}` : '';
                const sku = rawSku || fallbackSku;
                if (!sku) continue;

                const existingItem = await (prisma.item as any).findUnique({ where: { sku } });
                let itemId: string;

                if (!existingItem) {
                    if (settings.autoCreateItemsFromShopify === false) continue;
                    const created = await (prisma.item as any).create({
                        data: {
                            sku,
                            name: String(p.title || sku),
                            description: typeof p.body_html === 'string' ? p.body_html : null,
                            categoryId,
                            productId: wmsProduct.id,
                            isActive: true,
                            dataSource: 'SHOPIFY',
                            color: v.option1 ? String(v.option1) : null,
                            size: v.option2 ? String(v.option2) : null,
                            variantAttributes: {
                                shopify: {
                                    productId: p.id ? String(p.id) : null,
                                    variantId: v.id ? String(v.id) : null,
                                    inventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : null,
                                    option1: v.option1 ?? null,
                                    option2: v.option2 ?? null,
                                    option3: v.option3 ?? null,
                                    imageUrl: (p.images?.[0]?.src as any) ? String(p.images[0].src) : null,
                                },
                            },
                            uoms: {
                                create: [
                                    {
                                        uomId,
                                        conversionRate: 1,
                                        price: asNumber(v.price, 0),
                                        barcode: null,
                                        barcodeType: 'CODE128',
                                    },
                                ],
                            },
                        },
                    });
                    itemId = created.id;
                } else {
                    itemId = existingItem.id;
                    await (prisma.item as any).update({
                        where: { id: itemId },
                        data: {
                            categoryId: categoryId ?? existingItem.categoryId,
                            productId: wmsProduct.id,
                            dataSource: existingItem.dataSource === 'SHOPIFY' ? 'SHOPIFY' : existingItem.dataSource,
                        },
                    });
                }

                await (prisma as any).shopifyItemMapping.upsert({
                    where: { storeId_itemId: { storeId, itemId } },
                    create: {
                        storeId,
                        itemId,
                        shopifyProductId: String(p.id),
                        shopifyVariantId: String(v.id),
                        shopifyInventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : null,
                    },
                    update: {
                        shopifyProductId: String(p.id),
                        shopifyVariantId: String(v.id),
                        shopifyInventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : null,
                    },
                });
            }
        }
    }

    async pullOrders(storeId: string, payload: { limit?: number; sinceId?: string } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const settings = await this.getSettings(storeId);
        const data = await shopifyService.listOrders(store, { limit: payload.limit || 50, since_id: payload.sinceId, status: 'any' });
        const orders: any[] = data.orders || [];

        const uomId = await this.ensureUomId();

        for (const o of orders) {
            const shopifyOrderId = String(o.id);
            const existingMap = await (prisma as any).shopifyOrderMapping.findUnique({ where: { shopifyOrderId } });
            if (existingMap) {
                const status = o.fulfillment_status === 'fulfilled' ? 'SHIPPED' : 'APPROVED';
                await (prisma.salesOrder as any).update({
                    where: { id: existingMap.salesOrderId },
                    data: { status },
                });
                continue;
            }

            const customerCode = `SHOPIFY-${String(o.customer?.id || o.id)}`;
            let customer = await (prisma.customer as any).findUnique({ where: { code: customerCode } });
            if (!customer) {
                customer = await (prisma.customer as any).create({
                    data: {
                        code: customerCode,
                        name: String(o.customer?.first_name || o.shipping_address?.name || 'Shopify Customer'),
                        address: o.shipping_address ? String(o.shipping_address?.address1 || '') : null,
                        phone: o.phone ? String(o.phone) : null,
                        email: o.email ? String(o.email) : null,
                    },
                });
            }

            const soNumber = `SHOPIFY-${shopifyOrderId}`;
            const orderDate = o.created_at ? new Date(o.created_at) : new Date();
            const status = o.fulfillment_status === 'fulfilled' ? 'SHIPPED' : 'APPROVED';

            const lineItems: any[] = o.line_items || [];
            const soItemsData: any[] = [];
            for (const li of lineItems) {
                const sku = String(li.sku || '').trim();
                if (!sku) continue;

                let item = await (prisma.item as any).findUnique({ where: { sku } });
                if (!item) {
                    if (settings.autoCreateItemsFromShopify === false) continue;
                    item = await (prisma.item as any).create({
                        data: {
                            sku,
                            name: String(li.title || sku),
                            isActive: true,
                            dataSource: 'SHOPIFY',
                            uoms: {
                                create: [
                                    {
                                        uomId,
                                        conversionRate: 1,
                                        price: asNumber(li.price, 0),
                                        barcode: null,
                                        barcodeType: 'CODE128',
                                    },
                                ],
                            },
                        },
                    });
                }

                const qty = asNumber(li.quantity, 0);
                const unitPrice = asNumber(li.price, 0);
                soItemsData.push({
                    itemId: item.id,
                    quantity: qty,
                    unitPrice,
                    totalPrice: unitPrice * qty,
                });
            }

            if (!soItemsData.length) continue;

            const totalAmount = asNumber(o.total_price, soItemsData.reduce((s, x) => s + x.totalPrice, 0));

            const createdSO = await (prisma.salesOrder as any).create({
                data: {
                    soNumber,
                    customerId: customer.id,
                    orderDate,
                    status,
                    totalAmount,
                    dataSource: 'SHOPIFY',
                    items: { create: soItemsData },
                },
            });

            await (prisma as any).shopifyOrderMapping.create({
                data: {
                    storeId,
                    salesOrderId: createdSO.id,
                    shopifyOrderId,
                    shopifyOrderName: o.name ? String(o.name) : null,
                },
            });
        }
    }

    async pullCustomers(storeId: string, payload: { limit?: number; sinceId?: string } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const limit = Math.min(250, Math.max(1, Number(payload.limit || 50)));
        let sinceId = payload.sinceId ? String(payload.sinceId) : undefined;

        for (;;) {
            const data = await shopifyService.listCustomers(store, { limit, since_id: sinceId });
            const customers: any[] = data.customers || [];
            if (!customers.length) return;

            for (const c of customers) {
                const shopifyCustomerId = String(c.id || '').trim();
                if (!shopifyCustomerId) continue;

                const firstName = String(c.first_name || '').trim();
                const lastName = String(c.last_name || '').trim();
                const nameRaw = `${firstName} ${lastName}`.trim();
                const name = nameRaw || String(c.email || 'Shopify Customer');

                const addr = c.default_address || {};
                const addressParts = [
                    addr.address1,
                    addr.address2,
                    addr.city,
                    addr.province,
                    addr.zip,
                    addr.country,
                ]
                    .map((v: any) => String(v || '').trim())
                    .filter(Boolean);
                const address = addressParts.length ? addressParts.join(', ') : null;

                const phoneRaw = c.phone || addr.phone;
                const emailRaw = c.email;

                const customerCode = `SHOPIFY-${shopifyCustomerId}`;
                await (prisma.customer as any).upsert({
                    where: { code: customerCode },
                    create: {
                        code: customerCode,
                        name,
                        address,
                        phone: phoneRaw ? String(phoneRaw) : null,
                        email: emailRaw ? String(emailRaw) : null,
                        dataSource: 'SHOPIFY',
                        externalMeta: {
                            shopify: {
                                id: shopifyCustomerId,
                                tags: c.tags ? String(c.tags) : null,
                                ordersCount: c.orders_count ?? null,
                                totalSpent: c.total_spent ?? null,
                                verifiedEmail: c.verified_email ?? null,
                            },
                        },
                    },
                    update: {
                        name,
                        address,
                        phone: phoneRaw ? String(phoneRaw) : null,
                        email: emailRaw ? String(emailRaw) : null,
                        dataSource: 'SHOPIFY',
                        externalMeta: {
                            shopify: {
                                id: shopifyCustomerId,
                                tags: c.tags ? String(c.tags) : null,
                                ordersCount: c.orders_count ?? null,
                                totalSpent: c.total_spent ?? null,
                                verifiedEmail: c.verified_email ?? null,
                            },
                        },
                    },
                });
            }

            if (customers.length < limit) return;

            const lastId = String(customers[customers.length - 1]?.id || '').trim();
            if (!lastId || lastId === sinceId) return;
            sinceId = lastId;
        }
    }

    async pullCollections(storeId: string, _payload: any = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const [custom, smart] = await Promise.all([
            shopifyService.listCollections(store),
            shopifyService.listSmartCollections(store),
        ]);

        const collections: any[] = [
            ...(((custom as any)?.custom_collections || []) as any[]),
            ...(((smart as any)?.smart_collections || []) as any[]),
        ];

        for (const col of collections) {
            const shopifyCollectionId = String(col.id || '').trim();
            if (!shopifyCollectionId) continue;

            const name = String(col.title || '').trim();
            if (!name) continue;

            const category = await (prisma.category as any).upsert({
                where: { name },
                create: { name, description: typeof col.body_html === 'string' ? col.body_html : null },
                update: { description: typeof col.body_html === 'string' ? col.body_html : undefined },
            });

            const byCollection = await (prisma as any).shopifyCollectionMapping.findUnique({
                where: { storeId_shopifyCollectionId: { storeId, shopifyCollectionId } },
            });
            const byCategory = await (prisma as any).shopifyCollectionMapping.findUnique({
                where: { storeId_categoryId: { storeId, categoryId: category.id } },
            });

            const desired = {
                storeId,
                categoryId: category.id,
                shopifyCollectionId,
                title: name,
                handle: col.handle ? String(col.handle) : null,
            };

            if (byCategory) {
                if (byCollection && byCollection.id !== byCategory.id) {
                    await (prisma as any).shopifyCollectionMapping.delete({ where: { id: byCollection.id } });
                }
                await (prisma as any).shopifyCollectionMapping.update({
                    where: { id: byCategory.id },
                    data: { shopifyCollectionId: desired.shopifyCollectionId, title: desired.title, handle: desired.handle },
                });
            } else if (byCollection) {
                await (prisma as any).shopifyCollectionMapping.update({
                    where: { id: byCollection.id },
                    data: { categoryId: desired.categoryId, title: desired.title, handle: desired.handle },
                });
            } else {
                await (prisma as any).shopifyCollectionMapping.create({ data: desired });
            }

            let sinceId: string | undefined = undefined;
            for (let page = 0; page < 20; page += 1) {
                const pr = await shopifyService.listProductsByCollectionId(store, { collectionId: shopifyCollectionId, limit: 250, since_id: sinceId });
                const prods: any[] = (pr as any)?.products || [];
                if (!prods.length) break;

                for (const p of prods) {
                    const shopifyProductId = String(p.id || '').trim();
                    if (!shopifyProductId) continue;

                    const productCode = `SHOPIFY-${shopifyProductId}`;
                    const wmsProduct = await (prisma as any).product.upsert({
                        where: { code: productCode },
                        create: {
                            code: productCode,
                            name: String(p.title || productCode),
                            description: typeof p.body_html === 'string' ? p.body_html : null,
                            categoryId: category.id,
                            isActive: true,
                            dataSource: 'SHOPIFY',
                        },
                        update: {
                            name: String(p.title || productCode),
                            description: typeof p.body_html === 'string' ? p.body_html : null,
                            categoryId: category.id,
                            dataSource: 'SHOPIFY',
                        },
                    });

                    const mappings: any[] = await (prisma as any).shopifyItemMapping.findMany({
                        where: { storeId, shopifyProductId: shopifyProductId },
                    });
                    for (const m of mappings) {
                        if (!m?.itemId) continue;
                        await (prisma.item as any).update({
                            where: { id: m.itemId },
                            data: { categoryId: category.id, productId: wmsProduct.id },
                        });
                    }
                }

                if (prods.length < 250) break;
                const lastId = String(prods[prods.length - 1]?.id || '').trim();
                if (!lastId || lastId === sinceId) break;
                sinceId = lastId;
            }
        }
    }

    async pushCollections(storeId: string, payload: { categoryIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);

        const where: any = payload.categoryIds?.length ? { id: { in: payload.categoryIds } } : {};
        const categories: any[] = await (prisma.category as any).findMany({ where });

        for (const cat of categories) {
            const existing = await (prisma as any).shopifyCollectionMapping.findUnique({
                where: { storeId_categoryId: { storeId, categoryId: cat.id } },
            });

            if (existing?.shopifyCollectionId) {
                try {
                    await shopifyService.updateCollection(store, String(existing.shopifyCollectionId), {
                        title: String(cat.name),
                        body_html: cat.description || '',
                    });
                    await (prisma as any).shopifyCollectionMapping.update({
                        where: { id: existing.id },
                        data: { title: String(cat.name) },
                    });
                    continue;
                } catch (err: any) {
                    const formatted = this.formatError(err);
                    if (formatted.statusCode !== 404) throw err;
                }
            }

            const created = await shopifyService.createCollection(store, {
                title: String(cat.name),
                body_html: cat.description || '',
            });
            const col = (created as any)?.custom_collection;
            const shopifyCollectionId = col?.id ? String(col.id) : '';
            if (!shopifyCollectionId) continue;

            if (existing?.id) {
                await (prisma as any).shopifyCollectionMapping.update({
                    where: { id: existing.id },
                    data: {
                        shopifyCollectionId,
                        title: String(cat.name),
                        handle: col.handle ? String(col.handle) : null,
                    },
                });
            } else {
                await (prisma as any).shopifyCollectionMapping.create({
                    data: {
                        storeId,
                        categoryId: cat.id,
                        shopifyCollectionId,
                        title: String(cat.name),
                        handle: col.handle ? String(col.handle) : null,
                    },
                });
            }
        }
    }

    async pullDiscounts(storeId: string, payload: { limit?: number; sinceId?: string } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const limit = Math.min(250, Math.max(1, Number(payload.limit || 50)));
        let sinceId = payload.sinceId ? String(payload.sinceId) : undefined;
        const now = new Date();

        for (;;) {
            const data = await shopifyService.listPriceRules(store, { limit, since_id: sinceId });
            const rules: any[] = (data as any)?.price_rules || [];
            if (!rules.length) return;

            for (const r of rules) {
                const priceRuleId = String(r.id || '').trim();
                if (!priceRuleId) continue;

                const codesResp = await shopifyService.listDiscountCodes(store, priceRuleId, { limit: 50 });
                const codes: any[] = (codesResp as any)?.discount_codes || [];
                const firstCode = codes.length ? String(codes[0]?.code || '').trim() : '';
                if (!firstCode) continue;

                const valueType = String(r.value_type || '').trim();
                const rawValue = asNumber(r.value, 0);
                const value = Math.abs(rawValue);
                const type = valueType === 'percentage' ? 'PERCENTAGE' : 'NOMINAL';

                const startsAt = r.starts_at ? new Date(r.starts_at) : now;
                const endsAt = r.ends_at ? new Date(r.ends_at) : null;
                const isActive = startsAt.getTime() <= now.getTime() && (!endsAt || endsAt.getTime() > now.getTime());

                const entitledCollectionIds: string[] = Array.isArray(r.entitled_collection_ids)
                    ? r.entitled_collection_ids.map((x: any) => String(x)).filter(Boolean)
                    : [];
                const mappedCategoryIds: string[] = [];
                if (entitledCollectionIds.length) {
                    const mappings: any[] = await (prisma as any).shopifyCollectionMapping.findMany({
                        where: { storeId, shopifyCollectionId: { in: entitledCollectionIds } },
                    });
                    for (const m of mappings) {
                        if (m?.categoryId) mappedCategoryIds.push(String(m.categoryId));
                    }
                }

                const discountRule = await (prisma.discountRule as any).upsert({
                    where: { code: firstCode },
                    create: {
                        name: String(r.title || firstCode),
                        code: firstCode,
                        description: null,
                        type,
                        value,
                        startDate: startsAt,
                        endDate: endsAt,
                        isActive,
                        categories: mappedCategoryIds.length ? { connect: mappedCategoryIds.map((id) => ({ id })) } : undefined,
                    },
                    update: {
                        name: String(r.title || firstCode),
                        type,
                        value,
                        startDate: startsAt,
                        endDate: endsAt,
                        isActive,
                        ...(mappedCategoryIds.length ? { categories: { set: mappedCategoryIds.map((id) => ({ id })) } } : {}),
                    },
                });

                await (prisma as any).shopifyDiscountMapping.upsert({
                    where: { storeId_shopifyPriceRuleId: { storeId, shopifyPriceRuleId: priceRuleId } },
                    create: {
                        storeId,
                        discountRuleId: discountRule.id,
                        shopifyPriceRuleId: priceRuleId,
                        shopifyDiscountCodeId: codes[0]?.id ? String(codes[0].id) : null,
                        code: firstCode,
                    },
                    update: {
                        discountRuleId: discountRule.id,
                        shopifyDiscountCodeId: codes[0]?.id ? String(codes[0].id) : null,
                        code: firstCode,
                    },
                });
            }

            if (rules.length < limit) return;
            const lastId = String(rules[rules.length - 1]?.id || '').trim();
            if (!lastId || lastId === sinceId) return;
            sinceId = lastId;
        }
    }

    async pushDiscounts(storeId: string, payload: { discountRuleIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const where: any = payload.discountRuleIds?.length ? { id: { in: payload.discountRuleIds } } : {};

        const rules: any[] = await (prisma.discountRule as any).findMany({
            where,
            include: { categories: true },
            orderBy: { createdAt: 'desc' },
        });

        for (const r of rules) {
            const code = String(r.code || '').trim();
            if (!code) continue;

            const existing = await (prisma as any).shopifyDiscountMapping.findUnique({
                where: { storeId_discountRuleId: { storeId, discountRuleId: r.id } },
            });

            const categoryIds = (r.categories || []).map((c: any) => c.id);
            let entitledCollectionIds: string[] = [];
            if (categoryIds.length) {
                const mappings: any[] = await (prisma as any).shopifyCollectionMapping.findMany({
                    where: { storeId, categoryId: { in: categoryIds } },
                });
                entitledCollectionIds = mappings.map((m) => String(m.shopifyCollectionId)).filter(Boolean);
            }

            const isPercentage = String(r.type) === 'PERCENTAGE';
            const valueType = isPercentage ? 'percentage' : 'fixed_amount';
            const value = isPercentage ? -Math.abs(asNumber(r.value, 0)) : -Math.abs(asNumber(r.value, 0));

            const basePayload: any = {
                title: String(r.name || code),
                target_type: 'line_item',
                target_selection: entitledCollectionIds.length ? 'entitled' : 'all',
                allocation_method: 'across',
                value_type: valueType,
                value: String(value),
                customer_selection: 'all',
                starts_at: r.startDate ? new Date(r.startDate).toISOString() : new Date().toISOString(),
                ends_at: r.endDate ? new Date(r.endDate).toISOString() : null,
                ...(entitledCollectionIds.length ? { entitled_collection_ids: entitledCollectionIds } : {}),
            };

            if (existing?.shopifyPriceRuleId) {
                await shopifyService.updatePriceRule(store, String(existing.shopifyPriceRuleId), basePayload);
                try {
                    const codesResp = await shopifyService.listDiscountCodes(store, String(existing.shopifyPriceRuleId), { limit: 250 });
                    const codes: any[] = (codesResp as any)?.discount_codes || [];
                    const hasCode = codes.some((c: any) => String(c.code || '').trim().toLowerCase() === code.toLowerCase());
                    if (!hasCode) await shopifyService.createDiscountCode(store, String(existing.shopifyPriceRuleId), code);
                } catch {
                    await shopifyService.createDiscountCode(store, String(existing.shopifyPriceRuleId), code);
                }
                continue;
            }

            const created = await shopifyService.createPriceRule(store, basePayload);
            const pr = (created as any)?.price_rule;
            const priceRuleId = pr?.id ? String(pr.id) : '';
            if (!priceRuleId) continue;

            const createdCode = await shopifyService.createDiscountCode(store, priceRuleId, code);
            const dc = (createdCode as any)?.discount_code;

            await (prisma as any).shopifyDiscountMapping.create({
                data: {
                    storeId,
                    discountRuleId: r.id,
                    shopifyPriceRuleId: priceRuleId,
                    shopifyDiscountCodeId: dc?.id ? String(dc.id) : null,
                    code,
                },
            });
        }
    }

    async pullLocations(storeId: string, _payload: any = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const data = await shopifyService.listLocations(store);
        const locations: any[] = (data as any)?.locations || [];

        for (const loc of locations) {
            const shopifyLocationId = String(loc.id || '').trim();
            if (!shopifyLocationId) continue;

            const addressParts = [
                loc.address1,
                loc.address2,
                loc.city,
                loc.province,
                loc.zip,
                loc.country,
            ]
                .map((v: any) => String(v || '').trim())
                .filter(Boolean);
            const address = addressParts.length ? addressParts.join(', ') : null;

            const existingMappingByShopifyLoc = await (prisma as any).shopifyLocationMapping.findUnique({
                where: { storeId_shopifyLocationId: { storeId, shopifyLocationId } },
            });

            if (existingMappingByShopifyLoc?.warehouseId) {
                const existingWarehouse = await (prisma.warehouse as any).findUnique({
                    where: { id: String(existingMappingByShopifyLoc.warehouseId) },
                });

                if (existingWarehouse?.id) {
                    const shouldOverwriteWarehouseFields =
                        String(existingWarehouse?.dataSource || '') === 'SHOPIFY' ||
                        String(existingWarehouse?.code || '').startsWith('SHP-');

                    await (prisma.warehouse as any).update({
                        where: { id: existingWarehouse.id },
                        data: {
                            ...(shouldOverwriteWarehouseFields
                                ? { name: String(loc.name || existingWarehouse.code), address, isActive: true, dataSource: 'SHOPIFY' }
                                : {}),
                            externalMeta: { ...(existingWarehouse.externalMeta || {}), shopify: loc },
                        },
                    });

                    const locationCode = `SHPLOC-${shopifyLocationId}`;
                    await (prisma.location as any).upsert({
                        where: { code: locationCode },
                        create: {
                            warehouseId: existingWarehouse.id,
                            code: locationCode,
                            capacity: null,
                            isActive: true,
                            dataSource: 'SHOPIFY',
                            externalMeta: { shopify: { locationId: shopifyLocationId } },
                        },
                        update: {
                            warehouseId: existingWarehouse.id,
                            isActive: true,
                            dataSource: 'SHOPIFY',
                            externalMeta: { shopify: { locationId: shopifyLocationId } },
                        },
                    });
                }

                continue;
            }

            const warehouseCode = `SHP-${shopifyLocationId}`;
            const wh = await (prisma.warehouse as any).upsert({
                where: { code: warehouseCode },
                create: {
                    code: warehouseCode,
                    name: String(loc.name || warehouseCode),
                    address,
                    isActive: true,
                    dataSource: 'SHOPIFY',
                    externalMeta: { shopify: loc },
                },
                update: {
                    name: String(loc.name || warehouseCode),
                    address,
                    isActive: true,
                    dataSource: 'SHOPIFY',
                    externalMeta: { shopify: loc },
                },
            });

            const defaultLocationCode = `SHPLOC-${shopifyLocationId}`;
            await (prisma.location as any).upsert({
                where: { code: defaultLocationCode },
                create: {
                    warehouseId: wh.id,
                    code: defaultLocationCode,
                    capacity: null,
                    isActive: true,
                    dataSource: 'SHOPIFY',
                    externalMeta: { shopify: { locationId: shopifyLocationId } },
                },
                update: {
                    warehouseId: wh.id,
                    isActive: true,
                    dataSource: 'SHOPIFY',
                    externalMeta: { shopify: { locationId: shopifyLocationId } },
                },
            });

            await (prisma as any).shopifyLocationMapping.upsert({
                where: { storeId_warehouseId: { storeId, warehouseId: wh.id } },
                create: { storeId, warehouseId: wh.id, shopifyLocationId },
                update: { shopifyLocationId },
            });
        }
    }

    async pullGiftCards(storeId: string, payload: { limit?: number; sinceId?: string } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const limit = Math.min(250, Math.max(1, Number(payload.limit || 50)));
        let sinceId = payload.sinceId ? String(payload.sinceId) : undefined;

        for (;;) {
            let data: any;
            try {
                data = await shopifyService.listGiftCards(store, { limit, since_id: sinceId });
            } catch (err: any) {
                const formatted = this.formatError(err);
                if (formatted.statusCode === 403 || formatted.statusCode === 404) {
                    await (prisma as any).shopifyAuditLog.create({
                        data: {
                            storeId,
                            action: 'GIFT_CARDS_UNAVAILABLE',
                            direction: 'PULL',
                            type: 'GIFT_CARDS',
                            status: 'SUCCESS',
                            message: 'Gift cards API is not available for this Shopify store/scopes',
                            data: { statusCode: formatted.statusCode, error: formatted.details || null },
                        },
                    });
                    return;
                }
                throw err;
            }

            const cards: any[] = (data as any)?.gift_cards || [];
            if (!cards.length) return;

            for (const g of cards) {
                const shopifyGiftCardId = String(g.id || '').trim();
                if (!shopifyGiftCardId) continue;

                const serialNumber = `SHOPIFY-${shopifyGiftCardId}`;
                const initialValue = asNumber(g.initial_value, asNumber(g.balance, 0));
                const balance = asNumber(g.balance, 0);
                const currency = g.currency ? String(g.currency) : 'IDR';
                const status = g.disabled_at ? 'DISABLED' : 'ACTIVE';
                const issuedAt = g.created_at ? new Date(g.created_at) : new Date();
                const expiresAt = g.expires_on ? new Date(g.expires_on) : null;

                const giftCard = await ((prisma as any).giftCard as any).upsert({
                    where: { serialNumber },
                    create: {
                        serialNumber,
                        initialValue,
                        balance,
                        currency,
                        status,
                        issuedAt,
                        expiresAt,
                        redeemedAt: null,
                        dataSource: 'SHOPIFY',
                        externalMeta: { shopify: g },
                    },
                    update: {
                        initialValue,
                        balance,
                        currency,
                        status,
                        issuedAt,
                        expiresAt,
                        dataSource: 'SHOPIFY',
                        externalMeta: { shopify: g },
                    },
                });

                await (prisma as any).shopifyGiftCardMapping.upsert({
                    where: { storeId_shopifyGiftCardId: { storeId, shopifyGiftCardId: shopifyGiftCardId } },
                    create: { storeId, giftCardId: giftCard.id, shopifyGiftCardId: shopifyGiftCardId },
                    update: { giftCardId: giftCard.id },
                });
            }

            if (cards.length < limit) return;
            const lastId = String(cards[cards.length - 1]?.id || '').trim();
            if (!lastId || lastId === sinceId) return;
            sinceId = lastId;
        }
    }

    async pushGiftCards(storeId: string, payload: { giftCardIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const where: any = payload.giftCardIds?.length ? { id: { in: payload.giftCardIds } } : {};
        const cards: any[] = await ((prisma as any).giftCard as any).findMany({ where });

        for (const c of cards) {
            const existing = await (prisma as any).shopifyGiftCardMapping.findUnique({
                where: { storeId_giftCardId: { storeId, giftCardId: c.id } },
            });
            if (existing) continue;

            const created = await shopifyService.createGiftCard(store, {
                initial_value: String(asNumber(c.initialValue, 0)),
                note: `WHMS GiftCard ${c.serialNumber}`,
                currency: c.currency ? String(c.currency) : undefined,
            });
            const gc = (created as any)?.gift_card;
            const shopifyGiftCardId = gc?.id ? String(gc.id) : '';
            if (!shopifyGiftCardId) continue;

            await (prisma as any).shopifyGiftCardMapping.create({
                data: { storeId, giftCardId: c.id, shopifyGiftCardId },
            });

            await ((prisma as any).giftCard as any).update({
                where: { id: c.id },
                data: {
                    dataSource: c.dataSource === 'SHOPIFY' ? 'SHOPIFY' : c.dataSource,
                    externalMeta: { ...(c.externalMeta || {}), shopify: gc || null },
                },
            });
        }
    }

    async pullCompanies(storeId: string, _payload: any = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const extract = (gidOrId: any) => {
            const v = String(gidOrId || '');
            const m = /\/(\d+)$/.exec(v);
            return m ? m[1] : '';
        };

        let after: string | undefined = undefined;
        for (let page = 0; page < 20; page += 1) {
            let resp: any;
            try {
                resp = await shopifyService.listCompanies(store, { first: 25, after });
            } catch (err: any) {
                const formatted = this.formatError(err);
                await (prisma as any).shopifyAuditLog.create({
                    data: {
                        storeId,
                        action: 'COMPANIES_UNAVAILABLE',
                        direction: 'PULL',
                        type: 'COMPANIES',
                        status: 'SUCCESS',
                        message: 'Companies (B2B) API is not available for this Shopify store/plan/scopes',
                        data: { statusCode: formatted.statusCode || null, error: formatted.details || null },
                    },
                });
                return;
            }

            const edges: any[] = resp?.edges || [];
            for (const e of edges) {
                const node = e?.node;
                if (!node?.id) continue;
                const numericId = extract(node.id);
                const code = `SHOPIFY-${numericId || String(node.id)}`;
                const company = await ((prisma as any).company as any).upsert({
                    where: { code },
                    create: {
                        code,
                        name: String(node.name || code),
                        address: null,
                        phone: null,
                        email: null,
                        priceTier: null,
                        isActive: true,
                        dataSource: 'SHOPIFY',
                        externalMeta: { shopify: node },
                    },
                    update: {
                        name: String(node.name || code),
                        dataSource: 'SHOPIFY',
                        externalMeta: { shopify: node },
                    },
                });

                await (prisma as any).shopifyCompanyMapping.upsert({
                    where: { storeId_shopifyCompanyId: { storeId, shopifyCompanyId: String(node.id) } },
                    create: { storeId, companyId: company.id, shopifyCompanyId: String(node.id) },
                    update: { companyId: company.id },
                });
            }

            const hasNext = !!resp?.pageInfo?.hasNextPage;
            if (!hasNext) return;
            const lastCursor = edges.length ? String(edges[edges.length - 1]?.cursor || '') : '';
            if (!lastCursor) return;
            after = lastCursor;
        }
    }

    async pushCompanies() {
        throw new Error('Companies (B2B) push is not supported yet');
    }

    async pullInventory(storeId: string, payload: { itemIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const settings = await this.getSettings(storeId);
        const defaultWarehouseId = settings.defaultWarehouseId || null;
        if (!defaultWarehouseId) throw new Error('Missing Shopify settings: defaultWarehouseId');

        const locationMap = await (prisma as any).shopifyLocationMapping.findUnique({
            where: { storeId_warehouseId: { storeId, warehouseId: defaultWarehouseId } },
        });
        if (!locationMap?.shopifyLocationId) throw new Error('Missing Shopify location mapping for default warehouse');

        const defaultLocation = await (prisma.location as any).findFirst({
            where: { warehouseId: defaultWarehouseId, isActive: true },
            orderBy: { code: 'asc' },
        });
        if (!defaultLocation) throw new Error('No active location found for default warehouse');

        const mappings: any[] = await (prisma as any).shopifyItemMapping.findMany({
            where: payload.itemIds?.length ? { storeId, itemId: { in: payload.itemIds } } : { storeId },
        });

        const ids = mappings.map((m) => m.shopifyInventoryItemId).filter(Boolean).map(String);
        const chunkSize = 50;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const levelsResp = await shopifyService.listInventoryLevels(store, {
                inventoryItemIds: chunk,
                locationIds: [String(locationMap.shopifyLocationId)],
            });
            const levels: any[] = (levelsResp as any).inventory_levels || [];

            for (const lvl of levels) {
                const inventoryItemId = String(lvl.inventory_item_id || '');
                const available = Math.max(0, Math.floor(asNumber(lvl.available, 0)));
                if (!inventoryItemId) continue;

                const map = mappings.find((m) => String(m.shopifyInventoryItemId || '') === inventoryItemId);
                if (!map) continue;

                const existing = await (prisma.inventory as any).findFirst({
                    where: { itemId: map.itemId, locationId: defaultLocation.id, itemLotId: null },
                });
                if (existing) {
                    await (prisma.inventory as any).update({
                        where: { id: existing.id },
                        data: { onHandQty: available, availableQty: available },
                    });
                } else {
                    await (prisma.inventory as any).create({
                        data: {
                            itemId: map.itemId,
                            locationId: defaultLocation.id,
                            itemLotId: null,
                            onHandQty: available,
                            allocatedQty: 0,
                            availableQty: available,
                        },
                    });
                }

                await (prisma as any).shopifyItemMapping.update({
                    where: { id: map.id },
                    data: { lastShopifyInventoryUpdatedAt: new Date() },
                });
            }
        }
    }

    async pushProducts(storeId: string, payload: { itemIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);

        const where: any = payload.itemIds?.length
            ? { id: { in: payload.itemIds } }
            : {};

        const items: any[] = await (prisma.item as any).findMany({
            where,
            include: { uoms: { orderBy: { conversionRate: 'asc' } } },
        });

        for (const item of items) {
            const existing = await (prisma as any).shopifyItemMapping.findUnique({
                where: { storeId_itemId: { storeId, itemId: item.id } },
            });
            if (existing) continue;

            const price = item.uoms?.[0]?.price ?? 0;
            const created = await shopifyService.createProduct(store, {
                title: item.name,
                body_html: item.description || '',
                variants: [
                    {
                        sku: item.sku,
                        price: String(price),
                        inventory_management: 'shopify',
                    },
                ],
            });

            const product = (created as any).product;
            const variant = product?.variants?.[0];
            if (!product?.id || !variant?.id) continue;

            await (prisma as any).shopifyItemMapping.create({
                data: {
                    storeId,
                    itemId: item.id,
                    shopifyProductId: String(product.id),
                    shopifyVariantId: String(variant.id),
                    shopifyInventoryItemId: variant.inventory_item_id ? String(variant.inventory_item_id) : null,
                },
            });
        }
    }

    async pushInventory(storeId: string, payload: { itemIds?: string[] } = {}) {
        const store = await this.getStoreOrThrow(storeId);
        const settings = await this.getSettings(storeId);
        const defaultWarehouseId = settings.defaultWarehouseId || null;
        if (!defaultWarehouseId) throw new Error('Missing Shopify settings: defaultWarehouseId');

        const locationMap = await (prisma as any).shopifyLocationMapping.findUnique({
            where: { storeId_warehouseId: { storeId, warehouseId: defaultWarehouseId } },
        });
        if (!locationMap?.shopifyLocationId) throw new Error('Missing Shopify location mapping for default warehouse');

        const mappings: any[] = await (prisma as any).shopifyItemMapping.findMany({
            where: payload.itemIds?.length ? { storeId, itemId: { in: payload.itemIds } } : { storeId },
        });

        let pushed = 0;
        let skippedNotTracked = 0;
        let fixedTrackingEnabled = 0;
        let fixedLevelConnected = 0;
        let skipped422 = 0;

        for (const m of mappings) {
            if (!m.shopifyInventoryItemId) continue;

            const invs: any[] = await (prisma.inventory as any).findMany({
                where: { itemId: m.itemId, location: { warehouseId: defaultWarehouseId } },
                include: { location: true },
            });
            const available = Math.max(0, Math.floor(invs.reduce((sum, row) => sum + asNumber(row.onHandQty, 0), 0)));

            try {
                await shopifyService.setInventoryLevel(store, {
                    location_id: String(locationMap.shopifyLocationId),
                    inventory_item_id: String(m.shopifyInventoryItemId),
                    available,
                });

                pushed += 1;

                await (prisma as any).shopifyItemMapping.update({
                    where: { id: m.id },
                    data: { lastWmsInventoryUpdatedAt: new Date() },
                });
            } catch (err: any) {
                const formatted = this.formatError(err);
                const collectStrings = (v: any): string[] => {
                    if (v === null || v === undefined) return [];
                    if (typeof v === 'string') return [v];
                    if (typeof v === 'number' || typeof v === 'boolean') return [String(v)];
                    if (Array.isArray(v)) return v.flatMap((x) => collectStrings(x));
                    if (typeof v === 'object') return Object.values(v).flatMap((x) => collectStrings(x));
                    return [];
                };

                const body = formatted?.details?.body;
                const errorsRaw = body?.errors ?? formatted?.details?.errors;
                const message = collectStrings(errorsRaw).filter(Boolean).join(' | ') || String(formatted?.compact || '');
                const messageLower = message.toLowerCase();

                if (formatted.statusCode === 422) {
                    const invItemId = String(m.shopifyInventoryItemId);
                    const shopifyLocationId = String(locationMap.shopifyLocationId);
                    const isGiftCardAtFulfillmentLocation =
                        messageLower.includes('gift card') && messageLower.includes('fulfillment service location');
                    const isFulfillmentServiceLocationRestricted =
                        messageLower.includes('fulfillment service location') &&
                        (messageLower.includes('cannot') || messageLower.includes('can not') || messageLower.includes("can't"));
                    const isNotTracked = messageLower.includes('inventory item') && messageLower.includes('tracking') && messageLower.includes('enabled');
                    const isNotStockedAtLocation =
                        messageLower.includes('not stocked') ||
                        messageLower.includes('stocked at the location') ||
                        messageLower.includes('inventory level') && messageLower.includes('connect');

                    if (isGiftCardAtFulfillmentLocation) {
                        skipped422 += 1;
                        await (prisma as any).shopifyAuditLog.create({
                            data: {
                                storeId: store.id,
                                action: 'INVENTORY_SKIPPED',
                                direction: 'PUSH',
                                type: 'INVENTORY',
                                status: 'FAILED',
                                message: 'Gift cards cannot be stocked at a fulfillment service location in Shopify',
                                entityType: 'Item',
                                entityId: m.itemId,
                                data: {
                                    shopifyInventoryItemId: invItemId,
                                    shopifyLocationId,
                                    available,
                                    error: formatted.details || null,
                                    statusCode: formatted.statusCode || null,
                                    reason: message,
                                },
                            },
                        });
                        continue;
                    }

                    if (isFulfillmentServiceLocationRestricted) {
                        skipped422 += 1;
                        await (prisma as any).shopifyAuditLog.create({
                            data: {
                                storeId: store.id,
                                action: 'INVENTORY_SKIPPED',
                                direction: 'PUSH',
                                type: 'INVENTORY',
                                status: 'FAILED',
                                message: 'Cannot adjust inventory at a fulfillment service location in Shopify',
                                entityType: 'Item',
                                entityId: m.itemId,
                                data: {
                                    shopifyInventoryItemId: invItemId,
                                    shopifyLocationId,
                                    available,
                                    error: formatted.details || null,
                                    statusCode: formatted.statusCode || null,
                                    reason: message,
                                },
                            },
                        });
                        continue;
                    }

                    if (isNotTracked) {
                        try {
                            await shopifyService.setInventoryItemTracked(store, invItemId, true);
                            await shopifyService.setInventoryLevel(store, {
                                location_id: shopifyLocationId,
                                inventory_item_id: invItemId,
                                available,
                            });

                            fixedTrackingEnabled += 1;
                            pushed += 1;

                            await (prisma as any).shopifyItemMapping.update({
                                where: { id: m.id },
                                data: { lastWmsInventoryUpdatedAt: new Date() },
                            });

                            await (prisma as any).shopifyAuditLog.create({
                                data: {
                                    storeId: store.id,
                                    action: 'INVENTORY_TRACKING_ENABLED',
                                    direction: 'PUSH',
                                    type: 'INVENTORY',
                                    status: 'SUCCESS',
                                    message: 'Enabled inventory tracking in Shopify and retried inventory update',
                                    entityType: 'Item',
                                    entityId: m.itemId,
                                    data: {
                                        shopifyInventoryItemId: invItemId,
                                        shopifyLocationId,
                                        available,
                                    },
                                },
                            });
                            continue;
                        } catch (e: any) {
                            const f2 = this.formatError(e);
                            skippedNotTracked += 1;
                            await (prisma as any).shopifyAuditLog.create({
                                data: {
                                    storeId: store.id,
                                    action: 'INVENTORY_SKIPPED',
                                    direction: 'PUSH',
                                    type: 'INVENTORY',
                                    status: 'FAILED',
                                    message: 'Inventory item is not tracked in Shopify (auto-fix failed)',
                                    entityType: 'Item',
                                    entityId: m.itemId,
                                    data: {
                                        shopifyInventoryItemId: invItemId,
                                        shopifyLocationId,
                                        available,
                                        error: f2.details || formatted.details || null,
                                        statusCode: f2.statusCode || formatted.statusCode || null,
                                        reason: message,
                                    },
                                },
                            });
                            continue;
                        }
                    }

                    if (isNotStockedAtLocation) {
                        try {
                            await shopifyService.connectInventoryLevel(store, {
                                location_id: shopifyLocationId,
                                inventory_item_id: invItemId,
                                relocate_if_necessary: true,
                            });
                            await shopifyService.setInventoryLevel(store, {
                                location_id: shopifyLocationId,
                                inventory_item_id: invItemId,
                                available,
                            });

                            fixedLevelConnected += 1;
                            pushed += 1;

                            await (prisma as any).shopifyItemMapping.update({
                                where: { id: m.id },
                                data: { lastWmsInventoryUpdatedAt: new Date() },
                            });

                            await (prisma as any).shopifyAuditLog.create({
                                data: {
                                    storeId: store.id,
                                    action: 'INVENTORY_LEVEL_CONNECTED',
                                    direction: 'PUSH',
                                    type: 'INVENTORY',
                                    status: 'SUCCESS',
                                    message: 'Connected inventory level to location in Shopify and retried inventory update',
                                    entityType: 'Item',
                                    entityId: m.itemId,
                                    data: {
                                        shopifyInventoryItemId: invItemId,
                                        shopifyLocationId,
                                        available,
                                    },
                                },
                            });
                            continue;
                        } catch (e: any) {
                            const f2 = this.formatError(e);
                            skipped422 += 1;
                            await (prisma as any).shopifyAuditLog.create({
                                data: {
                                    storeId: store.id,
                                    action: 'INVENTORY_SKIPPED',
                                    direction: 'PUSH',
                                    type: 'INVENTORY',
                                    status: 'FAILED',
                                    message: 'Inventory level could not be connected in Shopify',
                                    entityType: 'Item',
                                    entityId: m.itemId,
                                    data: {
                                        shopifyInventoryItemId: invItemId,
                                        shopifyLocationId,
                                        available,
                                        error: f2.details || formatted.details || null,
                                        statusCode: f2.statusCode || formatted.statusCode || null,
                                        reason: message,
                                    },
                                },
                            });
                            continue;
                        }
                    }

                    skipped422 += 1;
                    await (prisma as any).shopifyAuditLog.create({
                        data: {
                            storeId: store.id,
                            action: 'INVENTORY_SKIPPED',
                            direction: 'PUSH',
                            type: 'INVENTORY',
                            status: 'FAILED',
                            message: 'Shopify rejected inventory update (422)',
                            entityType: 'Item',
                            entityId: m.itemId,
                            data: {
                                shopifyInventoryItemId: invItemId,
                                shopifyLocationId,
                                available,
                                error: formatted.details || null,
                                statusCode: formatted.statusCode || null,
                                reason: message,
                            },
                        },
                    });
                    continue;
                }

                throw err;
            }
        }

        await (prisma as any).shopifyAuditLog.create({
            data: {
                storeId: store.id,
                action: 'INVENTORY_PUSH_SUMMARY',
                direction: 'PUSH',
                type: 'INVENTORY',
                status: 'SUCCESS',
                data: { pushed, fixedTrackingEnabled, fixedLevelConnected, skippedNotTracked, skipped422 },
            },
        });
    }

    async pushOrders(
        storeId: string,
        payload: {
            salesOrderIds?: string[];
            financialStatus?: 'paid' | 'pending';
            shippingTitle?: string;
            shippingPrice?: number;
            paymentGateway?: string;
            paymentReference?: string;
        } = {}
    ) {
        const store = await this.getStoreOrThrow(storeId);
        const where: any = payload.salesOrderIds?.length ? { id: { in: payload.salesOrderIds } } : {};
        const orders: any[] = await (prisma.salesOrder as any).findMany({
            where,
            include: { items: { include: { item: true } }, customer: true },
        });

        for (const so of orders) {
            const existing = await (prisma as any).shopifyOrderMapping.findUnique({ where: { storeId_salesOrderId: { storeId, salesOrderId: so.id } } });
            if (existing) continue;

            const line_items = (so.items || []).map((it: any) => ({
                sku: it.item?.sku || '',
                title: it.item?.name || '',
                quantity: asNumber(it.quantity, 0),
                price: String(asNumber(it.unitPrice, 0)),
            })).filter((x: any) => x.sku && x.quantity > 0);

            if (!line_items.length) continue;

            const shippingPrice = payload.shippingPrice !== undefined ? asNumber(payload.shippingPrice, 0) : null;
            const shipping_lines = shippingPrice !== null ? [{ title: payload.shippingTitle || 'Shipping', price: String(shippingPrice) }] : undefined;

            const financial_status = payload.financialStatus || 'paid';
            const transactions =
                financial_status === 'paid'
                    ? [
                          {
                              kind: 'sale',
                              status: 'success',
                              amount: String(asNumber(so.totalAmount, 0)),
                              gateway: payload.paymentGateway || 'manual',
                          },
                      ]
                    : undefined;

            const created = await shopifyService.createOrder(store, {
                email: so.customer?.email || undefined,
                financial_status,
                line_items,
                shipping_lines,
                transactions,
                note_attributes: payload.paymentReference ? [{ name: 'payment_reference', value: String(payload.paymentReference) }] : undefined,
            });

            const createdOrder = (created as any).order;
            if (!createdOrder?.id) continue;

            await (prisma as any).shopifyOrderMapping.create({
                data: {
                    storeId,
                    salesOrderId: so.id,
                    shopifyOrderId: String(createdOrder.id),
                    shopifyOrderName: createdOrder.name ? String(createdOrder.name) : null,
                },
            });
        }
    }

    async applyInventoryWebhook(storeId: string, payload: any) {
        const store = await this.getStoreOrThrow(storeId);
        if (!payload?.webhookId || !payload?.topic) throw new Error('Invalid webhook payload');

        const existing = await (prisma as any).shopifyWebhookEvent.findUnique({ where: { webhookId: String(payload.webhookId) } });
        if (existing) return;

        await (prisma as any).shopifyWebhookEvent.create({
            data: {
                storeId,
                webhookId: String(payload.webhookId),
                topic: String(payload.topic),
                payload: payload.body,
            },
        });

        const body = payload.body || {};
        const shopifyLocationId = body.location_id ? String(body.location_id) : null;
        const inventoryItemId = body.inventory_item_id ? String(body.inventory_item_id) : null;
        const available = Math.max(0, Math.floor(asNumber(body.available, 0)));
        const updatedAt = body.updated_at ? new Date(body.updated_at) : new Date();

        if (!shopifyLocationId || !inventoryItemId) return;

        const mapping = await (prisma as any).shopifyItemMapping.findFirst({
            where: { storeId, shopifyInventoryItemId: inventoryItemId },
        });
        if (!mapping) return;

        const locationMapping = await (prisma as any).shopifyLocationMapping.findFirst({
            where: { storeId, shopifyLocationId },
        });
        if (!locationMapping) return;

        const last = mapping.lastShopifyInventoryUpdatedAt ? new Date(mapping.lastShopifyInventoryUpdatedAt) : null;
        if (last && last.getTime() >= updatedAt.getTime()) return;

        const defaultLocation = await (prisma.location as any).findFirst({
            where: { warehouseId: locationMapping.warehouseId, isActive: true },
            orderBy: { code: 'asc' },
        });
        if (!defaultLocation) return;

        const existingInv = await (prisma.inventory as any).findFirst({
            where: { itemId: mapping.itemId, locationId: defaultLocation.id, itemLotId: null },
        });
        if (existingInv) {
            await (prisma.inventory as any).update({
                where: { id: existingInv.id },
                data: { onHandQty: available, availableQty: available },
            });
        } else {
            await (prisma.inventory as any).create({
                data: {
                    itemId: mapping.itemId,
                    locationId: defaultLocation.id,
                    itemLotId: null,
                    onHandQty: available,
                    allocatedQty: 0,
                    availableQty: available,
                },
            });
        }

        await (prisma as any).shopifyItemMapping.update({
            where: { id: mapping.id },
            data: { lastShopifyInventoryUpdatedAt: updatedAt },
        });

        await (prisma as any).shopifyAuditLog.create({
            data: {
                storeId: store.id,
                action: 'WEBHOOK_APPLIED',
                direction: 'PULL',
                type: 'WEBHOOK_INVENTORY',
                status: 'SUCCESS',
                entityType: 'Item',
                entityId: mapping.itemId,
                data: { shopifyLocationId, inventoryItemId, available },
            },
        });
    }
}

export const shopifySyncService = new ShopifySyncService();
