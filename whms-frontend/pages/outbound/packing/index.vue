<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Packing Station</h1>
      <p class="text-sm text-slate-500">Verifikasi isi paket sebelum pengiriman. Pastikan setiap pesanan lengkap.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="space-y-3">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Antrian Packing</h2>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="flex-1">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari SO / Customer..." size="small" class="w-full" />
          </IconField>
          <Button icon="pi pi-refresh" text rounded @click="refresh()" :loading="loading" />
        </div>

        <div
          v-for="order in filteredQueue"
          :key="order.id"
          @click="selectOrder(order)"
          :class="[
            'p-4 rounded-xl border-2 cursor-pointer transition-all',
            activeOrder?.id === order.id ? 'border-primary-500 bg-primary-50 shadow-md' : 'border-slate-200 bg-white hover:border-primary-300 hover:shadow-sm'
          ]"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-bold text-sm text-slate-800">{{ order.soNumber }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ order.customer }} · {{ order.items_count }} item</p>
            </div>
            <div>
              <i class="pi pi-box text-slate-300 text-xl"></i>
            </div>
          </div>
        </div>

        <div v-if="filteredQueue.length === 0" class="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-4">
          Tidak ada antrian packing.
        </div>
      </div>

      <div class="lg:col-span-2">
        <div v-if="!activeOrder" class="bg-slate-100 rounded-xl flex flex-col items-center justify-center py-20 text-slate-400">
          <i class="pi pi-inbox text-5xl mb-3 opacity-40"></i>
          <p class="font-medium">Pilih pesanan dari antrian untuk memulai packing</p>
        </div>

        <div v-else class="space-y-4">
          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-base font-bold text-slate-800">{{ activeOrder.soNumber }} — {{ activeOrder.customer }}</h2>
                <p class="text-xs text-slate-500">Alamat: {{ shippingForm.recipientAddress || '-' }}</p>
              </div>
              <Button
                v-if="allVerified"
                label="Selesai Packing → Buat Shipment"
                icon="pi pi-truck"
                @click="completePacking"
                :loading="saving"
              />
            </div>

            <div class="flex gap-2 mb-4">
              <InputText v-model="scanBuffer" placeholder="Scan barcode item untuk verifikasi..." class="flex-1" @keydown.enter="scanVerify" />
              <Button icon="pi pi-barcode" @click="scanVerify" :disabled="!scanBuffer" />
            </div>

            <div class="space-y-2">
              <div
                v-for="item in activeOrder.items"
                :key="item.soItemId"
                :class="[
                  'flex items-center justify-between p-3 rounded-lg border transition-all',
                  item.verifiedQty >= item.qty ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                ]"
              >
                <div class="flex items-center gap-3">
                  <i :class="['pi text-lg', item.verifiedQty >= item.qty ? 'pi-check-circle text-emerald-500' : 'pi-circle text-slate-300']"></i>
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ item.item_name }}</p>
                    <p class="text-xs text-slate-500">SKU: {{ item.sku }} · {{ item.verifiedQty }} / {{ item.qty }} {{ item.unit }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <InputNumber v-model="item.editQty" :min="0" :max="item.qty" size="small" class="w-24" inputClass="text-right" />
                  <Button label="Save" icon="pi pi-save" text size="small" @click="saveManual(item)" />
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-sm font-bold text-slate-700 mb-3">Info Paket</h3>
            <div class="grid grid-cols-3 gap-4">
              <UiInput label="Berat Total (Kg)" v-model="shippingForm.weight" type="number" />
              <UiSelect label="Ukuran Box" v-model="parcelSize" :options="['Small (30x20x15)', 'Medium (40x30x25)', 'Large (60x40x30)']" />
              <UiInput label="Jumlah Koli" v-model="parcelCount" type="number" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <UiInput label="Carrier" v-model="shippingForm.carrier" placeholder="Contoh: JNE, SiCepat, J&T" />
              <UiInput label="Tracking Number (optional)" v-model="shippingForm.trackingNumber" />
              <UiInput label="Nama Penerima" v-model="shippingForm.recipientName" class="md:col-span-2" />
              <UiInput label="Telepon Penerima" v-model="shippingForm.recipientPhone" class="md:col-span-2" />
              <div class="md:col-span-2 flex flex-col gap-1">
                <label class="text-sm font-medium text-slate-700">Alamat Penerima</label>
                <Textarea v-model="shippingForm.recipientAddress" rows="2" class="w-full bg-slate-50" placeholder="Alamat tujuan..." />
              </div>
              <div class="md:col-span-2 flex flex-col gap-1">
                <label class="text-sm font-medium text-slate-700">Notes</label>
                <Textarea v-model="shippingForm.notes" rows="2" class="w-full bg-slate-50" placeholder="Catatan packing/shipping..." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'OUTBOUND_STAFF'] })

import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

const scanBuffer = ref('')
const parcelSize = ref('Medium (40x30x25)')
const parcelCount = ref(1)
const searchQuery = ref('')
const loading = ref(false)
const saving = ref(false)

type ApiItemUom = { barcode?: string | null }
type ApiItem = { id: string; sku: string; name: string; uoms?: ApiItemUom[] }
type ApiSOItem = { id: string; itemId: string; quantity: number; item: ApiItem }
type ApiSalesOrder = {
  id: string
  soNumber: string
  status: string
  customer: { id: string; code: string; name: string; address?: string | null; phone?: string | null }
  items: ApiSOItem[]
}
type ApiShipment = { id: string; salesOrderId: string; awbNumber: string; status: string }

