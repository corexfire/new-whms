import { prisma } from '../index';

export type ARStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type APStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface CreateARDto {
    customerId: string;
    referenceId?: string;
    referenceType?: string;
    description: string;
    amount: number;
    dueDate: Date;
}

export interface CreateAPDto {
    supplierId: string;
    referenceId?: string;
    referenceType?: string;
    description: string;
    amount: number;
    dueDate: Date;
}

export interface RecordPaymentDto {
    amount: number;
    paymentDate: Date;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'GIRO' | 'CHEQUE';
    paymentAccountId?: string;
    reference?: string;
    notes?: string;
}

export class AccountingService {
    private generateNumber(prefix: 'AR' | 'AP') {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const n = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
        return `${prefix}-${y}${m}-${n}`;
    }

    async createAR(dto: CreateARDto) {
        if (!dto.customerId) throw new Error('customerId is required');
        if (!dto.description) throw new Error('description is required');
        if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');
        if (!dto.dueDate) throw new Error('dueDate is required');

        return (prisma as any).accountReceivable.create({
            data: {
                receivableNumber: this.generateNumber('AR'),
                customerId: dto.customerId,
                referenceId: dto.referenceId,
                referenceType: dto.referenceType,
                description: dto.description,
                totalAmount: dto.amount,
                openAmount: dto.amount,
                dueDate: dto.dueDate,
                status: 'OPEN',
            },
            include: { customer: true },
        });
    }

