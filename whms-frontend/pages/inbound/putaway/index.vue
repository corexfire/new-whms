<template>
  <div class="min-h-screen flex flex-col" :class="isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'">
    
    <!-- Top Bar -->
    <div class="px-4 py-3 flex items-center justify-between shrink-0" :class="isDark ? 'bg-slate-800' : 'bg-white border-b border-slate-200'">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded :class="isDark ? 'text-white' : 'text-slate-700'" @click="router.back()" />
        <div>
          <h1 class="text-base font-bold">Putaway Task</h1>
          <p class="text-xs" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
            <span v-if="task?.goodsReceipt?.grnNumber">GRN: {{ task.goodsReceipt.grnNumber }}</span>
            <span v-else>GRN: -</span>
            · {{ pendingCount }} item menunggu
            <span v-if="task?.fromLocation?.code">· From: {{ task.fromLocation.code }}</span>
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <span v-if="isScanning" class="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-pulse">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Scanner Aktif
        </span>
        <Button
          v-if="task && task.status === 'DRAFT'"
          label="Complete"
          icon="pi pi-check"
          size="small"
          severity="success"
          :disabled="!allDone"
          @click="completePutaway"
        />
      </div>
    </div>

    <div class="px-4 py-3 shrink-0" :class="isDark ? 'bg-slate-800' : 'bg-white border-b border-slate-200'">
      <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
        <UiSelect
          v-model="selectedGrnId"
          :options="grnOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Pilih GRN (COMPLETED)"
          class="w-full sm:w-[420px]"
          :loading="loadingGrn"
        />
        <div class="flex gap-2">
          <Button
            v-if="task && task.status === 'DRAFT'"
            label="Void"
            icon="pi pi-ban"
            size="small"
            severity="danger"
            outlined
            @click="voidPutaway"
          />
          <Button
            v-if="task && task.status === 'DRAFT'"
            label="Delete"
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            @click="deletePutaway"
          />
        </div>
      </div>
    </div>

    <!-- Scanner Viewport -->
    <div class="relative bg-black h-48 overflow-hidden shrink-0">
      <video id="putaway-scanner-video" class="w-full h-full object-cover" />
      <!-- Scan guide frame -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-48 h-24 border-2 border-white/70 rounded-lg relative">
          <div class="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl"></div>
          <div class="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr"></div>
          <div class="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl"></div>
          <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br"></div>
          <!-- Scan line animation -->
          <div class="absolute left-0 right-0 h-0.5 bg-emerald-400/80 scan-line"></div>
        </div>
      </div>
      
      <div class="absolute bottom-2 left-0 right-0 flex gap-2 justify-center">
        <Button v-if="!isScanning" label="Aktifkan Kamera" icon="pi pi-camera" size="small" @click="startScanner" />
        <Button v-else label="Stop Scanner" icon="pi pi-times" severity="danger" size="small" @click="stopScanner" />
      </div>
    </div>

    <!-- OR manual input for location barcode -->
    <div class="px-4 py-3 shrink-0" :class="isDark ? 'bg-slate-800' : 'bg-white border-b border-slate-200'">
      <div class="flex gap-2 items-center">
        <div class="flex-1 relative">
          <i class="pi pi-map-marker absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm z-10"></i>
          <InputText
            v-model="locationBarcode"
            class="w-full pl-9"
            :class="isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'"
            placeholder="Scan kode rak tujuan (atau ketik manual)..."
            @keydown.enter="assignLocation"
          />
        </div>
        <Button icon="pi pi-check" label="Assign" :disabled="!locationBarcode || !activeItem || !task" @click="assignLocation" />
      </div>
    </div>

    <!-- Pending Items List -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-widest" :class="isDark ? 'text-slate-400' : 'text-slate-500'">Barang Menunggu Putaway</h2>
      
      <div
        v-for="item in pendingItems" :key="item.id"
        @click="selectItem(item)"
        :class="[
          'p-4 rounded-xl border-2 transition-all cursor-pointer',
          activeItem?.id === item.id
            ? 'border-emerald-400 bg-emerald-900/30'
            : item.status === 'DONE'
              ? 'border-slate-700 bg-slate-800/50 opacity-60'
              : 'border-slate-700 bg-slate-800 hover:border-primary-500'
        ]"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">{{ item.item_name }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ item.qty }} {{ item.unit }} · SKU: {{ item.sku }}</p>
          </div>
          <div class="text-right shrink-0">
            <div v-if="item.status === 'DONE'" class="flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <i class="pi pi-check-circle"></i> {{ item.assigned_location }}
            </div>
            <div v-else-if="activeItem?.id === item.id" class="text-emerald-400 text-xs font-bold animate-pulse">
              → Scan Rak Tujuan
            </div>
            <div v-else class="text-slate-500 text-xs">Pending</div>
          </div>
        </div>
      </div>

      <div v-if="allDone" class="mt-4 p-6 text-center bg-emerald-900/30 rounded-xl border border-emerald-500">
        <i class="pi pi-check-circle text-3xl text-emerald-400 mb-2 block"></i>
        <p class="text-emerald-300 font-bold">Semua Barang Selesai Diputaway!</p>
        <Button label="Kembali ke GRN" severity="success" class="mt-4" @click="router.push('/inbound/grn')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useScanner } from '~/composables/useScanner'
