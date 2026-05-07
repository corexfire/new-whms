<template>
  <div class="p-6">
    <!-- AP Summary -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <p class="text-xs text-slate-500 font-medium">Total Hutang</p>
        <p class="text-xl font-bold text-slate-900 mt-1">{{ formatIdr(summary.total) }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <p class="text-xs text-slate-500 font-medium">Belum Jatuh Tempo</p>
        <p class="text-xl font-bold text-emerald-700 mt-1">{{ formatIdr(summary.current) }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <p class="text-xs text-slate-500 font-medium">Jatuh Tempo (1-30d)</p>
        <p class="text-xl font-bold text-amber-600 mt-1">{{ formatIdr(summary.due_1_30) }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <p class="text-xs text-slate-500 font-medium">Overdue (>30d)</p>
        <p class="text-xl font-bold text-red-600 mt-1">{{ formatIdr(summary.over_30) }}</p>
      </div>
    </div>

    <UiDataTable
      title="Accounts Payable (Hutang Supplier)"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterSupplierId"
            :options="supplierOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Supplier"
            class="w-72"
            :loading="loadingMasters"
          />
          <UiSelect
            v-model="filterStatus"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Status"
            class="w-36"
          />
          <UiSelect
            v-model="filterOverdue"
            :options="overdueOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Overdue"
            class="w-36"
          />
          <UiDatePicker v-model="dueRange" :range="true" class="w-56" />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari no / deskripsi / ref..." size="small" />
          </IconField>
          <Button icon="pi pi-plus" label="Buat Hutang" size="small" @click="openCreate()" />
          <Button icon="pi pi-money-bill" label="Catat Pembayaran" size="small" severity="success" @click="openPayment()" />
          <Button icon="pi pi-refresh" text rounded @click="refreshAll()" :loading="loading" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
          <Button v-if="data.status !== 'PAID' && data.status !== 'CANCELLED'" text rounded size="small" icon="pi pi-pencil" @click="openEdit(data.id)" />
          <Button v-if="data.status !== 'PAID' && data.status !== 'CANCELLED'" text rounded size="small" severity="success" icon="pi pi-money-bill" @click="openPayment(data.id)" />
          <Button v-if="data.status !== 'CANCELLED'" text rounded size="small" severity="warning" icon="pi pi-ban" @click="voidAp(data.id)" />
          <Button v-if="data.status !== 'PAID' && data.status !== 'CANCELLED'" text rounded size="small" severity="danger" icon="pi pi-trash" @click="deleteAp(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showCreate" :title="editId ? 'Edit Hutang Supplier' : 'Buat Hutang Supplier'" width="55vw" :loading="saving">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiSelect
            label="Supplier"
            v-model="apForm.supplierId"
            :options="supplierOptionsNoAll"
            optionLabel="label"
            optionValue="value"
            required
            :disabled="Boolean(editId)"
            :loading="loadingMasters"
          />
          <UiDatePicker label="Jatuh Tempo" v-model="apForm.dueDate" required />
          <UiCurrencyInput label="Total Hutang" v-model="apForm.amount" required :disabled="Boolean(editId)" />
          <UiInput label="Ref (optional)" v-model="apForm.referenceId" placeholder="Misal: PO-xxx / GRN-xxx" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Deskripsi</label>
          <Textarea v-model="apForm.description" rows="2" class="w-full bg-slate-50" placeholder="Deskripsi hutang..." />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showCreate = false" />
        <Button label="Simpan" icon="pi pi-save" :loading="saving" @click="saveAp()" />
      </template>
    </UiModal>

    <UiModal v-model="showPayment" title="Catat Pembayaran ke Supplier" width="45vw" :loading="saving">
      <div class="space-y-4">
        <UiSelect
          label="Hutang / Bill"
          v-model="payForm.apId"
          :options="openApOptions"
          optionLabel="label"
          optionValue="value"
          required
        />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiCurrencyInput label="Jumlah Bayar" v-model="payForm.amount" required />
          <UiDatePicker label="Tanggal Bayar" v-model="payForm.paymentDate" required />
          <UiSelect
            label="Metode"
            v-model="payForm.paymentMethod"
            :options="paymentMethods"
            optionLabel="label"
            optionValue="value"
            required
          />
          <UiSelect
            label="Akun Pembayaran"
            v-model="payForm.paymentAccountId"
            :options="paymentAccountOptions"
            optionLabel="label"
            optionValue="value"
            required
            :loading="loadingMasters"
          />
        </div>
        <UiInput label="No. Referensi Transfer" v-model="payForm.reference" placeholder="Bukti transfer..." />
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Notes</label>
          <Textarea v-model="payForm.notes" rows="2" class="w-full bg-slate-50" placeholder="Optional..." />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showPayment = false" />
        <Button label="Simpan Pembayaran" icon="pi pi-save" severity="success" :loading="saving" @click="recordPayment()" />
      </template>
    </UiModal>

    <UiModal v-model="showDetail" title="Detail Hutang" width="70vw">
      <div v-if="selected" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p class="text-xs text-slate-500">No</p><p class="font-semibold font-mono">{{ selected.payableNumber }}</p></div>
          <div><p class="text-xs text-slate-500">Status</p><p class="font-semibold">{{ selected.status }}</p></div>
          <div><p class="text-xs text-slate-500">Supplier</p><p class="font-semibold">{{ selected.supplier?.code }} — {{ selected.supplier?.name }}</p></div>
          <div><p class="text-xs text-slate-500">Jatuh Tempo</p><p class="font-semibold">{{ formatDate(selected.dueDate) }}</p></div>
          <div><p class="text-xs text-slate-500">Total</p><p class="font-semibold">{{ formatIdr(selected.totalAmount) }}</p></div>
          <div><p class="text-xs text-slate-500">Sisa</p><p class="font-semibold">{{ formatIdr(selected.openAmount) }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Reference</p><p class="font-semibold">{{ selected.referenceId || '-' }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Description</p><p class="font-semibold">{{ selected.description }}</p></div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Tanggal</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[180px]">Metode</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[240px]">Akun</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-36">Amount</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[180px]">Reference</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="(selected.payments || []).length === 0">
                <td colspan="6" class="px-3 py-6 text-center text-slate-400">Belum ada pembayaran.</td>
              </tr>
              <tr v-for="(p, idx) in selected.payments" :key="p.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2">{{ formatDate(p.paymentDate) }}</td>
                <td class="px-3 py-2">{{ p.paymentMethod }}</td>
                <td class="px-3 py-2">{{ p.paymentAccount?.code }} — {{ p.paymentAccount?.name }}</td>
                <td class="px-3 py-2 text-right font-semibold">{{ formatIdr(p.amount) }}</td>
                <td class="px-3 py-2">{{ p.reference || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showDetail = false" />
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

type APStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'GIRO' | 'CHEQUE'
type ApiSupplier = { id: string; code: string; name: string }
type ApiCoa = { id: string; code: string; name: string; type: string; isActive: boolean }
type ApiAPPayment = {
  id: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  paymentAccount?: { id: string; code: string; name: string } | null
  reference?: string | null
  notes?: string | null
}
type ApiAP = {
  id: string
  payableNumber: string
  supplierId: string
  supplier: ApiSupplier
  referenceId?: string | null
  referenceType?: string | null
  description: string
  totalAmount: number
  openAmount: number
  dueDate: string
  status: APStatus
  payments?: ApiAPPayment[]
}

type Option = { value: string | null; label: string }

const loading = ref(false)
const saving = ref(false)
const loadingMasters = ref(false)

const suppliers = ref<ApiSupplier[]>([])
const paymentAccounts = ref<ApiCoa[]>([])

const payables = ref<ApiAP[]>([])
const selected = ref<ApiAP | null>(null)

const showCreate = ref(false)
const showPayment = ref(false)
const showDetail = ref(false)
const editId = ref<string | null>(null)

const searchQuery = ref('')
const filterSupplierId = ref<string | null>(null)
const filterStatus = ref<APStatus | 'ALL'>('ALL')
const filterOverdue = ref<boolean | null>(null)
const dueRange = ref<Date[] | undefined>(undefined)

const statusOptions = ref<Array<{ label: string; value: APStatus | 'ALL' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'OPEN', value: 'OPEN' },
  { label: 'PARTIAL', value: 'PARTIAL' },
  { label: 'PAID', value: 'PAID' },
  { label: 'OVERDUE', value: 'OVERDUE' },
  { label: 'CANCELLED', value: 'CANCELLED' },
])

const overdueOptions = ref<Array<{ label: string; value: boolean | null }>>([
  { label: 'All', value: null },
  { label: 'Overdue Only', value: true },
  { label: 'Not Overdue', value: false },
])

const supplierOptions = computed<Option[]>(() => [
  { value: null, label: 'All Suppliers' },
  ...suppliers.value.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
])

const supplierOptionsNoAll = computed<Option[]>(() => suppliers.value.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })))

const paymentAccountOptions = computed<Option[]>(() =>
  paymentAccounts.value
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))
)

