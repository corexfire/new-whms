import {
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../config/s3.config';
import { Readable } from 'stream';

export interface UploadResult {
    key: string;
    url: string;
    bucket: string;
    size: number;
    mimetype: string;
}

export interface UploadOptions {
    folder?: string;
    filename?: string;
    mimetype?: string;
    expiresIn?: number;
}

export class StorageService {
    private bucket: string;

    constructor(bucket: string = BUCKET_NAME) {
        this.bucket = bucket;
    }

    async ensureBucket(): Promise<void> {
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                await s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
                console.log(`[Storage] Bucket ${this.bucket} created`);
            } else {
                throw error;
            }
        }
    }

    async uploadFile(
        buffer: Buffer,
        originalFilename: string,
        options: UploadOptions = {}
    ): Promise<UploadResult> {
        const timestamp = Date.now();
        const safeName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = options.folder
            ? `${options.folder}/${timestamp}-${safeName}`
            : `${timestamp}-${safeName}`;

        await s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: buffer,
                ContentType: options.mimetype || 'application/octet-stream',
                ACL: 'private',
            })
        );

        const url = await this.getSignedUrl(key, options.expiresIn || 3600);

        return {
            key,
            url,
            bucket: this.bucket,
            size: buffer.length,
            mimetype: options.mimetype || 'application/octet-stream',
        };
    }

    async uploadFromStream(
        stream: Readable,
        originalFilename: string,
        options: UploadOptions = {}
    ): Promise<UploadResult> {
        const chunks: Buffer[] = [];
        
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        
        const buffer = Buffer.concat(chunks);
        return this.uploadFile(buffer, originalFilename, options);
    }

    async deleteFile(key: string): Promise<void> {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            })
        );
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        
        return getSignedUrl(s3Client, command, { expiresIn });
    }

    async getFileBuffer(key: string): Promise<Buffer> {
        const response = await s3Client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            })
        );

        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];
        
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        
        return Buffer.concat(chunks);
    }

    getPublicUrl(key: string): string {
        const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
        const port = process.env.MINIO_PORT || '9000';
        const useSSL = process.env.MINIO_USE_SSL === 'true';
        
        return `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${this.bucket}/${key}`;
    }

    extractKeyFromUrl(url: string): string | null {
        const match = url.match(new RegExp(`${this.bucket}/(.+)$`));
        return match ? match[1] : null;
    }
}

export const storageService = new StorageService();
