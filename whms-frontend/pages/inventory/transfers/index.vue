<template>
  <div class="p-6">
    <UiDataTable
      title="Inter-Warehouse Transfers"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterStatus"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Status"
            class="w-48"
          />
          <UiSelect
            v-model="filterWarehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Warehouse"
            class="w-60"
          />
          <UiDatePicker v-model="dateRange" :range="true" class="w-56" />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari TRF / Warehouse..." size="small" />
          </IconField>
          <Button icon="pi pi-plus" label="Buat Transfer" size="small" @click="openCreate()" />
          <Button icon="pi pi-refresh" text rounded @click="fetchTransfers()" :loading="loading" />
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
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            icon="pi pi-pencil"
            @click="openEdit(data.id)"
          />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            icon="pi pi-send"
            @click="submitAndStartTransit(data.id)"
          />
          <Button
            v-if="data.status === 'SUBMITTED'"
            text
            rounded
            size="small"
            icon="pi pi-truck"
            @click="startTransit(data.id)"
          />
          <Button
            v-if="data.status === 'IN_TRANSIT'"
            text
            rounded
            size="small"
            severity="success"
            icon="pi pi-check"
            @click="completeTransfer(data.id)"
          />
          <Button
            v-if="data.status !== 'COMPLETED' && data.status !== 'CANCELLED'"
            text
            rounded
            size="small"
            severity="warning"
            icon="pi pi-ban"
            @click="cancelTransfer(data.id)"
          />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-trash"
            @click="deleteTransfer(data.id)"
          />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="dialogTitle" width="75vw" :loading="saving">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiSelect
            label="Warehouse Asal"
            v-model="form.fromWarehouseId"
            :options="warehouseOptionsNoAll"
            optionLabel="label"
            optionValue="value"
            required
            :disabled="mode === 'view'"
            :loading="loadingMasters"
          />
          <UiSelect
            label="Warehouse Tujuan"
            v-model="form.toWarehouseId"
            :options="warehouseOptionsNoAll"
            optionLabel="label"
            optionValue="value"
            required
            :disabled="mode === 'view'"
            :loading="loadingMasters"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alasan Transfer</label>
          <Textarea v-model="form.reason" rows="2" class="w-full bg-slate-50" placeholder="Contoh: replenishment, pindah stok, dsb." :disabled="mode === 'view'" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Catatan</label>
          <Textarea v-model="form.notes" rows="2" class="w-full bg-slate-50" placeholder="Optional..." :disabled="mode === 'view'" />
        </div>

        <div class="bg-white rounded-xl border border-slate-200">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Items</h3>
            <Button v-if="mode !== 'view'" icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine()" />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[280px]">Item</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">From Location</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">To Location</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">Lot</th>
                  <th class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in form.items" :key="line._key" class="hover:bg-slate-50/50">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-if="mode !== 'view'"
                      v-model="line.itemId"
                      :options="itemOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Pilih item"
                      class="w-full"
                      @update:modelValue="onLineItemChanged(line)"
                    />
                    <div v-else class="font-medium text-slate-800">{{ itemLabel(line.itemId) }}</div>
                  </td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-if="mode !== 'view'"
                      v-model="line.fromLocationId"
                      :options="fromLocationOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Pilih lokasi asal"
                      class="w-full"
                      :disabled="!form.fromWarehouseId"
                      @update:modelValue="onLineFromLocationChanged(line)"
                    />
                    <div v-else class="text-slate-700">{{ locationLabel(line.fromLocationId) }}</div>
                    <div v-if="mode !== 'view'" class="mt-1 text-xs text-slate-500">
                      Avail: {{ availableLabel(line) }}
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-if="mode !== 'view'"
                      v-model="line.toLocationId"
                      :options="toLocationOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Pilih lokasi tujuan"
                      class="w-full"
                      :disabled="!form.toWarehouseId"
                    />
                    <div v-else class="text-slate-700">{{ locationLabel(line.toLocationId) }}</div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-if="mode !== 'view'" v-model="line.quantity" :min="0" size="small" class="w-full text-right" />
                    <div v-else class="font-medium">{{ line.quantity }}</div>
                  </td>
                  <td class="px-3 py-2">
                    <InputText
                      v-if="mode !== 'view'"
                      v-model="line.lotNumber"
                      size="small"
                      class="w-full"
                      placeholder="-"
                      :disabled="!isLotTracked(line.itemId)"
                    />
                    <div v-else class="text-slate-700">{{ line.lotNumber || '-' }}</div>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <Button
                      v-if="mode !== 'view'"
                      icon="pi pi-trash"
                      text
                      rounded
                      severity="danger"
                      size="small"
                      @click="removeLine(idx)"
                      :disabled="form.items.length === 1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showDialog = false" />
        <Button v-if="mode !== 'view'" label="Simpan Draft" icon="pi pi-save" :loading="saving" severity="secondary" outlined @click="saveDraft(false)" />
        <Button v-if="mode !== 'view'" label="Simpan & Kirim" icon="pi pi-send" :loading="saving" @click="saveDraft(true)" />
      </template>
    </UiModal>

    <UiModal v-model="showDetail" title="Transfer Detail" width="70vw">
      <div v-if="selected" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p class="text-xs text-slate-500">No</p><p class="font-semibold font-mono">{{ selected.transferNumber }}</p></div>
          <div><p class="text-xs text-slate-500">Status</p><p class="font-semibold">{{ selected.status }}</p></div>
          <div><p class="text-xs text-slate-500">From</p><p class="font-semibold">{{ selected.fromWarehouse?.code }} — {{ selected.fromWarehouse?.name }}</p></div>
          <div><p class="text-xs text-slate-500">To</p><p class="font-semibold">{{ selected.toWarehouse?.code }} — {{ selected.toWarehouse?.name }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Reason</p><p class="font-semibold">{{ selected.reason }}</p></div>
          <div class="md:col-span-2"><p class="text-xs text-slate-500">Notes</p><p class="font-semibold">{{ selected.notes || '-' }}</p></div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[260px]">Item</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">From</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">To</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-24">Qty</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-36">Lot</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(it, idx) in selected.items" :key="it.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-medium">{{ it.item?.sku }} — {{ it.item?.name }}</td>
                <td class="px-3 py-2 text-slate-700">{{ it.fromLocation?.code }}</td>
                <td class="px-3 py-2 text-slate-700">{{ it.toLocation?.code }}</td>
                <td class="px-3 py-2 text-right font-semibold">{{ it.quantity }}</td>
                <td class="px-3 py-2 text-slate-700">{{ it.lotNumber || '-' }}</td>
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

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

type TransferStatus = 'DRAFT' | 'SUBMITTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
type ApiWarehouse = { id: string; code: string; name: string }
type ApiLocation = { id: string; code: string; warehouse: ApiWarehouse }
type ApiItem = { id: string; sku: string; name: string; trackLot: boolean }
type ApiTransferListItem = {
  id: string
  transferNumber: string
  status: TransferStatus
  reason: string
  notes?: string | null
  fromWarehouse: ApiWarehouse
  toWarehouse: ApiWarehouse
  createdAt: string
  _count?: { items: number }
}
type ApiTransferItem = {
  id: string
  itemId: string
  item: ApiItem
  fromLocationId: string
  fromLocation: { id: string; code: string }
  toLocationId: string
  toLocation: { id: string; code: string }
  quantity: number
  lotNumber?: string | null
}
type ApiTransferDetail = ApiTransferListItem & { items: ApiTransferItem[] }
type ApiInventory = {
  id: string
  itemId: string
  locationId: string
  onHandQty: number
  allocatedQty: number
  availableQty: number
  itemLot?: { id: string; lotNumber: string } | null
}

type Option = { value: string | null; label: string }

const showDialog = ref(false)
const showDetail = ref(false)
const loading = ref(false)
const saving = ref(false)
const loadingMasters = ref(false)
const mode = ref<'create' | 'edit' | 'view'>('create')

const searchQuery = ref('')
const filterStatus = ref<TransferStatus | 'ALL'>('ALL')
const filterWarehouseId = ref<string | null>(null)
const dateRange = ref<Date[] | undefined>(undefined)

const statusOptions = ref<Array<{ label: string; value: TransferStatus | 'ALL' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'SUBMITTED', value: 'SUBMITTED' },
  { label: 'IN_TRANSIT', value: 'IN_TRANSIT' },
  { label: 'COMPLETED', value: 'COMPLETED' },
  { label: 'CANCELLED', value: 'CANCELLED' },
])

