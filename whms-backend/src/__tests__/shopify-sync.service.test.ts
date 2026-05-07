import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { mockPrisma } from './setup';
import { shopifySyncService } from '../services/shopify-sync.service';
import { shopifyService } from '../services/shopify.service';

describe('ShopifySyncService.applyInventoryWebhook', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
    });

    test('applies inventory webhook once (idempotent by webhookId)', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: {},
        });

        mockPrisma.shopifyWebhookEvent.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'evt1', webhookId: 'wh_1' });

        mockPrisma.shopifyWebhookEvent.create.mockResolvedValue({ id: 'evt1' });
        mockPrisma.shopifyItemMapping.findFirst.mockResolvedValue({
            id: 'map1',
            itemId: 'item1',
            lastShopifyInventoryUpdatedAt: null,
        });
        mockPrisma.shopifyLocationMapping.findFirst.mockResolvedValue({
            id: 'lm1',
            warehouseId: 'wh1',
            shopifyLocationId: 'loc_shopify',
        });
        mockPrisma.location.findFirst.mockResolvedValue({ id: 'loc1' });
        mockPrisma.inventory.findFirst.mockResolvedValue(null);
        mockPrisma.inventory.create.mockResolvedValue({ id: 'inv1' });
        mockPrisma.shopifyItemMapping.update.mockResolvedValue({ id: 'map1' });
        mockPrisma.shopifyAuditLog.create.mockResolvedValue({ id: 'log1' });

        await shopifySyncService.applyInventoryWebhook('store1', {
            webhookId: 'wh_1',
            topic: 'inventory_levels/update',
            body: { location_id: 'loc_shopify', inventory_item_id: 'inv_it', available: 7, updated_at: '2026-01-01T00:00:00Z' },
        });

        expect(mockPrisma.inventory.create).toHaveBeenCalledTimes(1);

        await shopifySyncService.applyInventoryWebhook('store1', {
            webhookId: 'wh_1',
            topic: 'inventory_levels/update',
            body: { location_id: 'loc_shopify', inventory_item_id: 'inv_it', available: 9, updated_at: '2026-01-02T00:00:00Z' },
        });

        expect(mockPrisma.inventory.create).toHaveBeenCalledTimes(1);
    });

    test('skips when webhook payload is older than lastShopifyInventoryUpdatedAt', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: {},
        });

        mockPrisma.shopifyWebhookEvent.findUnique.mockResolvedValue(null);
        mockPrisma.shopifyWebhookEvent.create.mockResolvedValue({ id: 'evt2' });
        mockPrisma.shopifyItemMapping.findFirst.mockResolvedValue({
            id: 'map1',
            itemId: 'item1',
            lastShopifyInventoryUpdatedAt: '2026-01-03T00:00:00Z',
        });
        mockPrisma.shopifyLocationMapping.findFirst.mockResolvedValue({
            id: 'lm1',
            warehouseId: 'wh1',
            shopifyLocationId: 'loc_shopify',
        });
        mockPrisma.location.findFirst.mockResolvedValue({ id: 'loc1' });

        await shopifySyncService.applyInventoryWebhook('store1', {
            webhookId: 'wh_2',
            topic: 'inventory_levels/update',
            body: { location_id: 'loc_shopify', inventory_item_id: 'inv_it', available: 2, updated_at: '2026-01-01T00:00:00Z' },
        });

        expect(mockPrisma.inventory.create).toHaveBeenCalledTimes(0);
        expect(mockPrisma.inventory.update).toHaveBeenCalledTimes(0);
    });
});

