import { prisma } from '../index';

export interface CogsCalculationParams {
    period: string;
    categoryId?: string;
    allocationMethod: 'QTY' | 'SKU' | 'VALUE';
}

export class CogsService {
    async getOverhead(period: string) {
        return prisma.overheadExpense.findMany({
            where: { period },
            orderBy: { createdAt: 'asc' }
        });
    }

    async saveOverhead(period: string, items: any[]) {
        return prisma.$transaction(async (tx) => {
            // Delete existing for this period
            await tx.overheadExpense.deleteMany({ where: { period } });
            
            // Create new
            if (items.length > 0) {
                await tx.overheadExpense.createMany({
                    data: items.map(item => ({
                        period,
                        type: item.type || 'OTHER',
                        label: item.label || '',
                        amount: Number(item.amount || 0)
                    }))
                });
            }
            
            return this.getOverhead(period);
        });
    }

    async calculate(params: CogsCalculationParams) {
        const { period, categoryId, allocationMethod } = params;
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // 1. Fetch Overhead
        const overheads = await this.getOverhead(period);
        const totalOverhead = overheads.reduce((sum, o) => sum + o.amount, 0);

        // 2. Fetch Sales (POS and SO)
        // Note: In a real system we'd use stock movements or specific transactional tables.
        // We look for movements of type 'OUT' linked to the period.
        const movements = await prisma.stockMovement.findMany({
            where: {
                type: 'OUT',
                createdAt: { gte: startDate, lte: endDate },
                item: categoryId ? { categoryId } : undefined
            },
            include: {
                item: {
                    include: {
                        uoms: { where: { conversionRate: 1 } }
                    }
                }
            }
        });

        // 3. Aggregate Qty per Item
        const itemStats = new Map<string, { 
            sku: string; 
            name: string; 
            qtySold: number; 
            revenue: number;
            costPerUnit: number;
        }>();

        for (const m of movements) {
            const qty = Math.abs(m.quantity);
            const itemId = m.itemId;
            
            if (!itemStats.has(itemId)) {
                itemStats.set(itemId, {
                    sku: m.item.sku,
                    name: m.item.name,
                    qtySold: 0,
                    revenue: 0,
                    costPerUnit: m.item.uoms?.[0]?.price || 0 // Default to master price
                });
            }
            
            const stats = itemStats.get(itemId)!;
            stats.qtySold += qty;
        }

        // 4. Try to find more accurate purchase costs from latest POs
        const itemIds = Array.from(itemStats.keys());
        const latestPOs = await prisma.pOItem.findMany({
            where: {
                itemId: { in: itemIds },
                purchaseOrder: { status: 'CLOSED' }
            },
            orderBy: { purchaseOrder: { orderDate: 'desc' } },
            distinct: ['itemId'],
            select: { itemId: true, unitPrice: true }
        });

        for (const po of latestPOs) {
            if (itemStats.has(po.itemId)) {
                itemStats.get(po.itemId)!.costPerUnit = po.unitPrice;
            }
        }

        // 5. Fetch Revenue (Optional refinement, but for now we'll estimate or join POS/SO)
        // Simplified: Fetch POS and SO items for this period to get real revenue
        const posItems = await (prisma.posItem as any).findMany({
            where: {
                transaction: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: 'COMPLETED'
                },
                itemId: { in: itemIds }
            }
        });
        
        for (const pi of posItems) {
            if (itemStats.has(pi.itemId)) {
                itemStats.get(pi.itemId)!.revenue += pi.totalPrice;
            }
        }

        const soItems = await (prisma.sOItem as any).findMany({
            where: {
                salesOrder: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: { in: ['SHIPPED', 'DELIVERED', 'COMPLETED'] }
                },
                itemId: { in: itemIds }
            }
        });

        for (const si of soItems) {
            if (itemStats.has(si.itemId)) {
                itemStats.get(si.itemId)!.revenue += si.totalPrice;
            }
        }

        // 6. Allocation
        const totalQtySold = Array.from(itemStats.values()).reduce((sum, s) => sum + s.qtySold, 0);
        const totalBaseCogs = Array.from(itemStats.values()).reduce((sum, s) => sum + (s.qtySold * s.costPerUnit), 0);

        const rows = Array.from(itemStats.values()).map(stats => {
            let overheadPerUnit = 0;
            
            if (allocationMethod === 'QTY') {
                overheadPerUnit = totalQtySold > 0 ? totalOverhead / totalQtySold : 0;
            } else if (allocationMethod === 'SKU') {
                overheadPerUnit = itemStats.size > 0 ? (totalOverhead / itemStats.size) / (stats.qtySold || 1) : 0;
            } else if (allocationMethod === 'VALUE') {
                const baseCogs = stats.qtySold * stats.costPerUnit;
                const ratio = totalBaseCogs > 0 ? baseCogs / totalBaseCogs : 0;
                overheadPerUnit = stats.qtySold > 0 ? (totalOverhead * ratio) / stats.qtySold : 0;
            }

            const cogsPerUnit = stats.costPerUnit + overheadPerUnit;
            const totalCogs = cogsPerUnit * stats.qtySold;
            const marginPct = stats.revenue > 0 ? ((stats.revenue - totalCogs) / stats.revenue) * 100 : 0;

            return {
                sku: stats.sku,
                name: stats.name,
                qtySold: stats.qtySold,
                purchasePricePerUnit: stats.costPerUnit,
                overheadPerUnit: overheadPerUnit,
                cogsPerUnit: cogsPerUnit,
                totalCogs: totalCogs,
                sellingPrice: stats.qtySold > 0 ? stats.revenue / stats.qtySold : 0,
                revenue: stats.revenue,
                marginPct: marginPct
            };
        });

        const summary = {
            totalCogs: rows.reduce((sum, r) => sum + r.totalCogs, 0),
            totalOverhead,
            totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
            totalQtySold,
            avgCogsPerUnit: totalQtySold > 0 ? rows.reduce((sum, r) => sum + r.totalCogs, 0) / totalQtySold : 0
        };

        return { summary, rows };
    }

    async saveSettlement(period: string, summary: any, rows: any[]) {
        return prisma.cogsSettlement.upsert({
            where: { period },
            create: {
                period,
                totalRevenue: summary.totalRevenue,
                totalCogs: summary.totalCogs,
                totalOverhead: summary.totalOverhead,
                grossProfit: summary.totalRevenue - summary.totalCogs,
                results: rows as any
            },
            update: {
                totalRevenue: summary.totalRevenue,
                totalCogs: summary.totalCogs,
                totalOverhead: summary.totalOverhead,
                grossProfit: summary.totalRevenue - summary.totalCogs,
                results: rows as any
            }
        });
    }

    async getSettlement(period: string) {
        return prisma.cogsSettlement.findUnique({ where: { period } });
    }
}

export const cogsService = new CogsService();
