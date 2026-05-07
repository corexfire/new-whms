<template>
  <div class="p-6">
    <UiDataTable
      title="Goods Receipt Notes (GRN)"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari No. GRN / PO / Supplier..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button class="whitespace-nowrap" icon="pi pi-plus" label="Buat GRN dari PO" size="small" @click="router.push('/inbound/grn/new')" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="router.push(`/inbound/grn/${data.id}`)" />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-trash"
            @click="deleteGrn(data.id)"
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

type ApiSupplier = { id: string; code: string; name: string }
type ApiPurchaseOrder = { id: string; poNumber: string; supplier: ApiSupplier }
type ApiGRNItem = { id: string }
type ApiGRN = {
  id: string
  grnNumber: string
  purchaseOrderId: string
  purchaseOrder: ApiPurchaseOrder
  receiptDate: string
  status: 'DRAFT' | 'COMPLETED' | 'VOIDED'
  notes?: string | null
  items: ApiGRNItem[]
}

const searchQuery = ref('')
const filterStatus = ref<'ALL' | ApiGRN['status']>('ALL')
const showFilterDialog = ref(false)
const statusOptions = ref<Array<{ label: string; value: 'ALL' | ApiGRN['status'] }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'COMPLETED', value: 'COMPLETED' },
  { label: 'VOIDED', value: 'VOIDED' }
])

const grns = ref<ApiGRN[]>([])
const loading = ref(false)

const rows = computed(() => {
  return grns.value.map((g) => ({
    id: g.id,
    grnNumber: g.grnNumber,
    poNumber: g.purchaseOrder?.poNumber || '-',
    supplier: g.purchaseOrder?.supplier?.name || '-',
    receiptDate: formatDate(g.receiptDate),
    itemsCount: g.items?.length || 0,
    status: g.status
  }))
})

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'VOIDED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function clearFilters() {
  filterStatus.value = 'ALL'
}

async function fetchGrns() {
  loading.value = true
  try {
    const res = await api<{ success: true; grns: ApiGRN[] }>('/api/goods-receipts', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        page: 1,
        limit: 200
      }
    })
    grns.value = (res as any).grns || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function deleteGrn(id: string) {
  const ok = window.confirm('Hapus GRN ini? (hanya boleh jika masih DRAFT)')
  if (!ok) return
  try {
    await api(`/api/goods-receipts/${id}`, { method: 'DELETE' })
    toast.success('GRN dihapus.')
    await fetchGrns()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

let t: any = null
watch([filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchGrns(), 200)
})

onMounted(fetchGrns)

const columns = ref([
  { field: 'grnNumber', headerName: 'No. GRN', width: 160 },
  { field: 'poNumber', headerName: 'Ref. PO', width: 160 },
  { field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 200 },
  { field: 'receiptDate', headerName: 'Tgl. Terima', width: 120 },
  { field: 'itemsCount', headerName: 'Jml. Item', width: 100, type: 'numericColumn' },
  { field: 'status', headerName: 'Status', width: 140, slotName: 'status' },
  { field: 'actions', headerName: '', slotName: 'actions' }
])
</script>