describe('ShopifySyncService.pushInventory', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
        jest.restoreAllMocks();
    });

    test('enables inventory tracking then retries inventory push when tracking is disabled (422)', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: { defaultWarehouseId: 'wh1' },
        });

        mockPrisma.shopifyLocationMapping.findUnique.mockResolvedValue({
            id: 'lm1',
            storeId: 'store1',
            warehouseId: 'wh1',
            shopifyLocationId: 'loc_shopify',
        });

        mockPrisma.shopifyItemMapping.findMany.mockResolvedValue([
            { id: 'map1', itemId: 'item1', shopifyInventoryItemId: 'inv_it_1' },
        ]);

        mockPrisma.inventory.findMany.mockResolvedValue([{ onHandQty: 5 }]);

        const setInventoryLevelSpy = jest
            .spyOn(shopifyService as any, 'setInventoryLevel')
            .mockRejectedValueOnce({
                statusCode: 422,
                message: 'Shopify API request failed',
                details: { body: { errors: { base: ['Inventory item does not have inventory tracking enabled'] } } },
            })
            .mockResolvedValueOnce({});

        const setTrackedSpy = jest.spyOn(shopifyService as any, 'setInventoryItemTracked').mockResolvedValue({});

        mockPrisma.shopifyAuditLog.create.mockResolvedValue({ id: 'log1' });
        mockPrisma.shopifyItemMapping.update.mockResolvedValue({ id: 'map1' });

        await shopifySyncService.pushInventory('store1');

        expect(setInventoryLevelSpy).toHaveBeenCalledTimes(2);
        expect(setTrackedSpy).toHaveBeenCalledTimes(1);
        expect(mockPrisma.shopifyItemMapping.update).toHaveBeenCalledTimes(1);

        const calls = mockPrisma.shopifyAuditLog.create.mock.calls.map((c: any[]) => c?.[0]?.data?.action);
        expect(calls).toContain('INVENTORY_TRACKING_ENABLED');
        expect(calls).toContain('INVENTORY_PUSH_SUMMARY');
    });

    test('does not fail the whole job on unknown Shopify 422, logs and skips', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: { defaultWarehouseId: 'wh1' },
        });

        mockPrisma.shopifyLocationMapping.findUnique.mockResolvedValue({
            id: 'lm1',
            storeId: 'store1',
            warehouseId: 'wh1',
            shopifyLocationId: 'loc_shopify',
        });

        mockPrisma.shopifyItemMapping.findMany.mockResolvedValue([
            { id: 'map1', itemId: 'item1', shopifyInventoryItemId: 'inv_it_1' },
        ]);

        mockPrisma.inventory.findMany.mockResolvedValue([{ onHandQty: 5 }]);

        jest.spyOn(shopifyService as any, 'setInventoryLevel').mockRejectedValue({
            statusCode: 422,
            message: 'Shopify API request failed',
            details: { body: { errors: { location_id: ['is invalid'] } } },
        });

        mockPrisma.shopifyAuditLog.create.mockResolvedValue({ id: 'log1' });

        await shopifySyncService.pushInventory('store1');

        const calls = mockPrisma.shopifyAuditLog.create.mock.calls.map((c: any[]) => c?.[0]?.data?.action);
        expect(calls).toContain('INVENTORY_SKIPPED');
        expect(calls).toContain('INVENTORY_PUSH_SUMMARY');
    });

    test('skips inventory push for gift card item when location is fulfillment service (422)', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: { defaultWarehouseId: 'wh1' },
        });

        mockPrisma.shopifyLocationMapping.findUnique.mockResolvedValue({
            id: 'lm1',
            storeId: 'store1',
            warehouseId: 'wh1',
            shopifyLocationId: 'loc_shopify',
        });

        mockPrisma.shopifyItemMapping.findMany.mockResolvedValue([
            { id: 'map1', itemId: 'item1', shopifyInventoryItemId: 'inv_it_1' },
        ]);

        mockPrisma.inventory.findMany.mockResolvedValue([{ onHandQty: 5 }]);

        jest.spyOn(shopifyService as any, 'setInventoryLevel').mockRejectedValue({
            statusCode: 422,
            message: 'Shopify API request failed',
            details: { body: { errors: ['A fulfillment service location cannot hold gift cards'] } },
        });

        mockPrisma.shopifyAuditLog.create.mockResolvedValue({ id: 'log1' });

        await shopifySyncService.pushInventory('store1');

        const calls = mockPrisma.shopifyAuditLog.create.mock.calls.map((c: any[]) => c?.[0]?.data?.action);
        expect(calls).toContain('INVENTORY_SKIPPED');
        expect(calls).toContain('INVENTORY_PUSH_SUMMARY');
    });
});

