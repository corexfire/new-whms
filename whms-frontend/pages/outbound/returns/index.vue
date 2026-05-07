<template>
  <div class="p-6">
    <UiDataTable
      title="Customer Returns"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari No. Retur / Customer..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button icon="pi pi-plus" label="Buat Retur Customer" size="small" @click="openCreate()" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openView(data.id)" />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            icon="pi pi-send"
            @click="submitReturn(data.id)"
          />
          <Button
            v-if="data.status === 'SUBMITTED'"
            text
            rounded
            size="small"
            severity="success"
            icon="pi pi-check"
            @click="openComplete(data.id)"
          />
          <Button
            v-if="data.status !== 'COMPLETED' && data.status !== 'CANCELLED'"
            text
            rounded
            size="small"
            severity="warning"
            icon="pi pi-ban"
            @click="cancelReturn(data.id)"
          />
          <Button
            v-if="data.status === 'DRAFT'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-trash"
            @click="deleteReturn(data.id)"
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

    <UiModal v-model="showDialog" :title="dialogTitle" width="70vw" :loading="saving">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiSelect
            label="Customer"
            v-model="form.customerId"
            :options="customerOptions"
            optionLabel="label"
            optionValue="id"
            required
            :disabled="mode === 'view' || (mode === 'edit' && form.status !== 'DRAFT')"
          />
          <UiSelect
            label="Referensi SO (optional)"
            v-model="form.salesOrderId"
            :options="soOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="(Optional)"
            :disabled="mode === 'view' || (mode === 'edit' && form.status !== 'DRAFT')"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alasan Retur</label>
          <Textarea
            v-model="form.reason"
            rows="2"
            class="w-full bg-slate-50"
            placeholder="Contoh: barang rusak, salah kirim, dll."
            :disabled="mode === 'view' || (mode === 'edit' && form.status !== 'DRAFT')"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Catatan</label>
          <Textarea v-model="form.notes" rows="2" class="w-full bg-slate-50" placeholder="Catatan tambahan..." :disabled="mode === 'view' || (mode === 'edit' && form.status !== 'DRAFT')" />
        </div>

        <div class="bg-white rounded-xl border border-slate-200">
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Barang yang Diretur</h3>
            <Button v-if="mode !== 'view' && form.status === 'DRAFT'" icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine()" />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[280px]">Item</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Lot</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">Catatan</th>
                  <th class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in form.items" :key="line._key" class="hover:bg-slate-50/50">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-if="mode !== 'view' && form.status === 'DRAFT'"
                      v-model="line.itemId"
                      :options="itemOptions"
                      optionLabel="label"
                      optionValue="id"
                      placeholder="Pilih item"
                      class="w-full"
                    />
                    <div v-else class="font-medium text-slate-800">{{ itemLabel(line.itemId) }}</div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-if="mode !== 'view' && form.status === 'DRAFT'" v-model="line.quantity" :min="0" size="small" class="w-full text-right" />
                    <div v-else class="font-medium">{{ line.quantity }}</div>
                  </td>
                  <td class="px-3 py-2">
                    <InputText v-if="mode !== 'view' && form.status === 'DRAFT'" v-model="line.lotNumber" size="small" class="w-full" placeholder="-" />
                    <div v-else class="text-slate-700">{{ line.lotNumber || '-' }}</div>
                  </td>
                  <td class="px-3 py-2">
                    <InputText v-if="mode !== 'view' && form.status === 'DRAFT'" v-model="line.notes" size="small" class="w-full" placeholder="-" />
                    <div v-else class="text-slate-700">{{ line.notes || '-' }}</div>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <Button
                      v-if="mode !== 'view' && form.status === 'DRAFT'"
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
        <Button v-if="mode !== 'view' && form.status === 'DRAFT'" label="Simpan Draft" icon="pi pi-save" severity="secondary" outlined :loading="saving" @click="saveDraft(false)" />
        <Button v-if="mode !== 'view' && form.status === 'DRAFT'" label="Simpan & Submit" icon="pi pi-send" :loading="saving" @click="saveDraft(true)" />
      </template>
    </UiModal>

    <UiModal v-model="showCompleteDialog" title="Complete Retur Customer" width="40vw" :loading="saving">
      <div class="space-y-3">
        <p class="text-sm text-slate-600">Pilih lokasi penerimaan retur (stok akan bertambah di lokasi ini).</p>
        <UiSelect
          label="Lokasi"
          v-model="completeLocationId"
          :options="locationOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Pilih lokasi"
          required
        />
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showCompleteDialog = false" />
        <Button label="Complete" icon="pi pi-check" severity="success" :loading="saving" @click="completeReturn()" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'OUTBOUND_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()
