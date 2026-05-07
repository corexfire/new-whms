/// <reference types="jest" />
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockPrisma } from './setup';
import { JournalService } from '../services/journal.service';

const journalService = new JournalService();

describe('JournalService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create journal entry with balanced lines', async () => {
            const mockEntry = {
                id: 'je-1',
                entryNumber: 'JE-202604-0001',
                description: 'Test Entry',
                status: 'DRAFT',
                date: new Date(),
                lines: [
                    { id: 'line-1', accountId: 'acc-1', debit: 1000, credit: 0 },
                    { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 1000 },
                ],
            };

            (mockPrisma.journalEntry.create as any).mockResolvedValue(mockEntry);

            const dto = {
                description: 'Test Entry',
                lines: [
                    { accountId: 'acc-1', debit: 1000, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 1000 },
                ],
            };

            const result = await journalService.create(dto);

            expect(result.description).toBe('Test Entry');
            expect(result.status).toBe('DRAFT');
            expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
        });
    });

    describe('post', () => {
        it('should post journal entry and update balances', async () => {
            const mockEntry = {
                id: 'je-1',
                status: 'DRAFT',
                lines: [
                    { accountId: 'acc-1', debit: 1000, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 1000 },
                ],
            };

            const postedEntry = { ...mockEntry, status: 'POSTED' };

            (mockPrisma.journalEntry.findUnique as any)
                .mockResolvedValueOnce(mockEntry)
                .mockResolvedValueOnce(postedEntry);

            (mockPrisma.chartOfAccount.update as any).mockResolvedValue({});
            (mockPrisma.journalEntry.update as any).mockResolvedValue(postedEntry);

            const result = await journalService.post('je-1');

            expect(result?.status).toBe('POSTED');
        });

        it('should throw error for unbalanced entry', async () => {
            const mockEntry = {
                id: 'je-1',
                status: 'DRAFT',
                lines: [
                    { accountId: 'acc-1', debit: 1000, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 500 },
                ],
            };

            (mockPrisma.journalEntry.findUnique as any).mockResolvedValue(mockEntry);

            await expect(journalService.post('je-1')).rejects.toThrow(/tidak seimbang/i);
        });

        it('should throw error for already posted entry', async () => {
            const mockEntry = {
                id: 'je-1',
                status: 'POSTED',
                lines: [],
            };

            (mockPrisma.journalEntry.findUnique as any).mockResolvedValue(mockEntry);

            await expect(journalService.post('je-1')).rejects.toThrow(
                'Entry already posted'
            );
        });

        it('should throw error for non-existent entry', async () => {
            (mockPrisma.journalEntry.findUnique as any).mockResolvedValue(null);

            await expect(journalService.post('je-999')).rejects.toThrow(
                'Journal entry not found'
            );
        });
    });

    describe('void', () => {
        it('should void draft entry without balance adjustment', async () => {
            const mockEntry = {
                id: 'je-1',
                status: 'DRAFT',
                description: 'Original',
                lines: [],
            };

            (mockPrisma.journalEntry.findUnique as any).mockResolvedValue(mockEntry);
            (mockPrisma.journalEntry.update as any).mockResolvedValue({
                ...mockEntry,
                status: 'VOID',
            });

            await journalService.void('je-1', 'Test void');
            expect(mockPrisma.journalEntry.update).toHaveBeenCalled();
            expect(mockPrisma.chartOfAccount.update).not.toHaveBeenCalled();
        });

        it('should void posted entry and reverse balances', async () => {
            const mockEntry = {
                id: 'je-1',
                status: 'POSTED',
                description: 'Original',
                lines: [
                    { accountId: 'acc-1', debit: 1000, credit: 0 },
                ],
            };

            (mockPrisma.journalEntry.findUnique as any).mockResolvedValue(mockEntry);
            (mockPrisma.chartOfAccount.update as any).mockResolvedValue({});
            (mockPrisma.journalEntry.update as any).mockResolvedValue({
                ...mockEntry,
                status: 'VOID',
            });

            await journalService.void('je-1', 'Test void');
            expect(mockPrisma.journalEntry.update).toHaveBeenCalled();
            expect(mockPrisma.chartOfAccount.update).toHaveBeenCalled();
        });
    });
});
