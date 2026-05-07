import { prisma } from '../index';
import { posService } from './pos.service';

export type SyncStatus = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export interface OfflineActionData {
    actionType: string;
    payload: any;
    timestamp: string;
    clientId?: string;
}

export class OfflineSyncService {
    async queueAction(data: OfflineActionData) {
        return prisma.offlineAction.create({
            data: {
                actionType: data.actionType,
                payload: data.payload as any,
                status: 'PENDING',
            },
        });
    }

    async queueBulk(actions: OfflineActionData[]) {
        const results = await prisma.$transaction(
            actions.map(action =>
                prisma.offlineAction.create({
                    data: {
                        actionType: action.actionType,
                        payload: action.payload as any,
                        status: 'PENDING',
                    },
                })
            )
        );

        return { queued: results.length, actions: results };
    }

    async processPending(maxBatch: number = 50) {
        const pending = await prisma.offlineAction.findMany({
            where: { status: 'PENDING' },
            take: maxBatch,
            orderBy: { createdAt: 'asc' },
        });

        const results = {
            processed: 0,
            failed: 0,
            conflicts: 0,
            errors: [] as string[],
        };

        for (const action of pending) {
            try {
                await prisma.offlineAction.update({
                    where: { id: action.id },
                    data: { status: 'PROCESSING' },
                });

                await this.executeAction(action);

                await prisma.offlineAction.update({
                    where: { id: action.id },
                    data: { status: 'SYNCED' },
                });

                results.processed++;
            } catch (error: any) {
                if (error.message.includes('conflict') || error.message.includes('already')) {
                    await prisma.offlineAction.update({
                        where: { id: action.id },
                        data: { status: 'CONFLICT' },
                    });
                    results.conflicts++;
                } else {
                    await prisma.offlineAction.update({
                        where: { id: action.id },
                        data: {
                            status: 'FAILED',
                            retryCount: { increment: 1 },
                        },
                    });
                    results.failed++;
                    results.errors.push(`${action.id}: ${error.message}`);
                }
            }
        }

        return results;
    }

    private async executeAction(action: any) {
        const payload = typeof action.payload === 'string' ? JSON.parse(action.payload) : action.payload;

        switch (action.actionType) {
            case 'POS_CHECKOUT':
                await posService.checkout(payload.data, payload.cashierId);
                break;

            case 'POS_VOID':
                await posService.void(payload.receiptNumber, payload.reason, payload.cashierId);
                break;

            default:
                throw new Error(`Unknown action type: ${action.actionType}`);
        }
    }

    async getStatus(since?: Date) {
        const where: any = {};
        if (since) {
            where.createdAt = { gte: since };
        }

        const [pending, processing, synced, conflicts, failed] = await Promise.all([
            prisma.offlineAction.count({ where: { ...where, status: 'PENDING' } }),
            prisma.offlineAction.count({ where: { ...where, status: 'PROCESSING' } }),
            prisma.offlineAction.count({ ...where, status: { in: ['SYNCED'] } }),
            prisma.offlineAction.count({ where: { ...where, status: 'CONFLICT' } }),
            prisma.offlineAction.count({ where: { ...where, status: 'FAILED' } }),
        ]);

        return { pending, processing, synced, conflicts, failed };
    }

    async resolveConflict(actionId: string, resolution: 'APPLY' | 'DISCARD') {
        const action = await prisma.offlineAction.findUnique({ where: { id: actionId } });

        if (!action) throw new Error('Action not found');
        if (action.status !== 'CONFLICT') throw new Error('Action is not in conflict state');

        if (resolution === 'APPLY') {
            await this.executeAction(action);
        }

        return prisma.offlineAction.update({
            where: { id: actionId },
            data: { status: resolution === 'APPLY' ? 'SYNCED' : 'FAILED' },
        });
    }

    async retryFailed(maxRetries: number = 3) {
        const failed = await prisma.offlineAction.findMany({
            where: {
                status: 'FAILED',
                retryCount: { lt: maxRetries },
            },
            take: 50,
            orderBy: { createdAt: 'asc' },
        });

        const results = { retried: 0, succeeded: 0, failed: 0 };

        for (const action of failed) {
            try {
                await this.executeAction(action);
                await prisma.offlineAction.update({
                    where: { id: action.id },
                    data: { status: 'SYNCED' },
                });
                results.succeeded++;
            } catch {
                await prisma.offlineAction.update({
                    where: { id: action.id },
                    data: { retryCount: { increment: 1 } },
                });
                results.failed++;
            }
            results.retried++;
        }

        return results;
    }

    async cleanup(daysOld: number = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        const result = await prisma.offlineAction.deleteMany({
            where: {
                status: { in: ['SYNCED', 'FAILED'] },
                createdAt: { lt: cutoff },
                retryCount: { gte: 3 },
            },
        });

        return { deleted: result.count };
    }
}

export const offlineSyncService = new OfflineSyncService();
