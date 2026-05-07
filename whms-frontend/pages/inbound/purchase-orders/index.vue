<template>
  <div class="p-6">
    <UiDataTable
      title="Purchase Orders"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari No. PO / Supplier..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button class="whitespace-nowrap" icon="pi pi-plus" label="Buat PO Baru" size="small" @click="router.push('/inbound/purchase-orders/new')" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border"
          :class="statusChipClass(data.status)"
        >
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="router.push(`/inbound/purchase-orders/${data.id}`)" />
          <Button
            v-if="data.status === 'PENDING_APPROVAL'"
            text
            rounded
            size="small"
            severity="success"
            icon="pi pi-check"
            @click="approvePo(data.id)"
          />
          <Button
            v-if="data.status !== 'CANCELLED' && data.status !== 'CLOSED'"
            text
            rounded
            size="small"
            severity="warning"
            icon="pi pi-ban"
            @click="cancelPo(data.id)"
          />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-trash"
            @click="deletePo(data.id)"
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

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INBOUND_STAFF'] })

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
  { label: 'PENDING_APPROVAL', value: 'PENDING_APPROVAL' },
  { label: 'APPROVED', value: 'APPROVED' },
  { label: 'PARTIAL', value: 'PARTIAL' },
  { label: 'CLOSED', value: 'CLOSED' },
  { label: 'CANCELLED', value: 'CANCELLED' }
])

type ApiSupplier = { id: string; code: string; name: string }
type ApiPoItem = { id: string; itemId: string; quantity: number; unitPrice: number; totalPrice: number }
type ApiPurchaseOrder = {
  id: string
  poNumber: string
  supplierId: string
  supplier: ApiSupplier
  orderDate: string
  expectedDate?: string | null
  status: string
  totalAmount: number
  items: ApiPoItem[]
}
const orders = ref<ApiPurchaseOrder[]>([])
const loading = ref(false)

const rows = computed(() => {
  return orders.value.map((o) => ({
    id: o.id,
    poNumber: o.poNumber,
    supplier: o.supplier?.name || '-',
    date: formatDate(o.orderDate),
    expected_date: o.expectedDate ? formatDate(o.expectedDate) : '-',
    items_count: o.items?.length || 0,
    total: o.totalAmount || 0,
    status: o.status
  }))
})

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'PENDING_APPROVAL') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'APPROVED') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'PARTIAL') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (status === 'CLOSED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
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
    const res = await api<{ success: true; orders: ApiPurchaseOrder[] }>('/api/purchase-orders', {
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

async function cancelPo(id: string) {
  const ok = window.confirm('Cancel PO ini?')
  if (!ok) return
  try {
    await api(`/api/purchase-orders/${id}/status`, { method: 'PUT', body: { status: 'CANCELLED' } })
    toast.success('PO dibatalkan.')
    await fetchOrders()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function approvePo(id: string) {
  const ok = window.confirm('Approve PO ini?')
  if (!ok) return
  try {
    await api(`/api/purchase-orders/${id}/status`, { method: 'PUT', body: { status: 'APPROVED' } })
    toast.success('PO approved.')
    await fetchOrders()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function deletePo(id: string) {
  const ok = window.confirm('Hapus PO ini? (hanya boleh jika belum ada GRN)')
  if (!ok) return
  try {
    await api(`/api/purchase-orders/${id}`, { method: 'DELETE' })
    toast.success('PO dihapus.')
    await fetchOrders()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

let t: any = null
watch([searchQuery, filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchOrders(), 300)
})

onMounted(fetchOrders)

const columns = ref([
  { field: 'poNumber', headerName: 'No. PO', width: 160 },
  { field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 200 },
  { field: 'date', headerName: 'Tgl. PO', width: 120 },
  { field: 'expected_date', headerName: 'Est. Tiba', width: 120 },
  { field: 'items_count', headerName: 'Jml. Item', width: 100, type: 'numericColumn' },
  { 
    field: 'total', 
    headerName: 'Total Nilai', 
    width: 160, 
    type: 'numericColumn',
    valueFormatter: (p: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.value)
  },
  { 
    field: 'status',
    headerName: 'Status',
    width: 160,
    slotName: 'status'
  },
  { field: 'actions', headerName: '', slotName: 'actions' }
])
</script>