const warehouses = ref<ApiWarehouse[]>([])
const locations = ref<ApiLocation[]>([])
const items = ref<ApiItem[]>([])

const warehouseOptions = computed<Option[]>(() => [
  { value: null, label: 'All Warehouses' },
  ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
])

const warehouseOptionsNoAll = computed<Option[]>(() => warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })))

const itemOptions = computed<Option[]>(() => items.value.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })))

const fromLocationOptions = computed<Option[]>(() => {
  if (!form.value.fromWarehouseId) return []
  return locations.value
    .filter((l) => l.warehouse?.id === form.value.fromWarehouseId)
    .map((l) => ({ value: l.id, label: `${l.warehouse.code} / ${l.code}` }))
})

const toLocationOptions = computed<Option[]>(() => {
  if (!form.value.toWarehouseId) return []
  return locations.value
    .filter((l) => l.warehouse?.id === form.value.toWarehouseId)
    .map((l) => ({ value: l.id, label: `${l.warehouse.code} / ${l.code}` }))
})

const transfers = ref<ApiTransferListItem[]>([])
const selected = ref<ApiTransferDetail | null>(null)

const columns = ref([
  { field: 'transferNumber', headerName: 'No. Transfer', width: 170, pinned: 'left' },
  { field: 'date', headerName: 'Tanggal', width: 160 },
  { field: 'from', headerName: 'Dari', flex: 1, minWidth: 180 },
  { field: 'to', headerName: 'Ke', flex: 1, minWidth: 180 },
  { field: 'itemsCount', headerName: 'Item', width: 90, type: 'numericColumn' },
  { field: 'status', headerName: 'Status', width: 140, slotName: 'status' },
  { field: 'actions', headerName: '', width: 200, slotName: 'actions' },
])

