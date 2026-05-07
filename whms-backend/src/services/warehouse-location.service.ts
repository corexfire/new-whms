import { prisma } from '../index';

export interface CreateWarehouseDto {
    code: string;
    name: string;
    address?: string;
}

export interface UpdateWarehouseDto {
    name?: string;
    address?: string;
    isActive?: boolean;
}

export interface CreateLocationDto {
    warehouseId: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    level?: string;
    bin?: string;
    code: string;
    capacity?: number | string | null;
}

export interface UpdateLocationDto {
    warehouseId?: string;
    code?: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    level?: string;
    bin?: string;
    capacity?: number | string | null;
    isActive?: boolean;
}

export class WarehouseService {
    async create(dto: CreateWarehouseDto) {
        return prisma.warehouse.create({
            data: dto,
        });
    }

    async findAll(params: { search?: string; isActive?: boolean }) {
        const { search, isActive } = params;
        const where: any = {};
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined) where.isActive = isActive;

        return prisma.warehouse.findMany({
            where,
            orderBy: { code: 'asc' },
            include: {
                _count: { select: { locations: true } },
            },
        });
    }

    async findById(id: string) {
        return prisma.warehouse.findUnique({
            where: { id },
            include: {
                locations: {
                    where: { isActive: true },
                    orderBy: { code: 'asc' },
                },
            },
        });
    }

    async update(id: string, dto: UpdateWarehouseDto) {
        return prisma.warehouse.update({
            where: { id },
            data: dto,
        });
    }

    async delete(id: string) {
        return prisma.warehouse.update({
            where: { id },
            data: { isActive: false },
        });
    }
}

export class LocationService {
    private normalizeCapacity(input: any): number | null | undefined {
        if (input === undefined) return undefined;
        if (input === null) return null;
        if (input === '') return null;

        if (typeof input === 'number') {
            if (!Number.isFinite(input)) throw new Error('Invalid capacity');
            return input;
        }

        if (typeof input === 'string') {
            const n = Number(input);
            if (!Number.isFinite(n)) throw new Error('Invalid capacity');
            return n;
        }

        throw new Error('Invalid capacity');
    }

    generateCode(warehouseCode: string, zone?: string, aisle?: string, rack?: string, level?: string, bin?: string): string {
        const parts = [
            warehouseCode,
            zone || '',
            aisle || '',
            rack || '',
            level || '',
            bin || '',
        ].filter(Boolean);
        return parts.join('-');
    }

    async create(dto: CreateLocationDto) {
        return prisma.location.create({
            data: {
                ...dto,
                capacity: this.normalizeCapacity((dto as any).capacity),
            } as any,
            include: { warehouse: true },
        });
    }

    async findAll(params: {
        warehouseId?: string;
        zone?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { warehouseId, zone, search, page = 1, limit = 50 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (warehouseId) where.warehouseId = warehouseId;
        if (zone) where.zone = zone;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [locations, total] = await Promise.all([
            prisma.location.findMany({
                where,
                skip,
                take: limit,
                orderBy: { code: 'asc' },
                include: {
                    warehouse: true,
                    _count: { select: { inventories: true } },
                },
            }),
            prisma.location.count({ where }),
        ]);

        return { locations, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.location.findUnique({
            where: { id },
            include: {
                warehouse: true,
                inventories: {
                    include: { item: true, itemLot: true },
                },
            },
        });
    }

    async findByCode(code: string) {
        return prisma.location.findUnique({
            where: { code },
            include: { warehouse: true },
        });
    }

    async getZones(warehouseId: string) {
        const locations = await prisma.location.findMany({
            where: { warehouseId, isActive: true },
            select: { zone: true },
            distinct: ['zone'],
        });
        return locations.map(l => l.zone).filter(Boolean);
    }

    async getHierarchy(warehouseId: string) {
        const locations = await prisma.location.findMany({
            where: { warehouseId, isActive: true },
            orderBy: { code: 'asc' },
        });

        const hierarchy: Record<string, any> = {};

        for (const loc of locations) {
            const parts = loc.code.split('-');
            if (parts.length < 2) continue;

            const warehouseCode = parts[0];
            const zone = loc.zone || parts[1] || 'Z';

            if (!hierarchy[zone]) {
                hierarchy[zone] = { zone, aisles: {} };
            }

            const aisle = loc.aisle || 'A';
            if (!hierarchy[zone].aisles[aisle]) {
                hierarchy[zone].aisles[aisle] = { racks: {} };
            }

            const rack = loc.rack || 'R';
            if (!hierarchy[zone].aisles[aisle].racks[rack]) {
                hierarchy[zone].aisles[aisle].racks[rack] = { levels: {} };
            }

            const level = loc.level || 'L';
            if (!hierarchy[zone].aisles[aisle].racks[rack].levels[level]) {
                hierarchy[zone].aisles[aisle].racks[rack].levels[level] = { bins: [] };
            }

            if (loc.bin) {
                hierarchy[zone].aisles[aisle].racks[rack].levels[level].bins.push({
                    bin: loc.bin,
                    id: loc.id,
                    code: loc.code,
                });
            }
        }

        return Object.values(hierarchy);
    }

    async update(id: string, dto: UpdateLocationDto) {
        return prisma.location.update({
            where: { id },
            data: {
                ...dto,
                capacity: this.normalizeCapacity((dto as any).capacity),
            } as any,
        });
    }

    async delete(id: string) {
        return prisma.location.update({
            where: { id },
            data: { isActive: false },
        });
    }
}

export const warehouseService = new WarehouseService();
export const locationService = new LocationService();