const openApOptions = computed<Option[]>(() =>
  payables.value
    .filter((p) => p.status === 'OPEN' || p.status === 'PARTIAL' || p.status === 'OVERDUE')
    .map((p) => ({ value: p.id, label: `${p.payableNumber} — ${p.supplier?.name} (Sisa: ${formatIdr(p.openAmount)})` }))
)

const paymentMethods = ref<Array<{ label: string; value: PaymentMethod }>>([
  { label: 'CASH', value: 'CASH' },
  { label: 'BANK_TRANSFER', value: 'BANK_TRANSFER' },
  { label: 'GIRO', value: 'GIRO' },
  { label: 'CHEQUE', value: 'CHEQUE' },
])

const apForm = ref<{ supplierId: string; dueDate: Date; amount: number; referenceId: string; description: string }>({
  supplierId: '',
  dueDate: new Date(),
  amount: 0,
  referenceId: '',
  description: '',
})

const payForm = ref<{ apId: string; amount: number; paymentDate: Date; paymentMethod: PaymentMethod; paymentAccountId: string; reference: string; notes: string }>({
  apId: '',
  amount: 0,
  paymentDate: new Date(),
  paymentMethod: 'BANK_TRANSFER',
  paymentAccountId: '',
  reference: '',
  notes: '',
})

