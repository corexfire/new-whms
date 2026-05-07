<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
        <div>
          <h1 class="text-xl font-bold text-slate-900">Detail PO: {{ po?.poNumber || id }}</h1>
          <div v-if="po" class="text-xs font-bold px-2 py-0.5 rounded-full border inline-flex"
            :class="statusChipClass(po.status)"
          >
            {{ po.status }}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <Button icon="pi pi-print" label="Cetak PO" severity="secondary" outlined @click="printPO" />
        <Button v-if="po?.status === 'DRAFT'" label="Submit" icon="pi pi-send" @click="setStatus('PENDING_APPROVAL')" />
        <Button v-if="po?.status === 'PENDING_APPROVAL'" label="Approve" icon="pi pi-check" severity="success" @click="setStatus('APPROVED')" />
        <Button v-if="po?.status === 'PENDING_APPROVAL'" label="Reject" icon="pi pi-times" severity="warning" outlined @click="setStatus('CANCELLED')" />
        <Button v-if="po && po.status !== 'CANCELLED' && po.status !== 'CLOSED'" label="Cancel" severity="warning" outlined icon="pi pi-ban" @click="setStatus('CANCELLED')" />
        <Button v-if="po?.status === 'DRAFT'" label="Delete" severity="danger" outlined icon="pi pi-trash" @click="deletePo" />
      </div>
    </div>

    <div v-if="po" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-4 border-b pb-2">
            <h2 class="text-sm font-bold text-slate-700">Informasi Pesanan</h2>
            <Button v-if="po.status === 'DRAFT'" label="Edit" icon="pi pi-pencil" text @click="editMode = !editMode" />
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs text-slate-500 font-medium">Supplier</p>
              <p class="font-semibold text-slate-900 mt-0.5">{{ po.supplier?.name || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Total</p>
              <p class="font-semibold text-slate-900 mt-0.5">{{ formatIdr(po.totalAmount || 0) }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Tanggal PO</p>
              <div v-if="!editMode" class="font-semibold text-slate-900 mt-0.5">{{ formatDate(po.orderDate) }}</div>
              <UiDatePicker v-else v-model="editHeader.orderDate" />
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Estimasi Tiba</p>
              <div v-if="!editMode" class="font-semibold text-slate-900 mt-0.5">{{ po.expectedDate ? formatDate(po.expectedDate) : '-' }}</div>
              <UiDatePicker v-else v-model="editHeader.expectedDate" />
            </div>
          </div>
          <div v-if="editMode" class="mt-4 flex justify-end gap-2">
            <Button label="Cancel" severity="secondary" outlined @click="cancelEdit" />
            <Button label="Save" :loading="saving" @click="saveHeader" />
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-sm font-bold text-slate-700 mb-4">Daftar Barang</h2>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Item</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">Harga</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">Subtotal</th>
                  <th v-if="po.status === 'DRAFT'" class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="li in editLines" :key="li._key" class="hover:bg-slate-50/50">
                  <td class="px-3 py-2">
                    <div v-if="li.id" class="font-medium text-slate-900">
                      {{ li.itemLabel }}
                    </div>
                    <UiSelect
                      v-else
                      v-model="li.itemId"
                      :options="itemOptions"
                      optionLabel="label"
                      optionValue="id"
                      placeholder="Pilih item"
                      class="w-full"
                      @update:modelValue="onNewLineItemChanged(li)"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <div v-if="po.status !== 'DRAFT'" class="font-medium">{{ li.quantity }}</div>
                    <InputNumber v-else v-model="li.quantity" :min="1" class="w-full" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <div v-if="po.status !== 'DRAFT'">{{ formatIdr(li.unitPrice) }}</div>
                    <UiCurrencyInput v-else v-model="li.unitPrice" />
                  </td>
                  <td class="px-3 py-2 text-right font-semibold text-slate-800">{{ formatIdr(li.quantity * li.unitPrice) }}</td>
                  <td v-if="po.status === 'DRAFT'" class="px-3 py-2 text-center">
                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeLine(li)" />
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colspan="3" class="px-3 py-3 text-right text-sm font-bold text-slate-700">TOTAL:</td>
                  <td class="px-3 py-3 text-right text-base font-bold text-primary-700">{{ formatIdr(lineTotal) }}</td>
                  <td v-if="po.status === 'DRAFT'"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div v-if="po.status === 'DRAFT'" class="mt-3 flex items-center justify-between">
            <Button icon="pi pi-plus" label="Tambah Item" text size="small" @click="addEmptyLine" />
            <Button label="Save Items" :loading="savingItems" @click="saveItems" />
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-sm font-bold text-slate-700 mb-4">Penerimaan</h3>
          <div class="space-y-3">
            <div v-for="s in summary" :key="s.itemId" class="flex items-center justify-between text-xs">
              <span class="text-slate-600 truncate flex-1">{{ s.itemName }}</span>
              <span class="font-bold ml-2" :class="s.receivedQty >= s.orderedQty ? 'text-emerald-600' : 'text-amber-600'">
                {{ s.receivedQty }} / {{ s.orderedQty }}
              </span>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <p class="text-xs text-slate-500 mb-1.5">Progress Penerimaan</p>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div class="bg-emerald-500 h-2 rounded-full transition-all" :style="{ width: receivedPct + '%' }"></div>
            </div>
            <p class="text-right text-xs font-bold text-emerald-700 mt-1">{{ receivedPct }}% Diterima</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-slate-500">Loading...</div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INBOUND_STAFF'] })

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { api } = useApi()
const id = route.params.id as string

type ApiSupplier = { id: string; code: string; name: string }
type ApiPoItem = { id: string; itemId: string; quantity: number; unitPrice: number; totalPrice: number; item: { sku: string; name: string } }
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
type ApiSummaryRow = { itemId: string; itemName: string; orderedQty: number; receivedQty: number; remainingQty: number }

type ApiItemUom = { conversionRate: number; price: number; uom: { code: string } }
type ApiItem = { id: string; sku: string; name: string; uoms: ApiItemUom[] }

const po = ref<ApiPurchaseOrder | null>(null)
const summary = ref<ApiSummaryRow[]>([])
const items = ref<ApiItem[]>([])
const saving = ref(false)
const savingItems = ref(false)
const editMode = ref(false)
const editHeader = ref<{ orderDate: Date; expectedDate?: Date }>({ orderDate: new Date() })

type EditLine = { _key: string; id?: string; itemId: string; itemLabel: string; quantity: number; unitPrice: number }
const editLines = ref<EditLine[]>([])

const receivedPct = computed(() => {
  const totalQty = summary.value.reduce((s, i) => s + i.orderedQty, 0)
  const totalRecv = summary.value.reduce((s, i) => s + i.receivedQty, 0)
  if (!totalQty) return 0
  return Math.round((totalRecv / totalQty) * 100)
})

function printPO() {
  window.print()
}

const lineTotal = computed(() => editLines.value.reduce((s, l) => s + (l.quantity * l.unitPrice), 0))

const itemOptions = computed(() => items.value.map((i) => ({ id: i.id, label: `${i.sku} — ${i.name}` })))

function formatIdr(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0)
}

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function statusChipClass(status: string) {
  if (status === 'DRAFT') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'PENDING_APPROVAL') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'APPROVED') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'PARTIAL') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (status === 'CLOSED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchDetail() {
  const [poRes, sumRes, itemRes] = await Promise.all([
    api<{ success: true; po: ApiPurchaseOrder }>(`/api/purchase-orders/${id}`),
    api<{ success: true; summary: ApiSummaryRow[] }>(`/api/purchase-orders/${id}/summary`),
    api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 200 } })
  ])

  po.value = poRes.po
  summary.value = sumRes.summary || []
  items.value = itemRes.items || []

  editHeader.value = {
    orderDate: new Date(po.value.orderDate),
    expectedDate: po.value.expectedDate ? new Date(po.value.expectedDate) : undefined
  }
  editLines.value = (po.value.items || []).map((it) => ({
    _key: it.id,
    id: it.id,
    itemId: it.itemId,
    itemLabel: `${it.item.sku} — ${it.item.name}`,
    quantity: it.quantity,
    unitPrice: it.unitPrice
  }))
}

