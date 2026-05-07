<template>
  <div class="p-6">
    <UiDataTable
      title="Storage Locations (Bins / Racks)"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-64 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search path or barcode..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Location" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Location" @click="openDialog()" />
          </div>
        </div>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-1">
          <Button v-tooltip.top="'Lihat Inventori'" text rounded size="small" icon="pi pi-box" @click="openInventoryViewer(data.id)" />
          <Button v-tooltip.top="'QR Code / Print Label'" text rounded size="small" icon="pi pi-qrcode" @click="openQrDialog(data.id)" />
          <Button v-tooltip.top="'Edit'" text rounded size="small" icon="pi pi-pencil" @click="openDialog(data.id)" />
          <Button v-tooltip.top="'Nonaktifkan'" text rounded size="small" severity="danger" icon="pi pi-trash" @click="confirmDelete(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <!-- Modal Form -->
    <UiModal v-model="showDialog" :title="editId ? 'Edit Location' : 'New Location'" width="40vw" confirmLabel="Simpan" @confirm="saveData">
      <div class="grid grid-cols-1 gap-4">
        <UiSelect
          label="Gudang Induk"
          v-model="form.warehouseId"
          :options="warehouses"
          optionLabel="name"
          optionValue="id"
          placeholder="Pilih warehouse"
          required
        />

        <UiInput label="Code (Unique)" v-model="form.code" placeholder="Misal: WH-JKT-01-A-01-A" required />

        <div class="grid grid-cols-2 gap-4">
          <UiInput label="Zone" v-model="form.zone" placeholder="Misal: A" />
          <UiInput label="Aisle" v-model="form.aisle" placeholder="Misal: 01" />
          <UiInput label="Rack" v-model="form.rack" placeholder="Misal: 01" />
          <UiInput label="Level" v-model="form.level" placeholder="Misal: 01" />
          <UiInput label="Bin" v-model="form.bin" placeholder="Misal: A" />
          <UiInput label="Capacity" type="number" v-model="form.capacity" placeholder="0" />
        </div>

        <div class="flex items-center gap-2 mt-1">
          <Checkbox v-model="form.isActive" inputId="isActive" :binary="true" />
          <label for="isActive" class="text-sm font-medium text-slate-700">Aktif</label>
        </div>
      </div>
    </UiModal>

    <!-- QR Code Dialog -->
    <Dialog v-model:visible="showQrDialog" header="QR Code & Label Lokasi" :modal="true" class="w-full max-w-sm">
      <div v-if="qrLocation" class="flex flex-col items-center gap-4 py-2">
        <!-- QR Code -->
        <div
          class="w-52 h-52 rounded-xl border-2 border-slate-200 bg-white p-3 shadow-inner"
          v-html="qrSvg"
        ></div>

        <!-- Code & metadata -->
        <div class="text-center">
          <div class="text-lg font-extrabold text-slate-800 tracking-wide">{{ qrLocation.code }}</div>
          <div class="text-xs text-slate-500 mt-1">
            {{ qrLocation.warehouse?.name }}
            <span v-if="qrLocation.zone"> · Zone {{ qrLocation.zone }}</span>
            <span v-if="qrLocation.aisle"> · Aisle {{ qrLocation.aisle }}</span>
            <span v-if="qrLocation.rack"> · Rack {{ qrLocation.rack }}</span>
            <span v-if="qrLocation.level"> · Level {{ qrLocation.level }}</span>
            <span v-if="qrLocation.bin"> · Bin {{ qrLocation.bin }}</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">Kapasitas: {{ qrLocation.capacity ?? 'N/A' }}</div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end mt-2">
          <Button label="Tutup" severity="secondary" outlined size="small" @click="showQrDialog = false" />
          <Button label="Print Label" icon="pi pi-print" size="small" @click="printLabel" />
        </div>
      </template>
    </Dialog>

    <!-- Inventory Viewer Dialog -->
    <Dialog
      v-model:visible="showInventoryDialog"
      :header="inventoryLocation ? `Inventori: ${inventoryLocation.code}` : 'Inventori Lokasi'"
      :modal="true"
      class="w-full max-w-lg"
    >
      <div v-if="inventoryLoading" class="flex items-center justify-center py-10 text-slate-400">
        <i class="pi pi-spin pi-spinner text-2xl mr-2"></i>
        <span>Memuat data inventori...</span>
      </div>
      <div v-else-if="inventoryItems.length > 0" class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div
          v-for="inv in inventoryItems"
          :key="inv.id"
          class="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
        >
          <div class="flex flex-col gap-0.5">
            <div class="font-semibold text-slate-800 text-sm">{{ inv.item?.name }}</div>
            <div class="text-xs text-slate-500">SKU: <span class="font-mono">{{ inv.item?.sku || '-' }}</span></div>
            <div v-if="inv.itemLot" class="text-xs text-blue-500">Lot: {{ inv.itemLot?.lotNumber }}</div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-primary-700">{{ inv.onHandQty }}</div>
            <div class="text-[10px] text-slate-500">On Hand</div>
            <div v-if="inv.allocatedQty > 0" class="text-[10px] text-amber-600">{{ inv.allocatedQty }} Reserved</div>
            <div class="text-[10px] text-emerald-600 font-semibold">{{ inv.availableQty }} Avail.</div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-10 text-slate-400">
        <i class="pi pi-inbox text-4xl mb-3 text-slate-300 block"></i>
        <p class="font-medium text-slate-600">Tidak ada barang di lokasi ini</p>
        <p class="text-sm mt-1">Lokasi penyimpanan kosong</p>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end mt-2">
          <Button label="Tutup" severity="secondary" outlined size="small" @click="showInventoryDialog = false" />
          <Button
            label="Print Inventori"
            icon="pi pi-print"
            size="small"
            :disabled="inventoryLoading || inventoryItems.length === 0"
            @click="printInventoryManifest"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'
