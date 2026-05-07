<template>
  <div class="p-6">
    <UiDataTable
      title="Pick Lists"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari PL / SO / Customer..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button icon="pi pi-plus" label="Buat Pick List" size="small" @click="openCreate()" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #progress="{ data }">
        <div class="flex items-center gap-2 min-w-[160px]">
          <div class="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full" :class="data.progressPct === 100 ? 'bg-emerald-500' : data.progressPct > 0 ? 'bg-primary-500' : 'bg-slate-400'" :style="{ width: `${data.progressPct}%` }" />
          </div>
          <div class="text-xs font-semibold text-slate-700">{{ data.progressPct }}%</div>
        </div>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="router.push(`/outbound/pick-list/${data.id}`)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showCreate" title="Buat Pick List dari Sales Order" width="50vw" :loading="creating">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiSelect
          label="Sales Order (APPROVED/PICKING)"
          v-model="createForm.salesOrderId"
          :options="salesOrderOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Pilih SO"
          class="md:col-span-2"
          :loading="loadingSo"
          required
        />
        <UiSelect
          label="Assign Picker (optional)"
          v-model="createForm.assignedTo"
          :options="pickerOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Unassigned"
          :loading="loadingPickers"
        />
        <div class="flex items-end">
          <Button
            label="Generate"
            icon="pi pi-check"
            class="w-full"
            :disabled="!createForm.salesOrderId"
            :loading="creating"
            @click="createPickList()"
          />
        </div>
      </div>
    </UiModal>

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

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'OUTBOUND_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
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
  { label: 'NEW', value: 'NEW' },
  { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
  { label: 'COMPLETED', value: 'COMPLETED' }
])

type ApiCustomer = { id: string; code: string; name: string }
type ApiSalesOrder = { id: string; soNumber: string; status: string; customer: ApiCustomer }
type ApiPickListItem = { id: string; quantity: number; pickedQty: number }
type ApiPickList = { id: string; pickNumber: string; status: string; assignedTo?: string | null; createdAt: string; salesOrder: ApiSalesOrder; items: ApiPickListItem[] }
type ApiUser = { id: string; name: string; email: string }

const pickLists = ref<ApiPickList[]>([])
const loading = ref(false)

const rows = computed(() => {
  return pickLists.value.map((pl) => {
    const totalLines = pl.items?.length || 0
    const pickedLines = (pl.items || []).filter((i) => (i.pickedQty || 0) >= (i.quantity || 0)).length
    const pct = totalLines > 0 ? Math.round((pickedLines / totalLines) * 100) : 0
    return {
      id: pl.id,
      pickNumber: pl.pickNumber,
      soNumber: pl.salesOrder?.soNumber || '-',
      customer: pl.salesOrder?.customer?.name || '-',
      assignedTo: pl.assignedTo || 'Unassigned',
      totalLines,
      pickedLines,
      progressPct: pct,
      status: pl.status,
      createdAt: formatDateTime(pl.createdAt)
    }
  })
})

function formatDateTime(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function statusChipClass(status: string) {
  if (status === 'NEW') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function clearFilters() {
  filterStatus.value = 'ALL'
}

async function fetchPickLists() {
  loading.value = true
  try {
    const res = await api<{ success: true; pickLists: ApiPickList[] }>('/api/pick-lists', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        page: 1,
        limit: 200
      }
    })
    pickLists.value = (res as any).pickLists || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

const showCreate = ref(false)
const creating = ref(false)
const loadingSo = ref(false)
const loadingPickers = ref(false)
const salesOrders = ref<ApiSalesOrder[]>([])
const pickers = ref<ApiUser[]>([])

const createForm = ref<{ salesOrderId: string; assignedTo: string | null }>({ salesOrderId: '', assignedTo: null })

const salesOrderOptions = computed(() =>
  salesOrders.value.map((o) => ({
    value: o.id,
    label: `${o.soNumber} - ${o.customer?.name || '-'} (${o.status})`
  }))
)

type Option = { value: string | null; label: string }
const pickerOptions = computed<Option[]>(() => {
  const opts: Option[] = [
    { value: null, label: 'Unassigned' },
    ...pickers.value.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
  ]
  return opts
})

async function fetchSalesOrders() {
  loadingSo.value = true
  try {
    const res = await api<{ success: true; orders: ApiSalesOrder[] }>('/api/sales-orders', {
      query: { status: 'APPROVED', page: 1, limit: 200 }
    })
    const approved = (res as any).orders || []
    salesOrders.value = approved
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingSo.value = false
  }
}

async function fetchPickers() {
  loadingPickers.value = true
  try {
    const res = await api<{ success: true; users: ApiUser[] }>('/api/users', { query: { page: 1, limit: 200 } })
    pickers.value = (res as any).users || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingPickers.value = false
  }
}

async function openCreate() {
  showCreate.value = true
  createForm.value = { salesOrderId: '', assignedTo: null }
  await Promise.all([fetchSalesOrders(), fetchPickers()])
}

async function createPickList() {
  if (!createForm.value.salesOrderId) return
  creating.value = true
  try {
    const allocRes = await api<{ success: true; allocations: any[] }>('/api/pick-lists/auto-allocate', {
      method: 'POST',
      body: { salesOrderId: createForm.value.salesOrderId }
    })
    const allocations = (allocRes as any).allocations || []
    if (allocations.length === 0) {
      toast.error('Tidak ada allocation yang bisa dibuat (stok mungkin kosong).')
      return
    }

    const plRes = await api<{ success: true; pickList: ApiPickList }>('/api/pick-lists/create-with-allocation', {
      method: 'POST',
      body: { salesOrderId: createForm.value.salesOrderId, allocations, assignedTo: createForm.value.assignedTo || undefined }
    })
    toast.success(`Pick List dibuat: ${(plRes as any).pickList?.pickNumber || ''}`)
    showCreate.value = false
    await fetchPickLists()
    const id = (plRes as any).pickList?.id
    if (id) router.push(`/outbound/pick-list/${id}`)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    creating.value = false
  }
}

const columns = ref([
  { field: 'pickNumber', headerName: 'Pick List #', width: 160 },
  { field: 'soNumber', headerName: 'Ref. SO', width: 170 },
  { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 220 },
  { field: 'assignedTo', headerName: 'Picker', width: 180 },
  { field: 'progressPct', headerName: 'Progress', width: 200, slotName: 'progress' },
  { field: 'status', headerName: 'Status', width: 140, slotName: 'status' },
  { field: 'createdAt', headerName: 'Created', width: 160 },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

let t: any = null
watch([filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchPickLists(), 200)
})

onMounted(fetchPickLists)
</script>