const rows = computed(() =>
  transfers.value.map((t) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    date: formatDateTime(t.createdAt),
    from: `${t.fromWarehouse?.code || ''} — ${t.fromWarehouse?.name || ''}`,
    to: `${t.toWarehouse?.code || ''} — ${t.toWarehouse?.name || ''}`,
    itemsCount: t._count?.items ?? (t as any).items?.length ?? 0,
    status: t.status,
  }))
)

const dialogTitle = computed(() => {
  if (mode.value === 'edit') return 'Edit Transfer'
  if (mode.value === 'view') return 'Transfer Detail'
  return 'Buat Transfer'
})

const form = ref<{
  id: string | null
  fromWarehouseId: string
  toWarehouseId: string
  reason: string
  notes: string
  items: Array<{ _key: string; itemId: string; fromLocationId: string; toLocationId: string; quantity: number; lotNumber: string }>
}>({
  id: null,
  fromWarehouseId: '',
  toWarehouseId: '',
  reason: '',
  notes: '',
  items: [{ _key: crypto.randomUUID(), itemId: '', fromLocationId: '', toLocationId: '', quantity: 1, lotNumber: '' }],
})

const locationInventoryCache = ref<Record<string, ApiInventory[]>>({})
const locationInventoryLoading = ref<Record<string, boolean>>({})