describe('ShopifySyncService.pullCustomers', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
        jest.restoreAllMocks();
    });

    test('upserts customers from Shopify and paginates with since_id', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: {},
        });

        const listCustomersSpy = jest.spyOn(shopifyService as any, 'listCustomers').mockResolvedValueOnce({
            customers: [
                {
                    id: 1,
                    first_name: 'Budi',
                    last_name: 'Santoso',
                    email: 'budi@example.com',
                    phone: '0812',
                    default_address: {
                        address1: 'Jl. Mawar 1',
                        address2: 'No 2',
                        city: 'Jakarta',
                        province: 'DKI Jakarta',
                        zip: '12345',
                        country: 'Indonesia',
                    },
                },
                {
                    id: 2,
                    first_name: '',
                    last_name: '',
                    email: 'no-name@example.com',
                    default_address: {
                        address1: 'Jl. Melati',
                        city: 'Bandung',
                        province: 'Jawa Barat',
                        country: 'Indonesia',
                    },
                },
            ],
        });

        listCustomersSpy.mockResolvedValueOnce({
            customers: [
                {
                    id: 3,
                    first_name: 'Siti',
                    last_name: 'Aminah',
                    email: 'siti@example.com',
                    default_address: {},
                },
            ],
        });

        mockPrisma.customer.upsert.mockResolvedValue({ id: 'c1' });

        await shopifySyncService.pullCustomers('store1', { limit: 2 });

        expect(listCustomersSpy).toHaveBeenCalledTimes(2);
        expect(listCustomersSpy.mock.calls[0]?.[1]).toEqual({ limit: 2, since_id: undefined });
        expect(listCustomersSpy.mock.calls[1]?.[1]).toEqual({ limit: 2, since_id: '2' });

        expect(mockPrisma.customer.upsert).toHaveBeenCalledTimes(3);

        const first = mockPrisma.customer.upsert.mock.calls[0]?.[0];
        expect(first.where).toEqual({ code: 'SHOPIFY-1' });
        expect(first.create).toMatchObject({
            code: 'SHOPIFY-1',
            name: 'Budi Santoso',
            email: 'budi@example.com',
            phone: '0812',
            address: 'Jl. Mawar 1, No 2, Jakarta, DKI Jakarta, 12345, Indonesia',
        });

        const second = mockPrisma.customer.upsert.mock.calls[1]?.[0];
        expect(second.where).toEqual({ code: 'SHOPIFY-2' });
        expect(second.create).toMatchObject({
            code: 'SHOPIFY-2',
            name: 'no-name@example.com',
        });
    });
});

describe('ShopifySyncService.pullDiscounts', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
        jest.restoreAllMocks();
    });

    test('upserts percentage discount rule and maps entitled collections to WHMS categories', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: {},
        });

        jest.spyOn(shopifyService as any, 'listPriceRules').mockResolvedValue({
            price_rules: [
                {
                    id: 11,
                    title: 'PROMO 10%',
                    value_type: 'percentage',
                    value: '-10.0',
                    starts_at: '2026-01-01T00:00:00Z',
                    ends_at: '2026-12-31T00:00:00Z',
                    entitled_collection_ids: ['c1'],
                },
            ],
        });

        jest.spyOn(shopifyService as any, 'listDiscountCodes').mockResolvedValue({
            discount_codes: [{ id: 99, code: 'PROMO10' }],
        });

        mockPrisma.shopifyCollectionMapping.findMany.mockResolvedValue([{ categoryId: 'cat1' }]);
        mockPrisma.discountRule.upsert.mockResolvedValue({ id: 'dr1' });
        mockPrisma.shopifyDiscountMapping.upsert.mockResolvedValue({ id: 'sdm1' });

        await shopifySyncService.pullDiscounts('store1', { limit: 50 });

        expect(mockPrisma.discountRule.upsert).toHaveBeenCalledTimes(1);
        const call = mockPrisma.discountRule.upsert.mock.calls[0]?.[0];
        expect(call.where).toEqual({ code: 'PROMO10' });
        expect(call.create).toMatchObject({
            code: 'PROMO10',
            type: 'PERCENTAGE',
            value: 10,
        });
        expect(call.create.categories).toEqual({ connect: [{ id: 'cat1' }] });

        expect(mockPrisma.shopifyDiscountMapping.upsert).toHaveBeenCalledTimes(1);
        const mapCall = mockPrisma.shopifyDiscountMapping.upsert.mock.calls[0]?.[0];
        expect(mapCall.where).toEqual({ storeId_shopifyPriceRuleId: { storeId: 'store1', shopifyPriceRuleId: '11' } });
    });
});

