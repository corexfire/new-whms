<template>
  <div class="p-6">
    <UiDataTable
      title="Jurnal Transaksi"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect v-model="filterSource" :options="sourceOptions" optionLabel="label" optionValue="value" placeholder="Tipe" class="w-32" />
          <UiSelect v-model="filterStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Status" class="w-36" />
          <UiDatePicker v-model="dateRange" :range="true" class="w-56" />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari no / deskripsi / ref..." size="small" />
          </IconField>
          <Button icon="pi pi-plus" label="Jurnal Manual" size="small" @click="openCreate()" />
          <Button icon="pi pi-refresh" text rounded @click="fetchJournals()" :loading="loading" />
        </div>
      </template>

      <template #source="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="data.source === 'AUTO' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'">
          {{ data.source }}
        </span>
      </template>

      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
          <Button v-if="data.status === 'DRAFT'" text rounded size="small" icon="pi pi-pencil" @click="openEdit(data.id)" />
          <Button v-if="data.status === 'DRAFT'" text rounded size="small" severity="success" icon="pi pi-check" @click="postJournal(data.id)" />
          <Button v-if="data.status !== 'VOID'" text rounded size="small" severity="warning" icon="pi pi-ban" @click="voidJournal(data.id)" />
          <Button v-if="data.status === 'DRAFT'" text rounded size="small" severity="danger" icon="pi pi-trash" @click="deleteJournal(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="editId ? 'Edit Jurnal Manual' : 'Buat Jurnal Manual'" width="70vw" :loading="saving">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiInput label="No. Jurnal" v-model="form.entryNumber" :disabled="true" />
          <UiDatePicker label="Tanggal" v-model="form.date" required />
          <UiInput label="Ref (optional)" v-model="form.referenceId" placeholder="Misal: SO-xxx / GRN-xxx" />
          <div class="md:col-span-2 flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-700">Keterangan</label>
            <Textarea v-model="form.description" rows="2" class="w-full bg-slate-50" placeholder="Deskripsi jurnal..." />
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 w-8">#</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 min-w-[240px]">Akun</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 min-w-[220px]">Keterangan Baris</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-40">Debit</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-40">Credit</th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(line, idx) in form.lines" :key="line._key">
                <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2">
                  <UiSelect v-model="line.accountId" :options="accountOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Pilih akun" />
                </td>
                <td class="px-3 py-2"><InputText v-model="line.memo" size="small" class="w-full" /></td>
                <td class="px-3 py-2"><InputNumber v-model="line.debit" :min="0" size="small" class="w-full" @focus="line.credit = 0" /></td>
                <td class="px-3 py-2"><InputNumber v-model="line.credit" :min="0" size="small" class="w-full" @focus="line.debit = 0" /></td>
                <td class="px-3 py-2"><Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="form.lines.splice(idx, 1)" :disabled="form.lines.length <= 2" /></td>
              </tr>
            </tbody>
            <tfoot class="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colspan="3" class="px-3 py-2">
                  <Button icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine" />
                </td>
                <td class="px-3 py-2 text-right font-bold" :class="validationResult.isBalanced ? 'text-emerald-700' : 'text-red-600'">{{ formatIdr(validationResult.debitTotal) }}</td>
                <td class="px-3 py-2 text-right font-bold" :class="validationResult.isBalanced ? 'text-emerald-700' : 'text-red-600'">{{ formatIdr(validationResult.creditTotal) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div v-if="validationResult.isBalanced && validationResult.debitTotal > 0" class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
          <i class="pi pi-check-circle text-emerald-500"></i>
          <p class="text-xs text-emerald-700 font-medium">Jurnal seimbang ✓ Selisih: {{ formatIdr(validationResult.difference) }}</p>
        </div>

        <div v-if="validationResult.errors.length > 0" class="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
          <div class="flex items-center gap-2 mb-1">
            <i class="pi pi-exclamation-triangle text-red-500"></i>
            <p class="text-xs text-red-700 font-bold">Validasi gagal:</p>
          </div>
          <ul class="list-disc list-inside space-y-0.5">
            <li v-for="(err, i) in validationResult.errors" :key="i" class="text-xs text-red-600">{{ err }}</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showDialog = false" />
        <Button label="Simpan Draft" icon="pi pi-save" severity="secondary" outlined :loading="saving" @click="saveDraft()" />
        <Button label="Post Jurnal" icon="pi pi-check" severity="success" :loading="saving" @click="saveAndPost()" />
      </template>
    </UiModal>

    <UiModal v-model="showDetail" title="Journal Detail" width="70vw">
      <div v-if="selected" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p class="text-xs text-slate-500">No</p><p class="font-semibold font-mono">{{ selected.entryNumber }}</p></div>
          <div><p class="text-xs text-slate-500">Status</p><p class="font-semibold">{{ selected.status }}</p></div>
          <div><p class="text-xs text-slate-500">Tanggal</p><p class="font-semibold">{{ formatDate(selected.date) }}</p></div>
          <div><p class="text-xs text-slate-500">Source</p><p class="font-semibold">{{ selected.source }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Reference</p><p class="font-semibold">{{ selected.referenceId || '-' }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Description</p><p class="font-semibold">{{ selected.description }}</p></div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[260px]">Account</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">Memo</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Debit</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Credit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(l, idx) in selected.lines" :key="l.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-medium">{{ l.account?.code }} — {{ l.account?.name }}</td>
                <td class="px-3 py-2 text-slate-700">{{ l.memo || '-' }}</td>
                <td class="px-3 py-2 text-right">{{ formatIdr(l.debit) }}</td>
                <td class="px-3 py-2 text-right">{{ formatIdr(l.credit) }}</td>
              </tr>
            </tbody>
            <tfoot class="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colspan="3" class="px-3 py-2 text-right font-semibold text-slate-700">Total</td>
                <td class="px-3 py-2 text-right font-bold">{{ formatIdr(detailTotals.debit) }}</td>
                <td class="px-3 py-2 text-right font-bold">{{ formatIdr(detailTotals.credit) }}</td>
              </tr>
            </tfoot>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useJournalValidation, type JournalEntry, type JournalValidationResult } from '~/composables/useJournalValidation'
import { useApi } from '~/composables/useApi'

definePageMeta({
  middleware: ['rbac'],
  roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
  layout: 'default'
})

useHead({ title: 'Jurnal Transaksi — WHMS' })

const toast = useToast()
const { api } = useApi()
const showDialog = ref(false)
const showDetail = ref(false)
const loading = ref(false)
const saving = ref(false)

const searchQuery = ref('')
const filterSource = ref<'ALL' | 'AUTO' | 'MANUAL'>('ALL')
const filterStatus = ref<'ALL' | 'DRAFT' | 'POSTED' | 'VOID'>('ALL')
const dateRange = ref<Date[] | undefined>(undefined)

const selected = ref<ApiJournalEntry | null>(null)
const editId = ref<string | null>(null)

const { validateBalance, formatCurrency: formatIdr } = useJournalValidation()

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type ApiCoa = { id: string; code: string; name: string; type: AccountType; isActive: boolean; parentId?: string | null }
type ApiJournalLine = { id: string; accountId: string; memo?: string | null; debit: number; credit: number; account: { id: string; code: string; name: string; type: AccountType } }
type ApiJournalEntry = { id: string; entryNumber: string; date: string; description: string; referenceId?: string | null; source: 'AUTO' | 'MANUAL'; status: 'DRAFT' | 'POSTED' | 'VOID'; lines: ApiJournalLine[] }

type Option = { value: string; label: string }
type FormLine = { _key: string; accountId: string; memo: string; debit: number; credit: number }
type FormState = { entryNumber: string; date: Date; description: string; referenceId: string; lines: FormLine[] }

const sourceOptions = ref<Array<{ label: string; value: 'ALL' | 'AUTO' | 'MANUAL' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'AUTO', value: 'AUTO' },
  { label: 'MANUAL', value: 'MANUAL' },
])

const statusOptions = ref<Array<{ label: string; value: 'ALL' | 'DRAFT' | 'POSTED' | 'VOID' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'POSTED', value: 'POSTED' },
  { label: 'VOID', value: 'VOID' },
])

