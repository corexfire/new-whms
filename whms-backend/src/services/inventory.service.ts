import { prisma } from '../index';

export interface StockSummary {
    itemId: string;
    itemName: string;
    itemSku: string;
    totalOnHand: number;
    totalAllocated: number;
    totalAvailable: number;
}

export interface StockByLocation {
    locationId: string;
    locationCode: string;
    warehouseId: string;
    warehouseName: string;
    onHandQty: number;
    allocatedQty: number;
    availableQty: number;
    lotNumber?: string;
    expiryDate?: Date;
}

export interface MovementFilter {
    itemId?: string;
    locationId?: string;
    warehouseId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
}

export class InventoryService {
    async getSummary(params: {
        itemId?: string;
        warehouseId?: string;
        categoryId?: string;
        search?: string;
        lowStock?: boolean;
        page?: number;
        limit?: number;
    }) {
        const { itemId, warehouseId, categoryId, search, lowStock, page = 1, limit = 50 } = params;
        const skip = (page - 1) * limit;

        const itemWhere: any = {};
        if (itemId) itemWhere.id = itemId;
        if (search) {
            itemWhere.OR = [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId) itemWhere.categoryId = categoryId;

        const inventoryWhere: any = {};
        if (itemId) inventoryWhere.itemId = itemId;
        if (warehouseId) inventoryWhere.location = { warehouseId };

        // Filter items by search/category first, then get their inventories
        const matchingItems = await prisma.item.findMany({
            where: itemWhere,
            select: { id: true },
        });
        const itemIds = matchingItems.map(i => i.id);

        if (itemIds.length === 0) {
            return { summaries: [], total: 0, page, limit, totalPages: 0 };
        }

        // Now filter inventories by those itemIds
        const inventoryWhereWithItems = {
            ...inventoryWhere,
            itemId: { in: itemIds },
        };

        const inventories = await prisma.inventory.findMany({
            where: inventoryWhereWithItems,
            include: {
                item: true,
                location: true,
                itemLot: true,
            },
        });

        const summaryMap = new Map<string, StockSummary>();

        for (const inv of inventories) {
            if (!inv.item) continue;

            if (!summaryMap.has(inv.itemId)) {
                summaryMap.set(inv.itemId, {
                    itemId: inv.itemId,
                    itemName: inv.item.name,
                    itemSku: inv.item.sku,
                    totalOnHand: 0,
                    totalAllocated: 0,
                    totalAvailable: 0,
                });
            }

            const summary = summaryMap.get(inv.itemId)!;
            summary.totalOnHand += inv.onHandQty;
            summary.totalAllocated += inv.allocatedQty;
            summary.totalAvailable += inv.availableQty;
        }

        let summaries = Array.from(summaryMap.values());

        if (lowStock) {
            summaries = summaries.filter(s => s.totalAvailable <= 10);
        }

        const total = summaries.length;
        summaries = summaries
            .slice(skip, skip + limit);

        return { summaries, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getByLocation(locationId: string) {
        return prisma.inventory.findMany({
            where: { locationId },
            include: {
                item: { include: { category: true } },
                itemLot: true,
            },
            orderBy: { item: { name: 'asc' } },
        });
    }

    async getByItem(itemId: string) {
        return prisma.inventory.findMany({
            where: { itemId },
            include: {
                location: { include: { warehouse: true } },
                itemLot: true,
            },
            orderBy: { location: { code: 'asc' } },
        });
    }

    async getByWarehouse(warehouseId: string) {
        return prisma.inventory.findMany({
            where: { location: { warehouseId } },
            include: {
                item: { include: { category: true } },
                location: true,
                itemLot: true,
            },
            orderBy: { item: { name: 'asc' } },
        });
    }

    async getStockByLot(itemId: string) {
        return prisma.inventory.findMany({
            where: { itemId, itemLotId: { not: null } },
            include: {
                location: true,
                itemLot: true,
            },
            orderBy: { itemLot: { expiryDate: 'asc' } },
        });
    }

    async getLots(params: {
        expiry?: 'ALL' | 'EXPIRING' | 'EXPIRED' | 'OK';
        days?: number;
        warehouseId?: string;
        itemId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { expiry = 'ALL', days = 30, warehouseId, itemId, search, page = 1, limit = 50 } = params;
        const skip = (page - 1) * limit;
        const now = new Date();
        const expiringUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const and: any[] = [];

        if (search) {
            and.push({
                OR: [
                    { item: { sku: { contains: search, mode: 'insensitive' } } },
                    { item: { name: { contains: search, mode: 'insensitive' } } },
                    { itemLot: { lotNumber: { contains: search, mode: 'insensitive' } } },
                ],
            });
        }

        if (expiry === 'EXPIRED') {
            and.push({ itemLot: { expiryDate: { lt: now } } });
        } else if (expiry === 'EXPIRING') {
            and.push({ itemLot: { expiryDate: { gte: now, lte: expiringUntil } } });
        } else if (expiry === 'OK') {
            and.push({
                OR: [
                    { itemLot: { expiryDate: null } },
                    { itemLot: { expiryDate: { gt: expiringUntil } } },
                ],
            });
        }

        const where: any = {
            itemLotId: { not: null },
            itemLot: { isActive: true },
        };

        if (warehouseId) where.location = { warehouseId };
        if (itemId) where.itemId = itemId;
        if (and.length > 0) where.AND = and;

        const [lots, total] = await Promise.all([
            prisma.inventory.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { item: { sku: 'asc' } },
                    { itemLot: { expiryDate: 'asc' } },
                    { location: { code: 'asc' } },
                ],
                include: {
                    item: true,
                    itemLot: true,
                    location: { include: { warehouse: true } },
                },
            }),
            prisma.inventory.count({ where }),
        ]);

        return { lots, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getLotDetail(lotId: string) {
        const lot = await prisma.itemLot.findUnique({
            where: { id: lotId },
            include: { item: true },
        });
        if (!lot) return null;

        const inventories = await prisma.inventory.findMany({
            where: { itemLotId: lotId },
            include: { location: { include: { warehouse: true } } },
            orderBy: { location: { code: 'asc' } },
        });

        const totals = inventories.reduce(
            (acc, inv) => {
                acc.onHand += inv.onHandQty;
                acc.allocated += inv.allocatedQty;
                acc.available += inv.availableQty;
                return acc;
            },
            { onHand: 0, allocated: 0, available: 0 }
        );

        return { lot, inventories, totals };
    }

    async getMovements(filter: MovementFilter, page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (filter.itemId) where.itemId = filter.itemId;
        if (filter.locationId) where.locationId = filter.locationId;
        if (filter.warehouseId) where.location = { warehouseId: filter.warehouseId };
        if (filter.type) where.type = filter.type;
        if (filter.startDate || filter.endDate) {
            where.createdAt = {};
            if (filter.startDate) where.createdAt.gte = filter.startDate;
            if (filter.endDate) where.createdAt.lte = filter.endDate;
        }

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    item: true,
                    location: { include: { warehouse: true } },
                    itemLot: true,
                },
            }),
            prisma.stockMovement.count({ where }),
        ]);

        return { movements, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getMovementSummary(itemId: string, startDate: Date, endDate: Date) {
        const movements = await prisma.stockMovement.findMany({
            where: {
                itemId,
                createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: { createdAt: 'asc' },
        });

        const summary = {
            opening: 0,
            totalIn: 0,
            totalOut: 0,
            closing: 0,
        };

        for (const m of movements) {
            if (m.type === 'IN' || m.type === 'ADJUSTMENT' && m.quantity > 0) {
                summary.totalIn += m.quantity;
            } else if (m.type === 'OUT' || m.type === 'ADJUSTMENT' && m.quantity < 0) {
                summary.totalOut += Math.abs(m.quantity);
            }
        }

        return summary;
    }

    async reserveStock(itemId: string, locationId: string, quantity: number, referenceId: string): Promise<boolean> {
        const inventory = await prisma.inventory.findFirst({
            where: { itemId, locationId },
        });

        if (!inventory || inventory.availableQty < quantity) {
            return false;
        }

        await prisma.$transaction([
            prisma.inventory.update({
                where: { id: inventory.id },
                data: {
                    allocatedQty: { increment: quantity },
                    availableQty: { decrement: quantity },
                },
            }),
            prisma.stockMovement.create({
                data: {
                    itemId,
                    locationId,
                    type: 'TRANSFER',
                    quantity: 0,
                    referenceId,
                    remarks: `Reserved ${quantity} for ${referenceId}`,
                },
            }),
        ]);

        return true;
    }

    async releaseReservation(itemId: string, locationId: string, quantity: number, referenceId: string): Promise<boolean> {
        const inventory = await prisma.inventory.findFirst({
            where: { itemId, locationId },
        });

        if (!inventory) return false;

        await prisma.$transaction([
            prisma.inventory.update({
                where: { id: inventory.id },
                data: {
                    allocatedQty: { decrement: quantity },
                    availableQty: { increment: quantity },
                },
            }),
            prisma.stockMovement.create({
                data: {
                    itemId,
                    locationId,
                    type: 'TRANSFER',
                    quantity: 0,
                    referenceId,
                    remarks: `Released reservation ${quantity} for ${referenceId}`,
                },
            }),
        ]);

        return true;
    }
}

export const inventoryService = new InventoryService();
