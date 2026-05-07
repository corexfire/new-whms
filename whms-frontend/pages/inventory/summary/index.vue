<template>
  <div class="p-6">
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <div v-for="card in summaryCards" :key="card.label" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-3">
          <div :class="['w-10 h-10 rounded-lg flex items-center justify-center', card.bgColor]">
            <i :class="[card.icon, card.iconColor, 'text-lg']"></i>
          </div>
          <span :class="['text-xs font-bold px-2 py-0.5 rounded-full', card.trendUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50']">
            {{ card.trendUp ? '↑' : '↓' }} {{ card.trend }}
          </span>
        </div>
        <p class="text-2xl font-bold text-slate-900">{{ card.value }}</p>
        <p class="text-xs text-slate-500 mt-1">{{ card.label }}</p>
      </div>
    </div>

    <!-- Main Table -->
    <UiDataTable
      title="Inventory Summary (Stock per Item)"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
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
            v-model="filterCategoryId"
            :options="categoryOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All Categories"
            class="w-56"
          />
          <UiSelect
            v-model="filterItemId"
            :options="itemOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="All Items"
            class="w-72"
          />
          <UiSelect
            v-model="filterStock"
            :options="stockOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Stock Filter"
            class="w-48"
          />
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari SKU / Nama..." size="small" />
          </IconField>
          <Button icon="pi pi-refresh" text rounded @click="fetchSummaries" :loading="loading" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
    </UiDataTable>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

type ApiWarehouse = { id: string; code: string; name: string }
type ApiCategory = { id: string; name: string }
type ApiItem = { id: string; sku: string; name: string }
type ApiSummary = { itemId: string; itemSku: string; itemName: string; totalOnHand: number; totalAllocated: number; totalAvailable: number }

const loading = ref(false)

const searchQuery = ref('')
const filterWarehouseId = ref<string | null>(null)
const filterCategoryId = ref<string | null>(null)
const filterItemId = ref<string | null>(null)
const filterStock = ref<'ALL' | 'LOW'>('ALL')

const warehouses = ref<ApiWarehouse[]>([])
const categories = ref<ApiCategory[]>([])
const items = ref<ApiItem[]>([])

type Option = { value: string | null; label: string }
const warehouseOptions = computed<Option[]>(() => {
  return [
    { value: null, label: 'All Warehouses' },
    ...warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
  ]
})
const categoryOptions = computed<Option[]>(() => {
  return [
    { value: null, label: 'All Categories' },
    ...categories.value.map((c) => ({ value: c.id, label: c.name })),
  ]
})
const itemOptions = computed<Option[]>(() => {
  return [
    { value: null, label: 'All Items' },
    ...items.value.map((i) => ({ value: i.id, label: `${i.sku} — ${i.name}` })),
  ]
})
const stockOptions = ref([{ value: 'ALL', label: 'All Stock' }, { value: 'LOW', label: 'Low Stock (<=10)' }])

const totalSkus = ref<number>(0)
const lowStockSkus = ref<number>(0)

const summaries = ref<ApiSummary[]>([])

const rows = computed(() => {
  return summaries.value.map((s) => {
    const status = s.totalAvailable <= 0 ? 'OUT_OF_STOCK' : s.totalAvailable <= 10 ? 'LOW_STOCK' : 'OK'
    return {
      id: s.itemId,
      sku: s.itemSku,
      name: s.itemName,
      onHand: s.totalOnHand,
      allocated: s.totalAllocated,
      available: s.totalAvailable,
      status
    }
  })
})

const summaryCards = computed(() => [
  { label: 'Total SKU (Filtered)', value: String(totalSkus.value), icon: 'pi pi-box', iconColor: 'text-primary-600', bgColor: 'bg-primary-50', trend: '-', trendUp: true },
  { label: 'Item Low Stock (<=10)', value: String(lowStockSkus.value), icon: 'pi pi-exclamation-triangle', iconColor: 'text-amber-600', bgColor: 'bg-amber-50', trend: '-', trendUp: false },
  { label: 'Nilai Stok', value: '—', icon: 'pi pi-wallet', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', trend: '-', trendUp: true },
  { label: 'Near Expiry (30d)', value: '—', icon: 'pi pi-clock', iconColor: 'text-red-600', bgColor: 'bg-red-50', trend: '-', trendUp: false },
])

function statusChipClass(status: string) {
  if (status === 'OK') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'LOW_STOCK') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'OUT_OF_STOCK') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

const columns = ref([
  { field: 'sku', headerName: 'SKU', width: 140 },
  { field: 'name', headerName: 'Nama Barang', flex: 1, minWidth: 260 },
  { field: 'onHand', headerName: 'On Hand', width: 110 },
  { field: 'allocated', headerName: 'Allocated', width: 110 },
  { field: 'available', headerName: 'Available', width: 110 },
  { field: 'status', headerName: 'Status', width: 140, slotName: 'status' }
])

async function fetchMasters() {
  const [wRes, cRes, iRes] = await Promise.all([
    api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } }),
    api<{ success: true; categories: ApiCategory[] }>('/api/master/categories'),
    api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 200 } })
  ])
  warehouses.value = (wRes as any).warehouses || []
  categories.value = (cRes as any).categories || []
  items.value = (iRes as any).items || []
}

async function fetchSummaries() {
  loading.value = true
  try {
    const res = await api<{ success: true; summaries: ApiSummary[]; total: number }>('/api/inventory/summary', {
      query: {
        warehouseId: filterWarehouseId.value || undefined,
        categoryId: filterCategoryId.value || undefined,
        itemId: filterItemId.value || undefined,
        search: searchQuery.value || undefined,
        lowStock: filterStock.value === 'LOW' ? 'true' : undefined,
        page: 1,
        limit: 200
      }
    })
    summaries.value = (res as any).summaries || []
    totalSkus.value = (res as any).total || 0

    const lowRes = await api<{ success: true; total: number }>('/api/inventory/summary', {
      query: {
        warehouseId: filterWarehouseId.value || undefined,
        categoryId: filterCategoryId.value || undefined,
        itemId: filterItemId.value || undefined,
        search: searchQuery.value || undefined,
        lowStock: 'true',
        page: 1,
        limit: 1
      }
    })
    lowStockSkus.value = (lowRes as any).total || 0
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

let t: any = null
watch([searchQuery, filterWarehouseId, filterCategoryId, filterItemId, filterStock], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchSummaries(), 300)
})

onMounted(async () => {
  try {
    await fetchMasters()
    await fetchSummaries()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