const summary = ref<{ total: number; current: number; due_1_30: number; over_30: number }>({ total: 0, current: 0, due_1_30: 0, over_30: 0 })

const columns = ref([
  { field: 'payableNumber', headerName: 'No. AP', width: 150, pinned: 'left' },
  { field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 220 },
  { field: 'referenceId', headerName: 'Ref', width: 140 },
  { field: 'createdAt', headerName: 'Created', width: 120 },
  { field: 'dueDate', headerName: 'Jatuh Tempo', width: 120 },
  { field: 'totalAmount', headerName: 'Total', width: 140, type: 'numericColumn', valueFormatter: (p: any) => formatNumber(p.value) },
  { field: 'paidAmount', headerName: 'Dibayar', width: 140, type: 'numericColumn', valueFormatter: (p: any) => formatNumber(p.value) },
  {
    field: 'openAmount',
    headerName: 'Sisa Hutang',
    width: 150,
    type: 'numericColumn',
    valueFormatter: (p: any) => formatNumber(p.value),
  },
  { field: 'status', headerName: 'Status', width: 120, slotName: 'status' },
  { field: 'actions', headerName: '', width: 220, pinned: 'right', slotName: 'actions' },
])

const rows = computed(() =>
  payables.value.map((p) => ({
    id: p.id,
    payableNumber: p.payableNumber,
    supplier: p.supplier ? `${p.supplier.code} — ${p.supplier.name}` : '-',
    referenceId: p.referenceId || '-',
    createdAt: formatDate((p as any).createdAt || p.dueDate),
    dueDate: formatDate(p.dueDate),
    totalAmount: p.totalAmount,
    paidAmount: Math.max(0, Number(p.totalAmount || 0) - Number(p.openAmount || 0)),
    openAmount: p.openAmount,
    status: p.status,
  }))
)

function formatNumber(v: any) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(v || 0))
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(s: APStatus) {
  if (s === 'PAID') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (s === 'PARTIAL') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (s === 'OVERDUE') return 'bg-red-50 text-red-700 border-red-200'
  if (s === 'CANCELLED') return 'bg-slate-50 text-slate-700 border-slate-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const [supRes, coaRes] = await Promise.all([
      api<{ success: true; suppliers: ApiSupplier[] }>('/api/partners/suppliers', { query: { page: 1, limit: 300 } }),
      api<{ success: true; accounts: ApiCoa[] }>('/api/coa', { query: { type: 'ASSET', isActive: 'true' } }),
    ])
    suppliers.value = (supRes as any).suppliers || []
    paymentAccounts.value = (coaRes as any).accounts || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingMasters.value = false
  }
}

async function fetchPayables() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(dueRange.value) ? dueRange.value : []
    const res = await api<{ success: true; records: ApiAP[] }>('/api/accounting/ap', {
      query: {
        supplierId: filterSupplierId.value || undefined,
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        overdue: filterOverdue.value === null ? undefined : String(filterOverdue.value),
        search: searchQuery.value || undefined,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
        page: 1,
        limit: 200,
      },
    })
    payables.value = (res as any).records || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function fetchAging() {
  try {
    const res = await api<{ success: true; aging: Array<{ range: string; total: number; count: number }> }>('/api/accounting/ap/reports/aging')
    const aging = (res as any).aging || []
    const byRange = new Map<string, number>(aging.map((a: any) => [a.range, Number(a.total || 0)]))
    const current = byRange.get('current') || 0
    const due_1_30 = byRange.get('1-30') || 0
    const over_30 = (byRange.get('31-60') || 0) + (byRange.get('61-90') || 0) + (byRange.get('over_90') || 0)
    summary.value = { total: current + due_1_30 + over_30, current, due_1_30, over_30 }
  } catch {
  }
}

