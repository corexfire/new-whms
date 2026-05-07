/// <reference types="jest" />
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockPrisma } from './setup';
import { AccountingService } from '../services/accounting.service';

const accountingService = new AccountingService();

describe('AccountingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createAR', () => {
        it('should create AR with OPEN status', async () => {
            const mockAR = {
                id: 'ar-1',
                customerId: 'cust-1',
                description: 'Invoice #001',
                totalAmount: 10000,
                openAmount: 10000,
                status: 'OPEN',
                dueDate: new Date(),
            };

            (mockPrisma.accountReceivable.create as any).mockResolvedValue(mockAR);

            const result = await accountingService.createAR({
                customerId: 'cust-1',
                description: 'Invoice #001',
                amount: 10000,
                dueDate: new Date(),
            });

            expect(result.status).toBe('OPEN');
            expect(result.totalAmount).toBe(10000);
            expect(result.openAmount).toBe(10000);
        });
    });

    describe('recordARPayment', () => {
        it('should record partial payment and update status to PARTIAL', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'OPEN',
                openAmount: 10000,
            };

            const mockPayment = {
                id: 'pay-1',
                accountReceivableId: 'ar-1',
                amount: 5000,
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);
            (mockPrisma.aRPayment.create as any).mockResolvedValue(mockPayment);
            (mockPrisma.accountReceivable.update as any).mockResolvedValue({
                ...mockAR,
                status: 'PARTIAL',
                openAmount: 5000,
            });

            const result = await accountingService.recordARPayment('ar-1', {
                amount: 5000,
                paymentDate: new Date(),
                paymentMethod: 'CASH',
            });

            expect(result.amount).toBe(5000);
        });

        it('should mark as PAID when fully paid', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'OPEN',
                openAmount: 10000,
            };

            const mockPayment = {
                id: 'pay-1',
                accountReceivableId: 'ar-1',
                amount: 10000,
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);
            (mockPrisma.aRPayment.create as any).mockResolvedValue(mockPayment);
            (mockPrisma.accountReceivable.update as any).mockResolvedValue({
                ...mockAR,
                status: 'PAID',
                openAmount: 0,
            });

            const result = await accountingService.recordARPayment('ar-1', {
                amount: 10000,
                paymentDate: new Date(),
                paymentMethod: 'CASH',
            });

            expect(result.amount).toBe(10000);
        });

        it('should throw error when payment exceeds open amount', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'OPEN',
                openAmount: 5000,
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);

            await expect(
                accountingService.recordARPayment('ar-1', {
                    amount: 10000,
                    paymentDate: new Date(),
                    paymentMethod: 'CASH',
                })
            ).rejects.toThrow('Payment exceeds open amount');
        });

        it('should throw error for already paid AR', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'PAID',
                openAmount: 0,
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);

            await expect(
                accountingService.recordARPayment('ar-1', {
                    amount: 1000,
                    paymentDate: new Date(),
                    paymentMethod: 'CASH',
                })
            ).rejects.toThrow('AR already fully paid');
        });
    });

    describe('voidAR', () => {
        it('should void open AR', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'OPEN',
                description: 'Original',
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);
            (mockPrisma.accountReceivable.update as any).mockResolvedValue({
                ...mockAR,
                status: 'CANCELLED',
            });

            const result = await accountingService.voidAR('ar-1', 'Cancelled');

            expect(result.status).toBe('CANCELLED');
        });

        it('should throw error for already paid AR', async () => {
            const mockAR = {
                id: 'ar-1',
                status: 'PAID',
                description: 'Original',
            };

            (mockPrisma.accountReceivable.findUnique as any).mockResolvedValue(mockAR);

            await expect(accountingService.voidAR('ar-1', 'Cancel')).rejects.toThrow(
                'Can only void open or partial AR'
            );
        });
    });

    describe('createAP', () => {
        it('should create AP with OPEN status', async () => {
            const mockAP = {
                id: 'ap-1',
                supplierId: 'sup-1',
                description: 'PO #001',
                totalAmount: 50000,
                openAmount: 50000,
                status: 'OPEN',
            };

            (mockPrisma.accountPayable.create as any).mockResolvedValue(mockAP);

            const result = await accountingService.createAP({
                supplierId: 'sup-1',
                description: 'PO #001',
                amount: 50000,
                dueDate: new Date(),
            });

            expect(result.status).toBe('OPEN');
            expect(result.totalAmount).toBe(50000);
        });
    });
});
