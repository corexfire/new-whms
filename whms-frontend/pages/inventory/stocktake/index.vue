<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Stock Opname (Stocktake)</h1>
        <p class="text-sm text-slate-500">Proses penghitungan fisik stok gudang. Bisa dilakukan offline lalu sync.</p>
      </div>
      <Button icon="pi pi-plus" label="Mulai Opname Baru" @click="openCreate()" />
    </div>

    <UiDataTable title="" :rowData="rows" :columnDefs="columns" :exportable="true" :quickFilterText="searchQuery">
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterWarehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All Warehouses"
            class="w-56"
          />
          <UiSelect
            v-model="filterStatus"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All Status"
            class="w-56"
          />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari No. / Nama..." size="small" />
          </IconField>
          <Button icon="pi pi-refresh" text rounded @click="fetchStocktakes()" :loading="loading" />
        </div>
      </template>

      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>

      <template #actions="{ data }">
        <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
      </template>
    </UiDataTable>

    <!-- New Stocktake Dialog -->
    <UiModal v-model="showNewDialog" title="Buat Sesi Opname Baru" width="55vw" :loading="saving">
      <div class="space-y-4">
        <UiSelect
          label="Gudang"
          v-model="newForm.warehouseId"
          :options="warehouseOptions"
          optionLabel="label"
          optionValue="value"
          required
          :loading="loadingMasters"
        />
        <UiSelect
          label="Tipe Opname"
          v-model="newForm.type"
          :options="typeOptions"
          optionLabel="label"
          optionValue="value"
          required
        />
        <UiInput label="Nama Sesi" v-model="newForm.name" placeholder="Contoh: Stocktake Bulanan April" required />
        <UiDatePicker label="Tanggal Opname" v-model="newForm.stocktakeDate" required />
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Catatan</label>
          <Textarea v-model="newForm.notes" rows="2" class="w-full bg-slate-50" placeholder="Alasan atau konteks opname..." />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showNewDialog = false" />
        <Button label="Mulai Opname" icon="pi pi-check" :loading="saving" @click="createStocktake()" />
      </template>
    </UiModal>

    <!-- Count Detail Dialog -->
    <UiModal v-model="showDetailDialog" :title="detailTitle" width="80vw" :loading="saving">
      <div v-if="selectedStocktake" class="space-y-4">
        <div class="flex items-center justify-between mb-2">
          <UiBadge :value="selectedStocktake.status" />
          <div class="flex gap-2">
            <Button
              v-if="selectedStocktake.status === 'DRAFT'"
              label="Start Counting"
              icon="pi pi-play"
              size="small"
              severity="secondary"
              outlined
              @click="startCounting()"
              :loading="saving"
            />
            <Button
              v-if="selectedStocktake.status === 'IN_PROGRESS'"
              label="Submit ke Manager"
              icon="pi pi-send"
              size="small"
              @click="submitOpname()"
              :loading="saving"
            />
            <Button
              v-if="selectedStocktake.status === 'PENDING_APPROVAL'"
              label="Approve & Apply"
              icon="pi pi-check"
              size="small"
              severity="success"
              @click="approveAndApply()"
              :loading="saving"
            />
            <Button
              v-if="selectedStocktake.status === 'PENDING_APPROVAL'"
              label="Reject"
              icon="pi pi-ban"
              size="small"
              severity="danger"
              outlined
              @click="rejectOpname()"
              :loading="saving"
            />
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">SKU</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">Nama Barang</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">Lokasi</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500">Stok Sistem</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500">Hitung Fisik</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500">Selisih</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">Catatan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="line in countLines" :key="line.id" :class="line.variance !== 0 ? 'bg-amber-50/50' : ''">
                <td class="px-3 py-2 font-mono text-xs text-slate-600">{{ line.sku }}</td>
                <td class="px-3 py-2 font-medium text-slate-800">{{ line.name }}</td>
                <td class="px-3 py-2 text-xs text-slate-600">{{ line.location }}</td>
                <td class="px-3 py-2 text-right">{{ line.system_qty }}</td>
                <td class="px-3 py-2 text-right">
                  <InputNumber v-if="selectedStocktake.status === 'IN_PROGRESS'" v-model="line.count_qty" :min="0" size="small" class="w-20" @update:modelValue="recalcVariance(line)" />
                  <span v-else class="font-semibold">{{ line.count_qty }}</span>
                </td>
                <td class="px-3 py-2 text-right">
                  <span :class="['font-bold', line.variance > 0 ? 'text-emerald-600' : line.variance < 0 ? 'text-red-600' : 'text-slate-400']">
                    {{ line.variance > 0 ? '+' : '' }}{{ line.variance }}
                  </span>
                </td>
                <td class="px-3 py-2">
                  <InputText v-if="selectedStocktake.status === 'IN_PROGRESS'" v-model="line.note" size="small" class="w-full" placeholder="..." />
                  <span v-else class="text-xs text-slate-500">{{ line.note || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer><div></div></template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()
const showNewDialog = ref(false)
const showDetailDialog = ref(false)
const selectedStocktake = ref<any>(null)
const loading = ref(false)
const saving = ref(false)
const loadingMasters = ref(false)

type StocktakeStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
type ApiWarehouse = { id: string; code: string; name: string }
type ApiStocktake = { id: string; stocktakeNumber: string; warehouseId: string; warehouse: ApiWarehouse; name: string; stocktakeDate: string; status: StocktakeStatus; notes?: string | null; _count?: { counts: number } }
type ApiStocktakeCount = { id: string; systemQty: number; countedQty?: number | null; notes?: string | null; item: { sku: string; name: string }; location: { code: string } }

type Option = { value: string | null; label: string }
const warehouses = ref<ApiWarehouse[]>([])

const warehouseOptions = computed<Option[]>(() => [
  { value: null, label: 'All Warehouses' },
  ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
])

const typeOptions = ref<Array<{ label: string; value: string }>>([
  { label: 'FULL (Seluruh SKU)', value: 'FULL' },
  { label: 'PARTIAL (Area/Kategori tertentu)', value: 'PARTIAL' },
  { label: 'CYCLE COUNT (Harian rotasi)', value: 'CYCLE' },
])

const searchQuery = ref('')
const filterWarehouseId = ref<string | null>(null)
const filterStatus = ref<'ALL' | StocktakeStatus>('ALL')
const statusOptions = ref<Array<{ label: string; value: 'ALL' | StocktakeStatus }>>([
  { label: 'All Status', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
  { label: 'PENDING_APPROVAL', value: 'PENDING_APPROVAL' },
  { label: 'APPROVED', value: 'APPROVED' },
  { label: 'REJECTED', value: 'REJECTED' },
  { label: 'COMPLETED', value: 'COMPLETED' },
])

const newForm = ref({
  warehouseId: '',
  type: 'FULL',
  name: '',
  stocktakeDate: new Date(),
  notes: ''
})

const countLines = ref<Array<{ id: string; sku: string; name: string; location: string; system_qty: number; count_qty: number; variance: number; note: string }>>([])

const stocktakes = ref<ApiStocktake[]>([])

const rows = computed(() => {
  return stocktakes.value.map((s) => ({
    id: s.id,
    stocktakeNumber: s.stocktakeNumber,
    warehouse: s.warehouse ? `${s.warehouse.code} — ${s.warehouse.name}` : '-',
    name: s.name,
    date: formatDate(s.stocktakeDate),
    items_count: s._count?.counts || 0,
    status: s.status
  }))
})

const columns = ref([
  { field: 'stocktakeNumber', headerName: 'No. Opname', width: 170 },
  { field: 'warehouse', headerName: 'Gudang', flex: 1, minWidth: 220 },
  { field: 'name', headerName: 'Nama', flex: 1, minWidth: 220 },
  { field: 'date', headerName: 'Tanggal', width: 120 },
  { field: 'items_count', headerName: 'Total Item', width: 110, type: 'numericColumn' },
  { field: 'status', headerName: 'Status', width: 160, slotName: 'status' },
  { field: 'actions', headerName: '', width: 80, slotName: 'actions' }
])

const detailTitle = computed(() => {
  if (!selectedStocktake.value) return 'Detail Opname'
  return `Detail Opname: ${selectedStocktake.value.stocktakeNumber}`
})

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'PENDING_APPROVAL') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'REJECTED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function recalcVariance(line: any) { line.variance = Number(line.count_qty || 0) - Number(line.system_qty || 0) }

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const res = await api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } })
    warehouses.value = (res as any).warehouses || []
  } finally {
    loadingMasters.value = false
  }
}

