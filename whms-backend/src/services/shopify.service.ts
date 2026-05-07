import crypto from 'crypto';
import https from 'https';
import { prisma } from '../index';
import '@shopify/shopify-api/adapters/node';
import { ApiVersion, Session, shopifyApi } from '@shopify/shopify-api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ShopifySettings = {
    defaultWarehouseId?: string | null;
    autoCreateItemsFromShopify?: boolean;
    autoCreateOrdersFromShopify?: boolean;
};

type ShopifyStoreRow = {
    id: string;
    shop: string;
    accessTokenEnc: string;
    scope?: string | null;
    settings?: any;
    isActive: boolean;
};

type ShopifyRequestError = {
    statusCode: number;
    message: string;
    details?: any;
};

const DEFAULT_SHOPIFY_API_VERSION: ApiVersion = ApiVersion.April26;
const extractNumericId = (gidOrId: string) => {
    const v = String(gidOrId || '');
    const m = /\/(\d+)$/.exec(v);
    return m ? m[1] : '';
};

const normalizeShop = (shop: string) => {
    const value = String(shop || '').trim().toLowerCase();
    if (!value) return '';
    if (value.includes('://')) {
        try {
            const url = new URL(value);
            return url.hostname.toLowerCase();
        } catch {
            return value;
        }
    }
    return value;
};

const toHex = (buf: Buffer) => buf.toString('hex');

const timingSafeEqual = (a: string, b: string) => {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
};

const requestJson = async <T>(params: {
    hostname: string;
    path: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    body?: any;
}): Promise<{ statusCode: number; headers: any; data: T }> => {
    const payload = params.body === undefined ? undefined : Buffer.from(JSON.stringify(params.body), 'utf8');

    return await new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: params.hostname,
                path: params.path,
                method: params.method,
                headers: {
                    Accept: 'application/json',
                    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } : {}),
                    ...(params.headers || {}),
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8');
                    const statusCode = res.statusCode || 0;
                    const headers = res.headers;

                    if (!raw) {
                        return resolve({ statusCode, headers, data: undefined as any });
                    }

                    try {
                        const data = JSON.parse(raw);
                        return resolve({ statusCode, headers, data });
                    } catch (err: any) {
                        return reject({
                            statusCode,
                            message: 'Invalid JSON response',
                            details: raw,
                        } satisfies ShopifyRequestError);
                    }
                });
            }
        );

        req.on('error', (err) => reject({ statusCode: 0, message: err.message } satisfies ShopifyRequestError));
        if (payload) req.write(payload);
        req.end();
    });
};

const getEncryptionKey = () => {
    const raw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
    if (!raw) return null;
    const buf = Buffer.from(raw, 'utf8');
    if (buf.length >= 32) return crypto.createHash('sha256').update(buf).digest();
    return crypto.createHash('sha256').update(buf).digest();
};

export class ShopifyService {
    private _shopify: ReturnType<typeof shopifyApi> | null = null;

    private get apiKey() {
        return process.env.SHOPIFY_API_KEY || '';
    }

    private get apiSecret() {
        return process.env.SHOPIFY_API_SECRET || '';
    }

    private get apiVersion() {
        return process.env.SHOPIFY_API_VERSION || '2025-01';
    }

    private get scopes() {
        return (
            process.env.SHOPIFY_SCOPES ||
            'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders'
        );
    }

    private get redirectUri() {
        return process.env.SHOPIFY_REDIRECT_URI || '';
    }

