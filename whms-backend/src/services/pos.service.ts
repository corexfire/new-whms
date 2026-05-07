import { prisma } from '../index';
import { journalService } from './journal.service';

export type PaymentMethod = 'CASH' | 'DEBIT' | 'CREDIT' | 'QRIS' | 'EWALLET';
export type TransactionStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED';

export interface CheckoutItemDto {
    itemId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
}

export interface CheckoutDto {
    items: CheckoutItemDto[];
    paymentMethod: PaymentMethod;
    amountPaid: number;
    shiftId?: string;
    customerId?: string;
    promoCode?: string;
    discountTotal?: number;
    taxRate?: number;
    warehouseId?: string;
    paymentReference?: string;
    paymentProvider?: string;
    notes?: string;
}

export class PosService {
    private generateReceiptNumber(): string {
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `RCP-${day}-${random}`;
    }

    async checkout(dto: CheckoutDto, cashierId: string) {
        const receiptNumber = this.generateReceiptNumber();

        if (!Array.isArray(dto.items) || dto.items.length === 0) {
            throw new Error('Items are required');
        }

        const taxRate = typeof dto.taxRate === 'number' ? dto.taxRate : 0.11;
        const discountTotal = Number(dto.discountTotal || 0);

        const subtotal = dto.items.reduce((sum, item) => {
            const lineDiscount = Number(item.discount || 0);
            if (!item.itemId) throw new Error('Invalid item');
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Quantity must be greater than 0');
            if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Invalid unit price');
            if (!Number.isFinite(lineDiscount) || lineDiscount < 0) throw new Error('Invalid discount');
            const lineTotal = item.quantity * item.unitPrice - lineDiscount;
            if (lineTotal < 0) throw new Error('Line total cannot be negative');
            return sum + lineTotal;
        }, 0);

        if (!Number.isFinite(discountTotal) || discountTotal < 0) {
            throw new Error('Invalid discount total');
        }
        if (discountTotal > subtotal) {
            throw new Error('Discount cannot exceed subtotal');
        }

        const taxableBase = subtotal - discountTotal;
        const taxAmount = Math.max(0, taxableBase * taxRate);
        const totalAmount = taxableBase + taxAmount;

        if (dto.paymentMethod === 'CASH' && dto.amountPaid < totalAmount) {
            throw new Error('Insufficient payment amount');
        }

        if (dto.paymentMethod !== 'CASH') {
            const ref = (dto.paymentReference || '').trim();
            if (!ref) throw new Error('Payment reference is required for non-cash payments');
        }

        const change = dto.paymentMethod === 'CASH' ? dto.amountPaid - totalAmount : 0;

        const transaction = await prisma.$transaction(async (tx) => {
            for (const item of dto.items) {
                const inventory = await tx.inventory.findFirst({
                    where: {
                        itemId: item.itemId,
                        ...(dto.warehouseId ? { location: { warehouseId: dto.warehouseId } } : {}),
                    },
                    orderBy: { availableQty: 'desc' },
                });

                if (!inventory || inventory.availableQty < item.quantity) {
                    throw new Error('Insufficient stock');
                }
            }

            const posTx = await tx.posTransaction.create({
                data: {
                    receiptNumber,
                    customerId: dto.customerId,
                    totalAmount,
                    subtotal,
                    discountTotal,
                    promoCode: dto.promoCode,
                    taxAmount,
                    amountPaid: dto.amountPaid,
                    changeAmount: change,
                    paymentMethod: dto.paymentMethod,
                    paymentReference: dto.paymentReference,
                    paymentProvider: dto.paymentProvider,
                    status: 'COMPLETED',
                    notes: dto.notes,
                    cashierId,
                    shiftId: dto.shiftId,
                    items: {
                        create: dto.items.map(item => ({
                            itemId: item.itemId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: Number(item.discount || 0),
                            totalPrice: item.quantity * item.unitPrice - Number(item.discount || 0),
                        })),
                    },
                } as any,
                include: {
                    cashier: true,
                    customer: true,
                    items: { include: { item: true } } as any,
                } as any,
            });

            for (const item of dto.items) {
                const inventory = await tx.inventory.findFirst({
                    where: {
                        itemId: item.itemId,
                        ...(dto.warehouseId ? { location: { warehouseId: dto.warehouseId } } : {}),
                    },
                    orderBy: { availableQty: 'desc' },
                });

                if (!inventory || inventory.availableQty < item.quantity) {
                    throw new Error('Insufficient stock');
                }

                await tx.inventory.update({
                    where: { id: inventory.id },
                    data: {
                        onHandQty: { decrement: item.quantity },
                        availableQty: { decrement: item.quantity },
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        itemId: item.itemId,
                        locationId: inventory.locationId,
                        type: 'OUT',
                        quantity: -item.quantity,
                        referenceId: posTx.id,
                        remarks: `POS: ${receiptNumber}`,
                    },
                });
            }

            return posTx;
        });

        try {
            await this.postPOSJournal(transaction.id);
        } catch (err) {
            console.error('[POS] Failed to post journal:', err);
        }

        return { ...transaction, change };
    }