function statusChipClass(s: string) {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (s === 'IN_TRANSIT') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (s === 'SUBMITTED') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (s === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function formatDateTime(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function itemLabel(itemId: string) {
  const it = items.value.find((x) => x.id === itemId)
  return it ? `${it.sku} — ${it.name}` : '-'
}

function locationLabel(locationId: string) {
  const l = locations.value.find((x) => x.id === locationId)
  if (!l) return '-'
  return `${l.warehouse?.code || ''} / ${l.code}`
}

function isLotTracked(itemId: string) {
  const it = items.value.find((x) => x.id === itemId)
  return Boolean(it?.trackLot)
}

function onLineItemChanged(line: any) {
  if (!isLotTracked(line.itemId)) line.lotNumber = ''
}

async function ensureInventoryCached(locationId: string) {
  if (!locationId) return
  if (locationInventoryCache.value[locationId]) return
  if (locationInventoryLoading.value[locationId]) return

  locationInventoryLoading.value = { ...locationInventoryLoading.value, [locationId]: true }
  try {
    const res = await api<{ success: true; inventories: ApiInventory[] }>(`/api/inventory/location/${locationId}`)
    locationInventoryCache.value = { ...locationInventoryCache.value, [locationId]: (res as any).inventories || [] }
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    locationInventoryLoading.value = { ...locationInventoryLoading.value, [locationId]: false }
  }
}

async function onLineFromLocationChanged(line: any) {
  await ensureInventoryCached(line.fromLocationId)
}

function availableLabel(line: any) {
  if (!line.itemId || !line.fromLocationId) return '-'
  const list = locationInventoryCache.value[line.fromLocationId]
  if (!Array.isArray(list)) return locationInventoryLoading.value[line.fromLocationId] ? 'Loading...' : '-'
  const targetLot = (line.lotNumber || '').trim()
  const inv = list.find((x) => {
    if (x.itemId !== line.itemId) return false
    const lotNo = x.itemLot?.lotNumber || ''
    if (isLotTracked(line.itemId)) return lotNo === targetLot
    return !x.itemLot
  })
  return inv ? String(inv.availableQty) : '0'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const [wRes, lRes, iRes] = await Promise.all([
      api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } }),
      api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', { query: { page: 1, limit: 2000 } }),
      api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 800 } }),
    ])
    warehouses.value = (wRes as any).warehouses || []
    locations.value = (lRes as any).locations || []
    items.value = (iRes as any).items || []
  } finally {
    loadingMasters.value = false
  }
}

async function fetchTransfers() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
    const res = await api<{ success: true; transfers: ApiTransferListItem[] }>('/api/transfers', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        warehouseId: filterWarehouseId.value || undefined,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
        page: 1,
        limit: 200,
      },
    })
    transfers.value = (res as any).transfers || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.value = {
    id: null,
    fromWarehouseId: warehouses.value[0]?.id || '',
    toWarehouseId: '',
    reason: '',
    notes: '',
    items: [{ _key: crypto.randomUUID(), itemId: '', fromLocationId: '', toLocationId: '', quantity: 1, lotNumber: '' }],
  }
}

function addLine() {
  form.value.items.push({ _key: crypto.randomUUID(), itemId: '', fromLocationId: '', toLocationId: '', quantity: 1, lotNumber: '' })
}

function removeLine(idx: number) {
  if (form.value.items.length === 1) return
  form.value.items.splice(idx, 1)
}

function openCreate() {
  mode.value = 'create'
  resetForm()
  showDialog.value = true
}

