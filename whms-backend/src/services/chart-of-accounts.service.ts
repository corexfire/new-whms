import { prisma } from '../index';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface CreateAccountDto {
    code: string;
    name: string;
    type: AccountType;
    parentId?: string;
    description?: string;
    isActive?: boolean;
}

export interface UpdateAccountDto {
    name?: string;
    parentId?: string;
    description?: string;
    isActive?: boolean;
}

export class ChartOfAccountsService {
    async create(dto: CreateAccountDto) {
        if (!dto.code) throw new Error('Code is required');
        if (!dto.name) throw new Error('Name is required');

        if (dto.parentId) {
            const parent = await prisma.chartOfAccount.findUnique({ where: { id: dto.parentId } });
            if (!parent) throw new Error('Parent account not found');
            if (parent.type !== dto.type) throw new Error('Parent type must match account type');
        }

        return prisma.chartOfAccount.create({
            data: {
                code: dto.code,
                name: dto.name,
                type: dto.type,
                description: dto.description,
                isActive: dto.isActive ?? true,
                parentId: dto.parentId,
            },
        });
    }

    async findAll(params: {
        type?: AccountType;
        isActive?: boolean;
        search?: string;
    }) {
        const { type, isActive, search } = params;

        const where: any = {};
        if (type) where.type = type;
        if (isActive !== undefined) where.isActive = isActive;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        return prisma.chartOfAccount.findMany({
            where,
            orderBy: [{ type: 'asc' }, { code: 'asc' }],
            include: { parent: true },
        });
    }

    async findById(id: string) {
        return prisma.chartOfAccount.findUnique({
            where: { id },
            include: {
                journalLines: {
                    take: 10,
                    orderBy: { journalEntry: { date: 'desc' } },
                    include: { journalEntry: true },
                },
            },
        });
    }

    async findByCode(code: string) {
        return prisma.chartOfAccount.findUnique({ where: { code } });
    }

    async update(id: string, dto: UpdateAccountDto) {
        if (dto.parentId) {
            if (dto.parentId === id) throw new Error('Parent cannot be self');

            const parent = await prisma.chartOfAccount.findUnique({ where: { id: dto.parentId } });
            if (!parent) throw new Error('Parent account not found');

            const current = await prisma.chartOfAccount.findUnique({ where: { id } });
            if (!current) throw new Error('Account not found');
            if (parent.type !== current.type) throw new Error('Parent type must match account type');

            const descendants = await prisma.chartOfAccount.findMany({
                where: { parentId: id },
                select: { id: true },
            });
            if (descendants.some((d) => d.id === dto.parentId)) throw new Error('Invalid parent (circular)');
        }

        return prisma.chartOfAccount.update({
            where: { id },
            data: dto,
        });
    }

    async delete(id: string) {
        const childrenCount = await prisma.chartOfAccount.count({ where: { parentId: id } });
        if (childrenCount > 0) throw new Error('Cannot delete account with child accounts');

        const hasTransactions = await prisma.journalLine.count({
            where: { accountId: id },
        });

        if (hasTransactions > 0) {
            await prisma.chartOfAccount.update({
                where: { id },
                data: { isActive: false },
            });
            return { deactivated: true, message: 'Account has transactions, account deactivated' };
        }

        await prisma.chartOfAccount.delete({ where: { id } });
        return { deleted: true };
    }

    async getTree() {
        const accounts = await prisma.chartOfAccount.findMany({
            orderBy: [{ type: 'asc' }, { code: 'asc' }],
        });

        const byId = new Map(accounts.map((a) => [a.id, { ...a, children: [] as any[] }]));
        const roots: any[] = [];

        for (const a of accounts) {
            const node = byId.get(a.id)!;
            if (a.parentId) {
                const parent = byId.get(a.parentId);
                if (parent) parent.children.push(node);
                else roots.push(node);
            } else {
                roots.push(node);
            }
        }

        const grouped = roots.reduce((acc, node) => {
            if (!acc[node.type]) acc[node.type] = [];
            acc[node.type].push(node);
            return acc;
        }, {} as Record<string, any[]>);

        return Object.entries(grouped).map(([type, items]) => ({ type, accounts: items }));
    }

