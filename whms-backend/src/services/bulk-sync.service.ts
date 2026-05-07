import { prisma } from '../index';

export interface BulkSyncData {
    items?: any[];
    customers?: any[];
    suppliers?: any[];
    warehouses?: any[];
    locations?: any[];
    prices?: any[];
}

export interface BulkSyncResult {
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export class BulkSyncService {
    async syncItems(items: any[]): Promise<BulkSyncResult> {
        const result: BulkSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

        for (const item of items) {
            try {
                const existing = await prisma.item.findFirst({
                    where: {
                        OR: [
                            { id: item.id },
                            { sku: item.sku },
                        ],
                    },
                });

                if (existing) {
                    await prisma.item.update({
                        where: { id: existing.id },
                        data: {
                            name: item.name,
                            description: item.description,
                            categoryId: item.categoryId,
                            trackLot: item.trackLot,
                            trackExpiry: item.trackExpiry,
                        },
                    });
                    result.updated++;
                } else {
                    await prisma.item.create({
                        data: {
                            id: item.id,
                            sku: item.sku,
                            name: item.name,
                            description: item.description,
                            categoryId: item.categoryId,
                            trackLot: item.trackLot || false,
                            trackExpiry: item.trackExpiry || false,
                        },
                    });
                    result.imported++;
                }
            } catch (error: any) {
                result.errors.push(`${item.sku || item.id}: ${error.message}`);
                result.skipped++;
            }
        }

        return result;
    }

    async syncCustomers(customers: any[]): Promise<BulkSyncResult> {
        const result: BulkSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

        for (const customer of customers) {
            try {
                const existing = await prisma.customer.findFirst({
                    where: {
                        OR: [
                            { id: customer.id },
                            { code: customer.code },
                        ],
                    },
                });

                if (existing) {
                    await prisma.customer.update({
                        where: { id: existing.id },
                        data: {
                            name: customer.name,
                            address: customer.address,
                            phone: customer.phone,
                            email: customer.email,
                        },
                    });
                    result.updated++;
                } else {
                    await prisma.customer.create({
                        data: {
                            id: customer.id,
                            code: customer.code,
                            name: customer.name,
                            address: customer.address,
                            phone: customer.phone,
                            email: customer.email,
                        },
                    });
                    result.imported++;
                }
            } catch (error: any) {
                result.errors.push(`${customer.code || customer.id}: ${error.message}`);
                result.skipped++;
            }
        }

        return result;
    }

    async syncPrices(priceUpdates: any[]): Promise<BulkSyncResult> {
        const result: BulkSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

        for (const update of priceUpdates) {
            try {
                if (update.itemUoMId) {
                    await prisma.itemUoM.update({
                        where: { id: update.itemUoMId },
                        data: {
                            price: update.price,
                            conversionRate: update.conversionRate,
                        },
                    });
                    result.updated++;
                } else if (update.itemId && update.uomId) {
                    await prisma.itemUoM.upsert({
                        where: {
                            itemId_uomId: {
                                itemId: update.itemId,
                                uomId: update.uomId,
                            },
                        },
                        create: {
                            itemId: update.itemId,
                            uomId: update.uomId,
                            price: update.price,
                            conversionRate: update.conversionRate || 1,
                            barcode: update.barcode,
                        },
                        update: {
                            price: update.price,
                            conversionRate: update.conversionRate,
                        },
                    });
                    result.updated++;
                }
            } catch (error: any) {
                result.errors.push(`${update.itemId}: ${error.message}`);
                result.skipped++;
            }
        }

        return result;
    }

    async syncInventory(inventoryUpdates: any[]): Promise<BulkSyncResult> {
        const result: BulkSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

        for (const update of inventoryUpdates) {
            try {
                await prisma.inventory.upsert({
                    where: {
                        itemId_locationId_itemLotId: {
                            itemId: update.itemId,
                            locationId: update.locationId,
                            itemLotId: update.lotId || null,
                        },
                    },
                    create: {
                        itemId: update.itemId,
                        locationId: update.locationId,
                        itemLotId: update.lotId || null,
                        onHandQty: update.onHandQty || 0,
                        allocatedQty: 0,
                        availableQty: update.onHandQty || 0,
                    },
                    update: {
                        onHandQty: update.onHandQty,
                        availableQty: update.onHandQty,
                    },
                });
                result.updated++;
            } catch (error: any) {
                result.errors.push(`${update.itemId}: ${error.message}`);
                result.skipped++;
            }
        }

        return result;
    }

    async processBulkSync(data: BulkSyncData) {
        const results: any = {};

        if (data.items) {
            results.items = await this.syncItems(data.items);
        }

        if (data.customers) {
            results.customers = await this.syncCustomers(data.customers);
        }

        if (data.prices) {
            results.prices = await this.syncPrices(data.prices);
        }

        if (data.inventory) {
            results.inventory = await this.syncInventory(data.inventory);
        }

        return {
            success: true,
            results,
            timestamp: new Date().toISOString(),
        };
    }

    async getMasterDataVersion() {
        const [items, customers, warehouses] = await Promise.all([
            prisma.item.count(),
            prisma.customer.count(),
            prisma.warehouse.count(),
        ]);

        const lastUpdated = await prisma.item.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        });

        return {
            version: Date.now(),
            counts: { items, customers, warehouses },
            lastUpdated: lastUpdated?.updatedAt,
        };
    }
}

export const bulkSyncService = new BulkSyncService();