async function fetchStocktakes() {
  loading.value = true
  try {
    const res = await api<{ success: true; stocktakes: ApiStocktake[] }>('/api/stocktakes', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        warehouseId: filterWarehouseId.value || undefined,
        page: 1,
        limit: 200
      }
    })
    stocktakes.value = (res as any).stocktakes || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  showNewDialog.value = true
  newForm.value = {
    warehouseId: warehouses.value[0]?.id || '',
    type: 'FULL',
    name: '',
    stocktakeDate: new Date(),
    notes: ''
  }
}

async function createStocktake() {
  if (!newForm.value.warehouseId) return toast.error('Pilih gudang.')
  if (!newForm.value.name) return toast.error('Nama sesi wajib diisi.')

  saving.value = true
  try {
    const res = await api<{ success: true; stocktake: ApiStocktake }>('/api/stocktakes', {
      method: 'POST',
      body: {
        warehouseId: newForm.value.warehouseId,
        name: `[${newForm.value.type}] ${newForm.value.name}`,
        stocktakeDate: newForm.value.stocktakeDate,
        notes: newForm.value.notes || undefined,
        includeAllLocations: true,
      }
    })
    toast.success('Sesi opname berhasil dibuat.')
    showNewDialog.value = false
    await fetchStocktakes()
    const id = (res as any).stocktake?.id
    if (id) await openDetail(id)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function openDetail(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; stocktake: any }>(`/api/stocktakes/${id}`)
    selectedStocktake.value = (res as any).stocktake
    const counts: ApiStocktakeCount[] = selectedStocktake.value?.counts || []
    countLines.value = counts.map((c) => {
      const counted = c.countedQty === null || c.countedQty === undefined ? c.systemQty : c.countedQty
      return {
        id: c.id,
        sku: c.item?.sku || '-',
        name: c.item?.name || '-',
        location: c.location?.code || '-',
        system_qty: c.systemQty,
        count_qty: counted,
        variance: counted - c.systemQty,
        note: c.notes || ''
      }
    })
    showDetailDialog.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function startCounting() {
  if (!selectedStocktake.value) return
  saving.value = true
  try {
    await api(`/api/stocktakes/${selectedStocktake.value.id}/start`, { method: 'POST' })
    toast.success('Stocktake started.')
    await openDetail(selectedStocktake.value.id)
    await fetchStocktakes()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function submitOpname() {
  if (!selectedStocktake.value) return
  const payload = countLines.value.map((l) => ({ inventoryId: l.id, countedQty: Number(l.count_qty || 0), notes: l.note || undefined }))
  saving.value = true
  try {
    await api(`/api/stocktakes/${selectedStocktake.value.id}/submit`, { method: 'POST', body: { counts: payload } })
    toast.info('Opname disubmit ke Manager untuk approval.')
    await openDetail(selectedStocktake.value.id)
    await fetchStocktakes()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function approveAndApply() {
  if (!selectedStocktake.value) return
  const ok = window.confirm('Approve lalu apply adjustments? Ini akan mengubah stok sistem.')
  if (!ok) return

  saving.value = true
  try {
    await api(`/api/stocktakes/${selectedStocktake.value.id}/approve`, { method: 'POST' })
    await api(`/api/stocktakes/${selectedStocktake.value.id}/apply`, { method: 'POST' })
    toast.success('Opname approved & adjustments applied.')
    showDetailDialog.value = false
    selectedStocktake.value = null
    await fetchStocktakes()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function rejectOpname() {
  if (!selectedStocktake.value) return
  const reason = window.prompt('Alasan reject opname?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/stocktakes/${selectedStocktake.value.id}/reject`, { method: 'POST', body: { reason } })
    toast.success('Opname rejected.')
    await openDetail(selectedStocktake.value.id)
    await fetchStocktakes()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}
let t: any = null
watch([filterWarehouseId, filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchStocktakes(), 200)
})

onMounted(async () => {
  try {
    await fetchMasters()
    await fetchStocktakes()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