    async getAccountBalance(accountId: string, asOfDate?: Date) {
        const where: any = {
            accountId,
            journalEntry: { status: 'POSTED' },
        };

        if (asOfDate) {
            where.journalEntry.date = { lte: asOfDate };
        }

        const lines = await prisma.journalLine.findMany({
            where,
            include: { account: true },
        });

        const account = lines[0]?.account;
        if (!account) {
            const acc = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
            return { balance: acc?.balance || 0 };
        }

        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

        let balance = 0;
        if (account.type === 'ASSET' || account.type === 'EXPENSE') {
            balance = totalDebit - totalCredit;
        } else {
            balance = totalCredit - totalDebit;
        }

        return { balance, totalDebit, totalCredit };
    }

    async seedDefaultAccounts() {
        const defaults: Array<{ code: string; name: string; type: AccountType; parentCode?: string; description?: string }> = [
            { code: '1000', name: 'ASET', type: 'ASSET' },
            { code: '1100', name: 'Aset Lancar', type: 'ASSET', parentCode: '1000' },
            { code: '1110', name: 'Kas & Setara Kas', type: 'ASSET', parentCode: '1100' },
            { code: '1111', name: 'Kas Kecil', type: 'ASSET', parentCode: '1110' },
            { code: '1112', name: 'Kas Besar', type: 'ASSET', parentCode: '1110' },
            { code: '1120', name: 'Bank', type: 'ASSET', parentCode: '1100' },
            { code: '1121', name: 'Bank BCA', type: 'ASSET', parentCode: '1120' },
            { code: '1122', name: 'Bank Mandiri', type: 'ASSET', parentCode: '1120' },
            { code: '1130', name: 'Piutang Usaha', type: 'ASSET', parentCode: '1100' },
            { code: '1131', name: 'Piutang Dagang', type: 'ASSET', parentCode: '1130' },
            { code: '1139', name: 'Cadangan Kerugian Piutang', type: 'ASSET', parentCode: '1130' },
            { code: '1140', name: 'Persediaan', type: 'ASSET', parentCode: '1100' },
            { code: '1141', name: 'Persediaan Barang Dagang', type: 'ASSET', parentCode: '1140' },
            { code: '1142', name: 'Persediaan Dalam Perjalanan', type: 'ASSET', parentCode: '1140' },
            { code: '1150', name: 'Uang Muka & Biaya Dibayar Di Muka', type: 'ASSET', parentCode: '1100' },
            { code: '1151', name: 'Uang Muka Pembelian', type: 'ASSET', parentCode: '1150' },
            { code: '1152', name: 'Sewa Dibayar Di Muka', type: 'ASSET', parentCode: '1150' },
            { code: '1160', name: 'PPN Masukan', type: 'ASSET', parentCode: '1100' },
            { code: '1200', name: 'Aset Tidak Lancar', type: 'ASSET', parentCode: '1000' },
            { code: '1210', name: 'Aset Tetap', type: 'ASSET', parentCode: '1200' },
            { code: '1211', name: 'Peralatan', type: 'ASSET', parentCode: '1210' },
            { code: '1212', name: 'Kendaraan', type: 'ASSET', parentCode: '1210' },
            { code: '1213', name: 'Bangunan', type: 'ASSET', parentCode: '1210' },
            { code: '1220', name: 'Akumulasi Penyusutan', type: 'ASSET', parentCode: '1200' },
            { code: '1221', name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', parentCode: '1220' },
            { code: '1222', name: 'Akumulasi Penyusutan Kendaraan', type: 'ASSET', parentCode: '1220' },
            { code: '1223', name: 'Akumulasi Penyusutan Bangunan', type: 'ASSET', parentCode: '1220' },

            { code: '2000', name: 'LIABILITAS', type: 'LIABILITY' },
            { code: '2100', name: 'Liabilitas Lancar', type: 'LIABILITY', parentCode: '2000' },
            { code: '2110', name: 'Hutang Usaha', type: 'LIABILITY', parentCode: '2100' },
            { code: '2111', name: 'Hutang Dagang', type: 'LIABILITY', parentCode: '2110' },
            { code: '2120', name: 'Hutang Pajak', type: 'LIABILITY', parentCode: '2100' },
            { code: '2121', name: 'PPN Keluaran', type: 'LIABILITY', parentCode: '2120' },
            { code: '2122', name: 'PPh Terutang', type: 'LIABILITY', parentCode: '2120' },
            { code: '2130', name: 'Hutang Gaji', type: 'LIABILITY', parentCode: '2100' },
            { code: '2200', name: 'Liabilitas Jangka Panjang', type: 'LIABILITY', parentCode: '2000' },
            { code: '2210', name: 'Pinjaman Bank', type: 'LIABILITY', parentCode: '2200' },

            { code: '3000', name: 'EKUITAS', type: 'EQUITY' },
            { code: '3100', name: 'Modal', type: 'EQUITY', parentCode: '3000' },
            { code: '3110', name: 'Modal Disetor', type: 'EQUITY', parentCode: '3100' },
            { code: '3200', name: 'Laba Ditahan', type: 'EQUITY', parentCode: '3000' },
            { code: '3300', name: 'Laba/Rugi Tahun Berjalan', type: 'EQUITY', parentCode: '3000' },

            { code: '4000', name: 'PENDAPATAN', type: 'REVENUE' },
            { code: '4100', name: 'Penjualan', type: 'REVENUE', parentCode: '4000' },
            { code: '4110', name: 'Penjualan Barang', type: 'REVENUE', parentCode: '4100' },
            { code: '4120', name: 'Diskon Penjualan', type: 'REVENUE', parentCode: '4100' },
            { code: '4200', name: 'Pendapatan Lain-lain', type: 'REVENUE', parentCode: '4000' },

            { code: '5000', name: 'BEBAN', type: 'EXPENSE' },
            { code: '5100', name: 'Harga Pokok Penjualan', type: 'EXPENSE', parentCode: '5000' },
            { code: '5110', name: 'HPP Barang Dagang', type: 'EXPENSE', parentCode: '5100' },
            { code: '5200', name: 'Beban Operasional', type: 'EXPENSE', parentCode: '5000' },
            { code: '5210', name: 'Beban Gaji', type: 'EXPENSE', parentCode: '5200' },
            { code: '5220', name: 'Beban Sewa', type: 'EXPENSE', parentCode: '5200' },
            { code: '5230', name: 'Beban Listrik & Air', type: 'EXPENSE', parentCode: '5200' },
            { code: '5240', name: 'Beban Transportasi', type: 'EXPENSE', parentCode: '5200' },
            { code: '5250', name: 'Beban Perlengkapan', type: 'EXPENSE', parentCode: '5200' },
            { code: '5260', name: 'Beban Penyusutan', type: 'EXPENSE', parentCode: '5200' },
            { code: '5270', name: 'Beban Administrasi Bank', type: 'EXPENSE', parentCode: '5200' },
        ];

        const byCode = new Map<string, { id: string; type: AccountType }>();

        const roots = defaults.filter((d) => !d.parentCode);
        for (const acc of roots) {
            const created = await prisma.chartOfAccount.upsert({
                where: { code: acc.code },
                create: { code: acc.code, name: acc.name, type: acc.type, description: acc.description, isActive: true },
                update: { name: acc.name, type: acc.type, description: acc.description, isActive: true, parentId: null },
            });
            byCode.set(acc.code, { id: created.id, type: created.type as AccountType });
        }

        const children = defaults.filter((d) => d.parentCode);
        for (const acc of children) {
            const parent = byCode.get(acc.parentCode!);
            if (!parent) continue;
            const created = await prisma.chartOfAccount.upsert({
                where: { code: acc.code },
                create: { code: acc.code, name: acc.name, type: acc.type, description: acc.description, isActive: true, parentId: parent.id },
                update: { name: acc.name, type: acc.type, description: acc.description, isActive: true, parentId: parent.id },
            });
            byCode.set(acc.code, { id: created.id, type: created.type as AccountType });
        }

        return { created: defaults.length };
    }
}

export const chartOfAccountsService = new ChartOfAccountsService();