describe('ShopifySyncService.pullCollections', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
        jest.restoreAllMocks();
    });

    test('does not violate unique (storeId, categoryId) when multiple Shopify collections share the same title', async () => {
        mockPrisma.shopifyStore.findUnique.mockResolvedValue({
            id: 'store1',
            shop: 'my-store.myshopify.com',
            accessTokenEnc: 'plain:tok',
            isActive: true,
            settings: {},
        });

        jest.spyOn(shopifyService as any, 'listCollections').mockResolvedValue({
            custom_collections: [
                { id: 1, title: 'SALE', body_html: '', handle: 'sale-1' },
                { id: 2, title: 'SALE', body_html: '', handle: 'sale-2' },
            ],
        });
        jest.spyOn(shopifyService as any, 'listSmartCollections').mockResolvedValue({ smart_collections: [] });
        jest.spyOn(shopifyService as any, 'listProductsByCollectionId').mockResolvedValue({ products: [] });

        mockPrisma.category.upsert.mockResolvedValue({ id: 'cat1', name: 'SALE' });

        mockPrisma.shopifyCollectionMapping.findUnique
            .mockResolvedValueOnce(null) // byCollection (id=1)
            .mockResolvedValueOnce({ id: 'map1', storeId: 'store1', categoryId: 'cat1', shopifyCollectionId: 'old' }) // byCategory
            .mockResolvedValueOnce(null) // byCollection (id=2)
            .mockResolvedValueOnce({ id: 'map1', storeId: 'store1', categoryId: 'cat1', shopifyCollectionId: '1' }); // byCategory again

        mockPrisma.shopifyCollectionMapping.update.mockResolvedValue({ id: 'map1' });

        await shopifySyncService.pullCollections('store1');

        expect(mockPrisma.shopifyCollectionMapping.create).toHaveBeenCalledTimes(0);
        expect(mockPrisma.shopifyCollectionMapping.update).toHaveBeenCalledTimes(2);
    });
});

describe('ShopifySyncService.process', () => {
    beforeEach(() => {
        for (const model of Object.values(mockPrisma)) {
            if (!model || typeof model !== 'object') continue;
            for (const fn of Object.values(model as any)) {
                if (typeof fn === 'function' && 'mockReset' in fn) (fn as any).mockReset();
            }
        }
        jest.restoreAllMocks();
    });

    test('marks job QUEUED (retry scheduled) on Shopify 429 when attempts remaining', async () => {
        mockPrisma.shopifySyncJob.findUnique.mockResolvedValue({
            id: 'job1',
            storeId: 'store1',
            direction: 'PULL',
            type: 'ORDERS',
            status: 'QUEUED',
            attempts: 0,
            maxAttempts: 5,
            payload: {},
            store: { id: 'store1', shop: 'my-store.myshopify.com', accessTokenEnc: 'plain:tok', isActive: true },
        });

        mockPrisma.shopifySyncJob.update.mockResolvedValue({ id: 'job1' });
        mockPrisma.shopifyAuditLog.create.mockResolvedValue({ id: 'log1' });
        mockPrisma.shopifyStore.update.mockResolvedValue({ id: 'store1' });

        jest.spyOn(shopifySyncService as any, 'pullOrders').mockRejectedValue({
            statusCode: 429,
            message: 'Shopify API request failed',
            details: { body: { errors: 'Exceeded order API rate limit' }, headers: { 'retry-after': '60' } },
        });

        await expect(shopifySyncService.process('job1')).rejects.toBeTruthy();

        const updates = mockPrisma.shopifySyncJob.update.mock.calls.map((c: any[]) => c?.[0]?.data);
        expect(updates.some((d: any) => d?.status === 'QUEUED' && d?.finishedAt === null)).toBe(true);

        const actions = mockPrisma.shopifyAuditLog.create.mock.calls.map((c: any[]) => c?.[0]?.data?.action);
        expect(actions).toContain('SYNC_RETRY_SCHEDULED');
    });
});