async function openEdit(id: string) {
  mode.value = 'edit'
  saving.value = true
  try {
    const res = await api<{ success: true; transfer: ApiTransferDetail }>(`/api/transfers/${id}`)
    const t = (res as any).transfer as ApiTransferDetail
    form.value = {
      id: t.id,
      fromWarehouseId: t.fromWarehouse?.id || '',
      toWarehouseId: t.toWarehouse?.id || '',
      reason: t.reason || '',
      notes: t.notes || '',
      items: (t.items || []).map((it) => ({
        _key: it.id,
        itemId: it.itemId,
        fromLocationId: it.fromLocationId,
        toLocationId: it.toLocationId,
        quantity: Number(it.quantity || 0),
        lotNumber: it.lotNumber || '',
      })),
    }
    for (const line of form.value.items) {
      if (line.fromLocationId) await ensureInventoryCached(line.fromLocationId)
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
    const res = await api<{ success: true; transfer: ApiTransferDetail }>(`/api/transfers/${id}`)
    selected.value = (res as any).transfer
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function validateForm() {
  if (!form.value.fromWarehouseId) return 'Warehouse asal wajib dipilih.'
  if (!form.value.toWarehouseId) return 'Warehouse tujuan wajib dipilih.'
  if (form.value.fromWarehouseId === form.value.toWarehouseId) return 'Warehouse asal dan tujuan tidak boleh sama.'
  if (!form.value.reason.trim()) return 'Alasan transfer wajib diisi.'
  if (!Array.isArray(form.value.items) || form.value.items.length === 0) return 'Minimal 1 item wajib diisi.'

  for (const [idx, line] of form.value.items.entries()) {
    if (!line.itemId) return `Baris ${idx + 1}: item wajib dipilih.`
    if (!line.fromLocationId) return `Baris ${idx + 1}: from location wajib dipilih.`
    if (!line.toLocationId) return `Baris ${idx + 1}: to location wajib dipilih.`
    if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) return `Baris ${idx + 1}: qty harus > 0.`
    if (isLotTracked(line.itemId) && !line.lotNumber.trim()) return `Baris ${idx + 1}: lot wajib diisi untuk item lot.`
  }
  return null
}

async function saveDraft(submitAfter: boolean) {
  const err = validateForm()
  if (err) return toast.error(err)

  saving.value = true
  try {
    const payload = {
      fromWarehouseId: form.value.fromWarehouseId,
      toWarehouseId: form.value.toWarehouseId,
      reason: form.value.reason,
      notes: form.value.notes || undefined,
      items: form.value.items.map((l) => ({
        itemId: l.itemId,
        fromLocationId: l.fromLocationId,
        toLocationId: l.toLocationId,
        quantity: Number(l.quantity),
        lotNumber: isLotTracked(l.itemId) ? (l.lotNumber || undefined) : undefined,
      })),
    }

    let savedId = form.value.id
    if (mode.value === 'edit' && savedId) {
      const res = await api<{ success: true; transfer: ApiTransferDetail }>(`/api/transfers/${savedId}`, { method: 'PUT', body: payload })
      savedId = (res as any).transfer?.id || savedId
      toast.success('Draft transfer tersimpan.')
    } else {
      const res = await api<{ success: true; transfer: ApiTransferDetail }>('/api/transfers', { method: 'POST', body: payload })
      savedId = (res as any).transfer?.id
      toast.success('Draft transfer dibuat.')
    }

    if (submitAfter && savedId) {
      await submitAndStartTransit(savedId)
    } else {
      showDialog.value = false
      await fetchTransfers()
    }
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function submitAndStartTransit(id: string) {
  saving.value = true
  try {
    await api(`/api/transfers/${id}/submit`, { method: 'POST' })
    await api(`/api/transfers/${id}/start-transit`, { method: 'POST' })
    toast.success('Transfer dikirim. Status: IN_TRANSIT.')
    showDialog.value = false
    await fetchTransfers()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function startTransit(id: string) {
  saving.value = true
  try {
    await api(`/api/transfers/${id}/start-transit`, { method: 'POST' })
    toast.success('Transfer masuk status IN_TRANSIT.')
    await fetchTransfers()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function completeTransfer(id: string) {
  if (!window.confirm('Complete transfer ini? Stok akan dipindahkan antar lokasi.')) return
  saving.value = true
  try {
    await api(`/api/transfers/${id}/complete`, { method: 'POST' })
    toast.success('Transfer completed.')
    if (showDetail.value && selected.value?.id === id) await openDetail(id)
    await fetchTransfers()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function cancelTransfer(id: string) {
  const reason = window.prompt('Alasan cancel transfer?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/transfers/${id}/cancel`, { method: 'POST', body: { reason } })
    toast.success('Transfer cancelled.')
    if (showDetail.value && selected.value?.id === id) await openDetail(id)
    await fetchTransfers()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteTransfer(id: string) {
  if (!window.confirm('Hapus draft transfer ini?')) return
  saving.value = true
  try {
    await api(`/api/transfers/${id}`, { method: 'DELETE' })
    toast.success('Draft transfer dihapus.')
    await fetchTransfers()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

watch(
  () => form.value.fromWarehouseId,
  () => {
    for (const line of form.value.items) line.fromLocationId = ''
  }
)

watch(
  () => form.value.toWarehouseId,
  () => {
    for (const line of form.value.items) line.toLocationId = ''
  }
)

let t: any = null
watch([filterStatus, filterWarehouseId, dateRange], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchTransfers(), 250)
})

onMounted(async () => {
  await fetchMasters()
  await fetchTransfers()
})
</script>