    private getShopifyHostName() {
        const base = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost';
        try {
            return new URL(base).host;
        } catch {
            return String(base).replace(/^https?:\/\//, '').replace(/\/+$/, '');
        }
    }

    private resolveApiVersion(version: string) {
        const raw = String(version || '').trim();
        if (!raw) return DEFAULT_SHOPIFY_API_VERSION;

        const m = /^(\d{4})-(\d{2})$/.exec(raw);
        if (!m) return DEFAULT_SHOPIFY_API_VERSION;

        const year = Number(m[1]);
        const month = Number(m[2]);
        const yy = String(year % 100).padStart(2, '0');
        const monthName =
            month === 1
                ? 'January'
                : month === 4
                  ? 'April'
                  : month === 7
                    ? 'July'
                    : month === 10
                      ? 'October'
                      : null;
        if (!monthName) return DEFAULT_SHOPIFY_API_VERSION;

        const key = `${monthName}${yy}`;
        const candidate = (ApiVersion as any)[key];
        return candidate || DEFAULT_SHOPIFY_API_VERSION;
    }

    private ensureConfigured() {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error('Shopify integration is not configured (missing SHOPIFY_API_KEY/SHOPIFY_API_SECRET)');
        }
    }

    private get shopify() {
        if (this._shopify) return this._shopify;
        this.ensureConfigured();

        const hostName = this.getShopifyHostName();
        const scopes = this.scopes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        this._shopify = shopifyApi({
            apiKey: this.apiKey,
            apiSecretKey: this.apiSecret,
            scopes,
            hostName,
            isEmbeddedApp: false,
            apiVersion: this.resolveApiVersion(this.apiVersion),
        });

        return this._shopify;
    }

    private model<T = any>(name: string): T {
        const m = (prisma as any)?.[name];
        if (!m) {
            throw new Error(
                `Shopify tables are not available in Prisma Client. Run "npx prisma db push" and "npx prisma generate", then restart the backend. Missing model: ${name}`
            );
        }
        return m as T;
    }

    encryptToken(token: string) {
        const key = getEncryptionKey();
        if (!key) return `plain:${token}`;
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `gcm:${toHex(iv)}:${toHex(tag)}:${toHex(enc)}`;
    }