    async void(receiptNumber: string, reason: string, cashierId: string) {
        const transaction = await prisma.posTransaction.findUnique({
            where: { receiptNumber },
            include: { items: { include: { item: true } } as any } as any,
        });

        if (!transaction) throw new Error('Transaction not found');
        if (transaction.status === 'VOIDED') throw new Error('Transaction already voided');
        if (transaction.cashierId !== cashierId) throw new Error('Can only void own transactions');

        await prisma.$transaction(async (tx) => {
            for (const item of transaction.items) {
                const inventory = await tx.inventory.findFirst({
                    where: { itemId: item.itemId },
                    orderBy: { availableQty: 'desc' },
                });

                if (inventory) {
                    await tx.inventory.update({
                        where: { id: inventory.id },
                        data: {
                            onHandQty: { increment: item.quantity },
                            availableQty: { increment: item.quantity },
                        },
                    });

                    await tx.stockMovement.create({
                        data: {
                            itemId: item.itemId,
                            locationId: inventory.locationId,
                            type: 'IN',
                            quantity: item.quantity,
                            referenceId: transaction.id,
                            remarks: `VOID: ${receiptNumber} - ${reason}`,
                        },
                    });
                }
            }

            await tx.posTransaction.update({
                where: { id: transaction.id },
                data: { status: 'VOIDED' },
            });
        });
    }

    async findAll(params: {
        status?: TransactionStatus;
        cashierId?: string;
        shiftId?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { status, cashierId, shiftId, startDate, endDate, page = 1, limit = 50 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (cashierId) where.cashierId = cashierId;
        if (shiftId) where.shiftId = shiftId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [transactions, total] = await Promise.all([
            prisma.posTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    cashier: true,
                    items: { include: { item: true } } as any,
                } as any,
            }),
            prisma.posTransaction.count({ where }),
        ]);

        return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findByReceipt(receiptNumber: string) {
        return prisma.posTransaction.findUnique({
            where: { receiptNumber },
            include: {
                cashier: true,
                items: { include: { item: true } } as any,
            } as any,
        });
    }

    async getDailySummary(shiftId?: string, date?: Date) {
        const targetDate = date || new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const where: any = {
            createdAt: { gte: startOfDay, lte: endOfDay },
            status: 'COMPLETED',
        };
        if (shiftId) where.shiftId = shiftId;

        const [transactions, totalCount] = await Promise.all([
            prisma.posTransaction.findMany({
                where,
                include: { items: true },
            }),
            prisma.posTransaction.count({ where }),
        ]);

        const totalSales = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalItems = transactions.reduce((sum, tx) => sum + tx.items.length, 0);
        const totalQty = transactions.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);

        const byPayment = transactions.reduce((acc, tx) => {
            acc[tx.paymentMethod] = (acc[tx.paymentMethod] || 0) + tx.totalAmount;
            return acc;
        }, {} as Record<string, number>);