function cancelEdit() {
  editMode.value = false
  if (!po.value) return
  editHeader.value = {
    orderDate: new Date(po.value.orderDate),
    expectedDate: po.value.expectedDate ? new Date(po.value.expectedDate) : undefined
  }
}

async function saveHeader() {
  saving.value = true
  try {
    await api(`/api/purchase-orders/${id}`, {
      method: 'PUT',
      body: {
        orderDate: editHeader.value.orderDate,
        expectedDate: editHeader.value.expectedDate || undefined
      }
    })
    toast.success('PO updated.')
    editMode.value = false
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

function basePriceForItem(itemId: string) {
  const it = items.value.find(i => i.id === itemId)
  if (!it) return 0
  const base = it.uoms?.slice().sort((a, b) => a.conversionRate - b.conversionRate).find(u => u.conversionRate === 1) || it.uoms?.[0]
  return base?.price ?? 0
}

function onNewLineItemChanged(li: EditLine) {
  if (!li.itemId) return
  if (!li.unitPrice) li.unitPrice = basePriceForItem(li.itemId)
  const it = items.value.find(i => i.id === li.itemId)
  if (it) li.itemLabel = `${it.sku} — ${it.name}`
}

function addEmptyLine() {
  editLines.value.push({ _key: String(Date.now() + Math.random()), itemId: '', itemLabel: '', quantity: 1, unitPrice: 0 })
}

async function removeLine(li: EditLine) {
  if (!po.value) return
  if (!li.id) {
    editLines.value = editLines.value.filter(x => x._key !== li._key)
    return
  }
  const ok = window.confirm('Hapus item ini dari PO?')
  if (!ok) return
  try {
    await api(`/api/purchase-orders/items/${li.id}`, { method: 'DELETE' })
    toast.success('Item dihapus.')
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function saveItems() {
  if (!po.value) return
  const invalid = editLines.value.some(l => !l.itemId || l.quantity <= 0 || l.unitPrice < 0)
  if (invalid) return toast.error('Periksa item: wajib pilih item, qty > 0, harga valid.')

  const original = po.value.items
  const originalById = new Map(original.map(i => [i.id, i]))

  const updates = editLines.value.filter(l => l.id).filter((l) => {
    const o = originalById.get(l.id!)
    if (!o) return false
    return o.quantity !== l.quantity || o.unitPrice !== l.unitPrice
  })
  const creates = editLines.value.filter(l => !l.id)

  savingItems.value = true
  try {
    for (const u of updates) {
      await api(`/api/purchase-orders/items/${u.id}`, { method: 'PUT', body: { quantity: u.quantity, unitPrice: u.unitPrice } })
    }
    for (const c of creates) {
      await api(`/api/purchase-orders/${po.value.id}/items`, { method: 'POST', body: { itemId: c.itemId, quantity: c.quantity, unitPrice: c.unitPrice } })
    }
    toast.success('Items updated.')
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    savingItems.value = false
  }
}

async function setStatus(status: string) {
  if (!po.value) return
  const ok = window.confirm(`Ubah status PO menjadi ${status}?`)
  if (!ok) return
  try {
    await api(`/api/purchase-orders/${po.value.id}/status`, { method: 'PUT', body: { status } })
    toast.success('Status updated.')
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function deletePo() {
  if (!po.value) return
  const ok = window.confirm('Hapus PO ini? (hanya boleh jika belum ada GRN)')
  if (!ok) return
  try {
    await api(`/api/purchase-orders/${po.value.id}`, { method: 'DELETE' })
    toast.success('PO dihapus.')
    router.push('/inbound/purchase-orders')
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

onMounted(async () => {
  try {
    await fetchDetail()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>

<style>
@media print {
  header, aside, nav, .print\:hidden { display: none !important; }
  body { background: white !important; }
}
</style>
