import { prisma } from '../index';
import { journalService } from './journal.service';

export type ReturnStatus = 'DRAFT' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED';

export interface CreateReturnDto {
    supplierId: string;
    reason: string;
    items: Array<{
        itemId: string;
        quantity: number;
        lotNumber?: string;
        notes?: string;
    }>;
}

export interface UpdateReturnDto {
    supplierId?: string;
    reason?: string;
}

export class SupplierReturnService {
    private generateReturnNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `RET-${year}${month}-${random}`;
    }

    async create(dto: CreateReturnDto) {
        const returnNumber = this.generateReturnNumber();

        return prisma.supplierReturn.create({
            data: {
                returnNumber,
                supplierId: dto.supplierId,
                reason: dto.reason,
                status: 'DRAFT',
                items: {
                    create: dto.items.map(item => ({
                        itemId: item.itemId,
                        quantity: item.quantity,
                        lotNumber: item.lotNumber,
                        notes: item.notes,
                    })),
                },
            },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });
    }

    async findAll(params: {
        status?: ReturnStatus;
        supplierId?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, supplierId, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (supplierId) where.supplierId = supplierId;

        const [returns, total] = await Promise.all([
            prisma.supplierReturn.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: true,
                    items: { include: { item: true } },
                },
            }),
            prisma.supplierReturn.count({ where }),
        ]);

        return { returns, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.supplierReturn.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });
    }

    async update(id: string, dto: UpdateReturnDto) {
        const ret = await prisma.supplierReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be updated');

        return prisma.supplierReturn.update({
            where: { id },
            data: {
                supplierId: dto.supplierId ?? ret.supplierId,
                reason: dto.reason ?? ret.reason,
            },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });
    }

    async submit(id: string) {
        const ret = await prisma.supplierReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be submitted');

        return prisma.supplierReturn.update({
            where: { id },
            data: { status: 'SUBMITTED' },
        });
    }

    async complete(id: string, locationId: string, userId: string) {
        const ret = await prisma.supplierReturn.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });

        if (!ret) throw new Error('Return not found');
        if (ret.status === 'COMPLETED') throw new Error('Return already completed');
        if (ret.status === 'CANCELLED') throw new Error('Cannot complete cancelled return');

        const result = await prisma.$transaction(async (tx) => {
            for (const item of ret.items) {
                let lotId: string | null = null;
                if (item.lotNumber) {
                    const lot = await tx.itemLot.findFirst({
                        where: { itemId: item.itemId, lotNumber: item.lotNumber },
                    });
                    lotId = lot?.id || null;
                }

                if (lotId) {
                    const inv = await tx.inventory.findUnique({
                        where: {
                            itemId_locationId_itemLotId: {
                                itemId: item.itemId,
                                locationId,
                                itemLotId: lotId,
                            },
                        },
                    });
                    if (!inv) throw new Error('Inventory not found for return item');
                    if (inv.availableQty < item.quantity) throw new Error('Insufficient stock for return item');

                    await tx.inventory.update({
                        where: { id: inv.id },
                        data: {
                            onHandQty: { decrement: item.quantity },
                            availableQty: { decrement: item.quantity },
                        },
                    });
                } else {
                    const inv = await tx.inventory.findFirst({
                        where: { itemId: item.itemId, locationId, itemLotId: null },
                    });
                    if (!inv) throw new Error('Inventory not found for return item');
                    if (inv.availableQty < item.quantity) throw new Error('Insufficient stock for return item');

                    await tx.inventory.update({
                        where: { id: inv.id },
                        data: {
                            onHandQty: { decrement: item.quantity },
                            availableQty: { decrement: item.quantity },
                        },
                    });
                }

                await tx.stockMovement.create({
                    data: {
                        itemId: item.itemId,
                        locationId,
                        itemLotId: lotId,
                        type: 'OUT',
                        quantity: -item.quantity,
                        referenceId: ret.id,
                        remarks: `Supplier Return: ${ret.returnNumber}`,
                    },
                });
            }

            return tx.supplierReturn.update({
                where: { id },
                data: { status: 'COMPLETED' },
            });
        });

        try {
            const inventoryAccount = await prisma.chartOfAccount.findFirst({ where: { code: '1400' } });
            const apAccount = await prisma.chartOfAccount.findFirst({ where: { code: '2000' } });

            if (inventoryAccount && apAccount) {
                const totalValue = ret.items.reduce((sum, item) => sum + item.quantity * 100, 0);

                const entry = await journalService.create({
                    description: `Supplier Return: ${ret.returnNumber} to ${ret.supplier.name}`,
                    referenceId: ret.id,
                    lines: [
                        { accountId: apAccount.id, debit: totalValue, credit: 0 },
                        { accountId: inventoryAccount.id, debit: 0, credit: totalValue },
                    ],
                });
                await journalService.post(entry.id);
            }
        } catch (err) {
            console.error('[SupplierReturn] Failed to post journal:', err);
        }

        return result;
    }

    async cancel(id: string, reason: string) {
        const ret = await prisma.supplierReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status === 'COMPLETED') throw new Error('Cannot cancel completed return');

        return prisma.supplierReturn.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                reason: `${ret.reason}\nCancelled: ${reason}`,
            },
        });
    }

    async addItem(returnId: string, item: { itemId: string; quantity: number; lotNumber?: string; notes?: string }) {
        const ret = await prisma.supplierReturn.findUnique({ where: { id: returnId } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return prisma.supplierReturnItem.create({
            data: {
                supplierReturnId: returnId,
                itemId: item.itemId,
                quantity: item.quantity,
                lotNumber: item.lotNumber,
                notes: item.notes,
            },
            include: { item: true },
        });
    }

    async updateItem(itemId: string, data: { quantity?: number; lotNumber?: string | null; notes?: string | null }) {
        const it = await prisma.supplierReturnItem.findUnique({
            where: { id: itemId },
            include: { supplierReturn: true },
        });
        if (!it) throw new Error('Return item not found');
        if (it.supplierReturn.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return prisma.supplierReturnItem.update({
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
        const it = await prisma.supplierReturnItem.findUnique({
            where: { id: itemId },
            include: { supplierReturn: true },
        });
        if (!it) throw new Error('Return item not found');
        if (it.supplierReturn.status !== 'DRAFT') throw new Error('Only draft returns can be modified');

        return prisma.supplierReturnItem.delete({ where: { id: itemId } });
    }

    async delete(id: string) {
        const ret = await prisma.supplierReturn.findUnique({ where: { id } });
        if (!ret) throw new Error('Return not found');
        if (ret.status !== 'DRAFT') throw new Error('Only draft returns can be deleted');

        await prisma.$transaction(async (tx) => {
            await tx.supplierReturnItem.deleteMany({ where: { supplierReturnId: id } });
            await tx.supplierReturn.delete({ where: { id } });
        });
    }
}

export const supplierReturnService = new SupplierReturnService();
