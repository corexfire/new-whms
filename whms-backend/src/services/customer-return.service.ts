import { prisma } from '../index';

export type CustomerReturnStatus = 'DRAFT' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED';

export interface CreateCustomerReturnDto {
    customerId: string;
    salesOrderId?: string;
    reason: string;
    notes?: string;
    items: Array<{
        itemId: string;
        quantity: number;
        lotNumber?: string;
        notes?: string;
    }>;
}

export interface UpdateCustomerReturnDto {
    customerId?: string;
    salesOrderId?: string | null;
    reason?: string;
    notes?: string | null;
}

export class CustomerReturnService {
    private generateNumber(): string {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CR-${year}${month}-${rand}`;
    }

    async create(dto: CreateCustomerReturnDto) {
        if (!dto.customerId) throw new Error('customerId is required');
        if (!dto.reason) throw new Error('reason is required');
        if (!dto.items || dto.items.length === 0) throw new Error('items is required');

        const returnNumber = this.generateNumber();

        return (prisma as any).customerReturn.create({
            data: {
                returnNumber,
                customerId: dto.customerId,
                salesOrderId: dto.salesOrderId || null,
                reason: dto.reason,
                notes: dto.notes,
                status: 'DRAFT',
                items: {
                    create: dto.items.map((i) => ({
                        itemId: i.itemId,
                        quantity: i.quantity,
                        lotNumber: i.lotNumber,
                        notes: i.notes,
                    })),
                },
            },
            include: {
                customer: true,
                salesOrder: true,
                items: { include: { item: true } },
            },
        });
    }

    async findAll(params: { status?: CustomerReturnStatus; customerId?: string; salesOrderId?: string; page?: number; limit?: number }) {
        const { status, customerId, salesOrderId, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (customerId) where.customerId = customerId;
        if (salesOrderId) where.salesOrderId = salesOrderId;

        const [returns, total] = await Promise.all([
            (prisma as any).customerReturn.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: true,
                    salesOrder: true,
                    items: { include: { item: true } },
                },
            }),
            (prisma as any).customerReturn.count({ where }),
        ]);

        return { returns, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return (prisma as any).customerReturn.findUnique({
            where: { id },
            include: {
                customer: true,
                salesOrder: true,
                items: { include: { item: true } },
            },
        });
    }

    async update(id: string, dto: UpdateCustomerReturnDto) {
        const ret = await (prisma as any).customerReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be updated');

        return (prisma as any).customerReturn.update({
            where: { id },
            data: {
                customerId: dto.customerId ?? ret.customerId,
                salesOrderId: dto.salesOrderId === null ? null : (dto.salesOrderId ?? ret.salesOrderId),
                reason: dto.reason ?? ret.reason,
                notes: dto.notes === null ? null : (dto.notes ?? ret.notes),
            },
            include: {
                customer: true,
                salesOrder: true,
                items: { include: { item: true } },
            },
        });
    }

    async submit(id: string) {
        const ret = await (prisma as any).customerReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be submitted');

        return (prisma as any).customerReturn.update({
            where: { id },
            data: { status: 'SUBMITTED' },
        });
    }

    async complete(id: string, locationId: string) {
        const ret = await (prisma as any).customerReturn.findUnique({
            where: { id },
            include: { items: { include: { item: true } }, customer: true },
        });

        if (!ret) throw new Error('Return not found');
        if (ret.status === 'COMPLETED') throw new Error('Return already completed');
        if (ret.status === 'CANCELLED') throw new Error('Cannot complete cancelled return');
        if (!locationId) throw new Error('locationId is required');

        const result = await prisma.$transaction(async (tx) => {
            for (const line of ret.items) {
                const item = line.item;
                let lotId: string | null = null;

                if (item.trackLot && line.lotNumber) {
                    const lot = await tx.itemLot.upsert({
                        where: {
                            itemId_lotNumber: { itemId: line.itemId, lotNumber: line.lotNumber },
                        },
                        create: {
                            itemId: line.itemId,
                            lotNumber: line.lotNumber,
                        },
                        update: {},
                    });
                    lotId = lot.id;
                }

                if (lotId) {
                    await tx.inventory.upsert({
                        where: {
                            itemId_locationId_itemLotId: {
                                itemId: line.itemId,
                                locationId,
                                itemLotId: lotId,
                            },
                        },
                        create: {
                            itemId: line.itemId,
                            locationId,
                            itemLotId: lotId,
                            onHandQty: line.quantity,
                            allocatedQty: 0,
                            availableQty: line.quantity,
                        },
                        update: {
                            onHandQty: { increment: line.quantity },
                            availableQty: { increment: line.quantity },
                        },
                    });
                } else {
                    const inv = await tx.inventory.findFirst({
                        where: { itemId: line.itemId, locationId, itemLotId: null },
                    });
                    if (inv) {
                        await tx.inventory.update({
                            where: { id: inv.id },
                            data: {
                                onHandQty: { increment: line.quantity },
                                availableQty: { increment: line.quantity },
                            },
                        });
                    } else {
                        await tx.inventory.create({
                            data: {
                                itemId: line.itemId,
                                locationId,
                                itemLotId: null,
                                onHandQty: line.quantity,
                                allocatedQty: 0,
                                availableQty: line.quantity,
                            },
                        });
                    }
                }

                await tx.stockMovement.create({
                    data: {
                        itemId: line.itemId,
                        locationId,
                        itemLotId: lotId,
                        type: 'IN',
                        quantity: line.quantity,
                        referenceId: ret.id,
                        remarks: `Customer Return: ${ret.returnNumber}`,
                    },
                });
            }

            return (tx as any).customerReturn.update({
                where: { id },
                data: { status: 'COMPLETED' },
            });
        });

        return result;
    }

    async cancel(id: string, reason: string) {
        const ret = await (prisma as any).customerReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status === 'COMPLETED') throw new Error('Cannot cancel completed return');

        return (prisma as any).customerReturn.update({
            where: { id },
            data: { status: 'CANCELLED', notes: `${ret.notes || ''}\nCancel reason: ${reason || 'Cancelled'}`.trim() },
        });
    }

    async addItem(returnId: string, item: { itemId: string; quantity: number; lotNumber?: string; notes?: string }) {
        const ret = await (prisma as any).customerReturn.findUnique({ where: { id: returnId } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return (prisma as any).customerReturnItem.create({
            data: {
                customerReturnId: returnId,
                itemId: item.itemId,
                quantity: item.quantity,
                lotNumber: item.lotNumber,
                notes: item.notes,
            },
            include: { item: true },
        });
    }

    async updateItem(itemId: string, data: { quantity?: number; lotNumber?: string | null; notes?: string | null }) {
        const it = await (prisma as any).customerReturnItem.findUnique({
            where: { id: itemId },
            include: { customerReturn: true },
        });
        if (!it) throw new Error('Return item not found');
        if (it.customerReturn.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return (prisma as any).customerReturnItem.update({
            where: { id: itemId },
            data: {
                quantity: data.quantity ?? it.quantity,
                lotNumber: data.lotNumber === null ? null : (data.lotNumber ?? it.lotNumber),
                notes: data.notes === null ? null : (data.notes ?? it.notes),
            },
            include: { item: true },
        });
    }

    async removeItem(itemId: string) {
        const it = await (prisma as any).customerReturnItem.findUnique({
            where: { id: itemId },
            include: { customerReturn: true },
        });
        if (!it) throw new Error('Return item not found');
        if (it.customerReturn.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return (prisma as any).customerReturnItem.delete({ where: { id: itemId } });
    }

    async delete(id: string) {
        const ret = await (prisma as any).customerReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be deleted');

        await prisma.$transaction(async (tx) => {
            await (tx as any).customerReturnItem.deleteMany({ where: { customerReturnId: id } });
            await (tx as any).customerReturn.delete({ where: { id } });
        });
    }
}

export const customerReturnService = new CustomerReturnService();