type PackingLine = {
  soItemId: string
  itemId: string
  item_name: string
  sku: string
  qty: number
  unit: string
  acceptedBarcodes: string[]
  verifiedQty: number
  editQty: number
}

type PackingOrder = {
  id: string
  soId: string
  soNumber: string
  customer: string
  items_count: number
  items: PackingLine[]
}

const packingQueue = ref<PackingOrder[]>([])
const activeOrder = ref<PackingOrder | null>(null)

const filteredQueue = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return packingQueue.value
  return packingQueue.value.filter((o) => o.soNumber.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))
})

const allVerified = computed(() => activeOrder.value?.items.every((i) => i.verifiedQty >= i.qty) ?? false)

const shippingForm = ref({
  carrier: '',
  trackingNumber: '',
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  weight: 0,
  notes: ''
})

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function loadSo(soId: string) {
  try {
    const res = await api<{ success: true; so: ApiSalesOrder }>(`/api/sales-orders/${soId}`)
    const so = (res as any).so as ApiSalesOrder
    shippingForm.value.recipientName = so.customer?.name || ''
    shippingForm.value.recipientPhone = so.customer?.phone || ''
    shippingForm.value.recipientAddress = so.customer?.address || ''
    if (!shippingForm.value.carrier) shippingForm.value.carrier = 'JNE'
    if (!shippingForm.value.weight) shippingForm.value.weight = 1
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function selectOrder(order: PackingOrder) {
  activeOrder.value = order
  loadSo(order.soId)
}

function scanVerify() {
  if (!scanBuffer.value || !activeOrder.value) return
  const code = scanBuffer.value.trim()
  const line = activeOrder.value.items.find((i) => i.acceptedBarcodes.includes(code))
  if (!line) {
    toast.error('Barcode tidak sesuai pesanan ini!')
    scanBuffer.value = ''
    return
  }
  if (line.verifiedQty >= line.qty) {
    toast.warning('Qty item ini sudah terpenuhi.')
    scanBuffer.value = ''
    return
  }
  line.verifiedQty += 1
  line.editQty = line.verifiedQty
  toast.success(`✓ ${line.item_name} terverifikasi (${line.verifiedQty}/${line.qty}).`)
  scanBuffer.value = ''
}

function saveManual(line: PackingLine) {
  const v = Number(line.editQty || 0)
  line.verifiedQty = Math.max(0, Math.min(line.qty, v))
}

async function refresh() {
  loading.value = true
  try {
    const [soRes, shipRes] = await Promise.all([
      api<{ success: true; orders: ApiSalesOrder[] }>('/api/sales-orders', { query: { status: 'PACKED', page: 1, limit: 200 } }),
      api<{ success: true; shipments: ApiShipment[] }>('/api/shipping', { query: { page: 1, limit: 200 } })
    ])

    const orders: ApiSalesOrder[] = (soRes as any).orders || []
    const shipments: ApiShipment[] = (shipRes as any).shipments || []
    const shippedSoIds = new Set(shipments.map((s) => s.salesOrderId))

    packingQueue.value = orders
      .filter((o) => !shippedSoIds.has(o.id))
      .map((o) => ({
        id: o.id,
        soId: o.id,
        soNumber: o.soNumber,
        customer: o.customer?.name || '-',
        items_count: o.items?.length || 0,
        items: (o.items || []).map((it) => {
          const barcodes = new Set<string>()
          if (it.item?.sku) barcodes.add(it.item.sku)
          for (const u of it.item?.uoms || []) {
            if (u.barcode) barcodes.add(u.barcode)
          }
          return {
            soItemId: it.id,
            itemId: it.itemId,
            item_name: it.item?.name || '-',
            sku: it.item?.sku || '-',
            qty: Number(it.quantity || 0),
            unit: 'PCS',
            acceptedBarcodes: Array.from(barcodes),
            verifiedQty: 0,
            editQty: 0
          }
        })
      }))

    if (activeOrder.value) {
      const still = packingQueue.value.find((x) => x.soId === activeOrder.value!.soId)
      if (!still) activeOrder.value = null
    }
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function completePacking() {
  if (!activeOrder.value) return
  if (!allVerified.value) return toast.error('Masih ada item yang belum terverifikasi.')
  if (!shippingForm.value.carrier) return toast.error('Carrier wajib diisi.')
  if (!shippingForm.value.recipientName) return toast.error('Nama penerima wajib diisi.')
  if (!shippingForm.value.recipientPhone) return toast.error('Telepon penerima wajib diisi.')
  if (!shippingForm.value.recipientAddress) return toast.error('Alamat penerima wajib diisi.')

  const ok = window.confirm('Buat shipment untuk pesanan ini?')
  if (!ok) return

  saving.value = true
  try {
    const notes = [
      shippingForm.value.notes,
      `Box: ${parcelSize.value}`,
      `Koli: ${parcelCount.value}`
    ].filter(Boolean).join('\n')

    const res = await api<{ success: true; shipment: ApiShipment }>('/api/shipping', {
      method: 'POST',
      body: {
        salesOrderId: activeOrder.value.soId,
        carrier: shippingForm.value.carrier,
        trackingNumber: shippingForm.value.trackingNumber || undefined,
        recipientName: shippingForm.value.recipientName,
        recipientPhone: shippingForm.value.recipientPhone,
        recipientAddress: shippingForm.value.recipientAddress,
        weight: Number(shippingForm.value.weight || 0) || undefined,
        notes: notes || undefined
      }
    })

    toast.success(`Shipment dibuat: ${(res as any).shipment?.awbNumber || ''}`)
    activeOrder.value = null
    await refresh()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(refresh)
</script>
