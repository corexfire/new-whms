/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

const mockPrisma: any = {
    shopifyStore: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    shopifyOAuthState: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    shopifySyncJob: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    shopifyAuditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
    },
    shopifyItemMapping: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    shopifyOrderMapping: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    shopifyLocationMapping: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    shopifyCollectionMapping: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
    },
    shopifyDiscountMapping: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    shopifyGiftCardMapping: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    shopifyCompanyMapping: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    shopifyWebhookSubscription: {
        upsert: jest.fn(),
    },
    shopifyWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    item: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    uoM: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
    },
    discountRule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    giftCard: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    company: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    salesOrder: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    inventory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    location: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
    },
    warehouse: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
    },
    chartOfAccount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
    },
    journalEntry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    journalLine: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
    },
    accountReceivable: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    accountPayable: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    arPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    apPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    aRPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    aPPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

(mockPrisma.$transaction as any).mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return await arg(mockPrisma);
    if (Array.isArray(arg)) return await Promise.all(arg);
    return arg;
});

jest.mock('../index', () => ({
    prisma: mockPrisma,
}));

export { mockPrisma };