import { useApi } from '~/composables/useApi'

definePageMeta({ layout: 'fullscreen', middleware: ['rbac'], roles: ['SUPER_ADMIN', 'INBOUND_STAFF'] })

const router = useRouter()
const toast = useToast()
const { isScanning, scannedResult, startScan, stopScan } = useScanner('putaway-scanner-video')
const { api } = useApi()

const locationBarcode = ref('')
const activeItem = ref<any>(null)
const isDark = useState<boolean>('isDark', () => false)

type ApiSupplier = { id: string; code: string; name: string }
type ApiPO = { id: string; poNumber: string; supplier: ApiSupplier }
type ApiGRN = { id: string; grnNumber: string; status: string; purchaseOrder: ApiPO }

type ApiPutawayItem = {
  id: string
  itemId: string
  item: { id: string; sku: string; name: string }
  itemLotId?: string | null
  itemLot?: { id: string; lotNumber?: string | null } | null
  quantity: number
  toLocationId?: string | null
  toLocation?: { id: string; code: string } | null
  status: string
}

type ApiPutawayTask = {
  id: string
  putawayNumber: string
  goodsReceiptId: string
  goodsReceipt: { id: string; grnNumber: string; purchaseOrder: ApiPO }
  fromLocationId: string
  fromLocation: { id: string; code: string; warehouse?: { id: string; code: string; name: string } }
  status: 'DRAFT' | 'COMPLETED' | 'VOIDED'
  notes?: string | null
  items: ApiPutawayItem[]
}

type UiPutawayLine = {
  id: string
  item_name: string
  sku: string
  qty: number
  unit: string
  status: 'PENDING' | 'DONE'
  assigned_location: string
}

const loadingGrn = ref(false)
const grnOptions = ref<Array<{ label: string; value: string }>>([])
const selectedGrnId = ref<string>('')

const task = ref<ApiPutawayTask | null>(null)

const pendingItems = computed<UiPutawayLine[]>(() => {
  const items = task.value?.items || []
  return items.map((i) => ({
    id: i.id,
    item_name: i.item?.name || '-',
    sku: i.item?.sku || '-',
    qty: Number(i.quantity || 0),
    unit: 'PCS',
    status: i.toLocationId ? 'DONE' : 'PENDING',
    assigned_location: i.toLocation?.code || ''
  }))
})

const pendingCount = computed(() => pendingItems.value.filter((i) => i.status !== 'DONE').length)
const allDone = computed(() => pendingItems.value.length > 0 && pendingItems.value.every(i => i.status === 'DONE'))

function selectItem(item: any) {
  if (item.status === 'DONE') return
  activeItem.value = item
  locationBarcode.value = ''
}

function startScanner() {
  startScan((code) => {
    locationBarcode.value = code
    assignLocation()
  })
}

