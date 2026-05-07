import { prisma } from '../index';
import { emitToRoom } from './socket.service';

export interface StockAlert {
    itemId: string;
    itemName: string;
    itemSku: string;
    warehouseId: string;
    warehouseName: string;
    currentStock: number;
    minStock: number;
    alertType: 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OUT_OF_STOCK';
}

export interface DailySummary {
    date: Date;
    totalInbound: number;
    totalOutbound: number;
    totalAdjustments: number;
    netChange: number;
}

export class MonitoringService {
    private ALERT_THRESHOLDS = {
        LOW_STOCK: 20,
        CRITICAL_STOCK: 10,
        OUT_OF_STOCK: 0,
    };

    async checkLowStock(warehouseId?: string): Promise<StockAlert[]> {
        const inventoryWhere: any = {};
        if (warehouseId) {
            inventoryWhere.location = { warehouseId };
        }

        const inventories = await prisma.inventory.findMany({
            where: {
                ...inventoryWhere,
                availableQty: { lte: this.ALERT_THRESHOLDS.LOW_STOCK },
            },
            include: {
                item: true,
                location: { include: { warehouse: true } },
            },
        });

        const alerts: StockAlert[] = [];

        for (const inv of inventories) {
            let alertType: StockAlert['alertType'];

            if (inv.availableQty <= this.ALERT_THRESHOLDS.OUT_OF_STOCK) {
                alertType = 'OUT_OF_STOCK';
            } else if (inv.availableQty <= this.ALERT_THRESHOLDS.CRITICAL_STOCK) {
                alertType = 'CRITICAL_STOCK';
            } else {
                alertType = 'LOW_STOCK';
            }

            alerts.push({
                itemId: inv.itemId,
                itemName: inv.item.name,
                itemSku: inv.item.sku,
                warehouseId: inv.location.warehouse.id,
                warehouseName: inv.location.warehouse.name,
                currentStock: inv.availableQty,
                minStock: this.ALERT_THRESHOLDS.LOW_STOCK,
                alertType,
            });
        }

        return alerts.sort((a, b) => a.currentStock - b.currentStock);
    }

    async emitStockAlerts(warehouseId?: string) {
        const alerts = await this.checkLowStock(warehouseId);

        if (alerts.length === 0) return;

        const room = warehouseId ? `warehouse:${warehouseId}` : 'admin';

        emitToRoom(room, 'warehouse:alert', {
            type: 'STOCK_ALERT',
            alerts,
            timestamp: new Date().toISOString(),
        });
    }

    async getDashboardSummary(warehouseId?: string) {
        const inventoryWhere: any = warehouseId
            ? { location: { warehouseId } }
            : {};

        const [
            totalItems,
            lowStockCount,
            outOfStockCount,
            todayInbound,
            todayOutbound,
            pendingPO,
            pendingSO,
        ] = await Promise.all([
            prisma.inventory.count({ where: inventoryWhere }),
            prisma.inventory.count({
                where: {
                    ...inventoryWhere,
                    availableQty: {
                        gt: this.ALERT_THRESHOLDS.OUT_OF_STOCK,
                        lte: this.ALERT_THRESHOLDS.LOW_STOCK,
                    },
                },
            }),
            prisma.inventory.count({
                where: {
                    ...inventoryWhere,
                    availableQty: { lte: this.ALERT_THRESHOLDS.OUT_OF_STOCK },
                },
            }),
            prisma.stockMovement.count({
                where: {
                    ...inventoryWhere,
                    type: 'IN',
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
            }),
            prisma.stockMovement.count({
                where: {
                    ...inventoryWhere,
                    type: 'OUT',
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
            }),
            prisma.purchaseOrder.count({
                where: { status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
            }),
            prisma.salesOrder.count({
                where: { status: { in: ['DRAFT', 'APPROVED', 'PICKING'] } },
            }),
        ]);

        return {
            totalItems,
            lowStockCount,
            outOfStockCount,
            todayInbound,
            todayOutbound,
            pendingPO,
            pendingSO,
            timestamp: new Date().toISOString(),
        };
    }

    async getDailySummary(days: number = 7, warehouseId?: string) {
        const summaries: DailySummary[] = [];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const inventoryWhere: any = warehouseId
            ? { location: { warehouseId } }
            : {};

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);

            const [inbound, outbound, adjustments] = await Promise.all([
                prisma.stockMovement.aggregate({
                    where: {
                        ...inventoryWhere,
                        type: 'IN',
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                    _sum: { quantity: true },
                }),
                prisma.stockMovement.aggregate({
                    where: {
                        ...inventoryWhere,
                        type: 'OUT',
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                    _sum: { quantity: true },
                }),
                prisma.stockMovement.aggregate({
                    where: {
                        ...inventoryWhere,
                        type: 'ADJUSTMENT',
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                    _sum: { quantity: true },
                }),
            ]);

            summaries.push({
                date: new Date(d),
                totalInbound: inbound._sum.quantity || 0,
                totalOutbound: outbound._sum.quantity || 0,
                totalAdjustments: adjustments._sum.quantity || 0,
                netChange:
                    (inbound._sum.quantity || 0) -
                    (outbound._sum.quantity || 0) +
                    (adjustments._sum.quantity || 0),
            });
        }

        return summaries;
    }

    async getTopMovingItems(days: number = 7, limit: number = 10, type: 'IN' | 'OUT' | 'ALL' = 'ALL') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const where: any = {
            createdAt: { gte: startDate },
        };

        if (type !== 'ALL') {
            where.type = type;
        }

        const movements = await prisma.stockMovement.groupBy({
            by: ['itemId'],
            where,
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: limit,
        });

        const items = await Promise.all(
            movements.map(async (m) => {
                const item = await prisma.item.findUnique({ where: { id: m.itemId } });
                return {
                    itemId: m.itemId,
                    itemName: item?.name,
                    itemSku: item?.sku,
                    totalMovement: m._sum.quantity || 0,
                };
            })
        );

        return items;
    }

    async schedulePeriodicAlerts() {
        setInterval(async () => {
            try {
                await this.emitStockAlerts();
            } catch (err) {
                console.error('[Monitoring] Failed to emit stock alerts:', err);
            }
        }, 15 * 60 * 1000);
    }
}

export const monitoringService = new MonitoringService();
