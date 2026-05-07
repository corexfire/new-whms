import { Queue, Worker, Job } from 'bullmq';
import { bullmqConnection } from '../config/redis.config';
import { shopifySyncService } from '../services/shopify-sync.service';

export interface ShopifySyncJobData {
    syncJobId: string;
}

export const shopifySyncQueue = new Queue<ShopifySyncJobData>('ShopifySyncQueue', { connection: bullmqConnection });

export const shopifySyncWorker = new Worker<ShopifySyncJobData>(
    'ShopifySyncQueue',
    async (job: Job<ShopifySyncJobData>) => {
        await shopifySyncService.process(job.data.syncJobId);
        return { success: true };
    },
    { connection: bullmqConnection, concurrency: 3 }
);

shopifySyncWorker.on('failed', async (job, err) => {
    if (!job) return;
    try {
        const attempt = (job.attemptsMade || 0) + 1;
        await shopifySyncService.setBullJobId(job.data.syncJobId, String(job.id || ''));
        const { prisma } = await import('../index');
        await (prisma as any).shopifySyncJob.update({
            where: { id: job.data.syncJobId },
            data: { attempts: attempt, lastError: err?.message || 'Unknown error' },
        });
    } catch {
        return;
    }
});
