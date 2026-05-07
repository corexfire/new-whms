<template>
  <div class="p-6">
    <UiDataTable
      title="Shipping & Delivery"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex gap-2 items-center">
          <IconField iconPosition="left" class="hidden sm:block">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" placeholder="Cari AWB / SO / Customer..." size="small" />
          </IconField>
          <Button class="whitespace-nowrap" icon="pi pi-filter" label="Filter" severity="secondary" outlined size="small" @click="showFilterDialog = true" />
          <Button icon="pi pi-plus" label="Buat Shipment" size="small" @click="openCreate()" />
          <Button icon="pi pi-refresh" text rounded @click="fetchShipments()" :loading="loading" />
        </div>
      </template>
      <template #status="{ data }">
        <span class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="statusChipClass(data.status)">
          {{ data.status }}
        </span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-eye" @click="openDetail(data.id)" />
          <Button v-tooltip.top="'Cetak Surat Jalan'" text rounded size="small" icon="pi pi-car" severity="info" @click="handlePrintSJ(data.id)" />
          <Button text rounded size="small" icon="pi pi-sync" @click="openSync(data.awbNumber)" />
          <Button
            v-if="data.status !== 'DELIVERED' && data.status !== 'CANCELLED'"
            text
            rounded
            size="small"
            severity="danger"
            icon="pi pi-ban"
            @click="cancelShipment(data.id)"
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

    <!-- Shipping Detail Modal -->
    <UiModal v-model="showDetail" :title="detailTitle" width="70vw" :loading="saving">
      <div v-if="selectedShipment" class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs text-slate-500">AWB</p>
            <p class="font-semibold font-mono text-primary-700">{{ selectedShipment.awbNumber }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Status</p>
            <span class="inline-flex text-xs font-bold px-2 py-0.5 rounded-full border mt-1" :class="statusChipClass(selectedShipment.status)">
              {{ selectedShipment.status }}
            </span>
          </div>
          <div>
            <p class="text-xs text-slate-500">SO</p>
            <p class="font-semibold">{{ selectedShipment.salesOrder?.soNumber || '-' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Customer</p>
            <p class="font-semibold">{{ selectedShipment.salesOrder?.customer?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Carrier</p>
            <p class="font-semibold">{{ selectedShipment.carrier }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Tracking Number</p>
            <p class="font-semibold font-mono">{{ selectedShipment.trackingNumber || '-' }}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-xs text-slate-500">Alamat Tujuan</p>
            <p class="font-semibold">{{ selectedShipment.recipientAddress }}</p>
          </div>
        </div>

        <div v-if="selectedShipment.status !== 'DELIVERED' && selectedShipment.status !== 'CANCELLED'" class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <UiInput label="Lokasi (optional)" v-model="trackingLocation" placeholder="Contoh: Jakarta DC" />
            <UiInput label="Deskripsi (optional)" v-model="trackingDescription" placeholder="Catatan singkat..." class="md:col-span-2" />
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            <Button label="Picked Up" icon="pi pi-arrow-up" size="small" outlined @click="markPickedUp()" :loading="saving" />
            <Button label="In Transit" icon="pi pi-send" size="small" outlined @click="markInTransit()" :loading="saving" />
            <Button label="Out For Delivery" icon="pi pi-truck" size="small" outlined @click="markOutForDelivery()" :loading="saving" />
            <Button label="Delivered" icon="pi pi-check" size="small" severity="success" @click="markDelivered()" :loading="saving" />
          </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl">
          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Tracking Timeline</h3>
            <Button text size="small" icon="pi pi-refresh" @click="refreshDetail()" :loading="saving" />
          </div>
          <div class="p-4 space-y-2">
            <div v-if="(selectedShipment.trackingHistory || []).length === 0" class="text-sm text-slate-400">
              Belum ada tracking.
            </div>
            <div v-for="t in (selectedShipment.trackingHistory || [])" :key="t.id" class="flex items-start gap-3">
              <div class="mt-1 w-2 h-2 rounded-full bg-primary-500"></div>
              <div class="min-w-0">
                <div class="text-xs font-semibold text-slate-700">
                  {{ t.status }}
                  <span v-if="t.location" class="text-slate-500 font-normal">· {{ t.location }}</span>
                </div>
                <div v-if="t.description" class="text-xs text-slate-500">{{ t.description }}</div>
                <div class="text-[10px] text-slate-400">{{ formatDateTime(t.timestamp) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showDetail = false" />
        <Button label="Cetak Label" icon="pi pi-print" severity="secondary" outlined @click="printLabel()" />
      </template>
    </UiModal>

    <UiModal v-model="showCreate" title="Buat Shipment" width="60vw" :loading="saving">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UiSelect
          label="Sales Order (PACKED)"
          v-model="createForm.salesOrderId"
          :options="soOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Pilih SO"
          class="md:col-span-2"
          :loading="loadingSo"
          required
        />
        <UiInput label="Carrier" v-model="createForm.carrier" required />
        <UiInput label="Tracking Number (optional)" v-model="createForm.trackingNumber" />
        <UiInput label="Nama Penerima" v-model="createForm.recipientName" required class="md:col-span-2" />
        <UiInput label="Telepon Penerima" v-model="createForm.recipientPhone" required class="md:col-span-2" />
        <div class="md:col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alamat Penerima</label>
          <Textarea v-model="createForm.recipientAddress" rows="2" class="w-full bg-slate-50" />
        </div>
        <UiInput label="Berat (Kg) (optional)" v-model="createForm.weight" type="number" />
        <div class="md:col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Notes</label>
          <Textarea v-model="createForm.notes" rows="2" class="w-full bg-slate-50" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" icon="pi pi-check" :loading="saving" :disabled="!createForm.salesOrderId" @click="createShipment()" />
      </template>
    </UiModal>

    <UiModal v-model="showSync" title="Sync Tracking" width="420px" :loading="saving">
      <div class="space-y-4">
        <UiInput label="AWB" :modelValue="syncAwb" :disabled="true" />
        <UiInput label="Carrier" v-model="syncCarrier" placeholder="Contoh: JNE" required />
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showSync = false" />
        <Button label="Sync" icon="pi pi-sync" :loading="saving" :disabled="!syncCarrier" @click="syncTracking()" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'OUTBOUND_STAFF'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

type ShipmentStatus = 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED'

type ApiCustomer = { id: string; code: string; name: string }
type ApiSalesOrder = { id: string; soNumber: string; customer: ApiCustomer }
type ApiShipmentTracking = { id: string; status: string; location?: string | null; description?: string | null; timestamp: string }
type ApiShipment = {
  id: string
  awbNumber: string
  salesOrderId: string
  salesOrder?: ApiSalesOrder
  carrier: string
  trackingNumber?: string | null
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  weight?: number | null
  notes?: string | null
  status: ShipmentStatus
  createdAt: string
  trackingHistory?: ApiShipmentTracking[]
}

type ApiSoPacked = { id: string; soNumber: string; customer: ApiCustomer }

const searchQuery = ref('')
const filterStatus = ref<'ALL' | ShipmentStatus>('ALL')
const showFilterDialog = ref(false)
const statusOptions = ref<Array<{ label: string; value: 'ALL' | ShipmentStatus }>>([
  { label: 'All', value: 'ALL' },
  { label: 'PENDING', value: 'PENDING' },
  { label: 'PICKED_UP', value: 'PICKED_UP' },
  { label: 'IN_TRANSIT', value: 'IN_TRANSIT' },
  { label: 'OUT_FOR_DELIVERY', value: 'OUT_FOR_DELIVERY' },
  { label: 'DELIVERED', value: 'DELIVERED' },
  { label: 'RETURNED', value: 'RETURNED' },
  { label: 'CANCELLED', value: 'CANCELLED' }
])

const shipments = ref<ApiShipment[]>([])
const loading = ref(false)
const saving = ref(false)

const showDetail = ref(false)
const selectedShipment = ref<ApiShipment | null>(null)

const showCreate = ref(false)
const loadingSo = ref(false)
const packedSo = ref<ApiSoPacked[]>([])

const showSync = ref(false)
const syncAwb = ref('')
const syncCarrier = ref('')

const trackingLocation = ref('')
const trackingDescription = ref('')

const detailTitle = computed(() => {
  if (!selectedShipment.value) return 'Shipping'
  return `Shipping: ${selectedShipment.value.awbNumber}`
})

const soOptions = computed(() => {
  return packedSo.value.map((so) => ({
    value: so.id,
    label: `${so.soNumber} - ${so.customer?.name || '-'}`
  }))
})

const rows = computed(() => {
  return shipments.value.map((s) => ({
    id: s.id,
    awbNumber: s.awbNumber,
    soNumber: s.salesOrder?.soNumber || '-',
    customer: s.salesOrder?.customer?.name || '-',
    carrier: s.carrier,
    trackingNumber: s.trackingNumber || '-',
    status: s.status,
    createdAt: formatDateTime(s.createdAt)
  }))
})

const columns = ref([
  { field: 'awbNumber', headerName: 'AWB', width: 180 },
  { field: 'soNumber', headerName: 'SO', width: 170 },
  { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 220 },
  { field: 'carrier', headerName: 'Carrier', width: 160 },
  { field: 'trackingNumber', headerName: 'Tracking', width: 180 },
  { field: 'status', headerName: 'Status', width: 160, slotName: 'status' },
  { field: 'createdAt', headerName: 'Created', width: 160 },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

function formatDateTime(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
}

function statusChipClass(status: ShipmentStatus | string) {
  if (status === 'PENDING') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (status === 'PICKED_UP') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'IN_TRANSIT') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (status === 'OUT_FOR_DELIVERY') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'RETURNED') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function clearFilters() {
  filterStatus.value = 'ALL'
}

async function fetchShipments() {
  loading.value = true
  try {
    const res = await api<{ success: true; shipments: ApiShipment[] }>('/api/shipping', {
      query: {
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        page: 1,
        limit: 200
      }
    })
    shipments.value = (res as any).shipments || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function openDetail(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; shipment: ApiShipment }>(`/api/shipping/${id}`)
    selectedShipment.value = (res as any).shipment
    trackingLocation.value = ''
    trackingDescription.value = ''
    showDetail.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function refreshDetail() {
  if (!selectedShipment.value) return
  await openDetail(selectedShipment.value.id)
}

function printLabel() {
  toast.success('Label resi dikirim ke antrian cetak (Thermal Printer).')
}

async function cancelShipment(id: string) {
  const reason = window.prompt('Alasan cancel shipment?')
  if (!reason) return
  saving.value = true
  try {
    await api(`/api/shipping/${id}/cancel`, { method: 'POST', body: { reason } })
    toast.success('Shipment cancelled.')
    if (showDetail.value) await refreshDetail()
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function handlePrintSJ(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; shipment: any }>(`/api/shipping/${id}`)
    const shipment = res.shipment
    if (!shipment) throw new Error('Shipment detail not found')
    
    // Supplement with suratJalanNumber if missing
    const sj = {
      ...shipment,
      suratJalanNumber: shipment.suratJalanNumber || `SJ/${shipment.awbNumber || shipment.id.substring(0, 8).toUpperCase()}`
    }
    
    printSuratJalan(sj)
  } catch (e: any) {
    toast.error('Gagal mencetak Surat Jalan: ' + errMsg(e))
  } finally {
    saving.value = false
  }
}

function printSuratJalan(s: any) {
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const itemRows = (s.salesOrder?.items || []).map((item: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${item.item?.name || '-'}</strong><br><span class="sku">${item.item?.sku || ''}</span></td>
      <td class="num">${item.quantity}</td>
      <td class="num">${item.uom?.code || 'Pcs'}</td>
      <td></td>
    </tr>
  `).join('')

  const win = window.open('', '_blank', 'width=820,height=640')
  if (!win) return toast.error('Popup browser diblokir. Izinkan popup dan coba lagi.')

  win.document.open()
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Surat Jalan — ${s.suratJalanNumber}</title>
        <meta charset="utf-8"/>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#0f172a;padding:28px 32px}
          .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #1e3a5f;margin-bottom:16px}
          .company h2{font-size:20px;font-weight:900;color:#1e3a5f;margin-bottom:2px}
          .company p{font-size:11px;color:#64748b}
          .doc-title{text-align:right}
          .doc-title h1{font-size:22px;font-weight:900;color:#1e3a5f;text-transform:uppercase;letter-spacing:.04em}
          .doc-title .sj-num{font-size:14px;font-weight:700;color:#2563eb;margin-top:2px}
          .doc-title .date{font-size:10px;color:#94a3b8;margin-top:2px}
          .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
          .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
          .info-box h3{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:700;margin-bottom:6px}
          .info-box p{font-size:12px;color:#0f172a;line-height:1.5}
          .info-box .mono{font-family:monospace;font-size:11px;color:#2563eb;font-weight:700}
          table{width:100%;border-collapse:collapse;margin-bottom:24px}
          thead tr{background:#1e3a5f;color:#fff}
          thead th{padding:8px 10px;text-align:left;font-size:10px;font-weight:600}
          th.num,td.num{text-align:center}
          tbody tr:nth-child(even){background:#f8fafc}
          tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
          td .sku{font-family:monospace;font-size:10px;color:#94a3b8}
          .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:20px}
          .sig-box{text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
          .sig-box .title{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:48px}
          .sig-box .underline{border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#0f172a}
          .notes-box{background:#fffbeb;border:1px solid #fef08a;border-radius:8px;padding:10px;margin-bottom:16px;font-size:11px;color:#78350f}
          .footer{margin-top:20px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
          @media print{body{padding:16px 20px}}
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            <h2>WHMS Retail</h2>
            <p>Warehouse Management System — Retail Baju</p>
          </div>
          <div class="doc-title">
            <h1>Surat Jalan</h1>
            <div class="sj-num">${s.suratJalanNumber}</div>
            <div class="date">Tanggal: ${printDate}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Penerima</h3>
            <p><strong>${s.recipientName}</strong><br>
            Tel: ${s.recipientPhone}<br>
            ${s.recipientAddress}</p>
          </div>
          <div class="info-box">
            <h3>Pengiriman</h3>
            <p>
              SO: <span class="mono">${s.salesOrder?.soNumber || '-'}</span><br>
              Ekspedisi: <strong>${s.carrier}</strong><br>
              AWB/Resi: <span class="mono">${s.awbNumber || s.trackingNumber || '-'}</span><br>
              ${s.driverName ? `Driver: ${s.driverName}` : ''}
              ${s.vehicleNumber ? ` &nbsp;·&nbsp; Kendaraan: ${s.vehicleNumber}` : ''}
            </p>
          </div>
        </div>

        ${s.notes ? `<div class="notes-box">📝 Catatan: ${s.notes}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Nama Barang</th>
              <th class="num" style="width:70px">Qty</th>
              <th class="num" style="width:70px">Satuan</th>
              <th style="width:80px">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;">Data item tidak tersedia</td></tr>'}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="title">Pengirim / Gudang</div>
            <div class="underline">(____________________)</div>
          </div>
          <div class="sig-box">
            <div class="title">Driver / Ekspedisi</div>
            <div class="underline">${s.driverName ? s.driverName : '(____________________)'}</div>
          </div>
          <div class="sig-box">
            <div class="title">Penerima</div>
            <div class="underline">(____________________)</div>
          </div>
        </div>

        <div class="footer">
          Dokumen ini merupakan bukti pengiriman yang sah &nbsp;·&nbsp; WHMS Retail &nbsp;·&nbsp; ${s.suratJalanNumber}
        </div>

        <script>window.onload = () => { window.print(); }<\/script>
      </body>
    </html>
  `)
  win.document.close()
}

async function markPickedUp() {
  if (!selectedShipment.value) return
  saving.value = true
  try {
    await api(`/api/shipping/${selectedShipment.value.id}/pickup`, { method: 'POST' })
    toast.success('Status → PICKED_UP')
    await refreshDetail()
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function markInTransit() {
  if (!selectedShipment.value) return
  saving.value = true
  try {
    await api(`/api/shipping/${selectedShipment.value.id}/in-transit`, { method: 'POST', body: { location: trackingLocation.value || undefined } })
    if (trackingDescription.value) {
      await api(`/api/shipping/${selectedShipment.value.id}/update-tracking`, {
        method: 'POST',
        body: { status: 'IN_TRANSIT', location: trackingLocation.value || undefined, description: trackingDescription.value }
      })
    }
    toast.success('Status → IN_TRANSIT')
    await refreshDetail()
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function markOutForDelivery() {
  if (!selectedShipment.value) return
  saving.value = true
  try {
    await api(`/api/shipping/${selectedShipment.value.id}/out-for-delivery`, { method: 'POST', body: { location: trackingLocation.value || undefined } })
    if (trackingDescription.value) {
      await api(`/api/shipping/${selectedShipment.value.id}/update-tracking`, {
        method: 'POST',
        body: { status: 'OUT_FOR_DELIVERY', location: trackingLocation.value || undefined, description: trackingDescription.value }
      })
    }
    toast.success('Status → OUT_FOR_DELIVERY')
    await refreshDetail()
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function markDelivered() {
  if (!selectedShipment.value) return
  const ok = window.confirm('Set status DELIVERED? SO juga akan berubah menjadi DELIVERED.')
  if (!ok) return
  saving.value = true
  try {
    await api(`/api/shipping/${selectedShipment.value.id}/delivered`, { method: 'POST', body: { location: trackingLocation.value || undefined } })
    if (trackingDescription.value) {
      await api(`/api/shipping/${selectedShipment.value.id}/update-tracking`, {
        method: 'POST',
        body: { status: 'DELIVERED', location: trackingLocation.value || undefined, description: trackingDescription.value }
      })
    }
    toast.success('Status → DELIVERED')
    await refreshDetail()
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

const createForm = ref({
  salesOrderId: '',
  carrier: 'JNE',
  trackingNumber: '',
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  weight: 1,
  notes: ''
})

async function openCreate() {
  showCreate.value = true
  createForm.value = {
    salesOrderId: '',
    carrier: 'JNE',
    trackingNumber: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    weight: 1,
    notes: ''
  }

  loadingSo.value = true
  try {
    const res = await api<{ success: true; orders: ApiSoPacked[] }>('/api/sales-orders', { query: { status: 'PACKED', page: 1, limit: 200 } })
    packedSo.value = (res as any).orders || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingSo.value = false
  }
}

async function createShipment() {
  if (!createForm.value.salesOrderId) return
  if (!createForm.value.carrier) return toast.error('Carrier wajib diisi.')
  if (!createForm.value.recipientName) return toast.error('Nama penerima wajib diisi.')
  if (!createForm.value.recipientPhone) return toast.error('Telepon penerima wajib diisi.')
  if (!createForm.value.recipientAddress) return toast.error('Alamat penerima wajib diisi.')

  saving.value = true
  try {
    const res = await api<{ success: true; shipment: ApiShipment }>('/api/shipping', {
      method: 'POST',
      body: {
        salesOrderId: createForm.value.salesOrderId,
        carrier: createForm.value.carrier,
        trackingNumber: createForm.value.trackingNumber || undefined,
        recipientName: createForm.value.recipientName,
        recipientPhone: createForm.value.recipientPhone,
        recipientAddress: createForm.value.recipientAddress,
        weight: Number(createForm.value.weight || 0) || undefined,
        notes: createForm.value.notes || undefined
      }
    })
    toast.success(`Shipment dibuat: ${(res as any).shipment?.awbNumber || ''}`)
    showCreate.value = false
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

function openSync(awb: string) {
  syncAwb.value = awb
  syncCarrier.value = ''
  showSync.value = true
}

async function syncTracking() {
  if (!syncAwb.value) return
  if (!syncCarrier.value) return
  saving.value = true
  try {
    await api(`/api/shipping/sync/${encodeURIComponent(syncAwb.value)}`, { method: 'POST', body: { carrier: syncCarrier.value } })
    toast.success('Sync berhasil (jika carrier integration tersedia).')
    showSync.value = false
    await fetchShipments()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

let t: any = null
watch([filterStatus], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchShipments(), 200)
})

onMounted(fetchShipments)
</script>
