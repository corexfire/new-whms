import { prisma } from '../index';

export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIAL' | 'CLOSED' | 'CANCELLED';

export interface CreatePODto {
    supplierId: string;
    orderDate: Date;
    expectedDate?: Date;
    items: Array<{
        itemId: string;
        quantity: number;
        unitPrice: number;
    }>;
}

export interface UpdatePODto {
    orderDate?: Date;
    expectedDate?: Date;
    status?: POStatus;
}

export class PurchaseOrderService {
    private generatePONumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `PO-${year}${month}-${random}`;
    }

    async create(dto: CreatePODto) {
        const poNumber = this.generatePONumber();

        const po = await prisma.purchaseOrder.create({
            data: {
                poNumber,
                supplierId: dto.supplierId,
                orderDate: dto.orderDate,
                expectedDate: dto.expectedDate,
                status: 'DRAFT',
                items: {
                    create: dto.items.map(item => ({
                        itemId: item.itemId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });

        await this.recalculateTotal(po.id);
        return po;
    }

    async findAll(params: {
        status?: POStatus;
        supplierId?: string;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, supplierId, search, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (supplierId) where.supplierId = supplierId;
        if (startDate || endDate) {
            where.orderDate = {};
            if (startDate) where.orderDate.gte = startDate;
            if (endDate) where.orderDate.lte = endDate;
        }
        if (search) {
            where.OR = [
                { poNumber: { contains: search, mode: 'insensitive' } },
                { supplier: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [orders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: true,
                    items: { include: { item: true } },
                    goodsReceipts: true,
                },
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: {
                        item: true,
                        grnItems: { include: { goodsReceipt: true } },
                    },
                },
                goodsReceipts: true,
            },
        });
    }

    async findByNumber(poNumber: string) {
        return prisma.purchaseOrder.findUnique({
            where: { poNumber },
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });
    }

    async update(id: string, dto: UpdatePODto) {
        return prisma.purchaseOrder.update({
            where: { id },
            data: dto,
            include: {
                supplier: true,
                items: { include: { item: true } },
            },
        });
    }

    async updateStatus(id: string, status: POStatus) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { items: { include: { grnItems: true } }, goodsReceipts: true },
        });

        if (!po) throw new Error('PO not found');

        if (status === 'CANCELLED') {
            const hasCompletedGRN = po.goodsReceipts.some((gr: any) => gr.status === 'COMPLETED');
            if (hasCompletedGRN) {
                throw new Error('Cannot cancel PO with completed GRN');
            }
        }

        return prisma.purchaseOrder.update({
            where: { id },
            data: { status },
        });
    }

    async addItem(poId: string, item: { itemId: string; quantity: number; unitPrice: number }) {
        const totalPrice = item.quantity * item.unitPrice;

        const poItem = await prisma.pOItem.create({
            data: {
                purchaseOrderId: poId,
                itemId: item.itemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice,
            },
            include: { item: true },
        });

        await this.recalculateTotal(poId);
        return poItem;
    }

    async updateItem(itemId: string, data: { quantity?: number; unitPrice?: number }) {
        const item = await prisma.pOItem.findUnique({ where: { id: itemId } });
        if (!item) throw new Error('PO Item not found');

        const quantity = data.quantity ?? item.quantity;
        const unitPrice = data.unitPrice ?? item.unitPrice;
        const totalPrice = quantity * unitPrice;

        const updated = await prisma.pOItem.update({
            where: { id: itemId },
            data: { quantity, unitPrice, totalPrice },
        });

        await this.recalculateTotal(item.purchaseOrderId);
        return updated;
    }

    async removeItem(itemId: string) {
        const item = await prisma.pOItem.findUnique({
            where: { id: itemId },
            include: { grnItems: true },
        });

        if (!item) throw new Error('PO Item not found');
        if (item.grnItems.length > 0) {
            throw new Error('Cannot remove item with existing GRN');
        }

        await prisma.pOItem.delete({ where: { id: itemId } });
        await this.recalculateTotal(item.purchaseOrderId);
    }

    private async recalculateTotal(poId: string) {
        const items = await prisma.pOItem.findMany({
            where: { purchaseOrderId: poId },
        });

        const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { totalAmount: total },
        });
    }

    async getReceivedSummary(poId: string) {
        const items = await prisma.pOItem.findMany({
            where: { purchaseOrderId: poId },
            include: {
                item: true,
                grnItems: {
                    where: { goodsReceipt: { status: 'COMPLETED' } },
                    include: { goodsReceipt: true },
                },
            },
        });

        return items.map(item => ({
            itemId: item.itemId,
            itemName: item.item.name,
            orderedQty: item.quantity,
            receivedQty: item.grnItems.reduce((sum: number, gi: any) => sum + gi.receivedQty, 0),
            remainingQty: item.quantity - item.grnItems.reduce((sum: number, gi: any) => sum + gi.receivedQty, 0),
        }));
    }

    async delete(id: string) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { goodsReceipts: true },
        });

        if (!po) throw new Error('PO not found');
        if (po.goodsReceipts.length > 0) {
            throw new Error('Cannot delete PO with existing GRN');
        }

        await prisma.pOItem.deleteMany({ where: { purchaseOrderId: id } });
        return prisma.purchaseOrder.delete({ where: { id } });
    }
}

export const purchaseOrderService = new PurchaseOrderService();