function stopScanner() {
  stopScan()
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchCompletedGrns() {
  loadingGrn.value = true
  try {
    const res = await api<{ success: true; grns: ApiGRN[] }>('/api/goods-receipts', {
      query: { status: 'COMPLETED', page: 1, limit: 200 }
    })
    const grns = (res as any).grns || []
    grnOptions.value = grns.map((g: any) => ({
      value: g.id,
      label: `${g.grnNumber} - ${g.purchaseOrder?.supplier?.name || '-'}`
    }))
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingGrn.value = false
  }
}

async function fetchTask(id: string) {
  const res = await api<{ success: true; task: ApiPutawayTask }>(`/api/putaway/${id}`)
  task.value = (res as any).task
}

async function ensureTaskForGrn(goodsReceiptId: string) {
  try {
    const res = await api<{ success: true; tasks: Array<{ id: string }> }>('/api/putaway', {
      query: { goodsReceiptId, status: 'DRAFT', page: 1, limit: 1 }
    })
    const tasks = (res as any).tasks || []
    if (tasks.length > 0) {
      await fetchTask(tasks[0].id)
      return
    }

    const created = await api<{ success: true; task: ApiPutawayTask }>('/api/putaway', {
      method: 'POST',
      body: { goodsReceiptId }
    })
    task.value = (created as any).task
  } catch (e: any) {
    toast.error(errMsg(e))
    task.value = null
  }
}

async function assignLocation() {
  if (!task.value) return
  if (!locationBarcode.value || !activeItem.value) return

  try {
    const locRes = await api<{ success: true; location: { id: string; code: string } }>(
      `/api/warehouses/locations/code/${encodeURIComponent(locationBarcode.value)}`
    )
    const location = (locRes as any).location
    if (!location?.id) throw new Error('Lokasi tidak ditemukan')

    await api(`/api/putaway/items/${activeItem.value.id}`, {
      method: 'PUT',
      body: { toLocationId: location.id }
    })

    const target = task.value.items.find((x) => x.id === activeItem.value.id)
    if (target) {
      target.toLocationId = location.id
      target.toLocation = { id: location.id, code: location.code }
      target.status = 'ASSIGNED'
    }

    toast.success(`${activeItem.value.item_name} → ${location.code}`)

    locationBarcode.value = ''
    const next = pendingItems.value.find(i => i.status === 'PENDING')
    activeItem.value = next || null
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function completePutaway() {
  if (!task.value) return
  if (!allDone.value) return
  const ok = window.confirm('Complete putaway ini? Stok akan dipindahkan ke lokasi tujuan.')
  if (!ok) return

  try {
    const res = await api<{ success: true; task: ApiPutawayTask }>(`/api/putaway/${task.value.id}/complete`, { method: 'POST' })
    task.value = (res as any).task
    toast.success('Putaway completed.')
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function voidPutaway() {
  if (!task.value) return
  const reason = window.prompt('Alasan void putaway?') || ''
  if (!reason) return
  try {
    const res = await api<{ success: true; task: ApiPutawayTask }>(`/api/putaway/${task.value.id}/void`, {
      method: 'POST',
      body: { reason }
    })
    task.value = (res as any).task
    toast.success('Putaway voided.')
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function deletePutaway() {
  if (!task.value) return
  const ok = window.confirm('Hapus putaway draft ini?')
  if (!ok) return
  try {
    await api(`/api/putaway/${task.value.id}`, { method: 'DELETE' })
    toast.success('Putaway dihapus.')
    task.value = null
    activeItem.value = null
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

watch(selectedGrnId, async (v) => {
  task.value = null
  activeItem.value = null
  locationBarcode.value = ''
  if (!v) return
  await ensureTaskForGrn(v)
})

onMounted(fetchCompletedGrns)
</script>

<style scoped>
@keyframes scan {
  0%, 100% { top: 4px; }
  50% { top: calc(100% - 4px); }
}
.scan-line {
  animation: scan 2s ease-in-out infinite;
}
</style>
