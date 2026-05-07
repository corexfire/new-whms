<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Surat Jalan</h1>
        <p class="text-sm text-slate-500 mt-1">Dokumen pengiriman barang keluar dari gudang ke pelanggan</p>
      </div>
      <Button icon="pi pi-plus" label="Buat Surat Jalan" size="small" @click="openCreate" />
    </div>

    <!-- Filter Bar -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
      <IconField iconPosition="left">
        <InputIcon class="pi pi-search text-slate-400" />
        <InputText v-model="searchQuery" placeholder="Cari No. AWB / Surat Jalan..." size="small" class="w-52" />
      </IconField>
      <Select v-model="filterStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Semua Status" showClear size="small" class="w-40" />
      <div class="flex gap-2 items-center">
        <InputText v-model="filterDateFrom" type="date" size="small" class="w-36" />
        <span class="text-slate-400 text-sm">s/d</span>
        <InputText v-model="filterDateTo" type="date" size="small" class="w-36" />
      </div>
      <Button icon="pi pi-search" label="Cari" size="small" :loading="loading" @click="fetchShipments" />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16 text-slate-400">
        <i class="pi pi-spin pi-spinner text-2xl mr-2"></i><span>Memuat data...</span>
      </div>
      <div v-else-if="shipments.length === 0" class="text-center py-16 text-slate-400">
        <i class="pi pi-truck text-5xl text-slate-300 mb-4 block"></i>
        <p class="font-medium text-slate-600">Belum ada Surat Jalan</p>
        <p class="text-sm mt-1">Klik "Buat Surat Jalan" untuk membuat dokumen pengiriman</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-slate-800 text-white text-xs">
            <th class="px-4 py-3 text-left">No. Surat Jalan</th>
            <th class="px-4 py-3 text-left">Tanggal</th>
            <th class="px-4 py-3 text-left">SO Number</th>
            <th class="px-4 py-3 text-left">Penerima</th>
            <th class="px-4 py-3 text-left">Ekspedisi</th>
            <th class="px-4 py-3 text-left">No. Resi</th>
            <th class="px-4 py-3 text-center">Status</th>
            <th class="px-4 py-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in shipments" :key="s.id"
            class="hover:bg-blue-50 transition-colors border-b border-slate-100"
            :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
          >
            <td class="px-4 py-3 font-mono font-bold text-blue-700">{{ s.suratJalanNumber }}</td>
            <td class="px-4 py-3 text-slate-600">{{ formatDate(s.createdAt) }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-500">{{ s.salesOrder?.soNumber || '-' }}</td>
            <td class="px-4 py-3">
              <div class="font-medium text-slate-800">{{ s.recipientName }}</div>
              <div class="text-xs text-slate-400 truncate max-w-[180px]">{{ s.recipientPhone }}</div>
            </td>
            <td class="px-4 py-3 text-slate-700 font-medium">{{ s.carrier }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ s.trackingNumber || s.awbNumber || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(s.status)">
                {{ statusLabel(s.status) }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-center gap-1">
                <Button v-tooltip.top="'Lihat Detail'" text rounded size="small" icon="pi pi-eye" @click="openDetail(s)" />
                <Button v-tooltip.top="'Print Surat Jalan'" text rounded size="small" icon="pi pi-print" @click="printSuratJalan(s)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreateDialog" header="Buat Surat Jalan Baru" :modal="true" class="w-full max-w-2xl">
      <div class="space-y-4 mt-2">
        <!-- Link to Shipment/SO -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-700">Pilih Pengiriman (Shipment) *</label>
          <Select
            v-model="createForm.shipmentId"
            :options="availableShipments"
            optionLabel="label"
            optionValue="id"
            placeholder="Cari AWB / SO Number..."
            filter
            class="w-full"
            @change="onSelectShipment"
          />
        </div>

        <!-- Auto-filled from shipment -->
        <div v-if="selectedShipment" class="bg-blue-50 border border-blue-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-xs text-blue-600 font-semibold">Penerima:</span><br><span class="font-medium">{{ selectedShipment.recipientName }}</span></div>
          <div><span class="text-xs text-blue-600 font-semibold">Telepon:</span><br><span>{{ selectedShipment.recipientPhone }}</span></div>
          <div class="col-span-2"><span class="text-xs text-blue-600 font-semibold">Alamat:</span><br><span>{{ selectedShipment.recipientAddress }}</span></div>
          <div><span class="text-xs text-blue-600 font-semibold">Ekspedisi:</span><br><span class="font-medium">{{ selectedShipment.carrier }}</span></div>
          <div><span class="text-xs text-blue-600 font-semibold">No. Resi AWB:</span><br><span class="font-mono text-blue-800">{{ selectedShipment.awbNumber }}</span></div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Nama Pengirim / Driver</label>
            <InputText v-model="createForm.driverName" placeholder="Nama driver atau ekspedisi" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">No. Kendaraan</label>
            <InputText v-model="createForm.vehicleNumber" placeholder="Misal: B 1234 XYZ" class="w-full" />
          </div>
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Catatan Pengiriman</label>
            <Textarea v-model="createForm.notes" rows="2" class="w-full bg-slate-50" placeholder="(Opsional) Catatan khusus" />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Batal" severity="secondary" outlined @click="showCreateDialog = false" />
          <Button label="Buat & Print" icon="pi pi-print" :loading="saving" @click="createAndPrint" />
        </div>
      </template>
    </Dialog>

    <!-- Detail Dialog -->
    <Dialog v-model:visible="showDetailDialog" :header="`Detail Surat Jalan: ${detailItem?.suratJalanNumber}`" :modal="true" class="w-full max-w-2xl">
      <div v-if="detailItem" class="space-y-4 mt-2">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">Tanggal</div>
            <div class="font-semibold">{{ formatDate(detailItem.createdAt) }}</div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">SO Number</div>
            <div class="font-semibold font-mono">{{ detailItem.salesOrder?.soNumber || '-' }}</div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">Penerima</div>
            <div class="font-semibold">{{ detailItem.recipientName }}</div>
            <div class="text-xs text-slate-500">{{ detailItem.recipientPhone }}</div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">Ekspedisi / AWB</div>
            <div class="font-semibold">{{ detailItem.carrier }}</div>
            <div class="text-xs font-mono text-blue-600">{{ detailItem.awbNumber }}</div>
          </div>
          <div class="col-span-2 p-3 bg-slate-50 rounded-lg">
            <div class="text-xs text-slate-500 mb-1">Alamat Pengiriman</div>
            <div class="font-medium">{{ detailItem.recipientAddress }}</div>
          </div>
        </div>

        <div v-if="detailItem.salesOrder?.items?.length" class="mt-2">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">DAFTAR BARANG</div>
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-slate-700 text-white text-xs">
                <th class="px-3 py-2 text-left">#</th>
                <th class="px-3 py-2 text-left">Item</th>
                <th class="px-3 py-2 text-right">Qty</th>
                <th class="px-3 py-2 text-right">Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in detailItem.salesOrder.items" :key="i"
                class="border-b border-slate-100" :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'">
                <td class="px-3 py-2 text-slate-500">{{ i + 1 }}</td>
                <td class="px-3 py-2">
                  <div class="font-medium text-slate-800">{{ item.item?.name }}</div>
                  <div class="text-[10px] font-mono text-slate-400">{{ item.item?.sku }}</div>
                </td>
                <td class="px-3 py-2 text-right font-bold">{{ item.quantity }}</td>
                <td class="px-3 py-2 text-right text-slate-500">{{ item.uom?.code || 'Pcs' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Tutup" severity="secondary" outlined @click="showDetailDialog = false" />
          <Button label="Print Surat Jalan" icon="pi pi-print" @click="printSuratJalan(detailItem!)" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

// ── Types ──────────────────────────────────────────────────────
type SuratJalan = {
  id: string
  suratJalanNumber: string
  awbNumber: string
  carrier: string
  trackingNumber?: string | null
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  weight?: number | null
  notes?: string | null
  status: string
  driverName?: string
  vehicleNumber?: string
  createdAt: string
  salesOrder?: {
    soNumber: string
    customer?: { name: string }
    items?: { quantity: number; item?: { sku: string; name: string }; uom?: { code: string } }[]
  }
}

// ── Filter State ───────────────────────────────────────────────
const searchQuery = ref('')
const filterStatus = ref<string | null>(null)
const filterDateFrom = ref('')
const filterDateTo = ref('')

const statusOptions = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Picked Up', value: 'PICKED_UP' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Returned', value: 'RETURNED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

// ── Data ───────────────────────────────────────────────────────
const shipments = ref<SuratJalan[]>([])
const loading = ref(false)

// ── Create Dialog ──────────────────────────────────────────────
const showCreateDialog = ref(false)
const availableShipments = ref<{ id: string; label: string; [key: string]: any }[]>([])
const selectedShipment = ref<any>(null)
const saving = ref(false)

const createForm = ref({
  shipmentId: '',
  driverName: '',
  vehicleNumber: '',
  notes: '',
})

// ── Detail Dialog ──────────────────────────────────────────────
const showDetailDialog = ref(false)
const detailItem = ref<SuratJalan | null>(null)

// ── Helpers ────────────────────────────────────────────────────
function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDING: 'Pending', PICKED_UP: 'Diambil', IN_TRANSIT: 'Dalam Perjalanan',
    OUT_FOR_DELIVERY: 'Diantarkan', DELIVERED: 'Terkirim', RETURNED: 'Dikembalikan', CANCELLED: 'Dibatalkan'
  }
  return map[s] || s
}

function statusClass(s: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    PICKED_UP: 'bg-blue-100 text-blue-700',
    IN_TRANSIT: 'bg-amber-100 text-amber-700',
    OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    RETURNED: 'bg-orange-100 text-orange-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return map[s] || 'bg-slate-100 text-slate-600'
}

function generateSJNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `SJ/${y}${m}${d}/${seq}`
}

// ── Fetch ──────────────────────────────────────────────────────
async function fetchShipments() {
  loading.value = true
  try {
    const res = await api<{ success: boolean; shipments: any[] }>('/api/shipping', {
      query: {
        status: filterStatus.value || undefined,
        startDate: filterDateFrom.value || undefined,
        endDate: filterDateTo.value || undefined,
        limit: 100,
      }
    })
    const raw = res.shipments || []
    shipments.value = raw.map((s: any) => ({
      ...s,
      // Generate suratJalanNumber from awbNumber if not stored
      suratJalanNumber: s.suratJalanNumber || `SJ/${s.awbNumber || s.id.substring(0, 8).toUpperCase()}`,
    })).filter((s: SuratJalan) =>
      !searchQuery.value || s.suratJalanNumber.toLowerCase().includes(searchQuery.value.toLowerCase())
        || s.awbNumber?.toLowerCase().includes(searchQuery.value.toLowerCase())
        || s.salesOrder?.soNumber?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  } catch (e: any) {
    toast.error('Gagal memuat data shipment: ' + (e?.message || ''))
  } finally {
    loading.value = false
  }
}

async function openCreate() {
  createForm.value = { shipmentId: '', driverName: '', vehicleNumber: '', notes: '' }
  selectedShipment.value = null
  showCreateDialog.value = true

  // Load available shipments (PENDING/PICKED_UP that don't have SJ yet)
  try {
    const res = await api<{ success: boolean; shipments: any[] }>('/api/shipping', {
      query: { status: 'PENDING', limit: 200 }
    })
    availableShipments.value = (res.shipments || []).map((s: any) => ({
      id: s.id,
      label: `${s.awbNumber} — ${s.salesOrder?.soNumber || ''} — ${s.recipientName}`,
      ...s,
    }))
  } catch {
    availableShipments.value = []
  }
}

function onSelectShipment() {
  selectedShipment.value = availableShipments.value.find(s => s.id === createForm.value.shipmentId) || null
}

async function createAndPrint() {
  if (!createForm.value.shipmentId) return toast.error('Pilih pengiriman terlebih dahulu.')
  saving.value = true
  try {
    const shipment = selectedShipment.value
    // Build a surat jalan object
    const sj: SuratJalan = {
      id: 'sj-' + Date.now(),
      suratJalanNumber: generateSJNumber(),
      awbNumber: shipment.awbNumber,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      recipientAddress: shipment.recipientAddress,
      weight: shipment.weight,
      notes: createForm.value.notes || shipment.notes,
      status: shipment.status,
      driverName: createForm.value.driverName,
      vehicleNumber: createForm.value.vehicleNumber,
      createdAt: new Date().toISOString(),
      salesOrder: shipment.salesOrder,
    }
    showCreateDialog.value = false
    printSuratJalan(sj)
    toast.success('Surat Jalan berhasil dibuat.')
    await fetchShipments()
  } catch (e: any) {
    toast.error(e?.message || 'Gagal membuat Surat Jalan')
  } finally {
    saving.value = false
  }
}

function openDetail(s: SuratJalan) {
  detailItem.value = s
  showDetailDialog.value = true
}

// ── Print ──────────────────────────────────────────────────────
function printSuratJalan(s: SuratJalan) {
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const itemRows = (s.salesOrder?.items || []).map((item, i) => `
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

onMounted(fetchShipments)
</script>
