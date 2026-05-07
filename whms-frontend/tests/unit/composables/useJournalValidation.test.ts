import { describe, it, expect } from 'vitest'
import { useJournalValidation, type JournalEntry } from '~/composables/useJournalValidation'

describe('useJournalValidation', () => {
  describe('validateBalance()', () => {
    it('should return balanced for equal debit and credit', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 100000, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 100000 },
      ]

      const result = validateBalance(entries)
      expect(result.isBalanced).toBe(true)
      expect(result.debitTotal).toBe(100000)
      expect(result.creditTotal).toBe(100000)
      expect(result.difference).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should return unbalanced for different totals', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 100000, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 50000 },
      ]

      const result = validateBalance(entries)
      expect(result.isBalanced).toBe(false)
      expect(result.difference).toBe(50000)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should tolerate difference <= 0.01', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 100000.005, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 100000 },
      ]

      const result = validateBalance(entries)
      expect(result.isBalanced).toBe(true)
    })

    it('should error on fewer than 2 entries', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 100000, credit: 0 },
      ]

      const result = validateBalance(entries)
      expect(result.errors).toContain('Minimal harus ada 2 baris jurnal (debit & kredit)')
    })

    it('should error on rows with both debit and credit', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 100000, credit: 50000 },
        { account_code: '2-10001', debit: 0, credit: 50000 },
      ]

      const result = validateBalance(entries)
      expect(result.errors.some(e => e.includes('debit DAN kredit sekaligus'))).toBe(true)
    })

    it('should error on missing account codes', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '', debit: 100000, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 100000 },
      ]

      const result = validateBalance(entries)
      expect(result.errors.some(e => e.includes('tanpa kode akun'))).toBe(true)
    })

    it('should error on zero entries (both debit and credit = 0)', () => {
      const { validateBalance } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 0, credit: 0 },
        { account_code: '2-10001', debit: 100000, credit: 0 },
        { account_code: '3-10001', debit: 0, credit: 100000 },
      ]

      const result = validateBalance(entries)
      expect(result.errors.some(e => e.includes('tanpa nilai debit/kredit'))).toBe(true)
    })
  })

  describe('quickCheck()', () => {
    it('should return true for balanced entries', () => {
      const { quickCheck } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 500000, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 500000 },
      ]
      expect(quickCheck(entries)).toBe(true)
    })

    it('should return false for unbalanced entries', () => {
      const { quickCheck } = useJournalValidation()
      
      const entries: JournalEntry[] = [
        { account_code: '1-10001', debit: 500000, credit: 0 },
        { account_code: '2-10001', debit: 0, credit: 300000 },
      ]
      expect(quickCheck(entries)).toBe(false)
    })
  })

  describe('createAutoJournal()', () => {
    it('should create balanced auto journal entries', () => {
      const { createAutoJournal, quickCheck } = useJournalValidation()
      
      const entries = createAutoJournal(
        'GRN_COMPLETE',
        { code: '1-30001', name: 'Persediaan' },
        { code: '2-10001', name: 'Hutang Supplier' },
        5000000,
        'GRN-2025-001 received'
      )

      expect(entries).toHaveLength(2)
      expect(entries[0].debit).toBe(5000000)
      expect(entries[0].credit).toBe(0)
      expect(entries[1].debit).toBe(0)
      expect(entries[1].credit).toBe(5000000)
      expect(quickCheck(entries)).toBe(true)
    })
  })
})
