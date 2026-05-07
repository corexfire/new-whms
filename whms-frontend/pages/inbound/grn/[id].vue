<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
        <div>
          <h1 class="text-xl font-bold text-slate-900">Goods Receipt Note</h1>
          <p class="text-sm text-slate-500">
            PO: <b>{{ grn?.purchaseOrder?.poNumber || '-' }}</b> · Supplier: <b>{{ grn?.purchaseOrder?.supplier?.name || '-' }}</b>
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button
          v-if="grn?.status === 'DRAFT'"
          label="Simpan Draft"
          severity="secondary"
          outlined
          @click="saveDraft()"
          :loading="saving"
        />
        <Button
          v-if="grn?.status === 'DRAFT'"
          label="Complete GRN"
          icon="pi pi-check"
          @click="complete()"
          :loading="saving"
        />
        <Button
          v-if="grn && grn.status !== 'VOIDED'"
          label="Void"
          severity="danger"
          outlined
          icon="pi pi-ban"
          @click="voidGrn()"
          :loading="saving"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-5">
        
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-base font-semibold text-slate-800 mb-4 border-b pb-2">Detail Penerimaan</h2>
          <div class="grid grid-cols-2 gap-4">
            <UiInput label="No. GRN" :modelValue="grn?.grnNumber || ''" :disabled="true" />
            <UiDatePicker label="Tanggal Terima" v-model="form.receiptDate" required />
            <UiSelect
              label="Lokasi Penerimaan"
              v-model="form.locationId"
              :options="locationOptions"
              optionLabel="label"
              optionValue="value"
              required
              class="col-span-2"
              :disabled="grn?.status !== 'DRAFT'"
            />
            <div class="col-span-2 flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-700">Catatan Penerimaan</label>
              <Textarea
                v-model="form.notes"
                rows="2"
                class="w-full bg-slate-50"
                placeholder="Kondisi barang, kendaraan, dsb..."
                :disabled="grn?.status !== 'DRAFT'"
              />
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
            <i class="pi pi-info-circle text-amber-600"></i>
            <p class="text-xs text-amber-700 font-medium">Isi kolom <b>"Diterima"</b> sesuai kuantitas fisik nyata yang masuk. Bisa berbeda dari jumlah PO (partial receipt diperbolehkan).</p>
          </div>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-sm border-collapse">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[240px]">Barang</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Dipesan</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Diterima</th>
                  <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Lot</th>
                  <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, idx) in form.items" :key="line.id" class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                    <div class="font-medium text-slate-800">{{ line.itemName }}</div>
                    <div class="text-xs text-slate-500">{{ line.itemSku }}</div>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-medium">{{ line.orderedQty }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <InputNumber
                      v-if="grn?.status === 'DRAFT'"
                      v-model="line.receivedQty"
                      :min="0"
                      :max="line.orderedQty"
                      size="small"
                      class="w-full text-right"
                    />
                    <span v-else class="font-bold">{{ line.receivedQty }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <InputText
                      v-if="grn?.status === 'DRAFT'"
                      v-model="line.lotNumber"
                      size="small"
                      class="w-full"
                      placeholder="-"
                    />
                    <span v-else class="text-slate-700">{{ line.lotNumber || '-' }}</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span class="font-semibold text-slate-800">{{ formatIdr((line.unitPrice || 0) * (line.receivedQty || 0)) }}</span>
                  </td>
                </tr>
                <tr v-if="form.items.length === 0">
                  <td colspan="6" class="py-8 text-center text-slate-400 text-sm">Tidak ada item.</td>
                </tr>
              </tbody>
              <tfoot v-if="form.items.length > 0" class="bg-slate-50 border-t-2 border-slate-200">
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
            <p><span class="text-slate-400 text-xs">Nama:</span><br/><b>{{ grn?.purchaseOrder?.supplier?.name || '-' }}</b></p>
            <p><span class="text-slate-400 text-xs">Kode:</span><br/>{{ grn?.purchaseOrder?.supplier?.code || '-' }}</p>
          </div>
        </div>

        <div v-if="hasVariance" class="bg-amber-50 p-5 rounded-xl border border-amber-200">
          <div class="flex items-center gap-2 mb-3">
            <i class="pi pi-exclamation-triangle text-amber-600 text-lg"></i>
            <h3 class="text-sm font-bold text-amber-800">Selisih Penerimaan Terdeteksi</h3>
          </div>
          <p class="text-xs text-amber-700 mb-3">Beberapa barang diterima kurang dari yang dipesan. Staf gudang wajib konfirmasi sebelum posting GRN.</p>
          <div class="space-y-2">
            <div v-for="item in varianceItems" :key="item.id" class="text-xs flex justify-between">
              <span class="text-amber-900 truncate">{{ item.itemName }}</span>
              <span class="text-red-700 font-bold ml-2">-{{ item.orderedQty - (item.receivedQty || 0) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
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
const saving = ref(false)

type ApiSupplier = { id: string; code: string; name: string }
type ApiUom = { id: string; code: string; name: string }
type ApiItemUom = { id: string; conversionRate: number; uom: ApiUom }
type ApiItem = { id: string; sku: string; name: string; uoms?: ApiItemUom[]; trackLot?: boolean }
type ApiPOItem = { id: string; quantity: number; unitPrice: number; totalPrice: number }
type ApiPurchaseOrder = { id: string; poNumber: string; supplier: ApiSupplier }
type ApiGRNItem = { id: string; poItemId: string; poItem: ApiPOItem; itemId: string; item: ApiItem; receivedQty: number; lotNumber?: string | null }
type ApiGRN = {
  id: string
  grnNumber: string
  purchaseOrderId: string
  purchaseOrder: ApiPurchaseOrder
  receiptDate: string
  notes?: string | null
  status: 'DRAFT' | 'COMPLETED' | 'VOIDED'
  items: ApiGRNItem[]
}
type ApiLocation = { id: string; code: string; warehouse: { id: string; code: string; name: string } }

const grn = ref<ApiGRN | null>(null)
const locationOptions = ref<Array<{ label: string; value: string }>>([])

type GrnLine = {
  id: string
  poItemId: string
  itemId: string
  itemSku: string
  itemName: string
  orderedQty: number
  receivedQty: number
  unitPrice: number
  lotNumber?: string
}

const form = ref<{
  receiptDate: Date
  locationId: string
  notes: string
  items: GrnLine[]
}>({
  receiptDate: new Date(),
  locationId: '',
  notes: '',
  items: []
})

const varianceItems = computed(() => form.value.items.filter((i) => (i.receivedQty || 0) < i.orderedQty))
const hasVariance = computed(() => varianceItems.value.length > 0)
const totalAmount = computed(() => form.value.items.reduce((sum, l) => sum + (l.unitPrice || 0) * (l.receivedQty || 0), 0))

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchLocations() {
  const res = await api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', {
    query: { page: 1, limit: 200 }
  })
  const locations = (res as any).locations || []
  locationOptions.value = locations.map((l: ApiLocation) => ({
    value: l.id,
    label: `${l.warehouse?.code || ''} - ${l.warehouse?.name || ''} / ${l.code}`
  }))
}

async function fetchGrn() {
  const id = String(route.params.id || '')
  const res = await api<{ success: true; grn: ApiGRN }>(`/api/goods-receipts/${id}`)
  grn.value = (res as any).grn

  form.value.receiptDate = grn.value?.receiptDate ? new Date(grn.value.receiptDate) : new Date()
  form.value.notes = grn.value?.notes || ''
  form.value.items =
    grn.value?.items?.map((gi) => ({
      id: gi.id,
      poItemId: gi.poItemId,
      itemId: gi.itemId,
      itemSku: gi.item?.sku || '',
      itemName: gi.item?.name || '-',
      orderedQty: gi.poItem?.quantity || 0,
      receivedQty: gi.receivedQty || 0,
      unitPrice: gi.poItem?.unitPrice || 0,
      lotNumber: gi.lotNumber || ''
    })) || []
}

async function saveDraft() {
  if (!grn.value) return
  saving.value = true
  try {
    await api(`/api/goods-receipts/${grn.value.id}`, {
      method: 'PUT',
      body: {
        purchaseOrderId: grn.value.purchaseOrderId,
        receiptDate: form.value.receiptDate,
        notes: form.value.notes,
        items: form.value.items.map((l) => ({
          poItemId: l.poItemId,
          itemId: l.itemId,
          receivedQty: Number(l.receivedQty || 0),
          lotNumber: l.lotNumber || undefined
        }))
      }
    })
    toast.success('GRN draft tersimpan.')
    await fetchGrn()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function complete() {
  if (!grn.value) return
  if (!form.value.locationId) return toast.error('Pilih lokasi penerimaan.')
  const ok = window.confirm('Complete GRN ini? Stok akan ditambahkan.')
  if (!ok) return

  saving.value = true
  try {
    await api(`/api/goods-receipts/${grn.value.id}/complete`, {
      method: 'POST',
      body: { locationId: form.value.locationId }
    })
    toast.success('GRN berhasil di-complete. Stok telah ditambahkan.')
    await fetchGrn()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function voidGrn() {
  if (!grn.value) return
  const reason = window.prompt('Alasan void GRN?')
  if (!reason) return

  saving.value = true
  try {
    await api(`/api/goods-receipts/${grn.value.id}/void`, {
      method: 'POST',
      body: { reason }
    })
    toast.success('GRN di-void.')
    await fetchGrn()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([fetchLocations(), fetchGrn()])
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
