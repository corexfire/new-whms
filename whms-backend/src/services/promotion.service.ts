import { prisma } from '../index';

export interface CreateBundleDto {
    name: string;
    description?: string;
    bundlePrice: number;
    stock?: number;
    endDate?: string | Date;
    isActive?: boolean;
    items: {
        itemId: string;
        qty: number;
        unitPrice: number;
    }[];
}

export class PromotionService {
    // --- Bundles ---
    async findAllBundles() {
        const bundles = await (prisma as any).bundle.findMany({
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return bundles.map(this.mapBundle);
    }

    async findBundleById(id: string) {
        const bundle = await (prisma as any).bundle.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            }
        });
        return bundle ? this.mapBundle(bundle) : null;
    }

    async createBundle(dto: CreateBundleDto) {
        const { items, ...bundleData } = dto;
        const bundle = await (prisma as any).bundle.create({
            data: {
                ...bundleData,
                endDate: bundleData.endDate ? new Date(bundleData.endDate) : null,
                items: {
                    create: items.map((item: any) => ({
                        itemId: item.itemId,
                        quantity: item.qty,
                        unitPrice: item.unitPrice
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            }
        });

        return this.mapBundle(bundle);
    }

    async updateBundle(id: string, dto: any) {
        const { items, ...bundleData } = dto;
        
        const updateData: any = { ...bundleData };
        if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

        if (items) {
            await (prisma as any).bundleItem.deleteMany({ where: { bundleId: id } });
            updateData.items = {
                create: items.map((item: any) => ({
                    itemId: item.itemId,
                    quantity: item.qty || item.quantity,
                    unitPrice: item.unitPrice
                }))
            };
        }

        const bundle = await (prisma as any).bundle.update({
            where: { id },
            data: updateData,
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            }
        });

        return this.mapBundle(bundle);
    }

    async deleteBundle(id: string) {
        return (prisma as any).bundle.delete({ where: { id } });
    }

    private mapBundle(bundle: any) {
        const items = bundle.items.map((bi: any) => ({
            itemId: bi.itemId,
            sku: bi.item.sku,
            itemName: bi.item.name,
            qty: bi.quantity,
            unitPrice: bi.unitPrice
        }));

        const normalPrice = items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.qty), 0);
        const savings = normalPrice - bundle.bundlePrice;

        return {
            ...bundle,
            items,
            normalPrice,
            savings
        };
    }

    // --- Discount Rules ---
    async findAllDiscountRules() {
        const rules = await (prisma as any).discountRule.findMany({
            include: {
                categories: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return rules.map(this.mapDiscountRule);
    }

    async findDiscountRuleById(id: string) {
        const rule = await (prisma as any).discountRule.findUnique({
            where: { id },
            include: {
                categories: true
            }
        });
        return rule ? this.mapDiscountRule(rule) : null;
    }

    async createDiscountRule(dto: any) {
        const { categoryIds, ...ruleData } = dto;
        if (ruleData.startDate) ruleData.startDate = new Date(ruleData.startDate);
        if (ruleData.endDate) ruleData.endDate = new Date(ruleData.endDate);

        const rule = await (prisma as any).discountRule.create({
            data: {
                ...ruleData,
                categories: categoryIds ? {
                    connect: categoryIds.map((id: string) => ({ id }))
                } : undefined
            },
            include: {
                categories: true
            }
        });

        return this.mapDiscountRule(rule);
    }

    async updateDiscountRule(id: string, dto: any) {
        const { categoryIds, ...ruleData } = dto;
        
        if (ruleData.startDate) ruleData.startDate = new Date(ruleData.startDate);
        if (ruleData.endDate) ruleData.endDate = new Date(ruleData.endDate);

        if (categoryIds) {
            ruleData.categories = {
                set: categoryIds.map((id: string) => ({ id }))
            };
        }

        const rule = await (prisma as any).discountRule.update({
            where: { id },
            data: ruleData,
            include: {
                categories: true
            }
        });

        return this.mapDiscountRule(rule);
    }

    async deleteDiscountRule(id: string) {
        return (prisma as any).discountRule.delete({ where: { id } });
    }

    private mapDiscountRule(rule: any) {
        return {
            ...rule,
            categoryIds: rule.categories.map((c: any) => c.id),
            scopes: rule.categories.length > 0 
                ? rule.categories.map((c: any) => c.name) 
                : ['Semua Produk']
        };
    }
}

export const promotionService = new PromotionService();