const coa = ref<ApiCoa[]>([])
const accountOptions = computed<Option[]>(() =>
  coa.value
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))
)

const form = ref<FormState>({
  entryNumber: '(auto)',
  date: new Date(),
  description: '',
  referenceId: '',
  lines: [
    { _key: String(crypto.randomUUID()), accountId: '', memo: '', debit: 0, credit: 0 },
    { _key: String(crypto.randomUUID()), accountId: '', memo: '', debit: 0, credit: 0 },
  ]
})

const validationResult = computed<JournalValidationResult>(() => {
  const entries: JournalEntry[] = form.value.lines.map(l => ({
    account_code: l.accountId || '',
    description: l.memo,
    debit: l.debit || 0,
    credit: l.credit || 0
  }))
  return validateBalance(entries)
})

const journals = ref<ApiJournalEntry[]>([])

const rows = computed(() =>
  journals.value.map((j) => {
    const debitTotal = (j.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0)
    const creditTotal = (j.lines || []).reduce((s, l) => s + Number(l.credit || 0), 0)
    return {
      id: j.id,
      entryNumber: j.entryNumber,
      date: formatDate(j.date),
      description: j.description,
      source: j.source,
      referenceId: j.referenceId || '-',
      debitTotal,
      creditTotal,
      status: j.status,
    }
  })
)