    decryptToken(value: string) {
        if (!value) return '';
        if (value.startsWith('plain:')) return value.slice('plain:'.length);
        if (!value.startsWith('gcm:')) return value;
        const key = getEncryptionKey();
        if (!key) throw new Error('Missing SHOPIFY_TOKEN_ENCRYPTION_KEY');
        const parts = value.split(':');
        const iv = Buffer.from(parts[1], 'hex');
        const tag = Buffer.from(parts[2], 'hex');
        const enc = Buffer.from(parts[3], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
        return dec.toString('utf8');
    }

    verifyOAuthHmac(query: Record<string, string | string[] | undefined>) {
        const hmac = typeof query.hmac === 'string' ? query.hmac : '';
        if (!hmac) return false;
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
        const digest = crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
        return timingSafeEqual(digest, hmac);
    }

    verifyWebhookHmac(rawBody: Buffer, hmacHeader: string) {
        if (!hmacHeader) return false;
        const digest = crypto.createHmac('sha256', this.apiSecret).update(rawBody).digest('base64');
        return timingSafeEqual(digest, hmacHeader);
    }

    async validateWebhook(params: { rawBody: Buffer; rawRequest: any; rawResponse: any }) {
        this.ensureConfigured();
        return await this.shopify.webhooks.validate({
            rawBody: params.rawBody.toString('utf8'),
            rawRequest: params.rawRequest,
            rawResponse: params.rawResponse,
        });
    }

    async startOAuth(shopInput: string, opts?: { redirectUri?: string }) {
        this.ensureConfigured();
        const shop = normalizeShop(shopInput);
        if (!shop) throw new Error('Missing shop parameter');

        const redirectUri = String(opts?.redirectUri || this.redirectUri || '').trim();
        if (!redirectUri) throw new Error('Shopify integration is not configured (missing SHOPIFY_REDIRECT_URI)');

        const state = crypto.randomBytes(20).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.model('shopifyOAuthState').create({
            data: { id: state, shop, expiresAt },
        });

        const url = new URL(`https://${shop}/admin/oauth/authorize`);
        url.searchParams.set('client_id', this.apiKey);
        url.searchParams.set('scope', this.scopes);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', state);

        return { shop, state, url: url.toString() };
    }

    async completeOAuth(params: {
        shop: string;
        code: string;
        state: string;
        query: Record<string, string | string[] | undefined>;
    }) {
        this.ensureConfigured();

        const shop = normalizeShop(params.shop);
        if (!shop) throw new Error('Invalid shop');
        if (!params.code) throw new Error('Missing code');
        if (!params.state) throw new Error('Missing state');
        if (!this.verifyOAuthHmac(params.query)) throw new Error('Invalid Shopify HMAC');

        const stateRow = await this.model('shopifyOAuthState').findUnique({ where: { id: params.state } });
        if (!stateRow || stateRow.shop !== shop) throw new Error('Invalid state');
        if (stateRow.usedAt) throw new Error('State already used');
        if (new Date(stateRow.expiresAt).getTime() < Date.now()) throw new Error('State expired');

        const tokenResp = await requestJson<{ access_token: string; scope?: string }>(
            {
                hostname: shop,
                path: '/admin/oauth/access_token',
                method: 'POST',
                body: {
                    client_id: this.apiKey,
                    client_secret: this.apiSecret,
                    code: params.code,
                },
            }
        );

        if (tokenResp.statusCode < 200 || tokenResp.statusCode >= 300 || !(tokenResp.data as any)?.access_token) {
            throw new Error('Failed to exchange code for token');
        }

        await this.model('shopifyOAuthState').update({
            where: { id: params.state },
            data: { usedAt: new Date() },
        });

        const accessToken = (tokenResp.data as any).access_token as string;
        const scope = (tokenResp.data as any).scope as string | undefined;

        const existing = await this.model('shopifyStore').findUnique({ where: { shop } });
        const data = {
            shop,
            isActive: true,
            accessTokenEnc: this.encryptToken(accessToken),
            scope: scope || null,
            uninstalledAt: null,
        };

        const store = existing
            ? await this.model('shopifyStore').update({
                  where: { id: existing.id },
                  data,
              })
            : await this.model('shopifyStore').create({ data });

        return { storeId: store.id, shop: store.shop };
    }

    async getActiveStore(): Promise<ShopifyStoreRow | null> {
        const store = await this.model('shopifyStore').findFirst({
            where: { isActive: true },
            orderBy: { installedAt: 'desc' },
        });
        return store || null;
    }

    async getStoreById(storeId: string): Promise<ShopifyStoreRow | null> {
        const store = await this.model('shopifyStore').findUnique({ where: { id: storeId } });
        return store || null;
    }

    async updateSettings(storeId: string, settings: ShopifySettings) {
        const existing = await this.getStoreById(storeId);
        if (!existing) throw new Error('Shopify store not connected');
        const merged = { ...(existing.settings || {}), ...(settings || {}) };
        return await this.model('shopifyStore').update({
            where: { id: storeId },
            data: { settings: merged },
        });
    }

    async disconnect(storeId: string) {
        return await this.model('shopifyStore').update({
            where: { id: storeId },
            data: { isActive: false, uninstalledAt: new Date() },
        });
    }

    async connectManual(params: { shop: string; accessToken: string; scope?: string }) {
        const shop = normalizeShop(params.shop);
        if (!shop) throw new Error('Invalid shop');
        const accessToken = String(params.accessToken || '').trim();
        if (!accessToken) throw new Error('Missing accessToken');

        await this.validateAccessToken({ shop, accessToken });

        const existing = await this.model('shopifyStore').findUnique({ where: { shop } });
        const data = {
            shop,
            isActive: true,
            accessTokenEnc: this.encryptToken(accessToken),
            scope: params.scope || 'manual',
            installedAt: new Date(),
            uninstalledAt: null,
        };

        const store = existing
            ? await this.model('shopifyStore').update({ where: { id: existing.id }, data })
            : await this.model('shopifyStore').create({ data });

        return { storeId: store.id, shop: store.shop };
    }

    private async api<T = any>(store: ShopifyStoreRow, method: HttpMethod, path: string, body?: any): Promise<T> {
        const token = this.decryptToken(store.accessTokenEnc);
        if (!token) throw new Error('Missing Shopify token');

        const session = new Session({
            id: this.shopify.session.getOfflineId(store.shop),
            shop: store.shop,
            state: 'offline',
            isOnline: false,
            accessToken: token,
            scope: store.scope || undefined,
        });

        const client = new this.shopify.clients.Rest({
            session,
            apiVersion: this.resolveApiVersion(this.apiVersion),
        });

        const [basePath, queryString] = String(path || '').split('?', 2);
        const query =
            queryString && queryString.length
                ? Object.fromEntries(new URLSearchParams(queryString).entries())
                : undefined;

        try {
            if (method === 'GET') {
                const r = await client.get<T>({ path: basePath, query });
                return r.body as any;
            }
            if (method === 'POST') {
                const r = await client.post<T>({ path: basePath, query, data: body });
                return r.body as any;
            }
            if (method === 'PUT') {
                const r = await client.put<T>({ path: basePath, query, data: body });
                return r.body as any;
            }
            const r = await client.delete<T>({ path: basePath, query });
            return r.body as any;
        } catch (error: any) {
            const statusCode =
                error?.response?.code ||
                error?.response?.statusCode ||
                error?.statusCode ||
                (typeof error?.code === 'number' ? error.code : 0);
            const details = {
                body: error?.response?.body || error?.body || null,
                headers: error?.response?.headers || error?.headers || null,
                raw: error?.response || null,
            };
            const err: ShopifyRequestError = {
                statusCode: Number(statusCode) || 500,
                message: 'Shopify API request failed',
                details,
            };
            throw err;
        }
    }

    private async apiWithToken<T = any>(params: { shop: string; accessToken: string; method: HttpMethod; path: string; body?: any }): Promise<T> {
        const token = String(params.accessToken || '').trim();
        if (!token) throw new Error('Missing Shopify token');

        const shop = normalizeShop(params.shop);
        if (!shop) throw new Error('Invalid shop');

        const session = new Session({
            id: this.shopify.session.getOfflineId(shop),
            shop,
            state: 'offline',
            isOnline: false,
            accessToken: token,
        });

        const client = new this.shopify.clients.Rest({
            session,
            apiVersion: this.resolveApiVersion(this.apiVersion),
        });

        const [basePath, queryString] = String(params.path || '').split('?', 2);
        const query =
            queryString && queryString.length
                ? Object.fromEntries(new URLSearchParams(queryString).entries())
                : undefined;

        try {
            if (params.method === 'GET') {
                const r = await client.get<T>({ path: basePath, query });
                return r.body as any;
            }
            if (params.method === 'POST') {
                const r = await client.post<T>({ path: basePath, query, data: params.body });
                return r.body as any;
            }
            if (params.method === 'PUT') {
                const r = await client.put<T>({ path: basePath, query, data: params.body });
                return r.body as any;
            }
            const r = await client.delete<T>({ path: basePath, query });
            return r.body as any;
        } catch (error: any) {
            const statusCode =
                error?.response?.code ||
                error?.response?.statusCode ||
                error?.statusCode ||
                (typeof error?.code === 'number' ? error.code : 0);
            const details = {
                body: error?.response?.body || error?.body || null,
                headers: error?.response?.headers || error?.headers || null,
                raw: error?.response || null,
            };
            const err: ShopifyRequestError = {
                statusCode: Number(statusCode) || 500,
                message: 'Shopify API request failed',
                details,
            };
            throw err;
        }
    }

    async validateAccessToken(params: { shop: string; accessToken: string }) {
        const shop = normalizeShop(params.shop);
        const accessToken = String(params.accessToken || '').trim();
        if (!shop) throw new Error('Invalid shop');
        if (!accessToken) throw new Error('Missing accessToken');

        return await this.apiWithToken<any>({ shop, accessToken, method: 'GET', path: 'shop' });
    }

    async getInventoryItem(store: ShopifyStoreRow, inventoryItemId: string) {
        const id = String(inventoryItemId || '').trim();
        if (!id) throw new Error('Missing inventoryItemId');
        return await this.api<any>(store, 'GET', `inventory_items/${id}`);
    }

    async setInventoryItemTracked(store: ShopifyStoreRow, inventoryItemId: string, tracked: boolean) {
        const id = String(inventoryItemId || '').trim();
        if (!id) throw new Error('Missing inventoryItemId');
        return await this.api<any>(store, 'PUT', `inventory_items/${id}`, { inventory_item: { id, tracked: !!tracked } });
    }

    async resolveInventoryItem(store: ShopifyStoreRow, inventoryItemId: string) {
        const rest = await this.getInventoryItem(store, inventoryItemId);
        const inv = (rest as any)?.inventory_item || null;

        const out: any = {
            rest: inv,
            product: null,
            variant: null,
            admin: null,
        };

        const token = this.decryptToken(store.accessTokenEnc);
        if (!token) return out;

        const gid = String(inv?.admin_graphql_api_id || '').trim();
        if (!gid) return out;

        const session = new Session({
            id: this.shopify.session.getOfflineId(store.shop),
            shop: store.shop,
            state: 'offline',
            isOnline: false,
            accessToken: token,
            scope: store.scope || undefined,
        });

        const gql = new this.shopify.clients.Graphql({
            session,
            apiVersion: this.resolveApiVersion(this.apiVersion),
        });

        try {
            const resp = await gql.request(
                `query GetInventoryItem($id: ID!) {
                  inventoryItem(id: $id) {
                    id
                    sku
                    tracked
                    variant {
                      id
                      sku
                      product {
                        id
                        title
                        handle
                      }
                    }
                  }
                }`,
                { variables: { id: gid } }
            );

            const ii = (resp as any)?.data?.inventoryItem || null;
            const variant = ii?.variant || null;
            const product = variant?.product || null;

            out.variant = variant
                ? { id: variant.id, numericId: extractNumericId(variant.id), sku: variant.sku || null }
                : null;
            out.product = product
                ? { id: product.id, numericId: extractNumericId(product.id), title: product.title || null, handle: product.handle || null }
                : null;

            if (out.product?.numericId) {
                out.admin = {
                    productUrl: `https://${store.shop}/admin/products/${out.product.numericId}`,
                    variantUrl: out.variant?.numericId
                        ? `https://${store.shop}/admin/products/${out.product.numericId}/variants/${out.variant.numericId}`
                        : null,
                };
            }
        } catch {
            return out;
        }

        return out;
    }

    async listProducts(store: ShopifyStoreRow, params?: { limit?: number; since_id?: string }) {
        const query: Record<string, any> = { limit: params?.limit || 50 };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `products${qs ? `?${qs}` : ''}`);
    }

