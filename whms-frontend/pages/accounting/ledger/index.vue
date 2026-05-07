<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Buku Besar & Trial Balance</h1>
        <p class="text-sm text-slate-500">Ringkasan saldo per akun untuk periode berjalan.</p>
      </div>
      <div class="flex gap-2 items-center">
        <UiDatePicker v-model="dateRange" :range="true" class="w-64" />
        <Button icon="pi pi-refresh" text rounded @click="fetchTrialBalance()" :loading="loading" />
      </div>
    </div>

    <!-- Trial Balance Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div class="bg-blue-50 p-5 rounded-xl border border-blue-200">
        <p class="text-xs font-semibold text-blue-600 uppercase">Total Debit</p>
        <p class="text-2xl font-black text-blue-800 mt-1">{{ formatIdr(summary.totalDebit) }}</p>
      </div>
      <div class="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
        <p class="text-xs font-semibold text-emerald-600 uppercase">Total Credit</p>
        <p class="text-2xl font-black text-emerald-800 mt-1">{{ formatIdr(summary.totalCredit) }}</p>
      </div>
      <div :class="['p-5 rounded-xl border', summary.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200']">
        <p :class="['text-xs font-semibold uppercase', summary.isBalanced ? 'text-emerald-600' : 'text-red-600']">Selisih (Variance)</p>
        <p :class="['text-2xl font-black mt-1', summary.isBalanced ? 'text-emerald-800' : 'text-red-800']">
          {{ formatIdr(Math.abs(summary.totalDebit - summary.totalCredit)) }}
          <span v-if="isBalanced" class="text-sm"> ✅</span>
          <span v-else class="text-sm"> ⚠️</span>
        </p>
      </div>
    </div>

    <!-- Ledger Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-28">Kode</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 min-w-[200px]">Nama Akun</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 w-24">Tipe</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-44">Saldo Awal</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-36">Mutasi Debit</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-36">Mutasi Credit</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-44">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-for="group in groupedAccounts" :key="group.type">
              <!-- Group Header -->
              <tr class="bg-slate-50/50">
                <td colspan="7" class="px-4 py-2">
                  <span :class="['text-xs font-bold uppercase tracking-wider', typeColor(group.type)]">{{ group.type }}</span>
                </td>
              </tr>
              <tr v-for="acc in group.accounts" :key="acc.id" class="hover:bg-slate-50/50 transition-colors cursor-pointer" @click="openLedger(acc)">
                <td class="px-4 py-2.5 font-mono text-xs text-slate-500">{{ acc.code }}</td>
                <td class="px-4 py-2.5 font-medium text-slate-800">{{ acc.name }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span :class="['text-[10px] font-bold px-1.5 py-0.5 rounded-full', typeBadge(acc.type)]">{{ acc.type }}</span>
                </td>
                <td class="px-4 py-2.5 text-right text-slate-600">{{ formatIdr(acc.openingBalance) }}</td>
                <td class="px-4 py-2.5 text-right text-blue-700 font-semibold">{{ formatIdr(acc.periodDebit) }}</td>
                <td class="px-4 py-2.5 text-right text-emerald-700 font-semibold">{{ formatIdr(acc.periodCredit) }}</td>
                <td class="px-4 py-2.5 text-right font-bold text-slate-900">{{ formatIdr(acc.closingBalance) }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot class="bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td colspan="4" class="px-4 py-3 text-right text-sm font-bold text-slate-700">TOTAL:</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-blue-800">{{ formatIdr(summary.totalDebit) }}</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-emerald-800">{{ formatIdr(summary.totalCredit) }}</td>
              <td class="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <UiModal v-model="showLedger" title="Ledger Detail" width="80vw" :loading="ledgerLoading">
      <div v-if="selectedAccount" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-xs text-slate-500">Akun</p>
            <p class="font-semibold">{{ selectedAccount.code }} — {{ selectedAccount.name }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Periode</p>
            <p class="font-semibold">{{ rangeLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Saldo Awal</p>
            <p class="font-semibold">{{ formatIdr(selectedAccount.openingBalance) }}</p>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Tanggal</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">No Jurnal</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[240px]">Deskripsi</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[180px]">Memo</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-32">Debit</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-32">Credit</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Saldo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="ledgerRows.length === 0 && !ledgerLoading">
                <td colspan="7" class="px-3 py-6 text-center text-slate-400">Tidak ada transaksi di periode ini.</td>
              </tr>
              <tr v-for="r in ledgerRows" :key="r.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2">{{ r.date }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ r.entryNumber }}</td>
                <td class="px-3 py-2">{{ r.description }}</td>
                <td class="px-3 py-2 text-slate-700">{{ r.memo || '-' }}</td>
                <td class="px-3 py-2 text-right text-blue-700 font-semibold">{{ formatIdr(r.debit) }}</td>
                <td class="px-3 py-2 text-right text-emerald-700 font-semibold">{{ formatIdr(r.credit) }}</td>
                <td class="px-3 py-2 text-right font-bold">{{ formatIdr(r.runningBalance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showLedger = false" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type TrialBalanceRow = {
  id: string
  code: string
  name: string
  type: AccountType
  openingBalance: number
  periodDebit: number
  periodCredit: number
  closingBalance: number
  isActive: boolean
}
type LedgerLine = {
  id: string
  debit: number
  credit: number
  memo?: string | null
  journalEntry: { id: string; entryNumber: string; date: string; description: string; referenceId?: string | null }
}

const loading = ref(false)
const ledgerLoading = ref(false)
const dateRange = ref<Date[] | undefined>(defaultMonthRange())
const summary = ref<{ totalDebit: number; totalCredit: number; isBalanced: boolean }>({ totalDebit: 0, totalCredit: 0, isBalanced: true })
const balances = ref<TrialBalanceRow[]>([])

const showLedger = ref(false)
const selectedAccount = ref<TrialBalanceRow | null>(null)
const ledgerLines = ref<LedgerLine[]>([])

function defaultMonthRange(): Date[] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [start, end]
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const rangeLabel = computed(() => {
  const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
  if (!start || !end) return '-'
  return `${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`
})

const isBalanced = computed(() => summary.value.isBalanced)

const groupedAccounts = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const acc of balances.value) {
    if (!groups[acc.type]) groups[acc.type] = []
    groups[acc.type].push(acc)
  }
  return Object.entries(groups).map(([type, accounts]) => ({ type, accounts }))
})

function typeColor(t: string) {
  const m: Record<string, string> = { ASSET: 'text-blue-600', LIABILITY: 'text-amber-600', EQUITY: 'text-violet-600', REVENUE: 'text-emerald-600', EXPENSE: 'text-red-600' }
  return m[t] || 'text-slate-600'
}
function typeBadge(t: string) {
  const m: Record<string, string> = { ASSET: 'text-blue-700 bg-blue-100', LIABILITY: 'text-amber-700 bg-amber-100', EQUITY: 'text-violet-700 bg-violet-100', REVENUE: 'text-emerald-700 bg-emerald-100', EXPENSE: 'text-red-700 bg-red-100' }
  return m[t] || ''
}
function formatIdr(v: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v) }

async function fetchTrialBalance() {
  const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
  if (!start || !end) return toast.error('Pilih range tanggal.')

  loading.value = true
  try {
    const res = await api<{ success: true; balances: TrialBalanceRow[]; summary: { totalDebit: number; totalCredit: number; isBalanced: boolean } }>('/api/journals/reports/trial-balance', {
      query: { startDate: start.toISOString(), endDate: end.toISOString() },
    })
    balances.value = (res as any).balances || []
    summary.value = (res as any).summary || { totalDebit: 0, totalCredit: 0, isBalanced: true }
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

const ledgerRows = computed(() => {
  const acc = selectedAccount.value
  if (!acc) return []

  const isNormalDebit = acc.type === 'ASSET' || acc.type === 'EXPENSE'
  let running = Number(acc.openingBalance || 0)

  return ledgerLines.value.map((l) => {
    const debit = Number(l.debit || 0)
    const credit = Number(l.credit || 0)
    const delta = isNormalDebit ? debit - credit : credit - debit
    running += delta
    return {
      id: l.id,
      date: formatDate(l.journalEntry.date),
      entryNumber: l.journalEntry.entryNumber,
      description: l.journalEntry.description,
      memo: l.memo,
      debit,
      credit,
      runningBalance: running,
    }
  })
})

async function openLedger(acc: TrialBalanceRow) {
  const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
  if (!start || !end) return toast.error('Pilih range tanggal.')

  selectedAccount.value = acc
  showLedger.value = true
  ledgerLoading.value = true
  ledgerLines.value = []
  try {
    const res = await api<{ success: true; lines: LedgerLine[] }>(`/api/journals/accounts/${acc.id}/ledger`, {
      query: { startDate: start.toISOString(), endDate: end.toISOString() },
    })
    ledgerLines.value = (res as any).lines || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    ledgerLoading.value = false
  }
}

let t: any = null
watch(dateRange, () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchTrialBalance(), 250)
})

onMounted(async () => {
  await fetchTrialBalance()
})
</script>