const detailTotals = computed(() => {
  const lines = selected.value?.lines || []
  return {
    debit: lines.reduce((s, l) => s + Number(l.debit || 0), 0),
    credit: lines.reduce((s, l) => s + Number(l.credit || 0), 0),
  }
})

const columns = ref([
  { field: 'entryNumber', headerName: 'No. Jurnal', width: 170, pinned: 'left' },
  { field: 'date', headerName: 'Tanggal', width: 130 },
  { field: 'description', headerName: 'Keterangan', flex: 1, minWidth: 260 },
  { field: 'source', headerName: 'Tipe', width: 110, slotName: 'source' },
  { field: 'referenceId', headerName: 'Ref', width: 160 },
  { field: 'debitTotal', headerName: 'Debit', width: 150, type: 'numericColumn', valueFormatter: (p: any) => formatIdr(Number(p.value || 0)) },
  { field: 'creditTotal', headerName: 'Credit', width: 150, type: 'numericColumn', valueFormatter: (p: any) => formatIdr(Number(p.value || 0)) },
  { field: 'status', headerName: 'Status', width: 120, slotName: 'status' },
  { field: 'actions', headerName: '', width: 240, pinned: 'right', slotName: 'actions' },
])

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(s: string) {
  if (s === 'POSTED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (s === 'DRAFT') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function addLine() {
  form.value.lines.push({ _key: String(crypto.randomUUID()), accountId: '', memo: '', debit: 0, credit: 0 })
}

async function fetchCoa() {
  const res = await api<{ success: true; accounts: ApiCoa[] }>('/api/coa', { query: { isActive: 'true' } })
  coa.value = (res as any).accounts || []
}

async function fetchJournals() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
    const res = await api<{ success: true; entries: ApiJournalEntry[] }>('/api/journals', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        source: filterSource.value === 'ALL' ? undefined : filterSource.value,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
        search: searchQuery.value || undefined,
        page: 1,
        limit: 200,
      },
    })
    journals.value = (res as any).entries || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.value = {
    entryNumber: '(auto)',
    date: new Date(),
    description: '',
    referenceId: '',
    lines: [
      { _key: String(crypto.randomUUID()), accountId: '', memo: '', debit: 0, credit: 0 },
      { _key: String(crypto.randomUUID()), accountId: '', memo: '', debit: 0, credit: 0 },
    ],
  }
}

