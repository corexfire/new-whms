<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Buat Purchase Order Baru</h1>
        <p class="text-sm text-slate-500 mt-1">Dokumen pembelian resmi yang dikirim kepada supplier.</p>
      </div>
      <div class="flex gap-2">
        <Button label="Simpan Draft" severity="secondary" outlined @click="saveDraft" :loading="saving" />
        <Button label="Submit" icon="pi pi-send" @click="submitPO" :loading="submitting" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Form -->
      <div class="lg:col-span-2 space-y-6">

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-base font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informasi PO</h2>
          <div class="grid grid-cols-2 gap-4">
            <UiInput label="No. PO" v-model="form.poNumber" placeholder="Auto-generated" :disabled="true" class="col-span-1" />
            <UiDatePicker label="Tanggal PO" v-model="form.orderDate" class="col-span-1" required />
            <UiSelect
              label="Supplier"
              v-model="form.supplierId"
              :options="suppliers"
              optionLabel="name"
              optionValue="id"
              placeholder="Pilih supplier"
              required
              class="col-span-2"
            />
            <UiDatePicker label="Est. Tanggal Tiba" v-model="form.expectedDate" class="col-span-1" />
          </div>
        </div>

        <!-- Line Items -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-800">Daftar Barang yang Dipesan</h3>
            <Button icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine" />
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[260px]">Item</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">Harga Satuan</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-44">Subtotal</th>
                  <th class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in form.items" :key="line._key" class="hover:bg-slate-50/50">
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
                    <InputNumber v-model="line.quantity" :min="1" class="w-full" />
                  </td>
                  <td class="px-3 py-2">
                    <UiCurrencyInput v-model="line.unitPrice" />
                  </td>
                  <td class="px-3 py-2 text-right font-semibold text-slate-800">
                    {{ formatIdr(line.quantity * line.unitPrice) }}
                  </td>
                  <td class="px-3 py-2 text-center">
                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeLine(idx)" :disabled="form.items.length === 1" />
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-50 border-t-2 border-slate-200">
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
          <h2 class="text-sm font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">Ringkasan PO</h2>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between text-slate-600">
              <span>Subtotal ({{ form.items.length }} item)</span>
              <span class="font-semibold">{{ formatIdr(totalAmount) }}</span>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100">
            <p class="text-xs text-slate-400 leading-relaxed">
              Draft akan dibuat dengan status <b>DRAFT</b>. Submit akan mengubah status menjadi <b>PENDING_APPROVAL</b>.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INBOUND_STAFF'] })

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const router = useRouter()
const toast = useToast()
const { api } = useApi()
const saving = ref(false)
const submitting = ref(false)

type ApiSupplier = { id: string; code: string; name: string }
type ApiItemUom = { conversionRate: number; price: number; uom: { code: string } }
type ApiItem = { id: string; sku: string; name: string; uoms: ApiItemUom[] }

const suppliers = ref<ApiSupplier[]>([])
const items = ref<ApiItem[]>([])

const itemOptions = computed(() => {
  return items.value.map((i) => ({ id: i.id, label: `${i.sku} — ${i.name}` }))
})

const form = ref({
  items: [
    { _key: String(Date.now()), itemId: '', quantity: 1, unitPrice: 0 }
  ],
  poNumber: '',
  orderDate: new Date(),
  supplierId: '',
  expectedDate: undefined as Date | undefined
})

const totalAmount = computed(() => form.value.items.reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unitPrice)), 0))

function formatIdr(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  const [supRes, itemRes] = await Promise.all([
    api<{ success: true; suppliers: ApiSupplier[] }>('/api/partners/suppliers', { query: { page: 1, limit: 200 } }),
    api<{ success: true; items: ApiItem[] }>('/api/items', { query: { page: 1, limit: 200 } })
  ])
  suppliers.value = supRes.suppliers
  items.value = itemRes.items
  if (!form.value.supplierId && suppliers.value.length) form.value.supplierId = suppliers.value[0].id
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

async function saveDraft() {
  if (!form.value.supplierId) return toast.error('Pilih supplier terlebih dahulu.')
  const invalid = form.value.items.some(l => !l.itemId || l.quantity <= 0 || l.unitPrice < 0)
  if (invalid) return toast.error('Periksa item: wajib pilih item, qty > 0, harga valid.')

  saving.value = true
  try {
    const res = await api<{ success: true; po: any }>('/api/purchase-orders', {
      method: 'POST',
      body: {
        supplierId: form.value.supplierId,
        orderDate: form.value.orderDate,
        expectedDate: form.value.expectedDate || undefined,
        items: form.value.items.map(l => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
      }
    })
    toast.success('PO draft dibuat.')
    router.push(`/inbound/purchase-orders/${res.po.id}`)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function submitPO() {
  if (!form.value.supplierId) return toast.error('Pilih supplier terlebih dahulu.')
  const invalid = form.value.items.some(l => !l.itemId || l.quantity <= 0 || l.unitPrice < 0)
  if (invalid) return toast.error('Periksa item: wajib pilih item, qty > 0, harga valid.')

  submitting.value = true
  try {
    const res = await api<{ success: true; po: any }>('/api/purchase-orders', {
      method: 'POST',
      body: {
        supplierId: form.value.supplierId,
        orderDate: form.value.orderDate,
        expectedDate: form.value.expectedDate || undefined,
        items: form.value.items.map(l => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
      }
    })
    await api(`/api/purchase-orders/${res.po.id}/status`, { method: 'PUT', body: { status: 'PENDING_APPROVAL' } })
    toast.success('PO submitted.')
    router.push(`/inbound/purchase-orders/${res.po.id}`)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
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
