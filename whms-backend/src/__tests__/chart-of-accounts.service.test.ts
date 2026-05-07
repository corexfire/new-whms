/// <reference types="jest" />
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockPrisma } from './setup';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';

const coaService = new ChartOfAccountsService();

describe('ChartOfAccountsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create new account', async () => {
            const mockAccount = {
                id: 'acc-1',
                code: '1000',
                name: 'Cash',
                type: 'ASSET',
                balance: 0,
            };

            (mockPrisma.chartOfAccount.create as any).mockResolvedValue(mockAccount);

            const result = await coaService.create({
                code: '1000',
                name: 'Cash',
                type: 'ASSET',
            });

            expect(result.code).toBe('1000');
            expect(result.name).toBe('Cash');
            expect(mockPrisma.chartOfAccount.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    code: '1000',
                    name: 'Cash',
                    type: 'ASSET',
                }),
            });
        });
    });

    describe('findAll', () => {
        it('should return all accounts', async () => {
            const mockAccounts = [
                { id: 'acc-1', code: '1000', name: 'Cash', type: 'ASSET' },
                { id: 'acc-2', code: '2000', name: 'Payables', type: 'LIABILITY' },
            ];

            (mockPrisma.chartOfAccount.findMany as any).mockResolvedValue(mockAccounts);

            const result = await coaService.findAll({});

            expect(result).toHaveLength(2);
        });

        it('should filter by type', async () => {
            const mockAccounts = [
                { id: 'acc-1', code: '1000', name: 'Cash', type: 'ASSET' },
            ];

            (mockPrisma.chartOfAccount.findMany as any).mockResolvedValue(mockAccounts);

            const result = await coaService.findAll({ type: 'ASSET' });

            expect(result).toHaveLength(1);
            expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ type: 'ASSET' }),
                })
            );
        });
    });

    describe('delete', () => {
        it('should delete account with no transactions', async () => {
            (mockPrisma.journalLine.count as any).mockResolvedValue(0);
            (mockPrisma.chartOfAccount.delete as any).mockResolvedValue({});

            const result = await coaService.delete('acc-1');

            expect(result).toEqual({ deleted: true });
        });

        it('should deactivate account with transactions', async () => {
            (mockPrisma.journalLine.count as any).mockResolvedValue(5);
            (mockPrisma.chartOfAccount.update as any).mockResolvedValue({});

            const result = await coaService.delete('acc-1');

            expect(result).toEqual({ deactivated: true, message: expect.stringContaining('transactions') });
            expect(mockPrisma.chartOfAccount.delete).not.toHaveBeenCalled();
        });
    });

    describe('seedDefaultAccounts', () => {
        it('should create default accounts', async () => {
            (mockPrisma.chartOfAccount.upsert as any).mockResolvedValue({});

            const result = await coaService.seedDefaultAccounts();

            expect(result.created).toBe(58);
            expect(mockPrisma.chartOfAccount.upsert).toHaveBeenCalledTimes(58);
        });
    });
});
