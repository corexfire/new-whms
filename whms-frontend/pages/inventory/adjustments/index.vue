<template>
  <div class="p-6">
    <UiDataTable
      title="Stock Adjustments"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterReason"
            :options="reasonOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Filter Reason"
            class="w-56"
          />
          <UiSelect
            v-model="filterWarehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Warehouse"
            class="w-56"
          />
          <UiSelect
            v-model="filterLocationId"
            :options="locationOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Location"
            class="w-64"
          />
          <UiSelect
            v-model="filterItemId"
            :options="itemOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Item"
            class="w-72"
          />
          <UiDatePicker v-model="dateRange" :range="true" class="w-56" />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari ADJ / SKU..." size="small" />
          </IconField>
          <Button icon="pi pi-plus" label="Buat Adjustment" size="small" @click="openCreate()" />
          <Button icon="pi pi-refresh" text rounded @click="fetchAdjustments()" :loading="loading" />
        </div>
      </template>
      <template #reason="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="reasonChipClass(data.reason)">
          {{ data.reason }}
        </span>
      </template>
      <template #qty="{ data }">
        <span class="font-bold" :class="Number(data.qty) >= 0 ? 'text-emerald-700' : 'text-red-700'">
          {{ Number(data.qty) >= 0 ? '+' : '' }}{{ data.qty }}
        </span>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="data.voided ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'">
          {{ data.voided ? 'VOIDED' : 'POSTED' }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
          <Button
            v-if="!data.voided"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-ban"
            @click="voidAdjustment(data.id)"
          />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="dialogTitle" width="55vw" :loading="saving">
      <div class="space-y-4">
        <div class="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
          <i class="pi pi-exclamation-triangle text-amber-600 mt-0.5"></i>
          <p class="text-xs text-amber-700">Stock Adjustment akan langsung mempengaruhi On-Hand stok dan mencatat pergerakan di Inventory Movements. <b>Pastikan alasan tercatat.</b></p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiSelect
            label="Reason"
            v-model="form.reason"
            :options="reasonOptions.filter(o => o.value !== 'ALL')"
            optionLabel="label"
            optionValue="value"
            required
          />
          <UiSelect
            label="Warehouse"
            v-model="form.warehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            required
            :loading="loadingMasters"
          />
          <UiSelect
            label="Location"
            v-model="form.locationId"
            :options="formLocationOptions"
            optionLabel="label"
            optionValue="value"
            required
            :disabled="!form.warehouseId"
          />
          <UiSelect
            label="Item"
            v-model="form.itemId"
            :options="itemOptions"
            optionLabel="label"
            optionValue="value"
            required
          />
          <UiInput label="Qty (delta)" v-model="form.quantity" type="number" required />
        </div>

        <div class="p-3 rounded-lg border bg-slate-50 border-slate-200 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div class="font-semibold">Preview Stok</div>
            <div v-if="inventoryLoading" class="text-xs text-slate-500">Loading...</div>
          </div>
          <div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p class="text-xs text-slate-500">On Hand Saat Ini</p>
              <p class="font-semibold">{{ currentInventory ? currentInventory.onHandQty : '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Delta</p>
              <p class="font-semibold" :class="Number(form.quantity) >= 0 ? 'text-emerald-700' : 'text-red-700'">
                {{ Number(form.quantity) >= 0 ? '+' : '' }}{{ Number(form.quantity) || 0 }}
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-500">On Hand Setelah Adjustment</p>
              <p class="font-semibold" :class="resultingOnHand < 0 ? 'text-red-700' : 'text-slate-900'">
                {{ currentInventory ? resultingOnHand : '-' }}
              </p>
            </div>
          </div>
          <div v-if="inventoryError" class="mt-2 text-xs text-red-700">
            {{ inventoryError }}
          </div>
          <div v-else-if="!currentInventory && form.itemId && form.locationId" class="mt-2 text-xs text-amber-700">
            Inventory record belum ada untuk item ini di location ini, jadi adjustment tidak bisa diposting.
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Notes</label>
          <Textarea v-model="form.notes" rows="2" class="w-full bg-slate-50" placeholder="Catatan tambahan..." />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showDialog = false" />
        <Button label="Post Adjustment" icon="pi pi-check" :loading="saving" @click="submitAdjustment()" />
      </template>
    </UiModal>

    <UiModal v-model="showDetail" title="Adjustment Detail" width="50vw">
      <div v-if="selected" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><p class="text-xs text-slate-500">No</p><p class="font-semibold font-mono">{{ selected.adjustmentNumber }}</p></div>
        <div><p class="text-xs text-slate-500">Status</p><p class="font-semibold">{{ selected.voided ? 'VOIDED' : 'POSTED' }}</p></div>
        <div><p class="text-xs text-slate-500">Item</p><p class="font-semibold">{{ selected.item?.sku }} — {{ selected.item?.name }}</p></div>
        <div><p class="text-xs text-slate-500">Qty</p><p class="font-semibold">{{ selected.quantity }}</p></div>
        <div><p class="text-xs text-slate-500">Previous Qty</p><p class="font-semibold">{{ selected.previousQty }}</p></div>
        <div><p class="text-xs text-slate-500">New Qty</p><p class="font-semibold">{{ selected.newQty }}</p></div>
        <div><p class="text-xs text-slate-500">Warehouse</p><p class="font-semibold">{{ selected.location?.warehouse?.name || '-' }}</p></div>
        <div><p class="text-xs text-slate-500">Location</p><p class="font-semibold">{{ selected.location?.code || '-' }}</p></div>
        <div class="md:col-span-2"><p class="text-xs text-slate-500">Reason</p><p class="font-semibold">{{ selected.reason }}</p></div>
        <div class="md:col-span-2"><p class="text-xs text-slate-500">Notes</p><p class="font-semibold">{{ selected.notes || '-' }}</p></div>
        <div class="md:col-span-2" v-if="selected.voided"><p class="text-xs text-slate-500">Void Reason</p><p class="font-semibold">{{ selected.voidReason || '-' }}</p></div>
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
const showDialog = ref(false)
const showDetail = ref(false)
const loading = ref(false)
const saving = ref(false)
const loadingMasters = ref(false)
const inventoryLoading = ref(false)

type AdjustmentReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'FOUND' | 'CORRECTION' | 'OTHER'
type ApiWarehouse = { id: string; code: string; name: string }
type ApiLocation = { id: string; code: string; warehouse: ApiWarehouse }
type ApiItem = { id: string; sku: string; name: string }
type ApiInventory = {
  id: string
  itemId: string
  locationId: string
  onHandQty: number
  allocatedQty: number
  availableQty: number
}
type ApiAdjustment = {
  id: string
  adjustmentNumber: string
  itemId: string
  item: ApiItem
  locationId: string
  location: { id: string; code: string; warehouse: ApiWarehouse }
  quantity: number
  reason: AdjustmentReason
  notes?: string | null
  createdBy?: string | null
  createdAt: string
  previousQty: number
  newQty: number
  voided: boolean
  voidReason?: string | null
}

type Option = { value: string | null; label: string }

const searchQuery = ref('')
const filterReason = ref<AdjustmentReason | 'ALL'>('ALL')
const filterWarehouseId = ref<string | null>(null)
const filterLocationId = ref<string | null>(null)
const filterItemId = ref<string | null>(null)
const dateRange = ref<Date[] | undefined>(undefined)

const reasonOptions = ref<Array<{ label: string; value: AdjustmentReason | 'ALL' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DAMAGED', value: 'DAMAGED' },
  { label: 'EXPIRED', value: 'EXPIRED' },
  { label: 'LOST', value: 'LOST' },
  { label: 'FOUND', value: 'FOUND' },
  { label: 'CORRECTION', value: 'CORRECTION' },
  { label: 'OTHER', value: 'OTHER' },
])

const warehouses = ref<ApiWarehouse[]>([])
const locations = ref<ApiLocation[]>([])
const items = ref<ApiItem[]>([])

const warehouseOptions = computed<Option[]>(() => [
  { value: null, label: 'All Warehouses' },
  ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
])

const locationOptions = computed<Option[]>(() => {
  const list = filterWarehouseId.value ? locations.value.filter((l) => l.warehouse?.id === filterWarehouseId.value) : locations.value
  return [
    { value: null, label: 'All Locations' },
    ...list.map((l) => ({ value: l.id, label: `${l.warehouse?.code || ''} / ${l.code}` })),
  ]
})

const itemOptions = computed<Option[]>(() => [
  { value: null, label: 'All Items' },
  ...items.value.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
])

const formLocationOptions = computed<Option[]>(() => {
  if (!form.value.warehouseId) return []
  const list = locations.value.filter((l) => l.warehouse?.id === form.value.warehouseId)
  return list.map((l) => ({ value: l.id, label: `${l.warehouse?.code || ''} / ${l.code}` }))
})

const adjustments = ref<ApiAdjustment[]>([])
const selected = ref<ApiAdjustment | null>(null)

const columns = ref([
  { field: 'adjustmentNumber', headerName: 'No. ADJ', width: 170 },
  { field: 'date', headerName: 'Tanggal', width: 160 },
  { field: 'warehouse', headerName: 'Warehouse', width: 220 },
  { field: 'location', headerName: 'Location', width: 140 },
  { field: 'sku', headerName: 'SKU', width: 140 },
  { field: 'itemName', headerName: 'Item', flex: 1, minWidth: 240 },
  { field: 'reason', headerName: 'Reason', width: 140, slotName: 'reason' },
  { field: 'qty', headerName: 'Qty', width: 110, slotName: 'qty' },
  { field: 'status', headerName: 'Status', width: 120, slotName: 'status' },
  { field: 'actions', headerName: '', width: 90, slotName: 'actions' },
])

const dialogTitle = computed(() => 'Buat Stock Adjustment')

const form = ref<{
  reason: AdjustmentReason | ''
  warehouseId: string
  locationId: string
  itemId: string
  quantity: number
  notes: string
}>({
  reason: '',
  warehouseId: '',
  locationId: '',
  itemId: '',
  quantity: 0,
  notes: ''
})

const rows = computed(() => {
  return adjustments.value.map((a) => ({
    id: a.id,
    adjustmentNumber: a.adjustmentNumber,
    date: formatDateTime(a.createdAt),
    warehouse: a.location?.warehouse ? `${a.location.warehouse.code} — ${a.location.warehouse.name}` : '-',
    location: a.location?.code || '-',
    sku: a.item?.sku || '-',
    itemName: a.item?.name || '-',
    reason: a.reason,
    qty: a.quantity,
    voided: a.voided
  }))
})

const currentInventory = ref<ApiInventory | null>(null)
const inventoryError = ref<string | null>(null)
const resultingOnHand = computed(() => {
  const base = currentInventory.value?.onHandQty
  if (typeof base !== 'number') return 0
  return base + Number(form.value.quantity || 0)
})

function formatDateTime(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function reasonChipClass(r: string) {
  if (r === 'FOUND') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (r === 'DAMAGED' || r === 'EXPIRED' || r === 'LOST') return 'bg-red-50 text-red-700 border-red-200'
  if (r === 'CORRECTION') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const [wRes, lRes, iRes] = await Promise.all([
      api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } }),
      api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', { query: { page: 1, limit: 1000 } }),
      api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 500 } }),
    ])
    warehouses.value = (wRes as any).warehouses || []
    locations.value = (lRes as any).locations || []
    items.value = (iRes as any).items || []
  } finally {
    loadingMasters.value = false
  }
}

