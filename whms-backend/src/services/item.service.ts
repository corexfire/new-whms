import { prisma } from '../index';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface CreateItemDto {
    sku: string;
    name: string;
    description?: string;
    categoryId?: string;
    productId?: string;
    color?: string;
    size?: string;
    material?: string;
    variantAttributes?: any;
    trackLot?: boolean;
    trackExpiry?: boolean;
    uoms?: CreateItemUoMDto[];
}

export interface CreateItemUoMDto {
    uomId: string;
    conversionRate: number;
    price: number;
    barcode?: string;
    barcodeType?: 'CODE128' | 'EAN13' | 'QR_CODE';
}

export interface UpdateItemDto {
    name?: string;
    description?: string;
    categoryId?: string;
    productId?: string;
    color?: string;
    size?: string;
    material?: string;
    variantAttributes?: any;
    isActive?: boolean;
    trackLot?: boolean;
    trackExpiry?: boolean;
}

export interface ItemUoMConversion {
    fromUomId: string;
    toUomId: string;
    fromQty: number;
    convertedQty: number;
    conversionRate: number;
}

export class ItemService {
    async create(dto: CreateItemDto) {
        const { uoms, ...itemData } = dto;

        const sku = String(dto.sku || '').trim();
        if (!sku) throw new Error('SKU is required');

        return (prisma.item as any).create({
            data: {
                ...itemData,
                uoms: uoms ? {
                    create: uoms.map(uom => ({
                        uomId: uom.uomId,
                        conversionRate: uom.conversionRate,
                        price: uom.price,
                        barcode: (uom.barcode || '').trim() || sku,
                        barcodeType: uom.barcodeType || 'QR_CODE',
                    })),
                } : undefined,
            },
            include: {
                category: true,
                product: true,
                uoms: { include: { uom: true } },
                images: true,
            },
        });
    }

    async findAll(params: {
        search?: string;
        categoryId?: string;
        productId?: string;
        color?: string;
        page?: number;
        limit?: number;
    }) {
        const { search, categoryId, productId, color, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId) where.categoryId = categoryId;
        if (productId) where.productId = productId;
        if (color) where.color = { equals: color, mode: 'insensitive' };

        const [items, total] = await Promise.all([
            (prisma.item as any).findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                    category: true,
                    product: true,
                    uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                    images: { orderBy: { createdAt: 'desc' } },
                },
            }),
            prisma.item.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return (prisma.item as any).findUnique({
            where: { id },
            include: {
                category: true,
                product: true,
                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                lots: { where: { isActive: true } },
                images: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    async findBySku(sku: string) {
        return (prisma.item as any).findUnique({
            where: { sku },
            include: {
                category: true,
                product: true,
                uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                images: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    async findByBarcode(barcode: string) {
        return (prisma.itemUoM as any).findUnique({
            where: { barcode },
            include: {
                item: {
                    include: {
                        category: true,
                        product: true,
                        uoms: { include: { uom: true }, orderBy: { conversionRate: 'asc' } },
                        images: { orderBy: { createdAt: 'desc' } },
                    },
                },
                uom: true,
            },
        });
    }

    async update(id: string, dto: UpdateItemDto) {
        return (prisma.item as any).update({
            where: { id },
            data: dto,
            include: {
                category: true,
                product: true,
                uoms: { include: { uom: true } },
                images: true,
            },
        });
    }

    async delete(id: string) {
        return prisma.item.update({
            where: { id },
            data: { uoms: { deleteMany: {} } },
        }).then(() => prisma.item.delete({ where: { id } }));
    }

    async addUoM(itemId: string, dto: CreateItemUoMDto) {
        const item = await prisma.item.findUnique({ where: { id: itemId }, select: { sku: true } });
        if (!item) throw new Error('Item not found');
        const sku = String(item.sku || '').trim();

        return (prisma.itemUoM as any).create({
            data: {
                itemId,
                uomId: dto.uomId,
                conversionRate: dto.conversionRate,
                price: dto.price,
                barcode: (dto.barcode || '').trim() || sku,
                barcodeType: dto.barcodeType || 'QR_CODE',
            },
            include: { uom: true },
        });
    }

    async updateUoM(id: string, data: Partial<CreateItemUoMDto>) {
        if ((data as any)?.barcodeType === 'QR_CODE' && !(data as any)?.barcode) {
            const current = await (prisma.itemUoM as any).findUnique({
                where: { id },
                include: { item: { select: { sku: true } } },
            });
            const sku = String(current?.item?.sku || '').trim();
            if (sku) (data as any).barcode = sku;
        }

        return (prisma.itemUoM as any).update({
            where: { id },
            data,
            include: { uom: true },
        });
    }

    async deleteUoM(id: string) {
        return (prisma.itemUoM as any).delete({ where: { id } });
    }

    convertQty(itemId: string, fromUomId: string, toUomId: string, qty: number): ItemUoMConversion | null {
        return null;
    }

    async createLot(itemId: string, lotNumber: string, expiryDate?: Date, manufactured?: Date, isActive: boolean = true) {
        if (!lotNumber) throw new Error('Lot number is required');

        const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, trackLot: true } });
        if (!item) throw new Error('Item not found');
        if (!item.trackLot) throw new Error('Item is not lot-tracked');

        return prisma.itemLot.create({
            data: {
                itemId,
                lotNumber,
                expiryDate,
                manufactured,
                isActive,
            },
        });
    }

    async findLots(itemId: string) {
        return prisma.itemLot.findMany({
            where: { itemId, isActive: true },
            orderBy: { createdAt: 'desc' } as any,
        });
    }

    async updateLot(id: string, data: { expiryDate?: Date | null; manufactured?: Date | null; isActive?: boolean }) {
        return prisma.itemLot.update({
            where: { id },
            data,
        });
    }

    async deleteLot(id: string) {
        const lot = await prisma.itemLot.findUnique({ where: { id } });
        if (!lot) throw new Error('Lot not found');

        const invCount = await prisma.inventory.count({ where: { itemLotId: id } });
        if (invCount > 0) throw new Error('Cannot delete lot with inventory records');

        return prisma.itemLot.delete({ where: { id } });
    }

    async addImage(itemId: string, webpBuffer: Buffer) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'items', itemId);
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `${randomUUID()}.webp`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, webpBuffer);

        return (prisma as any).itemImage.create({
            data: {
                itemId,
                filename,
                mimeType: 'image/webp',
                size: webpBuffer.length,
            },
        });
    }

    async deleteImage(imageId: string) {
        const img = await (prisma as any).itemImage.findUnique({ where: { id: imageId } });
        if (!img) return null;

        const filepath = path.join(process.cwd(), 'uploads', 'items', img.itemId, img.filename);
        await fs.rm(filepath, { force: true });
        await (prisma as any).itemImage.delete({ where: { id: imageId } });
        return img;
    }
}

export const itemService = new ItemService();
