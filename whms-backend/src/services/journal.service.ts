import { prisma } from '../index';

export interface JournalLineDto {
    accountId: string;
    debit: number;
    credit: number;
    memo?: string;
}

export interface CreateJournalEntryDto {
    description: string;
    date?: Date;
    referenceId?: string;
    source?: 'MANUAL' | 'AUTO';
    lines: JournalLineDto[];
}

export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID';

export class JournalService {
    private generateEntryNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const count = Math.floor(Math.random() * 9999) + 1;
        return `JE-${year}${month}-${String(count).padStart(4, '0')}`;
    }

    async create(dto: CreateJournalEntryDto) {
        this.validateLines(dto.lines);

        const entryNumber = this.generateEntryNumber();

        return prisma.journalEntry.create({
            data: {
                entryNumber,
                description: dto.description,
                date: dto.date || new Date(),
                referenceId: dto.referenceId,
                source: dto.source || (dto.referenceId ? 'AUTO' : 'MANUAL'),
                status: 'DRAFT',
                lines: {
                    create: dto.lines.map(line => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        memo: line.memo,
                    })),
                },
            } as any,
            include: {
                lines: { include: { account: true } },
            },
        });
    }

    async update(id: string, dto: CreateJournalEntryDto) {
        const entry = await prisma.journalEntry.findUnique({
            where: { id },
            include: { lines: true },
        });

        if (!entry) throw new Error('Journal entry not found');
        if (entry.status !== 'DRAFT') throw new Error('Only draft entries can be updated');

        this.validateLines(dto.lines);

        return prisma.journalEntry.update({
            where: { id },
            data: {
                description: dto.description,
                date: dto.date || entry.date,
                referenceId: dto.referenceId,
                source: dto.source || (entry as any).source,
                lines: {
                    deleteMany: {},
                    create: dto.lines.map((line) => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        memo: line.memo,
                    })),
                },
            } as any,
            include: { lines: { include: { account: true } } },
        });
    }

    async delete(id: string) {
        const entry = await prisma.journalEntry.findUnique({ where: { id } });
        if (!entry) throw new Error('Journal entry not found');
        if (entry.status !== 'DRAFT') throw new Error('Only draft entries can be deleted');

        await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
        await prisma.journalEntry.delete({ where: { id } });
        return { deleted: true };
    }

    async post(id: string) {
        const entry = await prisma.journalEntry.findUnique({
            where: { id },
            include: { lines: true },
        });

        if (!entry) throw new Error('Journal entry not found');
        if (entry.status === 'POSTED') throw new Error('Entry already posted');
        if (entry.status === 'VOID') throw new Error('Cannot post voided entry');

        const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Journal tidak seimbang: Debit ${totalDebit} != Kredit ${totalCredit}`);
        }

        await prisma.$transaction(async (tx) => {
            for (const line of entry.lines) {
                await tx.chartOfAccount.update({
                    where: { id: line.accountId },
                    data: {
                        balance: { increment: line.debit - line.credit },
                    },
                });
            }

            await tx.journalEntry.update({
                where: { id },
                data: { status: 'POSTED' },
            });
        });

        return prisma.journalEntry.findUnique({
            where: { id },
            include: { lines: { include: { account: true } } },
        });
    }

    async void(id: string, reason: string) {
        const entry = await prisma.journalEntry.findUnique({
            where: { id },
            include: { lines: true },
        });

        if (!entry) throw new Error('Journal entry not found');
        if (entry.status === 'VOID') throw new Error('Entry already voided');

        if (entry.status === 'POSTED') {
            await prisma.$transaction(async (tx) => {
                for (const line of entry.lines) {
                    await tx.chartOfAccount.update({
                        where: { id: line.accountId },
                        data: {
                            balance: { decrement: line.debit - line.credit },
                        },
                    });
                }

                await tx.journalEntry.update({
                    where: { id },
                    data: {
                        status: 'VOID',
                        description: `${entry.description} | VOID: ${reason}`,
                    },
                });
            });
        } else {
            await prisma.journalEntry.update({
                where: { id },
                data: {
                    status: 'VOID',
                    description: `${entry.description} | VOID: ${reason}`,
                },
            });
        }
    }

    async postGRNJournal(grnId: string, userId: string) {
        const grn = await prisma.goodsReceipt.findUnique({
            where: { id: grnId },
            include: {
                purchaseOrder: { include: { supplier: true, items: true } },
                items: { include: { item: true } },
            },
        });

        if (!grn) throw new Error('GRN not found');

        const totalAmount = grn.items.reduce((sum, item) => {
            const poItem = grn.purchaseOrder.items.find(pi => pi.itemId === item.itemId);
            return sum + (poItem?.unitPrice || 0) * item.receivedQty;
        }, 0);

        const inventoryAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '1400' },
        });

        const apAccount = await prisma.chartOfAccount.findFirst({
            where: { code: '2000' },
        });

        if (!inventoryAccount || !apAccount) {
            throw new Error('Inventory or AP account not found');
        }

        return this.create({
            description: `GRN: ${grn.grnNumber} from ${grn.purchaseOrder.supplier.name}`,
            date: grn.receiptDate,
            referenceId: grn.id,
            source: 'AUTO',
            lines: [
                {
                    accountId: inventoryAccount.id,
                    debit: totalAmount,
                    credit: 0,
                },
                {
                    accountId: apAccount.id,
                    debit: 0,
                    credit: totalAmount,
                },
            ],
        }).then(entry => this.post(entry.id));
    }

    async findAll(params: {
        status?: JournalStatus;
        source?: 'MANUAL' | 'AUTO';
        startDate?: Date;
        endDate?: Date;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, source, startDate, endDate, search, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (source) where.source = source;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }
        if (search) {
            where.OR = [
                { entryNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [entries, total] = await Promise.all([
            prisma.journalEntry.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: 'desc' },
                include: {
                    lines: { include: { account: true } },
                },
            }),
            prisma.journalEntry.count({ where }),
        ]);

        return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.journalEntry.findUnique({
            where: { id },
            include: {
                lines: { include: { account: true } },
            },
        });
    }

    async getLedger(accountId: string, startDate?: Date, endDate?: Date) {
        const where: any = {
            accountId,
            journalEntry: { status: 'POSTED' },
        };

        if (startDate || endDate) {
            where.journalEntry.date = {};
            if (startDate) where.journalEntry.date.gte = startDate;
            if (endDate) where.journalEntry.date.lte = endDate;
        }

        const lines = await prisma.journalLine.findMany({
            where,
            include: { journalEntry: true },
            orderBy: { journalEntry: { date: 'asc' } },
        });

        return lines;
    }

    async getTrialBalance(startDate: Date, endDate: Date) {
        const accounts = await prisma.chartOfAccount.findMany({
            orderBy: { code: 'asc' },
        });

        const balances = await Promise.all(
            accounts.map(async (account) => {
                const lines = await prisma.journalLine.findMany({
                    where: {
                        accountId: account.id,
                        journalEntry: {
                            status: 'POSTED',
                            date: { gte: startDate, lte: endDate },
                        },
                    },
                });

                const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
                const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

                let balance = account.balance;
                if (['ASSET', 'EXPENSE'].includes(account.type)) {
                    balance = totalDebit - totalCredit;
                } else {
                    balance = totalCredit - totalDebit;
                }

                return {
                    ...account,
                    totalDebit,
                    totalCredit,
                    balance,
                };
            })
        );

        return balances;
    }

    async getTrialBalanceDetailed(startDate: Date, endDate: Date) {
        const accounts = await prisma.chartOfAccount.findMany({
            orderBy: { code: 'asc' },
        });

        const [openingAgg, periodAgg] = await Promise.all([
            prisma.journalLine.groupBy({
                by: ['accountId'],
                where: {
                    journalEntry: { status: 'POSTED', date: { lt: startDate } },
                },
                _sum: { debit: true, credit: true },
            }),
            prisma.journalLine.groupBy({
                by: ['accountId'],
                where: {
                    journalEntry: { status: 'POSTED', date: { gte: startDate, lte: endDate } },
                },
                _sum: { debit: true, credit: true },
            }),
        ]);

        const openingByAccountId = new Map<string, { debit: number; credit: number }>(
            openingAgg.map((r) => [r.accountId, { debit: Number(r._sum.debit || 0), credit: Number(r._sum.credit || 0) }])
        );
        const periodByAccountId = new Map<string, { debit: number; credit: number }>(
            periodAgg.map((r) => [r.accountId, { debit: Number(r._sum.debit || 0), credit: Number(r._sum.credit || 0) }])
        );

        const balances = accounts.map((account) => {
            const opening = openingByAccountId.get(account.id) || { debit: 0, credit: 0 };
            const period = periodByAccountId.get(account.id) || { debit: 0, credit: 0 };

            const isNormalDebit = account.type === 'ASSET' || account.type === 'EXPENSE';

            const openingBalance = isNormalDebit ? opening.debit - opening.credit : opening.credit - opening.debit;
            const periodNet = isNormalDebit ? period.debit - period.credit : period.credit - period.debit;
            const closingBalance = openingBalance + periodNet;

            return {
                id: account.id,
                code: account.code,
                name: account.name,
                type: account.type,
                openingBalance,
                periodDebit: period.debit,
                periodCredit: period.credit,
                closingBalance,
                isActive: (account as any).isActive ?? true,
            };
        });

        const totalDebit = balances.reduce((sum, b) => sum + b.periodDebit, 0);
        const totalCredit = balances.reduce((sum, b) => sum + b.periodCredit, 0);

        return {
            balances,
            summary: { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 },
        };
    }

    private validateLines(lines: JournalLineDto[]) {
        if (!Array.isArray(lines) || lines.length < 2) {
            throw new Error('Minimal harus ada 2 baris jurnal (debit & kredit)');
        }

        let debitTotal = 0;
        let creditTotal = 0;

        for (const line of lines) {
            if (!line.accountId) throw new Error('Ada baris tanpa akun');

            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);

            if (!Number.isFinite(debit) || debit < 0) throw new Error('Nilai debit tidak valid');
            if (!Number.isFinite(credit) || credit < 0) throw new Error('Nilai kredit tidak valid');

            if (debit > 0 && credit > 0) throw new Error('Ada baris yang memiliki debit DAN kredit sekaligus');
            if (debit === 0 && credit === 0) throw new Error('Ada baris tanpa nilai debit/kredit');

            debitTotal += debit;
            creditTotal += credit;
        }

        if (Math.abs(debitTotal - creditTotal) > 0.01) {
            throw new Error(`Jurnal tidak seimbang: Debit ${debitTotal} ≠ Kredit ${creditTotal}`);
        }
    }
}

export const journalService = new JournalService();
