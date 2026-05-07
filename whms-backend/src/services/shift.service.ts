import { prisma } from '../index';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface OpenShiftDto {
    openingCash: number;
    notes?: string;
}

export interface CloseShiftDto {
    closingCash: number;
    expectedCash: number;
    notes?: string;
}

export class ShiftService {
    private generateShiftNumber(): string {
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        return `SHIFT-${day}-${hour}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    }

    async open(cashierId: string, dto: OpenShiftDto) {
        const activeShift = await prisma.posShift.findFirst({
            where: { cashierId, status: 'OPEN' },
        });

        if (activeShift) {
            throw new Error('You already have an open shift');
        }

        const shiftNumber = this.generateShiftNumber();

        return prisma.posShift.create({
            data: {
                shiftNumber,
                cashierId,
                openingCash: dto.openingCash,
                status: 'OPEN',
                notes: dto.notes,
            },
            include: { cashier: true },
        });
    }

    async close(shiftId: string, cashierId: string, dto: CloseShiftDto) {
        const shift = await prisma.posShift.findUnique({
            where: { id: shiftId },
            include: {
                transactions: { where: { status: 'COMPLETED' } },
            },
        });

        if (!shift) throw new Error('Shift not found');
        if (shift.status === 'CLOSED') throw new Error('Shift already closed');
        if (shift.cashierId !== cashierId) throw new Error('Can only close own shift');

        const totalSales = shift.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalCash = shift.transactions
            .filter(tx => tx.paymentMethod === 'CASH')
            .reduce((sum, tx) => sum + tx.totalAmount, 0);

        const expectedCash = shift.openingCash + totalCash;
        const variance = dto.closingCash - expectedCash;

        return prisma.posShift.update({
            where: { id: shiftId },
            data: {
                closingCash: dto.closingCash,
                expectedCash,
                variance,
                status: 'CLOSED',
                closedAt: new Date(),
                notes: dto.notes,
            },
            include: {
                cashier: true,
                transactions: { where: { status: 'COMPLETED' } },
            },
        });
    }

    async findActive(cashierId: string) {
        return prisma.posShift.findFirst({
            where: { cashierId, status: 'OPEN' },
            include: {
                transactions: { where: { status: 'COMPLETED' } },
            },
        });
    }

    async findAll(params: {
        cashierId?: string;
        status?: ShiftStatus;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { cashierId, status, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (cashierId) where.cashierId = cashierId;
        if (status) where.status = status;
        if (startDate || endDate) {
            where.openedAt = {};
            if (startDate) where.openedAt.gte = startDate;
            if (endDate) where.openedAt.lte = endDate;
        }

        const [shifts, total] = await Promise.all([
            prisma.posShift.findMany({
                where,
                skip,
                take: limit,
                orderBy: { openedAt: 'desc' },
                include: {
                    cashier: true,
                    _count: { select: { transactions: true } },
                },
            }),
            prisma.posShift.count({ where }),
        ]);

        return { shifts, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getShiftSummary(shiftId: string) {
        const shift = await prisma.posShift.findUnique({
            where: { id: shiftId },
            include: {
                cashier: true,
                transactions: { where: { status: 'COMPLETED' } },
            },
        });

        if (!shift) throw new Error('Shift not found');

        const totalSales = shift.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalTransactions = shift.transactions.length;

        const byPayment = shift.transactions.reduce((acc, tx) => {
            acc[tx.paymentMethod] = (acc[tx.paymentMethod] || 0) + tx.totalAmount;
            return acc;
        }, {} as Record<string, number>);

        const cashIn = byPayment['CASH'] || 0;
        const expectedCash = shift.openingCash + cashIn;

        return {
            shiftId: shift.id,
            shiftNumber: shift.shiftNumber,
            cashier: shift.cashier.name,
            openingCash: shift.openingCash,
            closingCash: shift.closingCash,
            expectedCash,
            variance: shift.variance,
            totalSales,
            totalTransactions,
            byPayment,
            transactionCount: totalTransactions,
        };
    }
}

export const shiftService = new ShiftService();
