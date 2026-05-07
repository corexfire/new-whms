import { prisma } from '../index';
import { salesOrderService } from './sales-order.service';
import { journalService } from './journal.service';

export type PickListStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED';

export interface AllocationResult {
    soItemId: string;
    itemId: string;
    locationId: string;
    locationCode: string;
    quantity: number;
    lotNumber?: string;
    expiryDate?: Date;
}

export interface AutoAllocateParams {
    salesOrderId: string;
    warehouseId?: string;
    prioritizeExpiry?: boolean;
}

export class PickListService {
    private generatePickNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `PL-${year}${month}-${random}`;
    }

    async create(soId: string, assignedTo?: string) {
        const so = await prisma.salesOrder.findUnique({
            where: { id: soId },
            include: { items: { include: { item: true } } },
        });

        if (!so) throw new Error('Sales Order not found');
        if (so.status !== 'APPROVED' && so.status !== 'PICKING') {
            throw new Error('SO must be approved before creating pick list');
        }

        const pickNumber = this.generatePickNumber();

        return prisma.pickList.create({
            data: {
                pickNumber,
                salesOrderId: soId,
                status: 'NEW',
                assignedTo,
            },
            include: {
                salesOrder: { include: { customer: true } },
                items: { include: { soItem: { include: { item: true } }, location: true } },
            },
        });
    }

    async autoAllocate(params: AutoAllocateParams): Promise<AllocationResult[]> {
        const { salesOrderId, warehouseId, prioritizeExpiry = true } = params;

        const so = await prisma.salesOrder.findUnique({
            where: { id: salesOrderId },
            include: { items: true },
        });

        if (!so) throw new Error('Sales Order not found');

        const allocations: AllocationResult[] = [];

        const inventoryWhere: any = { availableQty: { gt: 0 } };
        if (warehouseId) {
            inventoryWhere.location = { warehouseId };
        }

        const inventories = await prisma.inventory.findMany({
            where: inventoryWhere,
            include: {
                item: true,
                location: true,
                itemLot: true,
            },
            orderBy: prioritizeExpiry
                ? [{ itemLot: { expiryDate: 'asc' } }, { location: { code: 'asc' } }]
                : { location: { code: 'asc' } },
        });

        const inventoryMap = new Map<string, typeof inventories>();
        for (const inv of inventories) {
            const key = inv.itemId;
            if (!inventoryMap.has(key)) {
                inventoryMap.set(key, []);
            }
            inventoryMap.get(key)!.push(inv);
        }

        for (const soItem of so.items) {
            let remainingQty = soItem.quantity;

            const availableInventory = inventoryMap.get(soItem.itemId) || [];

            for (const inv of availableInventory) {
                if (remainingQty <= 0) break;

                const allocateQty = Math.min(remainingQty, inv.availableQty);

                allocations.push({
                    soItemId: soItem.id,
                    itemId: soItem.itemId,
                    locationId: inv.locationId,
                    locationCode: inv.location.code,
                    quantity: allocateQty,
                    lotNumber: inv.itemLot?.lotNumber,
                    expiryDate: inv.itemLot?.expiryDate || undefined,
                });

                remainingQty -= allocateQty;
            }
        }

        return allocations;
    }

    async createFromAllocation(salesOrderId: string, allocations: AllocationResult[], assignedTo?: string) {
        const so = await prisma.salesOrder.findUnique({
            where: { id: salesOrderId },
            include: { items: true },
        });

        if (!so) throw new Error('Sales Order not found');

        const pickNumber = this.generatePickNumber();

        const groupedByLocation = new Map<string, AllocationResult[]>();
        for (const alloc of allocations) {
            if (!groupedByLocation.has(alloc.locationId)) {
                groupedByLocation.set(alloc.locationId, []);
            }
            groupedByLocation.get(alloc.locationId)!.push(alloc);
        }

        const pickList = await prisma.pickList.create({
            data: {
                pickNumber,
                salesOrderId,
                status: 'NEW',
                assignedTo,
                items: {
                    create: allocations.map(alloc => ({
                        soItemId: alloc.soItemId,
                        locationId: alloc.locationId,
                        quantity: alloc.quantity,
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        soItem: { include: { item: true } },
                        location: true,
                    },
                },
            },
        });

        await prisma.$transaction(async (tx) => {
            for (const alloc of allocations) {
                const inventory = await tx.inventory.findFirst({
                    where: {
                        itemId: alloc.itemId,
                        locationId: alloc.locationId,
                        itemLotId: alloc.lotNumber
                            ? { not: null }
                            : alloc.lotNumber === undefined
                                ? null
                                : undefined,
                    },
                });

                if (inventory) {
                    await tx.inventory.update({
                        where: { id: inventory.id },
                        data: {
                            allocatedQty: { increment: alloc.quantity },
                            availableQty: { decrement: alloc.quantity },
                        },
                    });
                }
            }
        });

        await salesOrderService.updateStatus(salesOrderId, 'PICKING');

        return pickList;
    }

    async findAll(params: {
        status?: PickListStatus;
        assignedTo?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, assignedTo, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (assignedTo) where.assignedTo = assignedTo;

        const [pickLists, total] = await Promise.all([
            prisma.pickList.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    salesOrder: { include: { customer: true } },
                    items: {
                        include: {
                            soItem: { include: { item: true } },
                            location: true,
                        },
                    },
                },
            }),
            prisma.pickList.count({ where }),
        ]);

        return { pickLists, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string) {
        return prisma.pickList.findUnique({
            where: { id },
            include: {
                salesOrder: { include: { customer: true } },
                items: {
                    include: {
                        soItem: { include: { item: true } },
                        location: true,
                    },
                },
            },
        });
    }

    async assignUser(pickListId: string, userId: string) {
        return prisma.pickList.update({
            where: { id: pickListId },
            data: { assignedTo: userId, status: 'IN_PROGRESS' },
        });
    }

    async confirmPick(pickItemId: string, pickedQty: number) {
        const pickItem = await prisma.pickListItem.findUnique({
            where: { id: pickItemId },
            include: { pickList: true, location: true },
        });

        if (!pickItem) throw new Error('Pick item not found');
        if (pickItem.pickList.status === 'COMPLETED') {
            throw new Error('Pick list already completed');
        }

        if (pickedQty > pickItem.quantity) {
            throw new Error('Picked quantity cannot exceed allocated quantity');
        }

        const updated = await prisma.pickListItem.update({
            where: { id: pickItemId },
            data: { pickedQty },
        });

        const allPicked = await this.checkAllPicked(pickItem.pickListId);

        if (allPicked) {
            await prisma.pickList.update({
                where: { id: pickItem.pickListId },
                data: { status: 'COMPLETED' },
            });
        }

        return updated;
    }

    async scanAndConfirm(pickListId: string, barcode: string, qty: number, userId: string) {
        const inventory = await prisma.inventory.findFirst({
            where: {
                item: {
                    uoms: {
                        some: { barcode },
                    },
                },
            },
            include: { item: true, location: true },
        });

        if (!inventory) {
            throw new Error('Item with barcode not found');
        }

        const pickItem = await prisma.pickListItem.findFirst({
            where: {
                pickListId,
                locationId: inventory.locationId,
                soItem: { itemId: inventory.itemId },
                pickedQty: { lt: prisma.pickListItem.fields.quantity },
            },
        });

        if (!pickItem) {
            throw new Error('No pending pick item found for this location');
        }

        const nextPickedQty = Math.min(pickItem.quantity, pickItem.pickedQty + qty);
        return this.confirmPick(pickItem.id, nextPickedQty);
    }

    async validatePacking(pickListId: string): Promise<{ valid: boolean; issues: string[] }> {
        const pickList = await prisma.pickList.findUnique({
            where: { id: pickListId },
            include: {
                items: true,
                salesOrder: { include: { items: { include: { item: true } } } },
            },
        });

        if (!pickList) throw new Error('Pick list not found');

        const issues: string[] = [];

        for (const soItem of pickList.salesOrder.items) {
            const totalPicked = pickList.items
                .filter(pi => pi.soItemId === soItem.id)
                .reduce((sum: number, pi) => sum + pi.pickedQty, 0);

            if (totalPicked < soItem.quantity) {
                issues.push(`Item ${soItem.item.name}: ordered ${soItem.quantity}, picked ${totalPicked}`);
            }
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }

    private async checkAllPicked(pickListId: string): Promise<boolean> {
        const items = await prisma.pickListItem.findMany({
            where: { pickListId },
        });

        return items.every(item => item.pickedQty >= item.quantity);
    }

    async complete(pickListId: string) {
        const pickList = await prisma.pickList.findUnique({
            where: { id: pickListId },
            include: {
                items: { include: { soItem: true, location: true } },
                salesOrder: true,
            },
        });

        if (!pickList) throw new Error('Pick list not found');
        if (pickList.status === 'COMPLETED') throw new Error('Already completed');

        await prisma.$transaction(async (tx) => {
            for (const item of pickList.items) {
                await tx.inventory.updateMany({
                    where: {
                        itemId: item.soItem.itemId,
                        locationId: item.locationId,
                    },
                    data: {
                        onHandQty: { decrement: item.pickedQty },
                        allocatedQty: { decrement: item.quantity },
                        availableQty: {
                            increment: item.quantity - item.pickedQty,
                        },
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        itemId: item.soItem.itemId,
                        locationId: item.locationId,
                        type: 'OUT',
                        quantity: -item.pickedQty,
                        referenceId: pickList.id,
                        remarks: `PickList: ${pickList.pickNumber}`,
                    },
                });
            }

            await tx.pickList.update({
                where: { id: pickListId },
                data: { status: 'COMPLETED' },
            });
        });

        const allPickListsComplete = await prisma.pickList.count({
            where: {
                salesOrderId: pickList.salesOrderId,
                status: { not: 'COMPLETED' },
            },
        });

        if (allPickListsComplete === 0) {
            await salesOrderService.updateStatus(pickList.salesOrderId, 'PACKED');
        }

        return pickList;
    }
}

export const pickListService = new PickListService();
