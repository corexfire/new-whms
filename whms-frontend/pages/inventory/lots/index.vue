<template>
  <div class="p-6">
    <!-- Expiry Alert Banner -->
    <div v-if="expiringLots.length > 0" class="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <i class="pi pi-exclamation-triangle text-red-500 text-xl mt-0.5"></i>
      <div>
        <p class="text-sm font-bold text-red-800">{{ expiringLots.length }} Lot akan kedaluwarsa / sudah expired (≤30 hari)!</p>
        <p class="text-xs text-red-600 mt-0.5">Segera lakukan tindakan: kirim ke customer priority, FIFO picking, atau adjustment stok.</p>
      </div>
    </div>

    <UiDataTable
      title="Lot & Expiry Management"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <UiSelect
            v-model="filterExpiry"
            :options="expiryOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Filter Expiry"
            class="w-48"
          />
          <UiSelect
            v-model="filterWarehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Warehouse"
            class="w-60"
            :loading="loadingMasters"
          />
          <UiSelect
            v-model="filterItemId"
            :options="itemOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Item"
            class="w-72"
            :loading="loadingMasters"
          />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari Lot / SKU..." size="small" />
          </IconField>
          <Button icon="pi pi-plus" label="Buat Lot" size="small" @click="openCreate()" />
          <Button icon="pi pi-refresh" text rounded @click="fetchLots()" :loading="loading" />
        </div>
      </template>
      <template #daysLeft="{ data }">
        <span v-if="data.daysLeft === null" class="text-slate-500">-</span>
        <span v-else class="font-bold" :class="data.daysLeft <= 0 ? 'text-red-700' : data.daysLeft <= 30 ? 'text-amber-700' : 'text-emerald-700'">
          {{ data.daysLeft <= 0 ? 'LEWAT' : `${data.daysLeft}d` }}
        </span>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.lotId)" />
          <Button text rounded size="small" icon="pi pi-pencil" @click="openEdit(data)" />
          <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="deleteLot(data.lotId)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="dialogTitle" width="55vw" :loading="saving">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiSelect
            label="Item (Lot-tracked)"
            v-model="form.itemId"
            :options="lotTrackedItemOptions"
            optionLabel="label"
            optionValue="value"
            required
            :disabled="mode !== 'create'"
          />
          <UiInput label="Lot Number" v-model="form.lotNumber" required :disabled="mode !== 'create'" />
          <UiDatePicker label="Manufactured" v-model="form.manufactured" />
          <UiDatePicker label="Expiry Date" v-model="form.expiryDate" />
        </div>

        <div class="flex items-center gap-2 mt-1">
          <Checkbox v-model="form.isActive" inputId="isActive" :binary="true" />
          <label for="isActive" class="text-sm font-medium text-slate-700">Aktif</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showDialog = false" />
        <Button label="Simpan" icon="pi pi-save" :loading="saving" @click="saveLot()" />
      </template>
    </UiModal>

    <UiModal v-model="showDetail" title="Lot Detail" width="70vw">
      <div v-if="detail" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p class="text-xs text-slate-500">Item</p><p class="font-semibold">{{ detail.lot.item?.sku }} — {{ detail.lot.item?.name }}</p></div>
          <div><p class="text-xs text-slate-500">Lot</p><p class="font-semibold font-mono">{{ detail.lot.lotNumber }}</p></div>
          <div><p class="text-xs text-slate-500">Manufactured</p><p class="font-semibold">{{ formatDate(detail.lot.manufactured) }}</p></div>
          <div><p class="text-xs text-slate-500">Expiry</p><p class="font-semibold">{{ formatDate(detail.lot.expiryDate) }}</p></div>
          <div><p class="text-xs text-slate-500">Total On Hand</p><p class="font-semibold">{{ detail.totals.onHand }}</p></div>
          <div><p class="text-xs text-slate-500">Total Available</p><p class="font-semibold">{{ detail.totals.available }}</p></div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">Warehouse</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[160px]">Location</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">On Hand</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Allocated</th>
                <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Available</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(inv, idx) in detail.inventories" :key="inv.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-medium">{{ inv.location?.warehouse?.code }} — {{ inv.location?.warehouse?.name }}</td>
                <td class="px-3 py-2 text-slate-700">{{ inv.location?.code }}</td>
                <td class="px-3 py-2 text-right font-semibold">{{ inv.onHandQty }}</td>
                <td class="px-3 py-2 text-right">{{ inv.allocatedQty }}</td>
                <td class="px-3 py-2 text-right">{{ inv.availableQty }}</td>
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