function openCreate() {
  editId.value = null
  resetForm()
  showDialog.value = true
}

async function openEdit(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; entry: ApiJournalEntry }>(`/api/journals/${id}`)
    const e = (res as any).entry as ApiJournalEntry
    if (e.status !== 'DRAFT') return toast.error('Hanya jurnal DRAFT yang bisa diedit.')
    editId.value = e.id
    form.value = {
      entryNumber: e.entryNumber,
      date: new Date(e.date),
      description: e.description,
      referenceId: e.referenceId || '',
      lines: (e.lines || []).map((l) => ({
        _key: String(l.id),
        accountId: l.accountId,
        memo: l.memo || '',
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
    }
    showDialog.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function openDetail(id: string) {
  try {
    const res = await api<{ success: true; entry: ApiJournalEntry }>(`/api/journals/${id}`)
    selected.value = (res as any).entry
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function buildPayload() {
  return {
    description: form.value.description,
    date: form.value.date,
    referenceId: form.value.referenceId || undefined,
    source: 'MANUAL',
    lines: form.value.lines.map((l) => ({
      accountId: l.accountId,
      memo: l.memo || undefined,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    })),
  }
}

async function saveDraft() {
  if (!form.value.description) return toast.error('Lengkapi keterangan jurnal.')
  if (validationResult.value.errors.length > 0) return toast.error(validationResult.value.errors[0])

  saving.value = true
  try {
    if (editId.value) {
      await api(`/api/journals/${editId.value}`, { method: 'PUT', body: buildPayload() })
      toast.success('Draft jurnal tersimpan.')
    } else {
      const res = await api<{ success: true; entry: ApiJournalEntry }>('/api/journals', { method: 'POST', body: buildPayload() })
      editId.value = (res as any).entry?.id || null
      toast.success('Draft jurnal dibuat.')
    }
    showDialog.value = false
    await fetchJournals()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function saveAndPost() {
  if (!form.value.description) return toast.error('Lengkapi keterangan jurnal.')
  if (validationResult.value.errors.length > 0) return toast.error(validationResult.value.errors[0])

  saving.value = true
  try {
    let id = editId.value
    if (id) {
      await api(`/api/journals/${id}`, { method: 'PUT', body: buildPayload() })
    } else {
      const res = await api<{ success: true; entry: ApiJournalEntry }>('/api/journals', { method: 'POST', body: buildPayload() })
      id = (res as any).entry?.id
    }
    if (!id) throw new Error('Journal id not found')
    await api(`/api/journals/${id}/post`, { method: 'POST' })
    toast.success('Jurnal berhasil diposting.')
    showDialog.value = false
    editId.value = null
    resetForm()
    await fetchJournals()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function postJournal(id: string) {
  saving.value = true
  try {
    await api(`/api/journals/${id}/post`, { method: 'POST' })
    toast.success('Jurnal berhasil diposting.')
    await fetchJournals()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function voidJournal(id: string) {
  const reason = window.prompt('Alasan void?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/journals/${id}/void`, { method: 'POST', body: { reason } })
    toast.success('Jurnal berhasil di-void.')
    if (selected.value?.id === id) await openDetail(id)
    await fetchJournals()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteJournal(id: string) {
  if (!window.confirm('Hapus draft jurnal ini?')) return
  saving.value = true
  try {
    await api(`/api/journals/${id}`, { method: 'DELETE' })
    toast.success('Draft jurnal dihapus.')
    await fetchJournals()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

let t: any = null
watch([filterSource, filterStatus, dateRange, searchQuery], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchJournals(), 250)
})

onMounted(async () => {
  await fetchCoa()
  await fetchJournals()
})
</script>
