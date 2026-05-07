import { prisma } from '../index';
import { purchaseOrderService } from './purchase-order.service';
import { journalService } from './journal.service';

export type GRNStatus = 'DRAFT' | 'COMPLETED' | 'VOIDED';

export interface CreateGRNDto {
    purchaseOrderId: string;
    receiptDate?: Date;
    notes?: string;
    items: Array<{
        poItemId: string;
        itemId: string;
        receivedQty: number;
        lotNumber?: string;
        locationId?: string;
    }>;
}

export class GoodsReceiptService {
    private generateGRNNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `GRN-${year}${month}-${random}`;
    }

    async create(dto: CreateGRNDto) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: dto.purchaseOrderId },
            include: { items: true },
        });

        if (!po) throw new Error('Purchase Order not found');
        if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
            throw new Error('Cannot create GRN for cancelled or closed PO');
        }

        const grnNumber = this.generateGRNNumber();

        const grn = await prisma.goodsReceipt.create({
            data: {
                grnNumber,
                purchaseOrderId: dto.purchaseOrderId,
                receiptDate: dto.receiptDate || new Date(),
                notes: dto.notes,
                status: 'DRAFT',
                items: {
                    create: dto.items.map(item => ({
                        poItemId: item.poItemId,
                        itemId: item.itemId,
                        receivedQty: item.receivedQty,
                        lotNumber: item.lotNumber,
                    })),
                },
            },
            include: {
                purchaseOrder: { include: { supplier: true } },
                items: {
                    include: {
                        item: {
                            include: {
                                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                            },
                        },
                        poItem: true,
                    },
                },
            },
        });

        return grn;
    }

    async findAll(params: {
        status?: GRNStatus;
        purchaseOrderId?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, purchaseOrderId, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
        if (startDate || endDate) {
            where.receiptDate = {};
            if (startDate) where.receiptDate.gte = startDate;
            if (endDate) where.receiptDate.lte = endDate;
        }

        const [grns, total] = await Promise.all([
            prisma.goodsReceipt.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    purchaseOrder: { include: { supplier: true } },
                    items: {
                        include: {
                            item: {
                                include: {
                                    uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.goodsReceipt.count({ where }),
        ]);

        return { grns, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.goodsReceipt.findUnique({
            where: { id },
            include: {
                purchaseOrder: { include: { supplier: true } },
                items: {
                    include: {
                        item: {
                            include: {
                                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                            },
                        },
                        poItem: true,
                    },
                },
            },
        });
    }

    async findByNumber(grnNumber: string) {
        return prisma.goodsReceipt.findUnique({
            where: { grnNumber },
            include: {
                purchaseOrder: { include: { supplier: true } },
                items: {
                    include: {
                        item: {
                            include: {
                                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                            },
                        },
                    },
                },
            },
        });
    }

    async update(id: string, dto: CreateGRNDto) {
        const existing = await prisma.goodsReceipt.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!existing) throw new Error('GRN not found');
        if (existing.status !== 'DRAFT') throw new Error('Only DRAFT GRN can be updated');
        if (existing.purchaseOrderId !== dto.purchaseOrderId) {
            throw new Error('purchaseOrderId cannot be changed');
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.gRNItem.deleteMany({ where: { goodsReceiptId: id } });

            return tx.goodsReceipt.update({
                where: { id },
                data: {
                    receiptDate: dto.receiptDate || existing.receiptDate,
                    notes: dto.notes,
                    items: {
                        create: dto.items.map((item) => ({
                            poItemId: item.poItemId,
                            itemId: item.itemId,
                            receivedQty: item.receivedQty,
                            lotNumber: item.lotNumber,
                        })),
                    },
                },
                include: {
                    purchaseOrder: { include: { supplier: true } },
                    items: {
                        include: {
                            item: {
                                include: {
                                    uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                                },
                            },
                            poItem: true,
                        },
                    },
                },
            });
        });

        return updated;
    }

    async complete(id: string, locationId: string, userId: string) {
        const grn = await prisma.goodsReceipt.findUnique({
            where: { id },
            include: {
                items: { include: { item: true, poItem: true } },
                purchaseOrder: { include: { supplier: true } },
            },
        });

        if (!grn) throw new Error('GRN not found');
        if (grn.status === 'COMPLETED') throw new Error('GRN already completed');
        if (grn.status === 'VOIDED') throw new Error('Cannot complete voided GRN');

        const result = await prisma.$transaction(async (tx) => {
            for (const grnItem of grn.items) {
                const item = grnItem.item;

                let lotId: string | null = null;
                if (item.trackLot && grnItem.lotNumber) {
                    const lot = await tx.itemLot.upsert({
                        where: {
                            itemId_lotNumber: {
                                itemId: grnItem.itemId,
                                lotNumber: grnItem.lotNumber,
                            },
                        },
                        create: {
                            itemId: grnItem.itemId,
                            lotNumber: grnItem.lotNumber,
                        },
                        update: {},
                    });
                    lotId = lot.id;
                }

                if (lotId) {
                    await tx.inventory.upsert({
                        where: {
                            itemId_locationId_itemLotId: {
                                itemId: grnItem.itemId,
                                locationId,
                                itemLotId: lotId,
                            },
                        },
                        create: {
                            itemId: grnItem.itemId,
                            locationId,
                            itemLotId: lotId,
                            onHandQty: grnItem.receivedQty,
                            allocatedQty: 0,
                            availableQty: grnItem.receivedQty,
                        },
                        update: {
                            onHandQty: { increment: grnItem.receivedQty },
                            availableQty: { increment: grnItem.receivedQty },
                        },
                    });
                } else {
                    const existingInventory = await tx.inventory.findFirst({
                        where: { itemId: grnItem.itemId, locationId, itemLotId: null },
                    });

                    if (existingInventory) {
                        await tx.inventory.update({
                            where: { id: existingInventory.id },
                            data: {
                                onHandQty: { increment: grnItem.receivedQty },
                                availableQty: { increment: grnItem.receivedQty },
                            },
                        });
                    } else {
                        await tx.inventory.create({
                            data: {
                                itemId: grnItem.itemId,
                                locationId,
                                itemLotId: null,
                                onHandQty: grnItem.receivedQty,
                                allocatedQty: 0,
                                availableQty: grnItem.receivedQty,
                            },
                        });
                    }
                }

                await tx.stockMovement.create({
                    data: {
                        itemId: grnItem.itemId,
                        locationId,
                        itemLotId: lotId,
                        type: 'IN',
                        quantity: grnItem.receivedQty,
                        referenceId: grn.id,
                        remarks: `GRN: ${grn.grnNumber}`,
                    },
                });
            }

            const completedGRN = await tx.goodsReceipt.update({
                where: { id },
                data: { status: 'COMPLETED' },
            });

            return completedGRN;
        });

        try {
            await journalService.postGRNJournal(result.id, userId);
        } catch (err) {
            console.error('[GRN] Failed to post journal:', err);
        }

        await purchaseOrderService.updateStatus(grn.purchaseOrderId, 'PARTIAL');

        const po = await purchaseOrderService.getReceivedSummary(grn.purchaseOrderId);
        const allReceived = po.every(p => p.remainingQty <= 0);
        if (allReceived) {
            await purchaseOrderService.updateStatus(grn.purchaseOrderId, 'CLOSED');
        }

        return result;
    }

    async void(id: string, reason: string, userId: string) {
        const grn = await prisma.goodsReceipt.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!grn) throw new Error('GRN not found');
        if (grn.status === 'VOIDED') throw new Error('GRN already voided');

        await prisma.$transaction(async (tx) => {
            if (grn.status === 'COMPLETED') {
                const inboundMovements = await tx.stockMovement.findMany({
                    where: { referenceId: grn.id, type: 'IN' },
                });

                for (const m of inboundMovements) {
                    await tx.inventory.updateMany({
                        where: { itemId: m.itemId, locationId: m.locationId, itemLotId: m.itemLotId },
                        data: {
                            onHandQty: { decrement: m.quantity },
                            availableQty: { decrement: m.quantity },
                        },
                    });

                    await tx.stockMovement.create({
                        data: {
                            itemId: m.itemId,
                            locationId: m.locationId,
                            itemLotId: m.itemLotId,
                            type: 'ADJUSTMENT',
                            quantity: -m.quantity,
                            referenceId: grn.id,
                            remarks: `VOID GRN: ${grn.grnNumber} - ${reason}`,
                        },
                    });
                }
            }

            await tx.goodsReceipt.update({
                where: { id },
                data: { status: 'VOIDED', notes: `${grn.notes || ''}\nVoid reason: ${reason}`.trim() },
            });
        });

        await purchaseOrderService.updateStatus(grn.purchaseOrderId, 'APPROVED');
    }

    async delete(id: string) {
        const grn = await prisma.goodsReceipt.findUnique({ where: { id } });
        if (!grn) throw new Error('GRN not found');
        if (grn.status !== 'DRAFT') throw new Error('Only DRAFT GRN can be deleted');

        await prisma.$transaction(async (tx) => {
            await tx.gRNItem.deleteMany({ where: { goodsReceiptId: id } });
            await tx.goodsReceipt.delete({ where: { id } });
        });
    }

    async addItem(grnId: string, item: { poItemId: string; itemId: string; receivedQty: number; lotNumber?: string }) {
        return prisma.gRNItem.create({
            data: {
                goodsReceiptId: grnId,
                poItemId: item.poItemId,
                itemId: item.itemId,
                receivedQty: item.receivedQty,
                lotNumber: item.lotNumber,
            },
            include: { item: true },
        });
    }

    async updateItem(itemId: string, data: { receivedQty?: number; lotNumber?: string }) {
        return prisma.gRNItem.update({
            where: { id: itemId },
            data,
        });
    }

    async removeItem(itemId: string) {
        return prisma.gRNItem.delete({ where: { id: itemId } });
    }
}

export const goodsReceiptService = new GoodsReceiptService();
