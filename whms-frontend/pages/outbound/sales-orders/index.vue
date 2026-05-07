<template>
  <div class="p-6">
    <UiDataTable
      title="Sales Orders"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari No. SO / Customer..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button icon="pi pi-plus" label="Buat SO Baru" size="small" @click="router.push('/outbound/sales-orders/new')" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="router.push(`/outbound/sales-orders/${data.id}`)" />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-trash"
            @click="deleteSo(data.id)"
          />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showFilterDialog" title="Filters" width="520px">
      <div class="grid grid-cols-1 gap-4">
        <UiSelect
          label="Status"
          v-model="filterStatus"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="All"
        />
      </div>
      <template #footer>
        <Button label="Clear" icon="pi pi-eraser" severity="secondary" outlined @click="clearFilters" />
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showFilterDialog = false" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'OUTBOUND_STAFF'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const router = useRouter()
const toast = useToast()
const { api } = useApi()
const searchQuery = ref('')
const filterStatus = ref<string>('ALL')
const showFilterDialog = ref(false)

const statusOptions = ref<Array<{ label: string; value: string }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'APPROVED', value: 'APPROVED' },
  { label: 'PICKING', value: 'PICKING' },
  { label: 'PACKED', value: 'PACKED' },
  { label: 'SHIPPED', value: 'SHIPPED' },
  { label: 'DELIVERED', value: 'DELIVERED' },
  { label: 'CANCELLED', value: 'CANCELLED' }
])

type ApiCustomer = { id: string; code: string; name: string }
type ApiSoItem = { id: string }
type ApiSalesOrder = {
  id: string
  soNumber: string
  customerId: string
  customer: ApiCustomer
  orderDate: string
  status: string
  totalAmount: number
  items: ApiSoItem[]
}

const orders = ref<ApiSalesOrder[]>([])
const loading = ref(false)

const rows = computed(() => {
  return orders.value.map((o) => ({
    id: o.id,
    soNumber: o.soNumber,
    customer: o.customer?.name || '-',
    date: formatDate(o.orderDate),
    items_count: o.items?.length || 0,
    total: o.totalAmount || 0,
    status: o.status
  }))
})

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'APPROVED') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'PICKING') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (status === 'PACKED') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'SHIPPED') return 'bg-cyan-50 text-cyan-700 border-cyan-200'
  if (status === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function clearFilters() {
  filterStatus.value = 'ALL'
}

async function fetchOrders() {
  loading.value = true
  try {
    const res = await api<{ success: true; orders: ApiSalesOrder[] }>('/api/sales-orders', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        search: searchQuery.value || undefined,
        page: 1,
        limit: 200
      }
    })
    orders.value = (res as any).orders || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function deleteSo(id: string) {
  const ok = window.confirm('Hapus SO ini? (hanya boleh jika belum ada pick list completed)')
  if (!ok) return
  try {
    await api(`/api/sales-orders/${id}`, { method: 'DELETE' })
    toast.success('SO dihapus.')
    await fetchOrders()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

const columns = ref([
  { field: 'soNumber', headerName: 'No. SO', width: 170 },
  { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 200 },
  { field: 'date', headerName: 'Tgl. Order', width: 120 },
  { field: 'items_count', headerName: 'Jml. Item', width: 100, type: 'numericColumn' },
  {
    field: 'total', headerName: 'Total Nilai', width: 160, type: 'numericColumn',
    valueFormatter: (p: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.value)
  },
  {
    field: 'status', headerName: 'Status', width: 140, slotName: 'status'
  },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

let t: any = null
watch([searchQuery, filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchOrders(), 300)
})

onMounted(fetchOrders)
</script>