    async createProduct(store: ShopifyStoreRow, payload: any) {
        return await this.api(store, 'POST', 'products', { product: payload });
    }

    async updateProduct(store: ShopifyStoreRow, productId: string, payload: any) {
        return await this.api(store, 'PUT', `products/${productId}`, { product: payload });
    }

    async deleteProduct(store: ShopifyStoreRow, productId: string) {
        return await this.api(store, 'DELETE', `products/${productId}`);
    }

    async listCollections(store: ShopifyStoreRow) {
        return await this.api(store, 'GET', 'custom_collections');
    }

    async listSmartCollections(store: ShopifyStoreRow) {
        return await this.api(store, 'GET', 'smart_collections');
    }

    async createCollection(store: ShopifyStoreRow, payload: any) {
        return await this.api(store, 'POST', 'custom_collections', { custom_collection: payload });
    }

    async updateCollection(store: ShopifyStoreRow, collectionId: string, payload: any) {
        return await this.api(store, 'PUT', `custom_collections/${collectionId}`, { custom_collection: payload });
    }

    async deleteCollection(store: ShopifyStoreRow, collectionId: string) {
        return await this.api(store, 'DELETE', `custom_collections/${collectionId}`);
    }

    async listProductsByCollectionId(store: ShopifyStoreRow, params: { collectionId: string; limit?: number; since_id?: string }) {
        const collectionId = String(params.collectionId || '').trim();
        if (!collectionId) throw new Error('Missing collectionId');
        const query: Record<string, any> = { collection_id: collectionId, limit: params.limit || 50 };
        if (params.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `products${qs ? `?${qs}` : ''}`);
    }

