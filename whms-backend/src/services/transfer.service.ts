import { prisma } from '../index';

export type TransferStatus = 'DRAFT' | 'SUBMITTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface CreateTransferDto {
    fromWarehouseId: string;
    toWarehouseId: string;
    reason: string;
    notes?: string;
    items: Array<{
        itemId: string;
        fromLocationId: string;
        toLocationId: string;
        quantity: number;
        lotNumber?: string;
    }>;
}

export class TransferService {
    private generateNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `TRF-${year}${month}-${random}`;
    }

    async create(dto: CreateTransferDto) {
        await this.validateDraft(dto);

        const transferNumber = this.generateNumber();

        return prisma.stockTransfer.create({
            data: {
                transferNumber,
                fromWarehouseId: dto.fromWarehouseId,
                toWarehouseId: dto.toWarehouseId,
                reason: dto.reason,
                status: 'DRAFT',
                notes: dto.notes,
                items: {
                    create: dto.items.map(line => ({
                        itemId: line.itemId,
                        fromLocationId: line.fromLocationId,
                        toLocationId: line.toLocationId,
                        quantity: line.quantity,
                        lotNumber: line.lotNumber,
                    })),
                },
            },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                items: {
                    include: {
                        item: true,
                        fromLocation: true,
                        toLocation: true,
                    },
                },
            },
        });
    }

    async update(id: string, dto: CreateTransferDto) {
        const transfer = await prisma.stockTransfer.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'DRAFT') throw new Error('Only draft transfers can be updated');

        await this.validateDraft(dto);

        return prisma.stockTransfer.update({
            where: { id },
            data: {
                fromWarehouseId: dto.fromWarehouseId,
                toWarehouseId: dto.toWarehouseId,
                reason: dto.reason,
                notes: dto.notes,
                items: {
                    deleteMany: {},
                    create: dto.items.map((line) => ({
                        itemId: line.itemId,
                        fromLocationId: line.fromLocationId,
                        toLocationId: line.toLocationId,
                        quantity: line.quantity,
                        lotNumber: line.lotNumber,
                    })),
                },
            },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                items: {
                    include: {
                        item: true,
                        fromLocation: true,
                        toLocation: true,
                    },
                },
            },
        });
    }

    async delete(id: string) {
        const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'DRAFT') throw new Error('Only draft transfers can be deleted');
        await prisma.stockTransferItem.deleteMany({ where: { stockTransferId: id } });
        await prisma.stockTransfer.delete({ where: { id } });
        return true;
    }

    async findAll(params: {
        status?: TransferStatus;
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
        if (warehouseId) {
            where.OR = [
                { fromWarehouseId: warehouseId },
                { toWarehouseId: warehouseId },
            ];
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [transfers, total] = await Promise.all([
            prisma.stockTransfer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    _count: { select: { items: true } },
                },
            }),
            prisma.stockTransfer.count({ where }),
        ]);

        return { transfers, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.stockTransfer.findUnique({
            where: { id },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                items: {
                    include: {
                        item: true,
                        fromLocation: true,
                        toLocation: true,
                    },
                },
            },
        });
    }

    async submit(id: string) {
        const transfer = await prisma.stockTransfer.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'DRAFT') throw new Error('Only draft transfers can be submitted');

        for (const line of transfer.items) {
            if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Quantity must be greater than 0');

            const item = await prisma.item.findUnique({ where: { id: line.itemId }, select: { id: true, trackLot: true } });
            if (!item) throw new Error(`Item not found: ${line.itemId}`);

            let lotId: string | null = null;
            if (item.trackLot) {
                if (!line.lotNumber) throw new Error('Lot number is required for lot-tracked item');
                const lot = await prisma.itemLot.findFirst({ where: { itemId: line.itemId, lotNumber: line.lotNumber } });
                if (!lot) throw new Error(`Lot not found: ${line.lotNumber}`);
                lotId = lot.id;
            }

            const inventory = await prisma.inventory.findFirst({
                where: { itemId: line.itemId, locationId: line.fromLocationId, itemLotId: lotId },
            });

            if (!inventory || inventory.availableQty < line.quantity) {
                throw new Error(`Insufficient stock for item ${line.itemId}`);
            }
        }

        return prisma.stockTransfer.update({
            where: { id },
            data: { status: 'SUBMITTED' },
            include: { items: true },
        });
    }

    async startTransit(id: string) {
        const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'SUBMITTED') throw new Error('Transfer must be submitted to start transit');
        return prisma.stockTransfer.update({
            where: { id },
            data: { status: 'IN_TRANSIT' },
        });
    }

    async complete(id: string, userId: string) {
        const transfer = await prisma.stockTransfer.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status !== 'IN_TRANSIT') throw new Error('Transfer must be in transit');

        await prisma.$transaction(async (tx) => {
            for (const item of transfer.items) {
                const dbItem = await tx.item.findUnique({ where: { id: item.itemId }, select: { id: true, trackLot: true } });
                if (!dbItem) throw new Error(`Item not found: ${item.itemId}`);

                let lotId: string | null = null;
                if (dbItem.trackLot) {
                    if (!item.lotNumber) throw new Error('Lot number is required for lot-tracked item');
                    const lot = await tx.itemLot.findFirst({ where: { itemId: item.itemId, lotNumber: item.lotNumber } });
                    if (!lot) throw new Error(`Lot not found: ${item.lotNumber}`);
                    lotId = lot.id;
                }

                const fromInv = await tx.inventory.findFirst({
                    where: { itemId: item.itemId, locationId: item.fromLocationId, itemLotId: lotId },
                });
                if (!fromInv) throw new Error('Inventory record not found at from location');
                if (fromInv.onHandQty < item.quantity) throw new Error('Transfer would result in negative stock at from location');

                await tx.inventory.update({
                    where: { id: fromInv.id },
                    data: {
                        onHandQty: { decrement: item.quantity },
                        availableQty: { decrement: item.quantity },
                    },
                });

                const toInv = await tx.inventory.findFirst({
                    where: { itemId: item.itemId, locationId: item.toLocationId, itemLotId: lotId },
                });
                if (toInv) {
                    await tx.inventory.update({
                        where: { id: toInv.id },
                        data: {
                            onHandQty: { increment: item.quantity },
                            availableQty: { increment: item.quantity },
                        },
                    });
                } else {
                    await tx.inventory.create({
                        data: {
                            itemId: item.itemId,
                            locationId: item.toLocationId,
                            itemLotId: lotId,
                            onHandQty: item.quantity,
                            allocatedQty: 0,
                            availableQty: item.quantity,
                        },
                    });
                }

                await tx.stockMovement.create({
                    data: {
                        itemId: item.itemId,
                        locationId: item.fromLocationId,
                        type: 'TRANSFER',
                        quantity: -item.quantity,
                        referenceId: transfer.id,
                        remarks: `Transfer Out: ${transfer.transferNumber}`,
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        itemId: item.itemId,
                        locationId: item.toLocationId,
                        type: 'TRANSFER',
                        quantity: item.quantity,
                        referenceId: transfer.id,
                        remarks: `Transfer In: ${transfer.transferNumber}`,
                    },
                });
            }

            await tx.stockTransfer.update({
                where: { id },
                data: { status: 'COMPLETED' },
            });
        });

        return this.findById(id);
    }

    async cancel(id: string, reason: string) {
        const transfer = await prisma.stockTransfer.findUnique({ where: { id } });

        if (!transfer) throw new Error('Transfer not found');
        if (transfer.status === 'COMPLETED') throw new Error('Cannot cancel completed transfer');
        if (!reason) throw new Error('Cancel reason is required');

        return prisma.stockTransfer.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                notes: `${transfer.notes || ''}\nCancelled: ${reason}`,
            },
        });
    }

    private async validateDraft(dto: CreateTransferDto) {
        if (!dto.fromWarehouseId) throw new Error('From warehouse is required');
        if (!dto.toWarehouseId) throw new Error('To warehouse is required');
        if (dto.fromWarehouseId === dto.toWarehouseId) throw new Error('From and to warehouse cannot be the same');
        if (!Array.isArray(dto.items) || dto.items.length === 0) throw new Error('Transfer items are required');

        for (const line of dto.items) {
            if (!line.itemId) throw new Error('Item is required');
            if (!line.fromLocationId) throw new Error('From location is required');
            if (!line.toLocationId) throw new Error('To location is required');
            if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Quantity must be greater than 0');

            const [fromLoc, toLoc, item] = await Promise.all([
                prisma.location.findUnique({ where: { id: line.fromLocationId }, select: { id: true, warehouseId: true } }),
                prisma.location.findUnique({ where: { id: line.toLocationId }, select: { id: true, warehouseId: true } }),
                prisma.item.findUnique({ where: { id: line.itemId }, select: { id: true, trackLot: true } }),
            ]);

            if (!item) throw new Error(`Item not found: ${line.itemId}`);
            if (!fromLoc) throw new Error('From location not found');
            if (!toLoc) throw new Error('To location not found');
            if (fromLoc.warehouseId !== dto.fromWarehouseId) throw new Error('From location is not in selected from warehouse');
            if (toLoc.warehouseId !== dto.toWarehouseId) throw new Error('To location is not in selected to warehouse');

            let lotId: string | null = null;
            if (item.trackLot) {
                if (!line.lotNumber) throw new Error('Lot number is required for lot-tracked item');
                const lot = await prisma.itemLot.findFirst({ where: { itemId: line.itemId, lotNumber: line.lotNumber } });
                if (!lot) throw new Error(`Lot not found: ${line.lotNumber}`);
                lotId = lot.id;
            } else if (line.lotNumber) {
                throw new Error('Lot number is not applicable for this item');
            }

            const inventory = await prisma.inventory.findFirst({
                where: {
                    itemId: line.itemId,
                    locationId: line.fromLocationId,
                    itemLotId: lotId,
                },
            });

            if (!inventory || inventory.availableQty < line.quantity) {
                throw new Error(`Insufficient stock for item ${line.itemId} at from location`);
            }
        }
    }
}

export const transferService = new TransferService();