    async findAR(params: {
        customerId?: string;
        status?: ARStatus;
        overdue?: boolean;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { customerId, status, overdue, search, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (customerId) where.customerId = customerId;
        if (status) where.status = status;
        if (overdue) {
            where.dueDate = { lt: new Date() };
            where.status = { in: ['OPEN', 'PARTIAL', 'OVERDUE'] };
        }
        if (startDate || endDate) {
            where.dueDate = where.dueDate || {};
            if (startDate) where.dueDate.gte = startDate;
            if (endDate) where.dueDate.lte = endDate;
        }
        if (search) {
            where.OR = [
                { receivableNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { referenceId: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [records, total] = await Promise.all([
            (prisma as any).accountReceivable.findMany({
                where,
                skip,
                take: limit,
                orderBy: { dueDate: 'asc' },
                include: { customer: true },
            }),
            (prisma as any).accountReceivable.count({ where }),
        ]);

        return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findARById(id: string) {
        return (prisma as any).accountReceivable.findUnique({
            where: { id },
            include: {
                customer: true,
                payments: { orderBy: { paymentDate: 'desc' }, include: { paymentAccount: true } },
            },
        });
    }

    async recordARPayment(id: string, dto: RecordPaymentDto) {
        const ar = await (prisma as any).accountReceivable.findUnique({ where: { id } });
        if (!ar) throw new Error('AR not found');
        if (ar.status === 'PAID') throw new Error('AR already fully paid');
        if (dto.amount > ar.openAmount) throw new Error('Payment exceeds open amount');
        if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');

        const newOpenAmount = ar.openAmount - dto.amount;
        const newStatus: ARStatus = newOpenAmount <= 0 ? 'PAID' : 'PARTIAL';

        return prisma.$transaction(async (tx) => {
            const payment = await (tx as any).aRPayment.create({
                data: {
                    accountReceivableId: id,
                    amount: dto.amount,
                    paymentDate: dto.paymentDate,
                    paymentMethod: dto.paymentMethod,
                    paymentAccountId: dto.paymentAccountId,
                    reference: dto.reference,
                    notes: dto.notes,
                },
            });

            await (tx as any).accountReceivable.update({
                where: { id },
                data: {
                    openAmount: newOpenAmount,
                    status: newStatus,
                },
            });

            return payment;
        });
    }

    async updateAR(id: string, dto: Partial<CreateARDto> & { status?: ARStatus }) {
        const ar = await (prisma as any).accountReceivable.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!ar) throw new Error('AR not found');
        if (ar.status === 'PAID' || ar.status === 'CANCELLED') throw new Error('Cannot update this AR');

        const hasPayments = ar.payments.length > 0;
        if (hasPayments && (dto.amount !== undefined || dto.customerId)) {
            throw new Error('Cannot change customer/amount after payments exist');
        }

        const data: any = {};
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.dueDate !== undefined) data.dueDate = dto.dueDate;
        if (!hasPayments && dto.amount !== undefined) {
            if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');
            data.totalAmount = dto.amount;
            data.openAmount = dto.amount;
            data.status = 'OPEN';
        }
        if (dto.referenceId !== undefined) data.referenceId = dto.referenceId;
        if (dto.referenceType !== undefined) data.referenceType = dto.referenceType;

        return (prisma as any).accountReceivable.update({ where: { id }, data, include: { customer: true } });
    }

    async deleteAR(id: string) {
        const ar = await (prisma as any).accountReceivable.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!ar) throw new Error('AR not found');
        if (ar.payments.length > 0) throw new Error('Cannot delete AR with payments');
        if (ar.status === 'CANCELLED') return { deleted: true };
        await (prisma as any).accountReceivable.delete({ where: { id } });
        return { deleted: true };
    }

    async voidAR(id: string, reason: string) {
        const ar = await (prisma as any).accountReceivable.findUnique({ where: { id } });
        if (!ar) throw new Error('AR not found');

        if (ar.status !== 'OPEN' && ar.status !== 'PARTIAL') {
            throw new Error('Can only void open or partial AR');
        }

        return (prisma as any).accountReceivable.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                description: `${ar.description} | VOID: ${reason}`,
            },
        });
    }

    async createAP(dto: CreateAPDto) {
        if (!dto.supplierId) throw new Error('supplierId is required');
        if (!dto.description) throw new Error('description is required');
        if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');
        if (!dto.dueDate) throw new Error('dueDate is required');

        return (prisma as any).accountPayable.create({
            data: {
                payableNumber: this.generateNumber('AP'),
                supplierId: dto.supplierId,
                referenceId: dto.referenceId,
                referenceType: dto.referenceType,
                description: dto.description,
                totalAmount: dto.amount,
                openAmount: dto.amount,
                dueDate: dto.dueDate,
                status: 'OPEN',
            },
            include: { supplier: true },
        });
    }

    async findAP(params: {
        supplierId?: string;
        status?: APStatus;
        overdue?: boolean;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
    }) {
        const { supplierId, status, overdue, search, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (supplierId) where.supplierId = supplierId;
        if (status) where.status = status;
        if (overdue) {
            where.dueDate = { lt: new Date() };
            where.status = { in: ['OPEN', 'PARTIAL', 'OVERDUE'] };
        }
        if (startDate || endDate) {
            where.dueDate = where.dueDate || {};
            if (startDate) where.dueDate.gte = startDate;
            if (endDate) where.dueDate.lte = endDate;
        }
        if (search) {
            where.OR = [
                { payableNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { referenceId: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [records, total] = await Promise.all([
            (prisma as any).accountPayable.findMany({
                where,
                skip,
                take: limit,
                orderBy: { dueDate: 'asc' },
                include: { supplier: true },
            }),
            (prisma as any).accountPayable.count({ where }),
        ]);

        return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findAPById(id: string) {
        return (prisma as any).accountPayable.findUnique({
            where: { id },
            include: {
                supplier: true,
                payments: { orderBy: { paymentDate: 'desc' }, include: { paymentAccount: true } },
            },
        });
    }

    async updateAP(id: string, dto: Partial<CreateAPDto> & { status?: APStatus }) {
        const ap = await (prisma as any).accountPayable.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!ap) throw new Error('AP not found');
        if (ap.status === 'PAID' || ap.status === 'CANCELLED') throw new Error('Cannot update this AP');

        const hasPayments = ap.payments.length > 0;
        if (hasPayments && (dto.amount !== undefined || dto.supplierId)) {
            throw new Error('Cannot change supplier/amount after payments exist');
        }

        const data: any = {};
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.dueDate !== undefined) data.dueDate = dto.dueDate;
        if (!hasPayments && dto.amount !== undefined) {
            if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');
            data.totalAmount = dto.amount;
            data.openAmount = dto.amount;
            data.status = 'OPEN';
        }
        if (dto.referenceId !== undefined) data.referenceId = dto.referenceId;
        if (dto.referenceType !== undefined) data.referenceType = dto.referenceType;

        return (prisma as any).accountPayable.update({ where: { id }, data, include: { supplier: true } });
    }

    async deleteAP(id: string) {
        const ap = await (prisma as any).accountPayable.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!ap) throw new Error('AP not found');
        if (ap.payments.length > 0) throw new Error('Cannot delete AP with payments');
        if (ap.status === 'CANCELLED') return { deleted: true };
        await (prisma as any).accountPayable.delete({ where: { id } });
        return { deleted: true };
    }

    async recordAPPayment(id: string, dto: RecordPaymentDto) {
        const ap = await (prisma as any).accountPayable.findUnique({ where: { id } });
        if (!ap) throw new Error('AP not found');
        if (ap.status === 'PAID') throw new Error('AP already fully paid');
        if (dto.amount > ap.openAmount) throw new Error('Payment exceeds open amount');
        if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error('amount is invalid');
        if (!dto.paymentAccountId) throw new Error('paymentAccountId is required');

        const newOpenAmount = ap.openAmount - dto.amount;
        const newStatus: APStatus = newOpenAmount <= 0 ? 'PAID' : 'PARTIAL';

        return prisma.$transaction(async (tx) => {
            const payment = await (tx as any).aPPayment.create({
                data: {
                    accountPayableId: id,
                    amount: dto.amount,
                    paymentDate: dto.paymentDate,
                    paymentMethod: dto.paymentMethod,
                    paymentAccountId: dto.paymentAccountId,
                    reference: dto.reference,
                    notes: dto.notes,
                },
            });

            await (tx as any).accountPayable.update({
                where: { id },
                data: {
                    openAmount: newOpenAmount,
                    status: newStatus,
                },
            });

            return payment;
        });
    }

    async voidAP(id: string, reason: string) {
        const ap = await (prisma as any).accountPayable.findUnique({ where: { id } });
        if (!ap) throw new Error('AP not found');

        if (ap.status !== 'OPEN' && ap.status !== 'PARTIAL') {
            throw new Error('Can only void open or partial AP');
        }

        return (prisma as any).accountPayable.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                description: `${ap.description} | VOID: ${reason}`,
            },
        });
    }

    async getARAging() {
        const now = new Date();
        const ranges = [
            { label: 'current', maxDays: 0 },
            { label: '1-30', minDays: 1, maxDays: 30 },
            { label: '31-60', minDays: 31, maxDays: 60 },
            { label: '61-90', minDays: 61, maxDays: 90 },
            { label: 'over_90', minDays: 91 },
        ];

        const result = [];

        for (const range of ranges) {
            const where: any = {
                status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
            };

            if (range.maxDays === 0) {
                where.dueDate = { gte: now };
            } else if (range.minDays && !range.maxDays) {
                const minDate = new Date(now);
                minDate.setDate(minDate.getDate() - range.minDays);
                where.dueDate = { lt: minDate };
            } else if (range.minDays && range.maxDays) {
                const minDate = new Date(now);
                minDate.setDate(minDate.getDate() - range.maxDays);
                const maxDate = new Date(now);
                maxDate.setDate(maxDate.getDate() - range.minDays);
                where.dueDate = { gte: minDate, lt: maxDate };
            }

            const records = await (prisma as any).accountReceivable.findMany({
                where,
                select: { openAmount: true },
            });

            result.push({
                range: range.label,
                count: records.length,
                total: records.reduce((sum: number, r: { openAmount: number }) => sum + r.openAmount, 0),
            });
        }

        return result;
    }

    async getAPAging() {
        const now = new Date();
        const ranges = [
            { label: 'current', maxDays: 0 },
            { label: '1-30', minDays: 1, maxDays: 30 },
            { label: '31-60', minDays: 31, maxDays: 60 },
            { label: '61-90', minDays: 61, maxDays: 90 },
            { label: 'over_90', minDays: 91 },
        ];

        const result = [];

        for (const range of ranges) {
            const where: any = {
                status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
            };

            if (range.maxDays === 0) {
                where.dueDate = { gte: now };
            } else if (range.minDays && !range.maxDays) {
                const minDate = new Date(now);
                minDate.setDate(minDate.getDate() - range.minDays);
                where.dueDate = { lt: minDate };
            } else if (range.minDays && range.maxDays) {
                const minDate = new Date(now);
                minDate.setDate(minDate.getDate() - range.maxDays);
                const maxDate = new Date(now);
                maxDate.setDate(maxDate.getDate() - range.minDays);
                where.dueDate = { gte: minDate, lt: maxDate };
            }

            const records = await (prisma as any).accountPayable.findMany({
                where,
                select: { openAmount: true },
            });

            result.push({
                range: range.label,
                count: records.length,
                total: records.reduce((sum: number, r: { openAmount: number }) => sum + r.openAmount, 0),
            });
        }

        return result;
    }
}

export const accountingService = new AccountingService();
