import { Queue, Worker, Job } from 'bullmq';
import net from 'net';
import { bullmqConnection } from '../config/redis.config';

export const printerQueue = new Queue('PrinterQueue', { connection: bullmqConnection });

export interface PrintJobData {
    zpl: string;
    printerIp: string;
    printerPort?: number;
    labelType: 'product' | 'shipping' | 'custom' | 'receipt';
    copies?: number;
    metadata?: Record<string, any>;
}

const sendToPrinter = async (zpl: string, ip: string, port: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let response = '';

        const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error('Printer connection timeout (10s)'));
        }, 10000);

        client.connect(port, ip, () => {
            client.write(zpl, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    client.end();
                    reject(err);
                }
            });
        });

        client.on('data', (data) => {
            response += data.toString();
        });

        client.on('close', () => {
            clearTimeout(timeout);
            if (response.includes('error') || response.includes('Error')) {
                reject(new Error(`Printer error: ${response}`));
            } else {
                resolve(true);
            }
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
};

export const printerWorker = new Worker(
    'PrinterQueue',
    async (job: Job<PrintJobData>) => {
        const { zpl, printerIp, printerPort, labelType, copies } = job.data;
        const port = printerPort || 9100;

        console.log(`[PrinterWorker] Processing ${labelType} job ${job.id} -> ${printerIp}:${port}`);

        let success = false;
        const printCount = copies || 1;

        for (let i = 0; i < printCount; i++) {
            try {
                await sendToPrinter(zpl, printerIp, port);
                console.log(`[PrinterWorker] Copy ${i + 1}/${printCount} sent successfully`);
                success = true;
            } catch (err: any) {
                console.error(`[PrinterWorker] Print attempt ${i + 1} failed:`, err.message);
                if (i === printCount - 1) {
                    throw err;
                }
            }
        }

        await job.updateProgress(100);
        console.log(`[PrinterWorker] Job ${job.id} completed (${printCount} copies)`);

        return { success, copies: printCount };
    },
    { 
        connection: bullmqConnection,
        concurrency: 5,
    }
);

printerWorker.on('completed', (job, result) => {
    console.log(`[PrinterWorker] Job ${job.id} completed:`, result);
});

printerWorker.on('failed', (job, err) => {
    console.error(`[PrinterWorker] Job ${job?.id} failed:`, err.message);
});

printerWorker.on('progress', (job, progress) => {
    console.log(`[PrinterWorker] Job ${job.id} progress: ${progress}%`);
});