const showDialog = ref(false)
const showCompleteDialog = ref(false)
const saving = ref(false)

type ApiCustomer = { id: string; code: string; name: string }
type ApiItem = { id: string; sku: string; name: string }
type ApiReturnItem = { id: string; itemId: string; item: ApiItem; quantity: number; lotNumber?: string | null; notes?: string | null }
type ApiReturn = {
  id: string
  returnNumber: string
  customerId: string
  customer: ApiCustomer
  salesOrderId?: string | null
  salesOrder?: { id: string; soNumber: string } | null
  reason: string
  notes?: string | null
  status: string
  createdAt: string
  items: ApiReturnItem[]
}
type ApiLocation = { id: string; code: string; warehouse: { id: string; code: string; name: string } }
type ApiSalesOrder = { id: string; soNumber: string; customer: ApiCustomer }

const searchQuery = ref('')
const filterStatus = ref<string>('ALL')
const showFilterDialog = ref(false)
const statusOptions = ref<Array<{ label: string; value: string }>>([
  { label: 'All', value: 'ALL' },
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'SUBMITTED', value: 'SUBMITTED' },
  { label: 'COMPLETED', value: 'COMPLETED' },
  { label: 'CANCELLED', value: 'CANCELLED' }
])

const returns = ref<ApiReturn[]>([])
const customers = ref<ApiCustomer[]>([])
const items = ref<ApiItem[]>([])
const locations = ref<ApiLocation[]>([])
const salesOrders = ref<ApiSalesOrder[]>([])

const mode = ref<'create' | 'edit' | 'view'>('create')
const removedItemIds = ref<string[]>([])

type FormLine = { id?: string; _key: string; itemId: string; quantity: number; lotNumber?: string; notes?: string }
const form = ref<{ id?: string; customerId: string; salesOrderId: string | null; reason: string; notes: string; status: string; items: FormLine[] }>({
  customerId: '',
  salesOrderId: null,
  reason: '',
  notes: '',
  status: 'DRAFT',
  items: [{ _key: String(Date.now()), itemId: '', quantity: 1, lotNumber: '', notes: '' }]
})

const completeReturnId = ref<string>('')
const completeLocationId = ref<string>('')

