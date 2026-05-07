<template>
  <div class="p-6">
    <UiDataTable
      title="Stock Movements History"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterType"
            :options="typeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Tipe Gerakan"
            class="w-44"
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
            <InputText v-model="searchQuery" placeholder="Cari SKU..." size="small" />
          </IconField>
          <Button icon="pi pi-refresh" text rounded @click="fetchMovements" :loading="loading" />
        </div>
      </template>
      <template #type="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="typeChipClass(data.type)">
          {{ data.type }}
        </span>
      </template>
      <template #qty="{ data }">
        <span class="font-bold" :class="Number(data.qty) >= 0 ? 'text-emerald-700' : 'text-red-700'">
          {{ Number(data.qty) >= 0 ? '+' : '' }}{{ data.qty }}
        </span>
      </template>
      <template #actions="{ data }">
        <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
      </template>
    </UiDataTable>

    <UiModal v-model="showDetail" title="Movement Detail" width="50vw">
      <div v-if="selected" class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-slate-500">Waktu</p>
          <p class="font-semibold">{{ selected.date }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Type</p>
          <p class="font-semibold">{{ selected.type }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Item</p>
          <p class="font-semibold">{{ selected.sku }} — {{ selected.item_name }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Qty</p>
          <p class="font-semibold">{{ selected.qty }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Warehouse</p>
          <p class="font-semibold">{{ selected.warehouse }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Location</p>
          <p class="font-semibold">{{ selected.location }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Lot</p>
          <p class="font-semibold">{{ selected.lot || '-' }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">Reference</p>
          <p class="font-semibold font-mono">{{ selected.ref || '-' }}</p>
        </div>
        <div class="md:col-span-2">
          <p class="text-xs text-slate-500">Remarks</p>
          <p class="font-semibold">{{ selected.remarks || '-' }}</p>
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

type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
type ApiMovement = {
  id: string
  itemId: string
  locationId: string
  itemLotId?: string | null
  type: MovementType
  quantity: number
  referenceId?: string | null
  remarks?: string | null
  createdAt: string
  item?: { id: string; sku: string; name: string }
  location?: { id: string; code: string; warehouse?: { id: string; code: string; name: string } }
  itemLot?: { id: string; lotNumber: string }
}

type ApiWarehouse = { id: string; code: string; name: string }
type ApiLocation = { id: string; code: string; warehouse: ApiWarehouse }
type ApiItem = { id: string; sku: string; name: string }

type Option = { value: string | null; label: string }

const searchQuery = ref('')
const filterType = ref<MovementType | 'ALL'>('ALL')
const filterWarehouseId = ref<string | null>(null)
const filterLocationId = ref<string | null>(null)
const filterItemId = ref<string | null>(null)
const dateRange = ref<Date[] | undefined>(undefined)

const typeOptions = ref<Array<{ label: string; value: MovementType | 'ALL' }>>([
  { label: 'All Types', value: 'ALL' },
  { label: 'IN', value: 'IN' },
  { label: 'OUT', value: 'OUT' },
  { label: 'TRANSFER', value: 'TRANSFER' },
  { label: 'ADJUSTMENT', value: 'ADJUSTMENT' },
])

const warehouses = ref<ApiWarehouse[]>([])
const locations = ref<ApiLocation[]>([])
const items = ref<ApiItem[]>([])

const warehouseOptions = computed<Option[]>(() => [
  { value: null, label: 'All Warehouses' },
  ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
])

const locationOptions = computed<Option[]>(() => {
  const all: Option[] = [{ value: null, label: 'All Locations' }]
  const list = filterWarehouseId.value ? locations.value.filter((l) => l.warehouse?.id === filterWarehouseId.value) : locations.value
  return all.concat(list.map((l) => ({ value: l.id, label: `${l.warehouse?.code || ''} / ${l.code}` })))
})

const itemOptions = computed<Option[]>(() => [
  { value: null, label: 'All Items' },
  ...items.value.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
])

const loading = ref(false)
const movements = ref<ApiMovement[]>([])

function formatDateTime(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

function typeChipClass(t: string) {
  if (t === 'IN') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (t === 'OUT') return 'bg-red-50 text-red-700 border-red-200'
  if (t === 'TRANSFER') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (t === 'ADJUSTMENT') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  const [wRes, lRes, iRes] = await Promise.all([
    api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } }),
    api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', { query: { page: 1, limit: 500 } }),
    api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 500 } }),
  ])
  warehouses.value = (wRes as any).warehouses || []
  locations.value = (lRes as any).locations || []
  items.value = (iRes as any).items || []
}

async function fetchMovements() {
  loading.value = true
  try {
    const [start, end] = Array.isArray(dateRange.value) ? dateRange.value : []
    const res = await api<{ success: true; movements: ApiMovement[] }>('/api/inventory/movements', {
      query: {
        itemId: filterItemId.value || undefined,
        locationId: filterLocationId.value || undefined,
        warehouseId: filterWarehouseId.value || undefined,
        type: filterType.value === 'ALL' ? undefined : filterType.value,
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
        page: 1,
        limit: 200
      }
    })
    movements.value = (res as any).movements || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

const rows = computed(() => {
  return movements.value.map((m) => ({
    id: m.id,
    date: formatDateTime(m.createdAt),
    sku: m.item?.sku || '-',
    item_name: m.item?.name || '-',
    type: m.type,
    ref: m.referenceId || '-',
    warehouse: m.location?.warehouse ? `${m.location.warehouse.code} — ${m.location.warehouse.name}` : '-',
    location: m.location?.code || '-',
    lot: m.itemLot?.lotNumber || '',
    qty: m.quantity,
    remarks: m.remarks || ''
  }))
})

const showDetail = ref(false)
const selected = ref<any>(null)

function openDetail(id: string) {
  selected.value = rows.value.find((r) => r.id === id) || null
  showDetail.value = true
}

let t: any = null
watch([filterType, filterWarehouseId, filterLocationId, filterItemId, dateRange], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchMovements(), 250)
})

const columns = ref([
  { field: 'date', headerName: 'Waktu', width: 160 },
  { field: 'type', headerName: 'Tipe', width: 130, slotName: 'type' },
  { field: 'sku', headerName: 'SKU', width: 140 },
  { field: 'item_name', headerName: 'Nama Barang', flex: 1, minWidth: 260 },
  { field: 'warehouse', headerName: 'Warehouse', width: 220 },
  { field: 'location', headerName: 'Location', width: 140 },
  { field: 'lot', headerName: 'Lot', width: 140 },
  { field: 'ref', headerName: 'Reference', width: 160 },
  { field: 'qty', headerName: 'Qty', width: 110, slotName: 'qty' },
  { field: 'remarks', headerName: 'Remarks', flex: 1, minWidth: 220 },
  { field: 'actions', headerName: '', width: 80, slotName: 'actions' },
])

onMounted(async () => {
  try {
    await fetchMasters()
    await fetchMovements()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