async function fetchAdjustments() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
    const res = await api<{ success: true; adjustments: ApiAdjustment[] }>('/api/adjustments', {
      query: {
        reason: filterReason.value === 'ALL' ? undefined : filterReason.value,
        itemId: filterItemId.value || undefined,
        warehouseId: filterWarehouseId.value || undefined,
        locationId: filterLocationId.value || undefined,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
        page: 1,
        limit: 200
      }
    })
    adjustments.value = (res as any).adjustments || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  showDialog.value = true
  form.value = {
    reason: '',
    warehouseId: warehouses.value[0]?.id || '',
    locationId: '',
    itemId: '',
    quantity: 0,
    notes: ''
  }
  currentInventory.value = null
  inventoryError.value = null
}

async function fetchFormInventory() {
  inventoryError.value = null
  currentInventory.value = null

  if (!form.value.itemId || !form.value.locationId) return

  inventoryLoading.value = true
  try {
    const res = await api<{ success: true; inventories: ApiInventory[] }>(`/api/inventory/location/${form.value.locationId}`)
    const list = (res as any).inventories as ApiInventory[] | undefined
    const inv = Array.isArray(list) ? list.find((x) => x.itemId === form.value.itemId) : undefined
    currentInventory.value = inv || null
  } catch (e: any) {
    inventoryError.value = errMsg(e)
  } finally {
    inventoryLoading.value = false
  }
}

