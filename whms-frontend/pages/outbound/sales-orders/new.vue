<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Buat Sales Order Baru</h1>
        <p class="text-sm text-slate-500 mt-1">Pesanan penjualan yang akan diproses ke picking → packing → shipping.</p>
      </div>
      <div class="flex gap-2">
        <Button label="Simpan Draft" severity="secondary" outlined @click="saveSO('DRAFT')" :loading="saving || submitting" />
        <Button label="Submit & Approve" icon="pi pi-check" @click="saveSO('APPROVED')" :loading="saving || submitting" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-base font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informasi Pesanan</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UiInput label="No. SO" v-model="soNumberPreview" :disabled="true" />
            <UiDatePicker label="Tanggal Order" v-model="form.orderDate" required />
            <UiSelect
              label="Customer"
              v-model="form.customerId"
              :options="customerOptions"
              optionLabel="label"
              optionValue="id"
              required
              class="md:col-span-2"
              :loading="loadingMasters"
            />
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">Daftar Barang Pesanan</h3>
            <Button icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine()" />
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
                  <th class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in form.items" :key="line._key" class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <UiSelect
                      v-model="line.itemId"
                      :options="itemOptions"
                      optionLabel="label"
                      optionValue="id"
                      placeholder="Pilih item"
                      class="w-full"
                      @update:modelValue="onItemChanged(line)"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-model="line.quantity" :min="1" size="small" class="w-full text-right" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-model="line.unitPrice" :min="0" size="small" class="w-full text-right" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-semibold text-slate-800">{{ formatIdr(Number(line.quantity) * Number(line.unitPrice)) }}</span>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeLine(idx)" :disabled="form.items.length === 1" />
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="form.items.length > 0" class="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colspan="4" class="px-3 py-3 text-right text-sm font-bold text-slate-700">TOTAL:</td>
                  <td class="px-3 py-3 text-right text-base font-bold text-primary-700">{{ formatIdr(totalAmount) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- Summary Sidebar -->
      <div class="space-y-5">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 sticky top-4">
          <h2 class="text-sm font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">Ringkasan SO</h2>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between text-slate-600">
              <span>Subtotal ({{ form.items.length }} item)</span>
              <span class="font-semibold">{{ formatIdr(totalAmount) }}</span>
            </div>
            <div class="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
              <span>Total SO</span>
              <span class="text-primary-700">{{ formatIdr(totalAmount) }}</span>
            </div>
          </div>
        </div>

        <div class="bg-blue-50 p-4 rounded-xl border border-blue-200">
          <h3 class="text-xs font-semibold text-blue-800 mb-2">Alur Proses SO</h3>
          <div class="flex flex-col gap-2 text-[11px] text-blue-700">
            <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">1</span> Draft / Approved</div>
            <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">2</span> Generate Pick List</div>
            <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">3</span> Picking → Packing</div>
            <div class="flex items-center gap-2"><span class="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">4</span> Shipping & Delivery</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'OUTBOUND_STAFF'] })

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const router = useRouter()
const toast = useToast()
const { api } = useApi()
const saving = ref(false)
const submitting = ref(false)
const loadingMasters = ref(false)

type ApiCustomer = { id: string; code: string; name: string }
type ApiItemUom = { conversionRate: number; price: number; uom: { code: string } }
type ApiItem = { id: string; sku: string; name: string; uoms: ApiItemUom[] }

const customers = ref<ApiCustomer[]>([])
const items = ref<ApiItem[]>([])

const customerOptions = computed(() => customers.value.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` })))
const itemOptions = computed(() => items.value.map((i) => ({ id: i.id, label: `${i.sku} — ${i.name}` })))

const soNumberPreview = computed(() => 'AUTO')

const form = ref({
  customerId: '',
  orderDate: new Date(),
  items: [
    { _key: String(Date.now()), itemId: '', quantity: 1, unitPrice: 0 }
  ]
})

const totalAmount = computed(() => form.value.items.reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unitPrice)), 0))

function formatIdr(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function addLine() {
  form.value.items.push({ _key: String(Date.now() + Math.random()), itemId: '', quantity: 1, unitPrice: 0 })
}

function removeLine(idx: number) {
  if (form.value.items.length <= 1) return
  form.value.items.splice(idx, 1)
}

function basePriceForItem(itemId: string) {
  const it = items.value.find(i => i.id === itemId)
  if (!it) return 0
  const base = it.uoms?.slice().sort((a, b) => a.conversionRate - b.conversionRate).find(u => u.conversionRate === 1) || it.uoms?.[0]
  return base?.price ?? 0
}

function onItemChanged(line: any) {
  if (!line.itemId) return
  if (!line.unitPrice || line.unitPrice === 0) line.unitPrice = basePriceForItem(line.itemId)
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const [custRes, itemRes] = await Promise.all([
      api<{ success: true; customers: ApiCustomer[] }>('/api/partners/customers', { query: { page: 1, limit: 200 } }),
      api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 200 } })
    ])
    customers.value = (custRes as any).customers || []
    items.value = (itemRes as any).items || []
    if (!form.value.customerId && customers.value.length) form.value.customerId = customers.value[0].id
  } finally {
    loadingMasters.value = false
  }
}

async function saveSO(status: 'DRAFT' | 'APPROVED') {
  if (!form.value.customerId) return toast.error('Pilih customer terlebih dahulu.')
  const invalid = form.value.items.some(l => !l.itemId || l.quantity <= 0 || l.unitPrice < 0)
  if (invalid) return toast.error('Periksa item: wajib pilih item, qty > 0, harga valid.')

  if (status === 'DRAFT') saving.value = true
  else submitting.value = true
  try {
    const res = await api<{ success: true; so: any }>('/api/sales-orders', {
      method: 'POST',
      body: {
        customerId: form.value.customerId,
        orderDate: form.value.orderDate,
        items: form.value.items.map(l => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
      }
    })

    if (status === 'APPROVED') {
      await api(`/api/sales-orders/${res.so.id}/status`, { method: 'PUT', body: { status: 'APPROVED' } })
    }

    toast.success(`Sales Order berhasil ${status === 'APPROVED' ? 'disubmit & disetujui' : 'disimpan sebagai draft'}.`)
    router.push(`/outbound/sales-orders/${res.so.id}`)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    await fetchMasters()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