    async listOrders(store: ShopifyStoreRow, params?: { limit?: number; status?: string; since_id?: string }) {
        const query: Record<string, any> = { limit: params?.limit || 50, status: params?.status || 'any' };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `orders${qs ? `?${qs}` : ''}`);
    }

    async listCustomers(store: ShopifyStoreRow, params?: { limit?: number; since_id?: string }) {
        const query: Record<string, any> = { limit: params?.limit || 50 };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `customers${qs ? `?${qs}` : ''}`);
    }

    async listPriceRules(store: ShopifyStoreRow, params?: { limit?: number; since_id?: string }) {
        const query: Record<string, any> = { limit: params?.limit || 50 };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `price_rules${qs ? `?${qs}` : ''}`);
    }

    async getPriceRule(store: ShopifyStoreRow, priceRuleId: string) {
        const id = String(priceRuleId || '').trim();
        if (!id) throw new Error('Missing priceRuleId');
        return await this.api(store, 'GET', `price_rules/${id}`);
    }

    async createPriceRule(store: ShopifyStoreRow, payload: any) {
        return await this.api(store, 'POST', 'price_rules', { price_rule: payload });
    }

    async updatePriceRule(store: ShopifyStoreRow, priceRuleId: string, payload: any) {
        const id = String(priceRuleId || '').trim();
        if (!id) throw new Error('Missing priceRuleId');
        return await this.api(store, 'PUT', `price_rules/${id}`, { price_rule: payload });
    }

    async deletePriceRule(store: ShopifyStoreRow, priceRuleId: string) {
        const id = String(priceRuleId || '').trim();
        if (!id) throw new Error('Missing priceRuleId');
        return await this.api(store, 'DELETE', `price_rules/${id}`);
    }

    async listDiscountCodes(store: ShopifyStoreRow, priceRuleId: string, params?: { limit?: number; since_id?: string }) {
        const id = String(priceRuleId || '').trim();
        if (!id) throw new Error('Missing priceRuleId');
        const query: Record<string, any> = { limit: params?.limit || 50 };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `price_rules/${id}/discount_codes${qs ? `?${qs}` : ''}`);
    }

    async createDiscountCode(store: ShopifyStoreRow, priceRuleId: string, code: string) {
        const id = String(priceRuleId || '').trim();
        const v = String(code || '').trim();
        if (!id) throw new Error('Missing priceRuleId');
        if (!v) throw new Error('Missing code');
        return await this.api(store, 'POST', `price_rules/${id}/discount_codes`, { discount_code: { code: v } });
    }

    async listCollectsByProductId(store: ShopifyStoreRow, productId: string, params?: { limit?: number }) {
        const id = String(productId || '').trim();
        if (!id) throw new Error('Missing productId');
        const query: Record<string, any> = { product_id: id, limit: params?.limit || 50 };
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `collects${qs ? `?${qs}` : ''}`);
    }

    async listGiftCards(store: ShopifyStoreRow, params?: { limit?: number; since_id?: string }) {
        const query: Record<string, any> = { limit: params?.limit || 50 };
        if (params?.since_id) query.since_id = params.since_id;
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `gift_cards${qs ? `?${qs}` : ''}`);
    }

    async createGiftCard(store: ShopifyStoreRow, payload: any) {
        return await this.api(store, 'POST', 'gift_cards', { gift_card: payload });
    }

    async listCompanies(store: ShopifyStoreRow, params?: { first?: number; after?: string }) {
        const token = this.decryptToken(store.accessTokenEnc);
        if (!token) throw new Error('Missing Shopify token');

        const session = new Session({
            id: this.shopify.session.getOfflineId(store.shop),
            shop: store.shop,
            state: 'offline',
            isOnline: false,
            accessToken: token,
            scope: store.scope || undefined,
        });

        const gql = new this.shopify.clients.Graphql({
            session,
            apiVersion: this.resolveApiVersion(this.apiVersion),
        });

        const first = Math.min(50, Math.max(1, Number(params?.first || 25)));
        const after = params?.after ? String(params.after) : null;

        const resp = await gql.request(
            `query Companies($first: Int!, $after: String) {
              companies(first: $first, after: $after) {
                edges {
                  cursor
                  node {
                    id
                    name
                    createdAt
                  }
                }
                pageInfo {
                  hasNextPage
                }
              }
            }`,
            { variables: { first, after } }
        );

        return (resp as any)?.data?.companies || null;
    }

    async createOrder(store: ShopifyStoreRow, payload: any) {
        return await this.api(store, 'POST', 'orders', { order: payload });
    }

    async getShop(store: ShopifyStoreRow) {
        return await this.api(store, 'GET', 'shop');
    }

    async getOrder(store: ShopifyStoreRow, orderId: string) {
        return await this.api(store, 'GET', `orders/${orderId}`);
    }

    async updateOrder(store: ShopifyStoreRow, orderId: string, payload: any) {
        return await this.api(store, 'PUT', `orders/${orderId}`, { order: payload });
    }

    async cancelOrder(store: ShopifyStoreRow, orderId: string, payload?: any) {
        return await this.api(store, 'POST', `orders/${orderId}/cancel`, payload || {});
    }

    async closeOrder(store: ShopifyStoreRow, orderId: string) {
        return await this.api(store, 'POST', `orders/${orderId}/close`, {});
    }

    async deleteOrder(store: ShopifyStoreRow, orderId: string) {
        return await this.api(store, 'DELETE', `orders/${orderId}`);
    }

    async setInventoryLevel(store: ShopifyStoreRow, payload: { location_id: string; inventory_item_id: string; available: number }) {
        return await this.api(store, 'POST', 'inventory_levels/set', payload);
    }

    async connectInventoryLevel(
        store: ShopifyStoreRow,
        payload: { location_id: string; inventory_item_id: string; relocate_if_necessary?: boolean }
    ) {
        return await this.api(store, 'POST', 'inventory_levels/connect', payload);
    }

    async listInventoryLevels(store: ShopifyStoreRow, params: { inventoryItemIds: string[]; locationIds?: string[] }) {
        const inventoryIds = (params.inventoryItemIds || []).filter(Boolean);
        if (!inventoryIds.length) return { inventory_levels: [] };
        const query: Record<string, any> = { inventory_item_ids: inventoryIds.join(',') };
        if (params.locationIds?.length) query.location_ids = params.locationIds.join(',');
        const qs = new URLSearchParams(query as any).toString();
        return await this.api(store, 'GET', `inventory_levels${qs ? `?${qs}` : ''}`);
    }

    async listLocations(store: ShopifyStoreRow) {
        return await this.api(store, 'GET', 'locations');
    }

    async ensureWebhooks(store: ShopifyStoreRow, topics: Array<{ topic: string; address: string }>) {
        const current = await this.api<any>(store, 'GET', 'webhooks');
        const existing: any[] = current.webhooks || [];

        const results: any[] = [];
        for (const t of topics) {
            const found = existing.find((w) => w.topic === t.topic && w.address === t.address);
            if (found) {
                await this.model('shopifyWebhookSubscription').upsert({
                    where: { storeId_topic: { storeId: store.id, topic: t.topic } },
                    create: { storeId: store.id, topic: t.topic, address: t.address, webhookId: String(found.id), isActive: true },
                    update: { address: t.address, webhookId: String(found.id), isActive: true },
                });
                results.push({ topic: t.topic, webhookId: String(found.id), status: 'EXISTS' });
                continue;
            }

            const created = await this.api<any>(store, 'POST', 'webhooks', { webhook: { topic: t.topic, address: t.address, format: 'json' } });
            const id = String(created.webhook?.id || '');
            await this.model('shopifyWebhookSubscription').upsert({
                where: { storeId_topic: { storeId: store.id, topic: t.topic } },
                create: { storeId: store.id, topic: t.topic, address: t.address, webhookId: id, isActive: true },
                update: { address: t.address, webhookId: id, isActive: true },
            });
            results.push({ topic: t.topic, webhookId: id, status: 'CREATED' });
        }

        return results;
    }
}

export const shopifyService = new ShopifyService();
