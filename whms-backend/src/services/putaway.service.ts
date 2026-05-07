import { prisma } from '../index';

export type PutawayStatus = 'DRAFT' | 'COMPLETED' | 'VOIDED';

export interface CreatePutawayDto {
    goodsReceiptId: string;
    notes?: string;
}

export interface UpdatePutawayDto {
    notes?: string;
}

export class PutawayService {
    private generateNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `PUT-${year}${month}-${random}`;
    }

    async createFromGRN(dto: CreatePutawayDto, userId?: string) {
        const existingDraft = await (prisma as any).putawayTask.findFirst({
            where: { goodsReceiptId: dto.goodsReceiptId, status: 'DRAFT' },
            include: {
                goodsReceipt: { include: { purchaseOrder: { include: { supplier: true } } } },
                fromLocation: { include: { warehouse: true } },
                items: { include: { item: true, itemLot: true, toLocation: true } },
            },
        });
        if (existingDraft) return existingDraft;

        const grn = await prisma.goodsReceipt.findUnique({
            where: { id: dto.goodsReceiptId },
            include: { purchaseOrder: { include: { supplier: true } } },
        });
        if (!grn) throw new Error('GRN not found');
        if (grn.status !== 'COMPLETED') throw new Error('Putaway hanya bisa dibuat untuk GRN COMPLETED');

        const inboundMovements = await prisma.stockMovement.findMany({
            where: { referenceId: grn.id, type: 'IN' },
            orderBy: { createdAt: 'asc' },
        });
        if (inboundMovements.length === 0) throw new Error('Tidak ada stock movement IN untuk GRN ini');

        const sourceLocationIds = Array.from(new Set(inboundMovements.map((m) => m.locationId)));
        if (sourceLocationIds.length !== 1) {
            throw new Error('GRN ini memiliki lebih dari 1 lokasi sumber. Putaway membutuhkan 1 lokasi sumber.');
        }
        const fromLocationId = sourceLocationIds[0];

        const byKey = new Map<string, { itemId: string; itemLotId: string | null; qty: number }>();
        for (const m of inboundMovements) {
            const k = `${m.itemId}::${m.itemLotId || ''}`;
            if (!byKey.has(k)) {
                byKey.set(k, { itemId: m.itemId, itemLotId: m.itemLotId, qty: 0 });
            }
            byKey.get(k)!.qty += m.quantity;
        }

        const putawayNumber = this.generateNumber();

        const task = await (prisma as any).putawayTask.create({
            data: {
                putawayNumber,
                goodsReceiptId: grn.id,
                fromLocationId,
                status: 'DRAFT',
                notes: dto.notes,
                createdBy: userId,
                items: {
                    create: Array.from(byKey.values()).map((x) => ({
                        itemId: x.itemId,
                        itemLotId: x.itemLotId,
                        quantity: x.qty,
                        status: 'PENDING',
                    })),
                },
            },
            include: {
                goodsReceipt: { include: { purchaseOrder: { include: { supplier: true } } } },
                fromLocation: { include: { warehouse: true } },
                items: { include: { item: true, itemLot: true, toLocation: true } },
            },
        });

        return task;
    }

    async findAll(params: {
        status?: PutawayStatus;
        goodsReceiptId?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, goodsReceiptId, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (goodsReceiptId) where.goodsReceiptId = goodsReceiptId;

        const [tasks, total] = await Promise.all([
            (prisma as any).putawayTask.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    goodsReceipt: { include: { purchaseOrder: { include: { supplier: true } } } },
                    fromLocation: { include: { warehouse: true } },
                    _count: { select: { items: true } },
                },
            }),
            (prisma as any).putawayTask.count({ where }),
        ]);

        return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return (prisma as any).putawayTask.findUnique({
            where: { id },
            include: {
                goodsReceipt: { include: { purchaseOrder: { include: { supplier: true } } } },
                fromLocation: { include: { warehouse: true } },
                items: { include: { item: true, itemLot: true, toLocation: { include: { warehouse: true } } } },
            },
        });
    }

    async update(id: string, dto: UpdatePutawayDto) {
        const task = await (prisma as any).putawayTask.findUnique({ where: { id } });
        if (!task) throw new Error('Putaway not found');
        if (task.status !== 'DRAFT') throw new Error('Hanya DRAFT yang bisa diubah');

        return (prisma as any).putawayTask.update({
            where: { id },
            data: { notes: dto.notes },
            include: {
                goodsReceipt: { include: { purchaseOrder: { include: { supplier: true } } } },
                fromLocation: { include: { warehouse: true } },
                items: { include: { item: true, itemLot: true, toLocation: true } },
            },
        });
    }

    async updateItem(itemId: string, dto: { toLocationId?: string | null }) {
        const item = await (prisma as any).putawayTaskItem.findUnique({
            where: { id: itemId },
            include: { putawayTask: true },
        });
        if (!item) throw new Error('Putaway item not found');
        if (item.putawayTask.status !== 'DRAFT') throw new Error('Hanya DRAFT yang bisa diubah');

        const status = dto.toLocationId ? 'ASSIGNED' : 'PENDING';
        return (prisma as any).putawayTaskItem.update({
            where: { id: itemId },
            data: {
                toLocationId: dto.toLocationId || null,
                status,
            },
            include: { item: true, itemLot: true, toLocation: true },
        });
    }

    async complete(id: string, userId?: string) {
        const task = await (prisma as any).putawayTask.findUnique({
            where: { id },
            include: {
                goodsReceipt: true,
                fromLocation: true,
                items: true,
            },
        });

        if (!task) throw new Error('Putaway not found');
        if (task.status !== 'DRAFT') throw new Error('Putaway harus DRAFT');

        const missing = task.items.filter((i: any) => !i.toLocationId);
        if (missing.length > 0) throw new Error('Semua item harus memiliki lokasi tujuan');

        await prisma.$transaction(async (tx) => {
            for (const line of task.items) {
                const qty = Number(line.quantity || 0);
                if (qty <= 0) continue;

                if (line.itemLotId) {
                    await tx.inventory.update({
                        where: {
                            itemId_locationId_itemLotId: {
                                itemId: line.itemId,
                                locationId: task.fromLocationId,
                                itemLotId: line.itemLotId,
                            },
                        },
                        data: {
                            onHandQty: { decrement: qty },
                            availableQty: { decrement: qty },
                        },
                    });
                } else {
                    const inv = await tx.inventory.findFirst({
                        where: { itemId: line.itemId, locationId: task.fromLocationId, itemLotId: null },
                    });
                    if (!inv) throw new Error('Inventory sumber tidak ditemukan');
                    await tx.inventory.update({
                        where: { id: inv.id },
                        data: {
                            onHandQty: { decrement: qty },
                            availableQty: { decrement: qty },
                        },
                    });
                }

                if (line.itemLotId) {
                    await tx.inventory.upsert({
                        where: {
                            itemId_locationId_itemLotId: {
                                itemId: line.itemId,
                                locationId: line.toLocationId,
                                itemLotId: line.itemLotId,
                            },
                        },
                        create: {
                            itemId: line.itemId,
                            locationId: line.toLocationId,
                            itemLotId: line.itemLotId,
                            onHandQty: qty,
                            allocatedQty: 0,
                            availableQty: qty,
                        },
                        update: {
                            onHandQty: { increment: qty },
                            availableQty: { increment: qty },
                        },
                    });
                } else {
                    const invTo = await tx.inventory.findFirst({
                        where: { itemId: line.itemId, locationId: line.toLocationId, itemLotId: null },
                    });
                    if (invTo) {
                        await tx.inventory.update({
                            where: { id: invTo.id },
                            data: {
                                onHandQty: { increment: qty },
                                availableQty: { increment: qty },
                            },
                        });
                    } else {
                        await tx.inventory.create({
                            data: {
                                itemId: line.itemId,
                                locationId: line.toLocationId,
                                itemLotId: null,
                                onHandQty: qty,
                                allocatedQty: 0,
                                availableQty: qty,
                            },
                        });
                    }
                }

                await tx.stockMovement.create({
                    data: {
                        itemId: line.itemId,
                        locationId: task.fromLocationId,
                        itemLotId: line.itemLotId,
                        type: 'TRANSFER',
                        quantity: -qty,
                        referenceId: task.id,
                        remarks: `Putaway Out: ${task.putawayNumber} (GRN: ${task.goodsReceipt.grnNumber})`,
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        itemId: line.itemId,
                        locationId: line.toLocationId,
                        itemLotId: line.itemLotId,
                        type: 'TRANSFER',
                        quantity: qty,
                        referenceId: task.id,
                        remarks: `Putaway In: ${task.putawayNumber} (GRN: ${task.goodsReceipt.grnNumber})`,
                    },
                });
            }

            await (tx as any).putawayTask.update({
                where: { id: task.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });

        return this.findById(id);
    }

    async void(id: string, reason?: string) {
        const task = await (prisma as any).putawayTask.findUnique({ where: { id } });
        if (!task) throw new Error('Putaway not found');
        if (task.status !== 'DRAFT') throw new Error('Hanya DRAFT yang bisa di-void');

        return (prisma as any).putawayTask.update({
            where: { id },
            data: {
                status: 'VOIDED',
                notes: reason ? `${task.notes || ''}\nVoid reason: ${reason}`.trim() : task.notes,
            },
        });
    }

    async delete(id: string) {
        const task = await (prisma as any).putawayTask.findUnique({ where: { id } });
        if (!task) throw new Error('Putaway not found');
        if (task.status !== 'DRAFT') throw new Error('Hanya DRAFT yang bisa dihapus');

        await (prisma as any).putawayTask.delete({ where: { id } });
    }
}

export const putawayService = new PutawayService();
