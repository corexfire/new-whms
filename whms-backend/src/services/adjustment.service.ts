import { prisma } from '../index';
import { journalService } from './journal.service';

export type AdjustmentReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'FOUND' | 'CORRECTION' | 'OTHER';

export interface CreateAdjustmentDto {
    itemId: string;
    locationId: string;
    quantity: number;
    reason: AdjustmentReason;
    notes?: string;
}

export class AdjustmentService {
    private generateNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ADJ-${year}${month}-${random}`;
    }

    async create(dto: CreateAdjustmentDto, userId: string) {
        const inventory = await prisma.inventory.findFirst({
            where: { itemId: dto.itemId, locationId: dto.locationId },
            include: { item: true },
        });

        if (!inventory) throw new Error('Inventory record not found');

        if (inventory.onHandQty + dto.quantity < 0) {
            throw new Error('Adjustment would result in negative stock');
        }

        const adjustmentNumber = this.generateNumber();

        return prisma.$transaction(async (tx) => {
            const adjustment = await tx.stockAdjustment.create({
                data: {
                    adjustmentNumber,
                    itemId: dto.itemId,
                    locationId: dto.locationId,
                    quantity: dto.quantity,
                    reason: dto.reason,
                    notes: dto.notes,
                    createdBy: userId,
                    previousQty: inventory.onHandQty,
                    newQty: inventory.onHandQty + dto.quantity,
                },
                include: {
                    item: true,
                    location: true,
                },
            });

            await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                    onHandQty: { increment: dto.quantity },
                    availableQty: { increment: dto.quantity },
                },
            });

            await tx.stockMovement.create({
                data: {
                    itemId: dto.itemId,
                    locationId: dto.locationId,
                    type: 'ADJUSTMENT',
                    quantity: dto.quantity,
                    referenceId: adjustment.id,
                    remarks: `${dto.reason}: ${dto.notes || 'No notes'}`,
                },
            });

            return adjustment;
        });
    }

    async findAll(params: {
        reason?: AdjustmentReason;
        itemId?: string;
        warehouseId?: string;
        locationId?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { reason, itemId, warehouseId, locationId, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (reason) where.reason = reason;
        if (itemId) where.itemId = itemId;
        if (locationId) where.locationId = locationId;
        if (warehouseId) where.location = { warehouseId };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [adjustments, total] = await Promise.all([
            prisma.stockAdjustment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    item: true,
                    location: { include: { warehouse: true } },
                },
            }),
            prisma.stockAdjustment.count({ where }),
        ]);

        return { adjustments, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.stockAdjustment.findUnique({
            where: { id },
            include: {
                item: true,
                location: { include: { warehouse: true } },
            },
        });
    }

    async void(id: string, reason: string, userId: string) {
        const adjustment = await prisma.stockAdjustment.findUnique({
            where: { id },
            include: { item: true },
        });

        if (!adjustment) throw new Error('Adjustment not found');

        const inventory = await prisma.inventory.findFirst({
            where: { itemId: adjustment.itemId, locationId: adjustment.locationId },
        });

        if (!inventory) throw new Error('Inventory not found');

        await prisma.$transaction(async (tx) => {
            await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                    onHandQty: { decrement: adjustment.quantity },
                    availableQty: { decrement: adjustment.quantity },
                },
            });

            await tx.stockMovement.create({
                data: {
                    itemId: adjustment.itemId,
                    locationId: adjustment.locationId,
                    type: 'ADJUSTMENT',
                    quantity: -adjustment.quantity,
                    referenceId: adjustment.id,
                    remarks: `VOIDED: ${reason}`,
                },
            });

            await tx.stockAdjustment.update({
                where: { id },
                data: {
                    voided: true,
                    voidedBy: userId,
                    voidedAt: new Date(),
                    voidReason: reason,
                },
            });
        });
    }
}

export const adjustmentService = new AdjustmentService();
