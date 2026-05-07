/**
 * useJournalValidation
 * 
 * Composable to validate journal entries for double-entry bookkeeping.
 * Ensures debit total equals credit total with a tolerance of 0.01.
 * 
 * Usage in accounting forms:
 *   const { validateBalance, isBalanced, debitTotal, creditTotal, difference } = useJournalValidation()
 *   validateBalance(entries)
 */

import { ref, computed } from 'vue'

export interface JournalEntry {
  account_code: string
  account_name?: string
  description?: string
  debit: number
  credit: number
}

export interface JournalValidationResult {
  isBalanced: boolean
  debitTotal: number
  creditTotal: number
  difference: number
  errors: string[]
}

const BALANCE_TOLERANCE = 0.01

export function useJournalValidation() {
  const entries = ref<JournalEntry[]>([])

  const debitTotal = computed(() =>
    entries.value.reduce((sum, e) => sum + (Number(e.debit) || 0), 0)
  )

  const creditTotal = computed(() =>
    entries.value.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)
  )

  const difference = computed(() =>
    Math.abs(debitTotal.value - creditTotal.value)
  )

  const isBalanced = computed(() =>
    difference.value <= BALANCE_TOLERANCE
  )

  /**
   * Validate a set of journal entries
   */
  function validateBalance(journalEntries: JournalEntry[]): JournalValidationResult {
    entries.value = journalEntries

    const errors: string[] = []

    // Check minimum entries
    if (journalEntries.length < 2) {
      errors.push('Minimal harus ada 2 baris jurnal (debit & kredit)')
    }

    // Check no empty rows
    const emptyRows = journalEntries.filter(e => e.debit === 0 && e.credit === 0)
    if (emptyRows.length > 0) {
      errors.push(`Ada ${emptyRows.length} baris tanpa nilai debit/kredit`)
    }

    // Check no row has both debit and credit
    const dualRows = journalEntries.filter(e => e.debit > 0 && e.credit > 0)
    if (dualRows.length > 0) {
      errors.push(`Ada ${dualRows.length} baris yang memiliki debit DAN kredit sekaligus`)
    }

    // Check at least one debit and one credit
    const hasDebit = journalEntries.some(e => e.debit > 0)
    const hasCredit = journalEntries.some(e => e.credit > 0)
    if (!hasDebit) errors.push('Tidak ada baris debit')
    if (!hasCredit) errors.push('Tidak ada baris kredit')

    // Check balance
    if (!isBalanced.value) {
      errors.push(
        `Jurnal tidak seimbang: Debit ${formatCurrency(debitTotal.value)} ≠ Kredit ${formatCurrency(creditTotal.value)} (selisih ${formatCurrency(difference.value)})`
      )
    }

    // Check account codes
    const missingCodes = journalEntries.filter(e => !e.account_code)
    if (missingCodes.length > 0) {
      errors.push(`Ada ${missingCodes.length} baris tanpa kode akun`)
    }

    return {
      isBalanced: isBalanced.value,
      debitTotal: debitTotal.value,
      creditTotal: creditTotal.value,
      difference: difference.value,
      errors
    }
  }

  /**
   * Quick check if entries are balanced (without full validation)
   */
  function quickCheck(journalEntries: JournalEntry[]): boolean {
    const dTotal = journalEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0)
    const cTotal = journalEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0)
    return Math.abs(dTotal - cTotal) <= BALANCE_TOLERANCE
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })
  }

  /**
   * Create a balanced set of auto-generated journal entries
   * Used by GRN, SO, POS, etc.
   */
  function createAutoJournal(
    type: string,
    debitAccount: { code: string; name: string },
    creditAccount: { code: string; name: string },
    amount: number,
    description?: string
  ): JournalEntry[] {
    return [
      {
        account_code: debitAccount.code,
        account_name: debitAccount.name,
        description: description || `Auto journal: ${type}`,
        debit: amount,
        credit: 0
      },
      {
        account_code: creditAccount.code,
        account_name: creditAccount.name,
        description: description || `Auto journal: ${type}`,
        debit: 0,
        credit: amount
      }
    ]
  }

  return {
    entries,
    debitTotal,
    creditTotal,
    difference,
    isBalanced,
    validateBalance,
    quickCheck,
    formatCurrency,
    createAutoJournal,
    BALANCE_TOLERANCE
  }
}