import { generateQrSvg, printQrLabel } from '~/composables/useQrSvg'

const toast = useToast()
const { api } = useApi()
const searchQuery = ref('')
const showDialog = ref(false)
const editId = ref<string | null>(null)

const form = ref({
  warehouseId: '',
  code: '',
  zone: '',
  aisle: '',
  rack: '',
  level: '',
  bin: '',
  capacity: 0,
  isActive: true
})

type ApiWarehouse = { id: string; code: string; name: string }
type ApiLocation = {
  id: string
  warehouseId: string
  code: string
  zone?: string | null
  aisle?: string | null
  rack?: string | null
  level?: string | null
  bin?: string | null
  capacity?: number | null
  isActive: boolean
  warehouse?: ApiWarehouse
}

type InventoryItem = {
  id: string
  onHandQty: number
  allocatedQty: number
  availableQty: number
  item?: { id: string; sku: string; name: string }
  itemLot?: { id: string; lotNumber: string } | null
}

const warehouses = ref<ApiWarehouse[]>([])
const locations = ref<ApiLocation[]>([])
const loading = ref(false)

// ---- QR Dialog ----
const showQrDialog = ref(false)
const qrLocation = ref<ApiLocation | null>(null)
const qrSvg = computed(() => qrLocation.value ? generateQrSvg(qrLocation.value.code) : '')

function openQrDialog(id: string) {
  qrLocation.value = locations.value.find(l => l.id === id) ?? null
  showQrDialog.value = true
}

function printLabel() {
  if (!qrLocation.value) return
  printQrLabel({
    code: qrLocation.value.code,
    warehouseName: qrLocation.value.warehouse?.name,
    zone: qrLocation.value.zone ?? undefined,
    aisle: qrLocation.value.aisle ?? undefined,
    rack: qrLocation.value.rack ?? undefined,
    level: qrLocation.value.level ?? undefined,
    bin: qrLocation.value.bin ?? undefined,
    capacity: qrLocation.value.capacity,
  })
}

// ---- Inventory Viewer ----
const showInventoryDialog = ref(false)
const inventoryLocation = ref<ApiLocation | null>(null)
const inventoryItems = ref<InventoryItem[]>([])
const inventoryLoading = ref(false)

async function openInventoryViewer(id: string) {
  inventoryLocation.value = locations.value.find(l => l.id === id) ?? null
  inventoryItems.value = []
  showInventoryDialog.value = true
  inventoryLoading.value = true
  try {
    const res = await api<{ success: boolean; inventories: InventoryItem[] }>(`/api/inventory/location/${id}`)
    inventoryItems.value = res.inventories || []
  } catch (e: any) {
    toast.error('Gagal memuat inventori lokasi: ' + (e?.message || ''))
  } finally {
    inventoryLoading.value = false
  }
}

