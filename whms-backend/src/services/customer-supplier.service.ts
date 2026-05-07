import { prisma } from '../index';

export interface CreateCustomerDto {
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
}

export interface UpdateCustomerDto {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
}

export interface CreateSupplierDto {
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
}

export interface UpdateSupplierDto {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
}

export class CustomerService {
    async create(dto: CreateCustomerDto) {
        return prisma.customer.create({
            data: dto,
        });
    }

    async findAll(params: { search?: string; page?: number; limit?: number }) {
        const { search, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.customer.count({ where }),
        ]);

        return { customers, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.customer.findUnique({
            where: { id },
            include: {
                salesOrders: {
                    take: 10,
                    orderBy: { orderDate: 'desc' },
                },
            },
        });
    }

    async findByCode(code: string) {
        return prisma.customer.findUnique({ where: { code } });
    }

    async update(id: string, dto: UpdateCustomerDto) {
        return prisma.customer.update({
            where: { id },
            data: dto,
        });
    }

    async delete(id: string) {
        return prisma.customer.delete({ where: { id } });
    }
}

export class SupplierService {
    async create(dto: CreateSupplierDto) {
        return prisma.supplier.create({
            data: dto,
        });
    }

    async findAll(params: { search?: string; page?: number; limit?: number }) {
        const { search, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [suppliers, total] = await Promise.all([
            prisma.supplier.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.supplier.count({ where }),
        ]);

        return { suppliers, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.supplier.findUnique({
            where: { id },
            include: {
                purchaseOrders: {
                    take: 10,
                    orderBy: { orderDate: 'desc' },
                },
            },
        });
    }

    async findByCode(code: string) {
        return prisma.supplier.findUnique({ where: { code } });
    }

    async update(id: string, dto: UpdateSupplierDto) {
        return prisma.supplier.update({
            where: { id },
            data: dto,
        });
    }

    async delete(id: string) {
        return prisma.supplier.delete({ where: { id } });
    }
}

export const customerService = new CustomerService();
export const supplierService = new SupplierService();