async function refreshAll() {
  await Promise.all([fetchPayables(), fetchAging()])
}

function openCreate() {
  editId.value = null
  showCreate.value = true
  apForm.value = {
    supplierId: suppliers.value[0]?.id || '',
    dueDate: new Date(),
    amount: 0,
    referenceId: '',
    description: '',
  }
}

async function openEdit(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; ap: ApiAP }>(`/api/accounting/ap/${id}`)
    const ap = (res as any).ap as ApiAP
    editId.value = ap.id
    apForm.value = {
      supplierId: ap.supplierId,
      dueDate: new Date(ap.dueDate),
      amount: ap.totalAmount,
      referenceId: ap.referenceId || '',
      description: ap.description || '',
    }
    showCreate.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function saveAp() {
  if (!apForm.value.supplierId) return toast.error('Supplier wajib dipilih.')
  if (!apForm.value.description) return toast.error('Deskripsi wajib diisi.')
  if (!Number.isFinite(Number(apForm.value.amount)) || Number(apForm.value.amount) <= 0) return toast.error('Total hutang tidak valid.')

  saving.value = true
  try {
    if (editId.value) {
      await api(`/api/accounting/ap/${editId.value}`, {
        method: 'PUT',
        body: {
          description: apForm.value.description,
          dueDate: apForm.value.dueDate,
          referenceId: apForm.value.referenceId || undefined,
        },
      })
      toast.success('AP berhasil diupdate.')
    } else {
      await api('/api/accounting/ap', {
        method: 'POST',
        body: {
          supplierId: apForm.value.supplierId,
          description: apForm.value.description,
          amount: Number(apForm.value.amount),
          dueDate: apForm.value.dueDate,
          referenceId: apForm.value.referenceId || undefined,
          referenceType: apForm.value.referenceId ? 'MANUAL' : undefined,
        },
      })
      toast.success('AP berhasil dibuat.')
    }
    showCreate.value = false
    editId.value = null
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

function openPayment(apId?: string) {
  showPayment.value = true
  payForm.value = {
    apId: apId || openApOptions.value[0]?.value || '',
    amount: 0,
    paymentDate: new Date(),
    paymentMethod: 'BANK_TRANSFER',
    paymentAccountId: paymentAccountOptions.value[0]?.value || '',
    reference: '',
    notes: '',
  }
}

async function recordPayment() {
  if (!payForm.value.apId) return toast.error('Pilih hutang.')
  if (!Number.isFinite(Number(payForm.value.amount)) || Number(payForm.value.amount) <= 0) return toast.error('Jumlah bayar tidak valid.')
  if (!payForm.value.paymentAccountId) return toast.error('Akun pembayaran wajib dipilih.')

  saving.value = true
  try {
    await api(`/api/accounting/ap/${payForm.value.apId}/payment`, {
      method: 'POST',
      body: {
        amount: Number(payForm.value.amount),
        paymentDate: payForm.value.paymentDate,
        paymentMethod: payForm.value.paymentMethod,
        paymentAccountId: payForm.value.paymentAccountId,
        reference: payForm.value.reference || undefined,
        notes: payForm.value.notes || undefined,
      },
    })
    toast.success('Pembayaran ke supplier berhasil dicatat.')
    showPayment.value = false
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function openDetail(id: string) {
  try {
    const res = await api<{ success: true; ap: ApiAP }>(`/api/accounting/ap/${id}`)
    selected.value = (res as any).ap
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function voidAp(id: string) {
  const reason = window.prompt('Alasan void/cancel?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/accounting/ap/${id}/void`, { method: 'POST', body: { reason } })
    toast.success('AP berhasil di-cancel.')
    if (selected.value?.id === id) await openDetail(id)
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteAp(id: string) {
  if (!window.confirm('Hapus AP ini? (hanya bisa jika belum ada pembayaran)')) return
  saving.value = true
  try {
    await api(`/api/accounting/ap/${id}`, { method: 'DELETE' })
    toast.success('AP berhasil dihapus.')
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

function formatIdr(v: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v) }

let t: any = null
watch([filterSupplierId, filterStatus, filterOverdue, dueRange, searchQuery], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchPayables(), 250)
})

onMounted(async () => {
  await fetchMasters()
  await refreshAll()
})
</script>