function printInventoryManifest() {
  const loc = inventoryLocation.value
  if (!loc) return

  const qrSvgStr = generateQrSvg(loc.code)
  const warehouseName = loc.warehouse?.name || '-'
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const metaParts = [
    loc.zone && `Zone: ${loc.zone}`,
    loc.aisle && `Aisle: ${loc.aisle}`,
    loc.rack && `Rak: ${loc.rack}`,
    loc.level && `Level: ${loc.level}`,
    loc.bin && `Bin: ${loc.bin}`,
  ].filter(Boolean).join('  ·  ')

  const rowsHtml = inventoryItems.value.map((inv, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="sku">${inv.item?.sku ?? '-'}</td>
      <td>${inv.item?.name ?? '-'}</td>
      <td>${inv.itemLot?.lotNumber ?? '-'}</td>
      <td class="num">${inv.onHandQty}</td>
      <td class="num">${inv.allocatedQty}</td>
      <td class="num avail">${inv.availableQty}</td>
    </tr>
  `).join('')

  const win = window.open('', '_blank', 'width=820,height=640')
  if (!win) return

  win.document.open()
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inventori — ${loc.code}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
            font-size: 12px;
            color: #0f172a;
            padding: 28px 32px;
          }
          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #334155;
          }
          .header-left h1 { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
          .header-left .code { font-size: 22px; font-weight: 900; letter-spacing: 0.04em; color: #1e3a5f; }
          .header-left .warehouse { font-size: 12px; color: #64748b; margin-top: 4px; }
          .header-left .meta { font-size: 11px; color: #94a3b8; margin-top: 2px; }
          .header-left .date { font-size: 10px; color: #94a3b8; margin-top: 8px; }
          .qr-box { width: 110px; height: 110px; flex-shrink: 0; }
          .qr-box svg { width: 100%; height: 100%; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          thead tr { background: #1e3a5f; color: #fff; }
          thead th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; }
          thead th.num { text-align: right; }
          tbody tr:nth-child(even) { background: #f8fafc; }
          tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
          tbody td.sku { font-family: monospace; font-size: 11px; color: #475569; }
          tbody td.avail { font-weight: 700; color: #059669; }
          .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          @media print { body { padding: 16px 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>Laporan Inventori Lokasi Penyimpanan</h1>
            <div class="code">${loc.code}</div>
            <div class="warehouse">${warehouseName}</div>
            <div class="meta">${metaParts}</div>
            <div class="date">Dicetak: ${printDate}</div>
          </div>
          <div class="qr-box">${qrSvgStr}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:32px">#</th>
              <th style="width:100px">SKU</th>
              <th>Nama Barang</th>
              <th style="width:100px">Lot</th>
              <th class="num" style="width:80px">On Hand</th>
              <th class="num" style="width:80px">Reserved</th>
              <th class="num" style="width:80px">Tersedia</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Total ${inventoryItems.value.length} item · WHMS — Warehouse Management System
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
    </html>
  `)
  win.document.close()
}

// ---- Table ----
const rows = computed(() => {
  return locations.value.map(l => ({
    id: l.id,
    code: l.code,
    warehouse: l.warehouse?.name || '-',
    zone: l.zone || '-',
    aisle: l.aisle || '-',
    rack: l.rack || '-',
    level: l.level || '-',
    bin: l.bin || '-',
    capacity: l.capacity ?? 0,
    status: l.isActive ? 'ACTIVE' : 'INACTIVE'
  }))
})

const columns = ref([
  { field: 'code', headerName: 'Code', width: 200 },
  { field: 'warehouse', headerName: 'Warehouse', width: 200 },
  { field: 'zone', headerName: 'Zone', width: 90 },
  { field: 'aisle', headerName: 'Aisle', width: 90 },
  { field: 'rack', headerName: 'Rack', width: 90 },
  { field: 'level', headerName: 'Level', width: 90 },
  { field: 'bin', headerName: 'Bin', width: 90 },
  { field: 'capacity', headerName: 'Capacity', width: 110 },
  { field: 'status', headerName: 'Status', width: 110 },
  { field: 'actions', headerName: '', slotName: 'actions', minWidth: 180 }
])

function openDialog(id?: string) {
  if (id) {
    const data = locations.value.find(l => l.id === id)
    if (data) {
      editId.value = data.id
      form.value = {
        warehouseId: data.warehouseId,
        code: data.code,
        zone: data.zone || '',
        aisle: data.aisle || '',
        rack: data.rack || '',
        level: data.level || '',
        bin: data.bin || '',
        capacity: data.capacity ?? 0,
        isActive: data.isActive
      }
    }
  } else {
    editId.value = null
    form.value = { warehouseId: '', code: '', zone: '', aisle: '', rack: '', level: '', bin: '', capacity: 0, isActive: true }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.warehouseId || !form.value.code) {
    toast.error('Warehouse dan Code wajib diisi.')
    return
  }
  try {
    if (editId.value) {
      await api(`/api/warehouses/locations/${editId.value}`, { method: 'PUT', body: { ...form.value } })
      toast.success('Lokasi diperbarui.')
    } else {
      await api('/api/warehouses/locations', { method: 'POST', body: { ...form.value } })
      toast.success('Lokasi baru ditambahkan.')
    }
    showDialog.value = false
    await fetchLocations()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Nonaktifkan location ini?')
  if (!ok) return
  try {
    await api(`/api/warehouses/locations/${id}`, { method: 'DELETE' })
    toast.success('Location dinonaktifkan.')
    await fetchLocations()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

async function fetchWarehouses() {
  const res = await api<{ success: true; warehouses: any[] }>('/api/warehouses')
  warehouses.value = (res.warehouses || []).map((w: any) => ({ id: w.id, code: w.code, name: w.name }))
}

async function fetchLocations() {
  loading.value = true
  try {
    const res = await api<{ success: true; locations: ApiLocation[] }>('/api/warehouses/locations', {
      query: { search: searchQuery.value || undefined, page: 1, limit: 200 }
    })
    locations.value = res.locations
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat locations')
  } finally {
    loading.value = false
  }
}

watch(searchQuery, async () => {
  await fetchLocations()
})

onMounted(async () => {
  await fetchWarehouses()
  await fetchLocations()
})
</script>