async function submitAdjustment() {
  if (!form.value.reason) return toast.error('Reason wajib dipilih.')
  if (!form.value.warehouseId) return toast.error('Warehouse wajib dipilih.')
  if (!form.value.locationId) return toast.error('Location wajib dipilih.')
  if (!form.value.itemId) return toast.error('Item wajib dipilih.')
  if (!Number.isFinite(Number(form.value.quantity)) || Number(form.value.quantity) === 0) return toast.error('Qty (delta) tidak boleh 0.')
  if (!currentInventory.value) return toast.error('Inventory record tidak ditemukan untuk kombinasi Item + Location.')
  if (resultingOnHand.value < 0) return toast.error('Adjustment akan membuat stok negatif.')

  saving.value = true
  try {
    await api('/api/adjustments', {
      method: 'POST',
      body: {
        itemId: form.value.itemId,
        locationId: form.value.locationId,
        quantity: Number(form.value.quantity),
        reason: form.value.reason,
        notes: form.value.notes || undefined
      }
    })
    toast.success('Stock Adjustment berhasil diposting.')
    showDialog.value = false
    await fetchAdjustments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function openDetail(id: string) {
  try {
    const res = await api<{ success: true; adjustment: ApiAdjustment }>(`/api/adjustments/${id}`)
    selected.value = (res as any).adjustment
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function voidAdjustment(id: string) {
  const reason = window.prompt('Alasan void adjustment?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/adjustments/${id}/void`, { method: 'POST', body: { reason } })
    toast.success('Adjustment voided.')
    if (showDetail.value && selected.value?.id === id) await openDetail(id)
    await fetchAdjustments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

let t: any = null
watch([filterReason, filterWarehouseId, filterLocationId, filterItemId, dateRange], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchAdjustments(), 250)
})

watch(filterWarehouseId, () => {
  if (filterLocationId.value && filterWarehouseId.value) {
    const loc = locations.value.find((l) => l.id === filterLocationId.value)
    if (loc && loc.warehouse?.id !== filterWarehouseId.value) filterLocationId.value = null
  }
})

watch(
  () => [form.value.itemId, form.value.locationId],
  async () => {
    await fetchFormInventory()
  }
)

watch(
  () => form.value.warehouseId,
  () => {
    form.value.locationId = ''
    currentInventory.value = null
    inventoryError.value = null
  }
)

onMounted(async () => {
  await fetchMasters()
  await fetchAdjustments()
})
</script>
