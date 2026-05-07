import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3) {
            console.warn('[Redis] Connection failed, continuing without Redis');
            return null;
        }
        return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
});

const parseRedisUrlForBullMQ = (value: string) => {
    const url = new URL(value);
    const port = url.port ? Number(url.port) : 6379;
    const db = url.pathname && url.pathname !== '/' ? Number(url.pathname.replace('/', '')) : undefined;

    const connection: any = {
        host: url.hostname,
        port,
    };

    if (url.username) connection.username = url.username;
    if (url.password) connection.password = url.password;
    if (Number.isFinite(db as any)) connection.db = db;
    if (url.protocol === 'rediss:') connection.tls = {};

    return connection;
};

export const bullmqConnection = parseRedisUrlForBullMQ(redisUrl);

redisConnection.on('connect', () => {
    console.log('[Redis] Connected successfully');
});

redisConnection.on('error', (err) => {
    console.warn('[Redis] Connection Error (non-blocking):', err.message);
});
