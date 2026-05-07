import { prisma } from '../index';

export type StocktakeStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface CreateStocktakeDto {
    warehouseId: string;
    name: string;
    stocktakeDate: Date;
    notes?: string;
    locationIds?: string[];
    includeAllLocations?: boolean;
}

export interface CountItemDto {
    inventoryId: string;
    countedQty: number;
    notes?: string;
}

export class StocktakeService {
    private generateNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ST-${year}${month}-${random}`;
    }

    async create(dto: CreateStocktakeDto) {
        const stocktakeNumber = this.generateNumber();

        let locationFilter: any = { warehouseId: dto.warehouseId, isActive: true };
        if (dto.locationIds && dto.locationIds.length > 0) {
            locationFilter = { ...locationFilter, id: { in: dto.locationIds } };
        }

        const locations = await prisma.location.findMany({ where: locationFilter });
        const locationIds = locations.map(l => l.id);

        const inventories = await prisma.inventory.findMany({
            where: { locationId: { in: locationIds } },
            include: { item: true, location: true },
        });

        const stocktake = await prisma.stocktake.create({
            data: {
                stocktakeNumber,
                warehouseId: dto.warehouseId,
                name: dto.name,
                stocktakeDate: dto.stocktakeDate,
                status: 'DRAFT',
                notes: dto.notes,
                counts: {
                    create: inventories.map(inv => ({
                        inventoryId: inv.id,
                        itemId: inv.itemId,
                        locationId: inv.locationId,
                        systemQty: inv.onHandQty,
                    })),
                },
            },
            include: {
                warehouse: true,
                counts: {
                    include: { item: true, location: true },
                },
            },
        });

        return stocktake;
    }

    async findAll(params: {
        status?: StocktakeStatus;
        warehouseId?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, warehouseId, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (warehouseId) where.warehouseId = warehouseId;
        if (startDate || endDate) {
            where.stocktakeDate = {};
            if (startDate) where.stocktakeDate.gte = startDate;
            if (endDate) where.stocktakeDate.lte = endDate;
        }

        const [stocktakes, total] = await Promise.all([
            prisma.stocktake.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    warehouse: true,
                    _count: { select: { counts: true } },
                },
            }),
            prisma.stocktake.count({ where }),
        ]);

        return { stocktakes, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.stocktake.findUnique({
            where: { id },
            include: {
                warehouse: true,
                counts: {
                    include: {
                        item: true,
                        location: true,
                    },
                },
                adjustments: true,
            },
        });
    }

    async startCounting(id: string) {
        const stocktake = await prisma.stocktake.findUnique({ where: { id } });
        if (!stocktake) throw new Error('Stocktake not found');
        if (stocktake.status !== 'DRAFT') throw new Error('Can only start draft stocktakes');

        return prisma.stocktake.update({
            where: { id },
            data: { status: 'IN_PROGRESS' },
        });
    }

    async submitCount(id: string, counts: CountItemDto[]) {
        const stocktake = await prisma.stocktake.findUnique({ where: { id } });
        if (!stocktake) throw new Error('Stocktake not found');
        if (stocktake.status !== 'IN_PROGRESS') throw new Error('Stocktake must be in progress');

        await prisma.$transaction(async (tx) => {
            for (const count of counts) {
                await tx.stocktakeCount.update({
                    where: { id: count.inventoryId },
                    data: {
                        countedQty: count.countedQty,
                        notes: count.notes,
                        countedAt: new Date(),
                    },
                });
            }

            await tx.stocktake.update({
                where: { id },
                data: { status: 'PENDING_APPROVAL' },
            });
        });

        return this.findById(id);
    }

    async approve(id: string, userId: string) {
        const stocktake = await prisma.stocktake.findUnique({
            where: { id },
            include: { counts: { where: { countedQty: { not: null } } } },
        });

        if (!stocktake) throw new Error('Stocktake not found');
        if (stocktake.status !== 'PENDING_APPROVAL') throw new Error('Stocktake must be pending approval');

        const discrepancies = stocktake.counts.filter(
            c => c.countedQty !== undefined && c.systemQty !== c.countedQty
        );

        await prisma.$transaction(async (tx) => {
            for (const count of stocktake.counts) {
                if (count.countedQty === null || count.countedQty === undefined) continue;

                const difference = count.countedQty - count.systemQty;

                if (Math.abs(difference) > 0.001) {
                    await tx.stocktakeAdjustment.create({
                        data: {
                            stocktakeId: id,
                            inventoryId: count.inventoryId,
                            itemId: count.itemId,
                            locationId: count.locationId,
                            systemQty: count.systemQty,
                            countedQty: count.countedQty,
                            difference,
                            approvedBy: userId,
                            status: 'PENDING',
                        },
                    });
                }
            }

            await tx.stocktake.update({
                where: { id },
                data: { status: 'APPROVED' },
            });
        });

        return this.findById(id);
    }

    async reject(id: string, reason: string) {
        return prisma.stocktake.update({
            where: { id },
            data: { status: 'REJECTED', notes: reason },
        });
    }

    async applyAdjustments(id: string) {
        const stocktake = await prisma.stocktake.findUnique({
            where: { id },
            include: {
                adjustments: { where: { status: 'PENDING' } },
            },
        });

        if (!stocktake) throw new Error('Stocktake not found');
        if (stocktake.status !== 'APPROVED') throw new Error('Stocktake must be approved');

        await prisma.$transaction(async (tx) => {
            for (const adj of stocktake.adjustments) {
                await tx.inventory.update({
                    where: { id: adj.inventoryId },
                    data: {
                        onHandQty: { set: adj.countedQty },
                        availableQty: { set: adj.countedQty - adj.systemQty + (await tx.inventory.findUnique({ where: { id: adj.inventoryId } }))!.allocatedQty },
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        itemId: adj.itemId,
                        locationId: adj.locationId,
                        type: 'ADJUSTMENT',
                        quantity: adj.difference,
                        referenceId: stocktake.id,
                        remarks: `Stocktake: ${stocktake.stocktakeNumber}`,
                    },
                });

                await tx.stocktakeAdjustment.update({
                    where: { id: adj.id },
                    data: { status: 'COMPLETED' },
                });
            }

            await tx.stocktake.update({
                where: { id },
                data: { status: 'COMPLETED' },
            });
        });

        return this.findById(id);
    }

    async getDiscrepancies(id: string) {
        const stocktake = await prisma.stocktake.findUnique({
            where: { id },
            include: {
                counts: {
                    where: { countedQty: { not: null } },
                    include: { item: true, location: true },
                },
            },
        });

        if (!stocktake) return [];

        return stocktake.counts
            .filter(c => c.countedQty !== c.systemQty)
            .map(c => ({
                itemId: c.itemId,
                itemName: c.item.name,
                locationCode: c.location.code,
                systemQty: c.systemQty,
                countedQty: c.countedQty,
                difference: c.countedQty! - c.systemQty,
                notes: c.notes,
            }));
    }
}

export const stocktakeService = new StocktakeService();