const searchQuery = ref('')
const filterExpiry = ref<'ALL' | 'EXPIRING' | 'EXPIRED' | 'OK'>('ALL')
const filterWarehouseId = ref<string | null>(null)
const filterItemId = ref<string | null>(null)

const toast = useToast()
const { api } = useApi()

type ApiWarehouse = { id: string; code: string; name: string }
type ApiLocation = { id: string; code: string; warehouse: ApiWarehouse }
type ApiItem = { id: string; sku: string; name: string; trackLot: boolean; trackExpiry: boolean }
type ApiItemLot = { id: string; itemId: string; lotNumber: string; expiryDate?: string | null; manufactured?: string | null; isActive: boolean; item?: ApiItem }
type ApiInventoryLot = {
  id: string
  itemId: string
  item: ApiItem
  locationId: string
  location: ApiLocation
  itemLotId: string
  itemLot: ApiItemLot
  onHandQty: number
  allocatedQty: number
  availableQty: number
}

type LotStatus = 'OK' | 'EXPIRING' | 'EXPIRED'

const loading = ref(false)
const saving = ref(false)
const loadingMasters = ref(false)
const mode = ref<'create' | 'edit'>('create')
const showDialog = ref(false)
const showDetail = ref(false)

const warehouses = ref<ApiWarehouse[]>([])
const items = ref<ApiItem[]>([])
const lots = ref<ApiInventoryLot[]>([])

const expiryOptions = ref<Array<{ label: string; value: 'ALL' | 'EXPIRING' | 'EXPIRED' | 'OK' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'Expiring (<30d)', value: 'EXPIRING' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'OK', value: 'OK' },
])

type Option = { value: string | null; label: string }
const warehouseOptions = computed<Option[]>(() => [
  { value: null, label: 'All Warehouses' },
  ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
])

const itemOptions = computed<Option[]>(() => [
  { value: null, label: 'All Items' },
  ...items.value.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
])

