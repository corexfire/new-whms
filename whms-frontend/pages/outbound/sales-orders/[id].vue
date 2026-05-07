<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
        <div>
          <h1 class="text-xl font-bold text-slate-900">Detail SO: {{ so?.soNumber || '-' }}</h1>
          <UiBadge :value="so?.status || '-'" />
        </div>
      </div>
      <div class="flex gap-2">
        <Button v-if="so?.status === 'DRAFT'" label="Approve SO" icon="pi pi-check" @click="changeStatus('APPROVED')" :loading="saving" />
        <Button v-if="so?.status === 'APPROVED'" label="Generate Pick List" icon="pi pi-list" severity="warning" @click="generatePickList" :loading="saving" />
        <Button
          v-if="so?.status === 'DRAFT'"
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          outlined
          @click="deleteSo()"
          :loading="saving"
        />
        <Button icon="pi pi-print" severity="secondary" outlined @click="onPrint()" />
      </div>
    </div>

    <div v-if="so" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-5">
        
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2">Informasi Pesanan</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <UiInput label="Customer" :modelValue="so?.customer?.name || '-'" :disabled="true" />
            </div>
            <UiDatePicker label="Tanggal Order" v-model="orderDate" :disabled="so?.status !== 'DRAFT'" />
            <UiInput label="Total" :modelValue="formatIdr(so?.totalAmount || 0)" :disabled="true" />
          </div>
          <div v-if="so?.status === 'DRAFT'" class="mt-4 flex justify-end">
            <Button label="Simpan Perubahan" icon="pi pi-save" severity="secondary" outlined @click="saveHeader()" :loading="saving" />
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">Detail Barang</h3>
            <Button v-if="so?.status === 'DRAFT'" icon="pi pi-plus" label="Tambah Item" text size="small" @click="startAddLine()" />
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[260px]">Item</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Harga</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Subtotal</th>
                  <th v-if="so?.status === 'DRAFT'" class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in lines" :key="line._key" class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <div class="font-medium text-slate-800">{{ line.itemLabel }}</div>
                    <div class="text-xs text-slate-500">{{ line.itemSku }}</div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber
                      v-if="so?.status === 'DRAFT'"
                      v-model="line.quantity"
                      :min="1"
                      size="small"
                      class="w-full text-right"
                    />
                    <span v-else class="font-medium">{{ line.quantity }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber
                      v-if="so?.status === 'DRAFT'"
                      v-model="line.unitPrice"
                      :min="0"
                      size="small"
                      class="w-full text-right"
                    />
                    <span v-else class="text-slate-700">{{ formatIdr(line.unitPrice) }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-semibold text-slate-800">{{ formatIdr(line.quantity * line.unitPrice) }}</span>
                  </td>
                  <td v-if="so?.status === 'DRAFT'" class="px-3 py-2 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <Button icon="pi pi-save" text rounded severity="secondary" size="small" @click="updateLine(line)" :loading="saving" />
                      <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeLine(line)" :loading="saving" />
                    </div>
                  </td>
                </tr>
                <tr v-if="so?.status === 'DRAFT' && addingLine">
                  <td class="px-3 py-2 text-slate-400 text-xs">+</td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-model="newLine.itemId"
                      :options="itemOptions"
                      optionLabel="label"
                      optionValue="id"
                      placeholder="Pilih item"
                      class="w-full"
                      @update:modelValue="onNewItemChanged()"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-model="newLine.quantity" :min="1" size="small" class="w-full text-right" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-model="newLine.unitPrice" :min="0" size="small" class="w-full text-right" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-semibold text-slate-800">{{ formatIdr(Number(newLine.quantity) * Number(newLine.unitPrice)) }}</span>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <Button icon="pi pi-check" text rounded severity="success" size="small" @click="confirmAddLine()" :loading="saving" />
                      <Button icon="pi pi-times" text rounded severity="secondary" size="small" @click="cancelAddLine()" :disabled="saving" />
                    </div>
                  </td>
                </tr>
                <tr v-if="lines.length === 0">
                  <td :colspan="so?.status === 'DRAFT' ? 6 : 5" class="py-8 text-center text-slate-400 text-sm">Tidak ada item.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Pipeline Sidebar -->
      <div class="space-y-5">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-sm font-bold text-slate-700 mb-4">Pipeline Status</h3>
          <div class="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            <div v-for="step in pipeline" :key="step.label" class="flex items-start gap-3 pl-7 relative">
              <div :class="[
                'absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 z-10',
                step.done ? 'bg-emerald-500 border-emerald-500 text-white' :
                step.active ? 'bg-primary-500 border-primary-500 text-white animate-pulse' :
                'bg-white border-slate-300 text-slate-400'
              ]">
                <i v-if="step.done" class="pi pi-check text-[10px]"></i>
                <span v-else>{{ step.idx }}</span>
              </div>
              <div>
                <p :class="['text-xs font-semibold', step.done ? 'text-emerald-700' : step.active ? 'text-primary-700' : 'text-slate-400']">{{ step.label }}</p>
                <p v-if="step.time" class="text-[10px] text-slate-400">{{ step.time }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-sm font-bold text-slate-700 mb-3">Pick Lists</h3>
          <div class="space-y-2">
            <div v-if="(so.pickLists || []).length === 0" class="text-xs text-slate-400">Belum ada pick list.</div>
            <div v-for="pl in (so.pickLists || [])" :key="pl.id" class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-slate-700 truncate">{{ pl.pickNumber }}</div>
                <div class="text-[10px] text-slate-400">Status: {{ pl.status }}</div>
              </div>
              <Button text rounded size="small" icon="pi pi-external-link" @click="router.push(`/outbound/pick-list/${pl.id}`)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'OUTBOUND_STAFF'] })

import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { api } = useApi()
const soId = String(route.params.id || '')
const saving = ref(false)

type ApiCustomer = { id: string; code: string; name: string }
type ApiItem = { id: string; sku: string; name: string; uoms?: Array<{ conversionRate: number; price: number }> }
type ApiSoItem = { id: string; itemId: string; item: ApiItem; quantity: number; unitPrice: number; totalPrice: number }
type ApiPickList = { id: string; pickNumber: string; status: string }
type ApiSalesOrder = {
  id: string
  soNumber: string
  customerId: string
  customer: ApiCustomer
  orderDate: string
  status: string
  totalAmount: number
  items: ApiSoItem[]
  pickLists?: ApiPickList[]
}

const so = ref<ApiSalesOrder | null>(null)
const orderDate = ref<Date>(new Date())

type UiLine = {
  id?: string
  _key: string
  itemId: string
  itemSku: string
  itemLabel: string
  quantity: number
  unitPrice: number
}

const lines = ref<UiLine[]>([])

const pipelineSteps = ['DRAFT', 'APPROVED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED']
const currentIdx = computed(() => pipelineSteps.indexOf(so.value?.status || 'DRAFT'))

const pipeline = computed(() => pipelineSteps.map((label, idx) => ({
  idx: idx + 1,
  label,
  done: idx < currentIdx.value,
  active: idx === currentIdx.value,
  time: ''
})))

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatIdr(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0)
}

type ApiItemMaster = { id: string; sku: string; name: string; uoms?: Array<{ conversionRate: number; price: number; uom?: { code: string } }> }
const items = ref<ApiItemMaster[]>([])
const itemOptions = computed(() => items.value.map((i) => ({ id: i.id, label: `${i.sku} — ${i.name}` })))

const addingLine = ref(false)
const newLine = ref<{ itemId: string; quantity: number; unitPrice: number }>({ itemId: '', quantity: 1, unitPrice: 0 })

function onPrint() {
  if (import.meta.client) window.print()
}

function basePriceForItem(itemId: string) {
  const it = items.value.find((i) => i.id === itemId)
  if (!it) return 0
  const base = it.uoms?.slice().sort((a, b) => (a.conversionRate || 0) - (b.conversionRate || 0)).find(u => u.conversionRate === 1) || it.uoms?.[0]
  return base?.price ?? 0
}

function onNewItemChanged() {
  if (!newLine.value.itemId) return
  if (!newLine.value.unitPrice || newLine.value.unitPrice === 0) newLine.value.unitPrice = basePriceForItem(newLine.value.itemId)
}

async function fetchSo() {
  const res = await api<{ success: true; so: ApiSalesOrder }>(`/api/sales-orders/${soId}`)
  so.value = (res as any).so
  orderDate.value = so.value?.orderDate ? new Date(so.value.orderDate) : new Date()
  lines.value =
    so.value?.items?.map((it) => ({
      id: it.id,
      _key: it.id,
      itemId: it.itemId,
      itemSku: it.item?.sku || '',
      itemLabel: it.item?.name || '-',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0)
    })) || []
}