        return {
            date: startOfDay,
            shiftId,
            totalTransactions: totalCount,
            totalSales,
            totalItems,
            totalQty,
            byPayment,
        };
    }

    private async postPOSJournal(transactionId: string) {
        const tx = await prisma.posTransaction.findUnique({
            where: { id: transactionId },
            include: { items: { include: { item: true } } as any } as any,
        });

        if (!tx) return;

        const cashAccount = await prisma.chartOfAccount.findFirst({ where: { code: '1100' } });
        const revenueAccount = await prisma.chartOfAccount.findFirst({ where: { code: '4000' } });
        const inventoryAccount = await prisma.chartOfAccount.findFirst({ where: { code: '1400' } });
        const cogsAccount = await prisma.chartOfAccount.findFirst({ where: { code: '5000' } });

        if (!cashAccount || !revenueAccount || !inventoryAccount || !cogsAccount) {
            console.warn('[POS] Required accounts not found');
            return;
        }

        const totalRevenue = tx.totalAmount;
        const totalCOGS = (tx as any).items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0) * 0.6, 0);

        const lines = [
            {
                accountId: cashAccount.id,
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
        ];

        const entry = await journalService.create({
            description: `POS Sale: ${tx.receiptNumber}`,
            referenceId: tx.id,
            lines,
        });

        await journalService.post(entry.id);
    }

    async getCatalog(params: {
        warehouseId: string;
        search?: string;
        categoryId?: string;
        color?: string;
        inStockOnly?: boolean;
        page?: number;
        limit?: number;
    }) {
        const { warehouseId, search, categoryId, color, inStockOnly = true, page = 1, limit = 60 } = params;
        const skip = (page - 1) * limit;

        if (!warehouseId) throw new Error('warehouseId is required');

        const locations = await prisma.location.findMany({
            where: { warehouseId, isActive: true },
            select: { id: true },
        });
        const locationIds = locations.map((l) => l.id);

        const stockByItemId = new Map<string, { available: number; onHand: number }>();

        if (locationIds.length > 0) {
            const invWhere: any = {
                locationId: { in: locationIds },
            };
            if (inStockOnly) {
                invWhere.OR = [{ availableQty: { gt: 0 } }, { onHandQty: { gt: 0 } }];
            }

            const invRows = await prisma.inventory.findMany({
                where: invWhere,
                select: { itemId: true, availableQty: true, onHandQty: true },
            });

            for (const r of invRows) {
                const prev = stockByItemId.get(r.itemId) || { available: 0, onHand: 0 };
                prev.available += Number(r.availableQty || 0);
                prev.onHand += Number(r.onHandQty || 0);
                stockByItemId.set(r.itemId, prev);
            }
        }

        const itemIds = Array.from(stockByItemId.keys());
        if (itemIds.length === 0 && inStockOnly) return { products: [], total: 0, page, limit, totalPages: 0 };

        const itemWhere: any = itemIds.length > 0 ? { id: { in: itemIds } } : {};

        const q = (search || '').trim();
        if (q) {
            const barcodeHits = await (prisma.itemUoM as any).findMany({
                where: { barcode: { contains: q } },
                select: { itemId: true },
                take: 50,
            });
            const barcodeItemIds = barcodeHits.map((b: any) => b.itemId);

            itemWhere.OR = [
                { sku: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { color: { contains: q, mode: 'insensitive' } },
                { size: { contains: q, mode: 'insensitive' } },
                ...(barcodeItemIds.length > 0 ? [{ id: { in: barcodeItemIds } }] : []),
            ];
        }

        if (categoryId) itemWhere.categoryId = categoryId;
        if (color) itemWhere.color = { equals: color, mode: 'insensitive' };

        const [items, total] = await Promise.all([
            prisma.item.findMany({
                where: itemWhere,
                orderBy: { name: 'asc' },
                include: {
                    category: true,
                    uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                    images: { orderBy: { createdAt: 'desc' } },
                },
                skip,
                take: limit,
            }) as any,
            prisma.item.count({ where: itemWhere }),
        ]);

        const products = items
            .map((it: any) => {
                const stock = stockByItemId.get(it.id) || { available: 0, onHand: 0 };
                const uoms = Array.isArray(it.uoms) ? it.uoms : [];
                const base = uoms.find((u: any) => Number(u.conversionRate) === 1) || uoms[0];
                const unit = base?.uom?.code || 'PCS';
                const price = Number(base?.price || 0);

                return {
                    id: it.id,
                    sku: it.sku,
                    name: it.name,
                    color: it.color,
                    categoryId: it.categoryId,
                    categoryName: it.category?.name,
                    unit,
                    price,
                    stock: stock.available,
                    onHand: stock.onHand,
                    imageId: it.images?.[0]?.id || null,
                };
            })
            .sort((a: any, b: any) => b.stock - a.stock || a.name.localeCompare(b.name));

        return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}

export const posService = new PosService();
