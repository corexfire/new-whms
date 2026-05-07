import crypto from 'crypto';
import { beforeEach, describe, expect, test } from '@jest/globals';
import { ShopifyService } from '../services/shopify.service';

const buildOAuthHmac = (secret: string, query: Record<string, any>) => {
    const pairs: string[] = [];
    for (const [k, v] of Object.entries(query)) {
        if (k === 'hmac' || k === 'signature') continue;
        if (v === undefined) continue;
        if (Array.isArray(v)) {
            for (const vv of v) pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(vv))}`);
        } else {
            pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    pairs.sort();
    const message = pairs.join('&').replace(/%20/g, '+');
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
};

describe('ShopifyService', () => {
    beforeEach(() => {
        process.env.SHOPIFY_API_KEY = 'key';
        process.env.SHOPIFY_API_SECRET = 'secret';
        process.env.SHOPIFY_REDIRECT_URI = 'http://localhost:3001/api/integrations/shopify/oauth/callback';
        delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
    });

    test('encrypt/decrypt token without encryption key uses plain', () => {
        const svc = new ShopifyService();
        const enc = svc.encryptToken('tok');
        expect(enc.startsWith('plain:')).toBe(true);
        expect(svc.decryptToken(enc)).toBe('tok');
    });

    test('encrypt/decrypt token with encryption key roundtrips', () => {
        process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = 'test-key';
        const svc = new ShopifyService();
        const enc = svc.encryptToken('tok-123');
        expect(enc.startsWith('gcm:')).toBe(true);
        expect(svc.decryptToken(enc)).toBe('tok-123');
    });

    test('verifyWebhookHmac validates base64 digest', () => {
        const svc = new ShopifyService();
        const raw = Buffer.from('{"a":1}', 'utf8');
        const hmac = crypto.createHmac('sha256', 'secret').update(raw).digest('base64');
        expect(svc.verifyWebhookHmac(raw, hmac)).toBe(true);
        expect(svc.verifyWebhookHmac(raw, 'bad')).toBe(false);
    });

    test('verifyOAuthHmac validates query digest', () => {
        const svc = new ShopifyService();
        const query: any = {
            shop: 'my-store.myshopify.com',
            code: 'abc',
            state: 'state',
            timestamp: '1',
        };
        query.hmac = buildOAuthHmac('secret', query);
        expect(svc.verifyOAuthHmac(query)).toBe(true);
        query.hmac = '00' + query.hmac.slice(2);
        expect(svc.verifyOAuthHmac(query)).toBe(false);
    });
});