async function saveHeader() {
  if (!so.value) return
  saving.value = true
  try {
    const res = await api<{ success: true; so: ApiSalesOrder }>(`/api/sales-orders/${so.value.id}`, {
      method: 'PUT',
      body: { orderDate: orderDate.value }
    })
    so.value = (res as any).so
    toast.success('SO tersimpan.')
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function changeStatus(newStatus: string) {
  if (!so.value) return
  saving.value = true
  try {
    await api(`/api/sales-orders/${so.value.id}/status`, { method: 'PUT', body: { status: newStatus } })
    toast.success(`Status SO → ${newStatus}`)
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

function startAddLine() {
  if (!so.value) return
  addingLine.value = true
  newLine.value = { itemId: '', quantity: 1, unitPrice: 0 }
}

function cancelAddLine() {
  addingLine.value = false
  newLine.value = { itemId: '', quantity: 1, unitPrice: 0 }
}

async function confirmAddLine() {
  if (!so.value) return
  if (!newLine.value.itemId) return toast.error('Pilih item terlebih dahulu.')
  if (Number(newLine.value.quantity) <= 0) return toast.error('Qty harus > 0.')

  saving.value = true
  try {
    await api(`/api/sales-orders/${so.value.id}/items`, {
      method: 'POST',
      body: {
        itemId: newLine.value.itemId,
        quantity: Number(newLine.value.quantity || 0),
        unitPrice: Number(newLine.value.unitPrice || 0)
      }
    })
    toast.success('Item ditambahkan.')
    addingLine.value = false
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function updateLine(line: UiLine) {
  if (!line.id) return
  saving.value = true
  try {
    await api(`/api/sales-orders/items/${line.id}`, {
      method: 'PUT',
      body: { quantity: Number(line.quantity || 0), unitPrice: Number(line.unitPrice || 0) }
    })
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function removeLine(line: UiLine) {
  if (!line.id) return
  const ok = window.confirm('Hapus item ini dari SO?')
  if (!ok) return
  saving.value = true
  try {
    await api(`/api/sales-orders/items/${line.id}`, { method: 'DELETE' })
    toast.success('Item dihapus.')
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function generatePickList() {
  if (!so.value) return
  saving.value = true
  try {
    const allocRes = await api<{ success: true; allocations: any[] }>('/api/pick-lists/auto-allocate', {
      method: 'POST',
      body: { salesOrderId: so.value.id }
    })
    const allocations = (allocRes as any).allocations || []
    if (allocations.length === 0) {
      toast.error('Tidak ada allocation yang bisa dibuat (stok mungkin kosong).')
      return
    }

    const plRes = await api<{ success: true; pickList: any }>('/api/pick-lists/create-with-allocation', {
      method: 'POST',
      body: { salesOrderId: so.value.id, allocations }
    })

    toast.success(`Pick List dibuat: ${(plRes as any).pickList?.pickNumber || ''}`)
    await fetchSo()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteSo() {
  if (!so.value) return
  const ok = window.confirm('Hapus SO ini?')
  if (!ok) return
  saving.value = true
  try {
    await api(`/api/sales-orders/${so.value.id}`, { method: 'DELETE' })
    toast.success('SO dihapus.')
    router.push('/outbound/sales-orders')
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      fetchSo(),
      api<{ success: true; items: ApiItemMaster[] }>('/api/items', { query: { page: 1, limit: 200 } }).then((r: any) => {
        items.value = (r as any).items || []
      }),
    ])
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
