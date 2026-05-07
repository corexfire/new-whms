<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
        <div>
          <h1 class="text-xl font-bold text-slate-900">Buat GRN</h1>
          <p class="text-sm text-slate-500">Buat draft GRN dari Purchase Order.</p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button label="Buat Draft" icon="pi pi-check" @click="createDraft()" :loading="saving" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-base font-semibold text-slate-800 mb-4 border-b pb-2">Referensi PO</h2>
          <div class="grid grid-cols-2 gap-4">
            <UiSelect
              label="Purchase Order"
              v-model="poId"
              :options="poOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Pilih PO"
              class="col-span-2"
              :loading="loadingPoList"
              required
            />
            <UiDatePicker label="Tanggal Terima" v-model="receiptDate" required />
            <div class="col-span-2 flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-700">Catatan</label>
              <Textarea v-model="notes" rows="2" class="w-full bg-slate-50" placeholder="Kondisi barang, kendaraan, dsb..." />
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-slate-800">Rincian Barang Masuk</h2>
            <div class="text-xs text-slate-500">
              {{ po?.poNumber || '-' }} · {{ po?.supplier?.name || '-' }}
            </div>
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[240px]">Barang</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Sisa PO</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Diterima</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Lot</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in lines" :key="line.poItemId" class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <div class="font-medium text-slate-800">{{ line.itemName }}</div>
                    <div class="text-xs text-slate-500">{{ line.itemSku }}</div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-medium">{{ line.remainingQty }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber v-model="line.receivedQty" :min="0" :max="line.remainingQty" size="small" class="w-full text-right" />
                  </td>
                  <td class="px-3 py-2">
                    <InputText v-model="line.lotNumber" size="small" class="w-full" placeholder="-" />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-semibold text-slate-800">{{ formatIdr((line.unitPrice || 0) * (line.receivedQty || 0)) }}</span>
                  </td>
                </tr>
                <tr v-if="lines.length === 0">
                  <td colspan="6" class="py-8 text-center text-slate-400 text-sm">
                    Pilih PO untuk memuat item.
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="lines.length > 0" class="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colspan="5" class="px-3 py-3 text-right text-sm font-bold text-slate-700">TOTAL:</td>
                  <td class="px-3 py-3 text-right text-base font-bold text-primary-700">{{ formatIdr(totalAmount) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2">Info Supplier</h3>
          <div class="space-y-2 text-sm text-slate-700">
            <p><span class="text-slate-400 text-xs">Nama:</span><br /><b>{{ po?.supplier?.name || '-' }}</b></p>
            <p><span class="text-slate-400 text-xs">Kode:</span><br />{{ po?.supplier?.code || '-' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INBOUND_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const router = useRouter()
const toast = useToast()
const { api } = useApi()

type ApiSupplier = { id: string; code: string; name: string }
type ApiGRNRef = { id: string; status: 'DRAFT' | 'COMPLETED' | 'VOIDED' }
type ApiPoItem = {
  id: string
  itemId: string
  item: { id: string; sku: string; name: string }
  quantity: number
  unitPrice: number
  totalPrice: number
  grnItems?: Array<{ receivedQty: number; goodsReceipt?: ApiGRNRef }>
}
type ApiPO = { id: string; poNumber: string; status: string; supplier: ApiSupplier; items: ApiPoItem[] }

type Line = {
  poItemId: string
  itemId: string
  itemSku: string
  itemName: string
  remainingQty: number
  receivedQty: number
  unitPrice: number
  lotNumber?: string
}

const poId = ref<string>('')
const po = ref<ApiPO | null>(null)
const poOptions = ref<Array<{ label: string; value: string }>>([])
const loadingPoList = ref(false)
const saving = ref(false)

const receiptDate = ref<Date>(new Date())
const notes = ref('')
const lines = ref<Line[]>([])

const totalAmount = computed(() => lines.value.reduce((sum, l) => sum + (l.unitPrice || 0) * (l.receivedQty || 0), 0))

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchPoList() {
  loadingPoList.value = true
  try {
    const res = await api<{ success: true; orders: Array<{ id: string; poNumber: string; status: string; supplier: ApiSupplier }> }>('/api/purchase-orders', {
      query: { page: 1, limit: 200 }
    })
    const orders = ((res as any).orders || []).filter((o: any) => o.status === 'APPROVED' || o.status === 'PARTIAL')
    poOptions.value = orders.map((o: any) => ({
      value: o.id,
      label: `${o.poNumber} - ${o.supplier?.name || '-'}`
    }))
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingPoList.value = false
  }
}

async function fetchPoDetail(id: string) {
  const res = await api<{ success: true; po: ApiPO }>(`/api/purchase-orders/${id}`)
  const poData = (res as any).po as ApiPO
  po.value = poData

  const nextLines: Line[] = []
  for (const it of poData.items || []) {
    const completedReceived = (it.grnItems || [])
      .filter((gi) => gi.goodsReceipt?.status === 'COMPLETED')
      .reduce((sum, gi) => sum + (gi.receivedQty || 0), 0)

    const remaining = Math.max(0, (it.quantity || 0) - completedReceived)
    if (remaining <= 0) continue

    nextLines.push({
      poItemId: it.id,
      itemId: it.itemId,
      itemSku: it.item?.sku || '',
      itemName: it.item?.name || '-',
      remainingQty: remaining,
      receivedQty: remaining,
      unitPrice: it.unitPrice || 0,
      lotNumber: ''
    })
  }

  lines.value = nextLines
}

async function createDraft() {
  if (!poId.value) return toast.error('Pilih PO.')
  if (lines.value.length === 0) return toast.error('Tidak ada item yang bisa diterima.')

  const items = lines.value
    .filter((l) => Number(l.receivedQty || 0) > 0)
    .map((l) => ({
      poItemId: l.poItemId,
      itemId: l.itemId,
      receivedQty: Number(l.receivedQty || 0),
      lotNumber: l.lotNumber || undefined
    }))

  if (items.length === 0) return toast.error('Isi qty diterima minimal 1 item.')

  saving.value = true
  try {
    const res = await api<{ success: true; grn: { id: string } }>('/api/goods-receipts', {
      method: 'POST',
      body: {
        purchaseOrderId: poId.value,
        receiptDate: receiptDate.value,
        notes: notes.value,
        items
      }
    })
    const id = (res as any).grn?.id
    toast.success('GRN draft berhasil dibuat.')
    router.push(`/inbound/grn/${id}`)
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

watch(poId, async (v) => {
  po.value = null
  lines.value = []
  if (!v) return
  try {
    await fetchPoDetail(v)
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})

onMounted(fetchPoList)
</script>
