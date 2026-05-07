import { prisma } from '../index';

export type SOStatus = 'DRAFT' | 'APPROVED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface CreateSODto {
    customerId: string;
    orderDate: Date;
    items: Array<{
        itemId: string;
        quantity: number;
        unitPrice: number;
    }>;
}

export interface UpdateSODto {
    orderDate?: Date;
    status?: SOStatus;
}

export class SalesOrderService {
    private generateSONumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SO-${year}${month}-${random}`;
    }

    async create(dto: CreateSODto) {
        const soNumber = this.generateSONumber();

        const so = await prisma.salesOrder.create({
            data: {
                soNumber,
                customerId: dto.customerId,
                orderDate: dto.orderDate,
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
                customer: true,
                items: { include: { item: true } },
            },
        });

        await this.recalculateTotal(so.id);
        return so;
    }

    async findAll(params: {
        status?: SOStatus;
        customerId?: string;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, customerId, search, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (customerId) where.customerId = customerId;
        if (startDate || endDate) {
            where.orderDate = {};
            if (startDate) where.orderDate.gte = startDate;
            if (endDate) where.orderDate.lte = endDate;
        }
        if (search) {
            where.OR = [
                { soNumber: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [orders, total] = await Promise.all([
            prisma.salesOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: true,
                    items: { include: { item: true } },
                    pickLists: true,
                },
            }),
            prisma.salesOrder.count({ where }),
        ]);

        return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        item: {
                            include: {
                                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                            },
                        },
                        pickListItems: {
                            include: { pickList: true, location: true },
                        },
                    },
                },
                pickLists: {
                    include: {
                        items: {
                            include: { location: true, soItem: { include: { item: true } } },
                        },
                    },
                },
            },
        });
    }

    async findByNumber(soNumber: string) {
        return prisma.salesOrder.findUnique({
            where: { soNumber },
            include: {
                customer: true,
                items: { include: { item: true } },
            },
        });
    }

    async update(id: string, dto: UpdateSODto) {
        return prisma.salesOrder.update({
            where: { id },
            data: dto,
            include: {
                customer: true,
                items: { include: { item: true } },
            },
        });
    }

    async updateStatus(id: string, status: SOStatus) {
        return prisma.salesOrder.update({
            where: { id },
            data: { status },
        });
    }

    async addItem(soId: string, item: { itemId: string; quantity: number; unitPrice: number }) {
        const totalPrice = item.quantity * item.unitPrice;

        const soItem = await prisma.sOItem.create({
            data: {
                salesOrderId: soId,
                itemId: item.itemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice,
            },
            include: { item: true },
        });

        await this.recalculateTotal(soId);
        return soItem;
    }

    async updateItem(itemId: string, data: { quantity?: number; unitPrice?: number }) {
        const item = await prisma.sOItem.findUnique({ where: { id: itemId } });
        if (!item) throw new Error('SO Item not found');

        const quantity = data.quantity ?? item.quantity;
        const unitPrice = data.unitPrice ?? item.unitPrice;
        const totalPrice = quantity * unitPrice;

        const updated = await prisma.sOItem.update({
            where: { id: itemId },
            data: { quantity, unitPrice, totalPrice },
        });

        await this.recalculateTotal(item.salesOrderId);
        return updated;
    }

    async removeItem(itemId: string) {
        const item = await prisma.sOItem.findUnique({ where: { id: itemId } });
        if (!item) throw new Error('SO Item not found');

        await prisma.sOItem.delete({ where: { id: itemId } });
        await this.recalculateTotal(item.salesOrderId);
    }

    private async recalculateTotal(soId: string) {
        const items = await prisma.sOItem.findMany({
            where: { salesOrderId: soId },
        });

        const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

        await prisma.salesOrder.update({
            where: { id: soId },
            data: { totalAmount: total },
        });
    }

    async getAllocationSummary(soId: string) {
        const items = await prisma.sOItem.findMany({
            where: { salesOrderId: soId },
            include: {
                item: true,
                pickListItems: true,
            },
        });

        return items.map(item => ({
            itemId: item.itemId,
            itemName: item.item.name,
            orderedQty: item.quantity,
            allocatedQty: item.pickListItems.reduce((sum: number, pli) => sum + pli.quantity, 0),
            pickedQty: item.pickListItems.reduce((sum: number, pli) => sum + pli.pickedQty, 0),
        }));
    }

    async delete(id: string) {
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            include: { pickLists: true },
        });

        if (!so) throw new Error('SO not found');
        if (so.pickLists.some(pl => pl.status === 'COMPLETED')) {
            throw new Error('Cannot delete SO with completed pick lists');
        }

        await prisma.pickListItem.deleteMany({
            where: { pickList: { salesOrderId: id } },
        });
        await prisma.pickList.deleteMany({
            where: { salesOrderId: id },
        });
        await prisma.sOItem.deleteMany({
            where: { salesOrderId: id },
        });

        return prisma.salesOrder.delete({ where: { id } });
    }
}

export const salesOrderService = new SalesOrderService();
