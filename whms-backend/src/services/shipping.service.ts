import { prisma } from '../index';
import { salesOrderService } from './sales-order.service';
import { journalService } from './journal.service';

export type ShipmentStatus = 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

export interface CreateShipmentDto {
    salesOrderId: string;
    carrier: string;
    trackingNumber?: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    weight?: number;
    notes?: string;
}

export interface UpdateTrackingDto {
    status: ShipmentStatus;
    location?: string;
    description?: string;
}

export class ShippingService {
    private generateAWB(): string {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `AWB${year}${month}${random}`;
    }

    async create(dto: CreateShipmentDto) {
        const so = await prisma.salesOrder.findUnique({
            where: { id: dto.salesOrderId },
            include: { items: { include: { item: true } } },
        });

        if (!so) throw new Error('Sales Order not found');
        if (so.status !== 'PACKED') {
            throw new Error('SO must be packed before shipping');
        }

        const existing = await prisma.shipment.findFirst({
            where: {
                salesOrderId: dto.salesOrderId,
                status: { not: 'CANCELLED' },
            },
        });
        if (existing) {
            throw new Error('Shipment already exists for this Sales Order');
        }

        const awb = this.generateAWB();

        return prisma.shipment.create({
            data: {
                awbNumber: awb,
                salesOrderId: dto.salesOrderId,
                carrier: dto.carrier,
                trackingNumber: dto.trackingNumber,
                recipientName: dto.recipientName,
                recipientPhone: dto.recipientPhone,
                recipientAddress: dto.recipientAddress,
                weight: dto.weight,
                notes: dto.notes,
                status: 'PENDING',
                trackingHistory: {
                    create: {
                        status: 'PENDING',
                        description: 'Shipment created',
                    },
                },
            },
            include: {
                salesOrder: { include: { customer: true } },
                trackingHistory: true,
            },
        });
    }

    async findAll(params: {
        status?: ShipmentStatus;
        carrier?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, carrier, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (carrier) where.carrier = carrier;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [shipments, total] = await Promise.all([
            prisma.shipment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    salesOrder: { include: { customer: true } },
                    trackingHistory: {
                        orderBy: { timestamp: 'desc' },
                        take: 1,
                    },
                },
            }),
            prisma.shipment.count({ where }),
        ]);

        return { shipments, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.shipment.findUnique({
            where: { id },
            include: {
                salesOrder: { include: { customer: true, items: { include: { item: true } } } },
                trackingHistory: { orderBy: { timestamp: 'asc' } },
            },
        });
    }

    async findByAwb(awbNumber: string) {
        return prisma.shipment.findUnique({
            where: { awbNumber },
            include: {
                salesOrder: { include: { customer: true } },
                trackingHistory: { orderBy: { timestamp: 'asc' } },
            },
        });
    }

    async updateTracking(id: string, dto: UpdateTrackingDto) {
        const shipment = await prisma.shipment.findUnique({ where: { id } });
        if (!shipment) throw new Error('Shipment not found');

        await prisma.shipmentTracking.create({
            data: {
                shipmentId: id,
                status: dto.status,
                location: dto.location,
                description: dto.description,
            },
        });

        const updated = await prisma.shipment.update({
            where: { id },
            data: { status: dto.status },
            include: {
                salesOrder: { include: { customer: true } },
                trackingHistory: { orderBy: { timestamp: 'asc' } },
            },
        });

        if (dto.status === 'DELIVERED') {
            await salesOrderService.updateStatus(shipment.salesOrderId, 'DELIVERED');
            await this.postShipmentJournal(shipment.salesOrderId);
        }

        return updated;
    }

    async syncTrackingFromCarrier(awbNumber: string, carrier: string) {
        console.log(`[Shipping] Syncing tracking for ${awbNumber} via ${carrier}`);
        return null;
    }

    async markPickedUp(id: string) {
        return this.updateTracking(id, {
            status: 'PICKED_UP',
            description: 'Package picked up by carrier',
        });
    }

    async markInTransit(id: string, location?: string) {
        return this.updateTracking(id, {
            status: 'IN_TRANSIT',
            location,
            description: 'Package in transit',
        });
    }

    async markOutForDelivery(id: string, location?: string) {
        return this.updateTracking(id, {
            status: 'OUT_FOR_DELIVERY',
            location,
            description: 'Package out for delivery',
        });
    }

    async markDelivered(id: string, location?: string) {
        return this.updateTracking(id, {
            status: 'DELIVERED',
            location,
            description: 'Package delivered successfully',
        });
    }

    async cancel(id: string, reason: string) {
        const shipment = await prisma.shipment.findUnique({
            where: { id },
            include: { salesOrder: true },
        });

        if (!shipment) throw new Error('Shipment not found');
        if (shipment.status === 'DELIVERED') {
            throw new Error('Cannot cancel delivered shipment');
        }

        await this.updateTracking(id, {
            status: 'CANCELLED',
            description: `Cancelled: ${reason}`,
        });

        await salesOrderService.updateStatus(shipment.salesOrderId, 'PACKED');

        return prisma.shipment.findUnique({
            where: { id },
            include: { trackingHistory: true },
        });
    }

    private async postShipmentJournal(salesOrderId: string) {
        const so = await prisma.salesOrder.findUnique({
            where: { id: salesOrderId },
            include: { customer: true, items: { include: { item: true } } },
        });

        if (!so) return;

        const revenueAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '4000' },
        });
        const arAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '1200' },
        });
        const inventoryAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '1400' },
        });
        const cogsAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '5000' },
        });

        if (!revenueAccount || !arAccount || !inventoryAccount || !cogsAccount) {
            console.warn('[Shipping] Required accounts not found for journal posting');
            return;
        }

        const totalRevenue = so.totalAmount;
        const totalCOGS = so.items.reduce((sum, item) => sum + item.unitPrice * item.quantity * 0.6, 0);

        try {
            const entry = await journalService.create({
                description: `SO Shipped: ${so.soNumber} to ${so.customer.name}`,
                referenceId: so.id,
                lines: [
                    {
                        accountId: arAccount.id,
                        debit: totalRevenue,
                        credit: 0,
                    },
                    {
                        accountId: revenueAccount.id,
                        debit: 0,
                        credit: totalRevenue,
                    },
                    {
                        accountId: cogsAccount.id,
                        debit: totalCOGS,
                        credit: 0,
                    },
                    {
                        accountId: inventoryAccount.id,
                        debit: 0,
                        credit: totalCOGS,
                    },
                ],
            });

            await journalService.post(entry.id);
        } catch (err) {
            console.error('[Shipping] Failed to post shipment journal:', err);
        }
    }

    async getTrackingTimeline(id: string) {
        const shipment = await prisma.shipment.findUnique({
            where: { id },
            include: {
                trackingHistory: {
                    orderBy: { timestamp: 'desc' },
                },
            },
        });

        if (!shipment) throw new Error('Shipment not found');

        return {
            awbNumber: shipment.awbNumber,
            carrier: shipment.carrier,
            currentStatus: shipment.status,
            timeline: shipment.trackingHistory,
        };
    }
}

export const shippingService = new ShippingService();