const lotTrackedItemOptions = computed<Option[]>(() =>
  items.value
    .filter((i) => i.trackLot)
    .map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` }))
)

const form = ref<{
  lotId: string | null
  itemId: string
  lotNumber: string
  manufactured?: Date
  expiryDate?: Date
  isActive: boolean
}>({
  lotId: null,
  itemId: '',
  lotNumber: '',
  manufactured: undefined,
  expiryDate: undefined,
  isActive: true,
})

const dialogTitle = computed(() => (mode.value === 'edit' ? 'Edit Lot' : 'Buat Lot'))

const detail = ref<{ lot: ApiItemLot; inventories: Array<any>; totals: { onHand: number; allocated: number; available: number } } | null>(null)

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatDate(s?: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function computeStatus(expiryDate?: string | null): { status: LotStatus; daysLeft: number | null } {
  if (!expiryDate) return { status: 'OK', daysLeft: null }
  const exp = new Date(expiryDate)
  if (Number.isNaN(exp.getTime())) return { status: 'OK', daysLeft: null }
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate())
  const daysLeft = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 0) return { status: 'EXPIRED', daysLeft }
  if (daysLeft <= 30) return { status: 'EXPIRING', daysLeft }
  return { status: 'OK', daysLeft }
}

const expiringLots = computed(() => rows.value.filter((l) => l.status === 'EXPIRING' || l.status === 'EXPIRED'))

const columns = ref([
  { field: 'lotNumber', headerName: 'No. Lot', width: 170, pinned: 'left' },
  { field: 'sku', headerName: 'SKU', width: 130 },
  { field: 'itemName', headerName: 'Nama Barang', flex: 1, minWidth: 220 },
  { field: 'manufactured', headerName: 'Tgl. Produksi', width: 140 },
  { field: 'expiry', headerName: 'Tgl. Expired', width: 140 },
  { field: 'daysLeft', headerName: 'Sisa Hari', width: 110, slotName: 'daysLeft' },
  { field: 'qty', headerName: 'On Hand', width: 110, type: 'numericColumn' },
  { field: 'warehouse', headerName: 'Gudang', width: 220 },
  { field: 'location', headerName: 'Lokasi', width: 140 },
  { field: 'status', headerName: 'Status', width: 130, slotName: 'status' },
  { field: 'actions', headerName: '', width: 130, slotName: 'actions' },
])

const rows = computed(() => {
  return lots.value.map((inv) => {
    const { status, daysLeft } = computeStatus(inv.itemLot?.expiryDate)
    return {
      id: inv.id,
      lotId: inv.itemLotId,
      lotNumber: inv.itemLot?.lotNumber || '-',
      sku: inv.item?.sku || '-',
      itemName: inv.item?.name || '-',
      manufactured: formatDate(inv.itemLot?.manufactured || null),
      expiry: formatDate(inv.itemLot?.expiryDate || null),
      daysLeft,
      qty: inv.onHandQty,
      warehouse: inv.location?.warehouse ? `${inv.location.warehouse.code} — ${inv.location.warehouse.name}` : '-',
      location: inv.location?.code || '-',
      status,
      isActive: inv.itemLot?.isActive ?? true,
      itemId: inv.itemId,
      lotNumberRaw: inv.itemLot?.lotNumber || '',
      manufacturedRaw: inv.itemLot?.manufactured || null,
      expiryRaw: inv.itemLot?.expiryDate || null,
    }
  })
})

function statusChipClass(s: string) {
  if (s === 'EXPIRED') return 'bg-red-50 text-red-700 border-red-200'
  if (s === 'EXPIRING') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const [wRes, iRes] = await Promise.all([
      api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } }),
      api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 800 } }),
    ])
    warehouses.value = (wRes as any).warehouses || []
    items.value = (iRes as any).items || []
  } finally {
    loadingMasters.value = false
  }
}

async function fetchLots() {
  loading.value = true
  try {
    const res = await api<{ success: true; lots: ApiInventoryLot[] }>('/api/inventory/lots', {
      query: {
        expiry: filterExpiry.value,
        days: 30,
        warehouseId: filterWarehouseId.value || undefined,
        itemId: filterItemId.value || undefined,
        search: searchQuery.value || undefined,
        page: 1,
        limit: 500,
      },
    })
    lots.value = (res as any).lots || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  mode.value = 'create'
  showDialog.value = true
  form.value = {
    lotId: null,
    itemId: lotTrackedItemOptions.value[0]?.value || '',
    lotNumber: '',
    manufactured: undefined,
    expiryDate: undefined,
    isActive: true,
  }
}

function openEdit(row: any) {
  mode.value = 'edit'
  showDialog.value = true
  form.value = {
    lotId: row.lotId,
    itemId: row.itemId,
    lotNumber: row.lotNumberRaw,
    manufactured: row.manufacturedRaw ? new Date(row.manufacturedRaw) : undefined,
    expiryDate: row.expiryRaw ? new Date(row.expiryRaw) : undefined,
    isActive: row.isActive,
  }
}

async function saveLot() {
  if (!form.value.itemId) return toast.error('Item wajib dipilih.')
  if (!form.value.lotNumber.trim() && mode.value === 'create') return toast.error('Lot number wajib diisi.')

  saving.value = true
  try {
    if (mode.value === 'create') {
      await api(`/api/items/${form.value.itemId}/lots`, {
        method: 'POST',
        body: {
          lotNumber: form.value.lotNumber.trim(),
          manufactured: form.value.manufactured ? form.value.manufactured.toISOString() : undefined,
          expiryDate: form.value.expiryDate ? form.value.expiryDate.toISOString() : undefined,
          isActive: form.value.isActive,
        },
      })
      toast.success('Lot berhasil dibuat.')
    } else {
      if (!form.value.lotId) throw new Error('Lot ID missing')
      await api(`/api/items/lots/${form.value.lotId}`, {
        method: 'PATCH',
        body: {
          manufactured: form.value.manufactured ? form.value.manufactured.toISOString() : null,
          expiryDate: form.value.expiryDate ? form.value.expiryDate.toISOString() : null,
          isActive: form.value.isActive,
        },
      })
      toast.success('Lot berhasil diupdate.')
    }
    showDialog.value = false
    await fetchLots()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function openDetail(lotId: string) {
  saving.value = true
  try {
    const res = await api(`/api/inventory/lots/${lotId}`)
    detail.value = (res as any)
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteLot(lotId: string) {
  if (!window.confirm('Hapus lot ini? Hanya bisa jika tidak ada inventory record.')) return
  saving.value = true
  try {
    await api(`/api/items/lots/${lotId}`, { method: 'DELETE' })
    toast.success('Lot deleted.')
    await fetchLots()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

let t: any = null
watch([filterExpiry, filterWarehouseId, filterItemId], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchLots(), 250)
})

watch(searchQuery, () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchLots(), 400)
})

onMounted(async () => {
  await fetchMasters()
  await fetchLots()
})
</script>