const customerOptions = computed(() => customers.value.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` })))
const itemOptions = computed(() => items.value.map((i) => ({ id: i.id, label: `${i.sku} — ${i.name}` })))
const locationOptions = computed(() => locations.value.map((l) => ({ value: l.id, label: `${l.warehouse?.code || ''} - ${l.warehouse?.name || ''} / ${l.code}` })))
type Option = { value: string | null; label: string }
const soOptions = computed<Option[]>(() => {
  const opts: Option[] = [
    { value: null, label: '(Optional)' },
    ...salesOrders.value.map((s) => ({ value: s.id, label: `${s.soNumber} - ${s.customer?.name || '-'}` })),
  ]
  return opts
})

const dialogTitle = computed(() => {
  if (mode.value === 'create') return 'Buat Retur Customer'
  if (mode.value === 'edit') return `Edit Retur — ${form.value.id || ''}`
  return `Detail Retur — ${form.value.id || ''}`
})

const rows = computed(() => {
  return returns.value.map((r) => ({
    id: r.id,
    returnNumber: r.returnNumber,
    customer: r.customer?.name || '-',
    soNumber: r.salesOrder?.soNumber || '-',
    date: formatDate(r.createdAt),
    qty: (r.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0),
    reason: r.reason,
    status: r.status
  }))
})

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'SUBMITTED') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function clearFilters() {
  filterStatus.value = 'ALL'
}

function resetForm() {
  removedItemIds.value = []
  form.value = {
    customerId: customers.value[0]?.id || '',
    salesOrderId: null,
    reason: '',
    notes: '',
    status: 'DRAFT',
    items: [{ _key: String(Date.now()), itemId: '', quantity: 1, lotNumber: '', notes: '' }]
  }
}

function addLine() {
  form.value.items.push({ _key: String(Date.now() + Math.random()), itemId: '', quantity: 1, lotNumber: '', notes: '' })
}

function removeLine(idx: number) {
  if (form.value.items.length <= 1) return
  const line = form.value.items[idx]
  if (line?.id) removedItemIds.value.push(line.id)
  form.value.items.splice(idx, 1)
}

function itemLabel(itemId: string) {
  const it = items.value.find((i) => i.id === itemId)
  return it ? `${it.sku} — ${it.name}` : '-'
}

async function fetchMasters() {
  const [custRes, itemRes, locRes, soRes] = await Promise.all([
    api<{ success: true; customers: ApiCustomer[] }>('/api/partners/customers', { query: { page: 1, limit: 200 } }),
    api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 200 } }),
    api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', { query: { page: 1, limit: 200 } }),
    api<{ success: true; orders: ApiSalesOrder[] }>('/api/sales-orders', { query: { page: 1, limit: 200 } })
  ])
  customers.value = (custRes as any).customers || []
  items.value = (itemRes as any).items || []
  locations.value = (locRes as any).locations || []
  salesOrders.value = (soRes as any).orders || []
  if (!form.value.customerId && customers.value.length) form.value.customerId = customers.value[0].id
  if (!completeLocationId.value && locations.value.length) completeLocationId.value = locations.value[0].id
}

async function fetchReturns() {
  try {
    const res = await api<{ success: true; returns: ApiReturn[] }>('/api/customer-returns', {
      query: { status: filterStatus.value === 'ALL' ? undefined : filterStatus.value, page: 1, limit: 200 }
    })
    returns.value = (res as any).returns || []
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function openCreate() {
  mode.value = 'create'
  resetForm()
  showDialog.value = true
}

async function openView(id: string) {
  try {
    const res = await api<{ success: true; return: ApiReturn }>(`/api/customer-returns/${id}`)
    const ret = (res as any).return as ApiReturn
    mode.value = ret.status === 'DRAFT' ? 'edit' : 'view'
    removedItemIds.value = []
    form.value = {
      id: ret.id,
      customerId: ret.customerId,
      salesOrderId: ret.salesOrderId || null,
      reason: ret.reason,
      notes: ret.notes || '',
      status: ret.status,
      items: (ret.items || []).map((it) => ({
        id: it.id,
        _key: it.id,
        itemId: it.itemId,
        quantity: Number(it.quantity || 0),
        lotNumber: it.lotNumber || '',
        notes: it.notes || ''
      }))
    }
    showDialog.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function validateForm() {
  if (!form.value.customerId) return 'Pilih customer.'
  if (!form.value.reason?.trim()) return 'Isi alasan retur.'
  const validLines = form.value.items.filter((l) => l.itemId && Number(l.quantity) > 0)
  if (validLines.length === 0) return 'Tambahkan minimal 1 item dengan qty > 0.'
  return ''
}

async function saveDraft(submitAfter: boolean) {
  const msg = validateForm()
  if (msg) return toast.error(msg)

  saving.value = true
  try {
    const payloadItems = form.value.items
      .filter((l) => l.itemId && Number(l.quantity) > 0)
      .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity || 0), lotNumber: l.lotNumber || undefined, notes: l.notes || undefined }))

    if (!form.value.id) {
      const created = await api<{ success: true; return: ApiReturn }>('/api/customer-returns', {
        method: 'POST',
        body: {
          customerId: form.value.customerId,
          salesOrderId: form.value.salesOrderId || undefined,
          reason: form.value.reason,
          notes: form.value.notes || undefined,
          items: payloadItems
        }
      })
      const ret = (created as any).return as ApiReturn
      form.value.id = ret.id
      form.value.status = ret.status
      form.value.items = (ret.items || []).map((it) => ({
        id: it.id,
        _key: it.id,
        itemId: it.itemId,
        quantity: Number(it.quantity || 0),
        lotNumber: it.lotNumber || '',
        notes: it.notes || ''
      }))
      mode.value = 'edit'
    } else {
      await api(`/api/customer-returns/${form.value.id}`, {
        method: 'PUT',
        body: { customerId: form.value.customerId, salesOrderId: form.value.salesOrderId || null, reason: form.value.reason, notes: form.value.notes || null }
      })

      for (const itemId of removedItemIds.value) {
        await api(`/api/customer-returns/items/${itemId}`, { method: 'DELETE' })
      }
      removedItemIds.value = []

      for (const line of form.value.items) {
        if (!line.itemId || Number(line.quantity) <= 0) continue
        if (line.id) {
          await api(`/api/customer-returns/items/${line.id}`, {
            method: 'PUT',
            body: { quantity: Number(line.quantity || 0), lotNumber: line.lotNumber || null, notes: line.notes || null }
          })
        } else {
          const createdItem = await api<{ success: true; item: ApiReturnItem }>(`/api/customer-returns/${form.value.id}/items`, {
            method: 'POST',
            body: { itemId: line.itemId, quantity: Number(line.quantity || 0), lotNumber: line.lotNumber || undefined, notes: line.notes || undefined }
          })
          line.id = (createdItem as any).item?.id
          line._key = line.id || line._key
        }
      }
    }

    if (submitAfter && form.value.id) {
      await api(`/api/customer-returns/${form.value.id}/submit`, { method: 'POST' })
      toast.success('Retur berhasil disubmit.')
      showDialog.value = false
      await fetchReturns()
      return
    }

    toast.success('Retur draft tersimpan.')
    showDialog.value = false
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function submitReturn(id: string) {
  const ok = window.confirm('Submit retur ini?')
  if (!ok) return
  try {
    await api(`/api/customer-returns/${id}/submit`, { method: 'POST' })
    toast.success('Retur disubmit.')
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function openComplete(id: string) {
  completeReturnId.value = id
  if (!completeLocationId.value && locations.value.length) completeLocationId.value = locations.value[0].id
  showCompleteDialog.value = true
}

async function completeReturn() {
  if (!completeReturnId.value) return
  if (!completeLocationId.value) return toast.error('Pilih lokasi.')
  const ok = window.confirm('Complete retur ini? Stok akan bertambah di lokasi yang dipilih.')
  if (!ok) return

  saving.value = true
  try {
    await api(`/api/customer-returns/${completeReturnId.value}/complete`, { method: 'POST', body: { locationId: completeLocationId.value } })
    toast.success('Retur completed.')
    showCompleteDialog.value = false
    completeReturnId.value = ''
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function cancelReturn(id: string) {
  const reason = window.prompt('Alasan cancel retur?')
  if (!reason) return
  try {
    await api(`/api/customer-returns/${id}/cancel`, { method: 'POST', body: { reason } })
    toast.success('Retur dibatalkan.')
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function deleteReturn(id: string) {
  const ok = window.confirm('Hapus retur draft ini?')
  if (!ok) return
  try {
    await api(`/api/customer-returns/${id}`, { method: 'DELETE' })
    toast.success('Retur dihapus.')
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

const columns = ref([
  { field: 'returnNumber', headerName: 'No. Retur', width: 170 },
  { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 220 },
  { field: 'soNumber', headerName: 'Ref. SO', width: 170 },
  { field: 'date', headerName: 'Tgl. Buat', width: 120 },
  { field: 'reason', headerName: 'Alasan', flex: 1, minWidth: 260 },
  { field: 'qty', headerName: 'Total Qty', width: 100, type: 'numericColumn' },
  { field: 'status', headerName: 'Status', width: 140, slotName: 'status' },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

let t: any = null
watch([filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchReturns(), 200)
})

onMounted(async () => {
  try {
    await fetchMasters()
    await fetchReturns()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
