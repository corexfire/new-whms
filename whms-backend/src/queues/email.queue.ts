import { Queue, Worker, Job } from 'bullmq';
import { bullmqConnection } from '../config/redis.config';
import { transporter, defaultFrom } from '../config/mail.config';

export const emailQueue = new Queue('EmailQueue', { connection: bullmqConnection });

export interface EmailJobData {
    to: string;
    subject: string;
    html: string;
}

export const emailWorker = new Worker(
    'EmailQueue',
    async (job: Job<EmailJobData>) => {
        const { to, subject, html } = job.data;
        console.log(`[EmailWorker] Sending email to ${to}...`);

        const info = await transporter.sendMail({
            from: defaultFrom,
            to,
            subject,
            html,
        });

        console.log(`[EmailWorker] Email sent successfully: ${info.messageId}`);
    },
    { connection: bullmqConnection }
);

emailWorker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} has completed`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} has failed:`, err);
});
