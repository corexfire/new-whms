<template>
  <div class="min-h-screen bg-slate-900 text-white flex flex-col">
    
    <!-- Top Bar -->
    <div class="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" text rounded class="text-white" @click="router.back()" />
        <div>
          <h1 class="text-base font-bold">Picking: {{ pickList?.pickNumber || pickListId }}</h1>
          <p class="text-xs text-slate-400">
            SO: {{ pickList?.salesOrder?.soNumber || '-' }} · {{ pendingCount }} / {{ pickItems.length }} line tersisa
            <span v-if="pickList?.assignedTo">· Picker: {{ pickerName(pickList.assignedTo) }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="pickList && pickList.status !== 'COMPLETED'"
          label="Assign Picker"
          icon="pi pi-user"
          severity="secondary"
          outlined
          size="small"
          @click="showAssign = true"
        />
        <Button
          v-if="pickList && pickList.status !== 'COMPLETED'"
          label="Validate"
          icon="pi pi-check-circle"
          severity="secondary"
          outlined
          size="small"
          @click="validatePacking"
          :loading="saving"
        />
        <Button
          v-if="pickList && pickList.status !== 'COMPLETED'"
          label="Complete"
          icon="pi pi-check"
          severity="success"
          size="small"
          @click="completePick"
          :disabled="!allPicked || !packingValid"
          :loading="saving"
        />
      </div>
    </div>

    <!-- Scanner Area -->
    <div class="relative bg-black h-40 overflow-hidden shrink-0">
      <video id="picking-scanner-video" class="w-full h-full object-cover" />
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-48 h-20 border-2 border-white/60 rounded-lg relative">
          <div class="absolute left-0 right-0 h-0.5 bg-blue-400/80 pick-scan-line"></div>
        </div>
      </div>
      <div class="absolute bottom-2 left-0 right-0 flex gap-2 justify-center">
        <Button v-if="!isScanning" label="Scan Barcode Item" icon="pi pi-camera" size="small" @click="startScanner" />
        <Button v-else label="Stop" icon="pi pi-times" severity="danger" size="small" @click="stopScanner" />
      </div>
    </div>

    <!-- Manual input -->
    <div class="px-4 py-3 bg-slate-800 shrink-0">
      <div class="flex gap-2">
        <InputText v-model="manualBarcode" placeholder="Scan atau ketik barcode item..." class="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400" @keydown.enter="verifyItem" />
        <Button icon="pi pi-check" label="Scan" @click="verifyItem" :disabled="!manualBarcode || !pickList || pickList.status === 'COMPLETED'" :loading="saving" />
      </div>
    </div>

    <div v-if="validationIssues.length > 0" class="px-4 py-3 bg-amber-900/20 border-b border-amber-500/30 text-amber-200 text-xs shrink-0">
      <div class="font-semibold mb-1">Packing validation issues:</div>
      <ul class="list-disc pl-5 space-y-0.5">
        <li v-for="(i, idx) in validationIssues" :key="idx">{{ i }}</li>
      </ul>
    </div>

    <!-- Pick Items List -->
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <div v-for="item in pickItems" :key="item.id"
        :class="[
          'p-4 rounded-xl border-2 transition-all',
          item.picked ? 'border-emerald-500/50 bg-emerald-900/20 opacity-70' :
          item.id === activeItemId ? 'border-blue-400 bg-blue-900/20' :
          'border-slate-700 bg-slate-800'
        ]"
        @click="activeItemId = item.id"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <i v-if="item.picked" class="pi pi-check-circle text-emerald-400"></i>
              <p class="font-semibold text-sm">{{ item.item_name }}</p>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
              <span><i class="pi pi-map-marker text-[10px] mr-1"></i>{{ item.location }}</span>
              <span><i class="pi pi-box text-[10px] mr-1"></i>{{ item.picked_qty }} / {{ item.qty }} {{ item.unit }}</span>
              <span class="text-slate-500">SKU: {{ item.sku }}</span>
            </div>
          </div>
          <div class="text-right ml-3">
            <div v-if="item.picked" class="text-emerald-400 text-xs font-bold">✓ Picked</div>
            <div v-else-if="item.id === activeItemId" class="text-blue-400 text-xs font-bold animate-pulse">→ Scan Item</div>
          </div>
        </div>

        <div v-if="pickList && pickList.status !== 'COMPLETED'" class="mt-3 flex items-center justify-between gap-2">
          <div class="text-[10px] text-slate-400">Update picked qty (manual)</div>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="item.editPickedQty"
              :min="0"
              :max="item.qty"
              size="small"
              class="w-28"
              inputClass="text-right"
            />
            <Button
              icon="pi pi-save"
              label="Save"
              size="small"
              severity="secondary"
              outlined
              :loading="saving"
              @click="savePickedQty(item.id, item.editPickedQty)"
            />
          </div>
        </div>
      </div>
    </div>

    <UiModal v-model="showAssign" title="Assign Picker" width="420px" :loading="saving">
      <div class="space-y-4">
        <UiSelect
          label="Picker"
          v-model="assignUserId"
          :options="pickerOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Pilih user"
          :loading="loadingPickers"
          required
        />
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showAssign = false" />
        <Button label="Assign" icon="pi pi-check" :loading="saving" :disabled="!assignUserId" @click="assignPicker" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useScanner } from '~/composables/useScanner'
import { useApi } from '~/composables/useApi'

definePageMeta({ layout: 'fullscreen', middleware: ['rbac'], roles: ['SUPER_ADMIN', 'OUTBOUND_STAFF'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { api } = useApi()
const pickListId = String(route.params.id || '')

const { isScanning, startScan, stopScan } = useScanner('picking-scanner-video')
const manualBarcode = ref('')
const activeItemId = ref('1')
const saving = ref(false)

type ApiPickListItem = {
  id: string
  location: { id: string; code: string }
  quantity: number
  pickedQty: number
  soItem: { id: string; item: { id: string; sku: string; name: string } }
}

type ApiPickList = {
  id: string
  pickNumber: string
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED'
  assignedTo?: string | null
  salesOrder: { id: string; soNumber: string; customer: { id: string; code: string; name: string } }
  items: ApiPickListItem[]
}

type ApiUser = { id: string; name: string; email: string }

const pickList = ref<ApiPickList | null>(null)
const pickers = ref<ApiUser[]>([])
const loadingPickers = ref(false)

type UiPickItem = {
  id: string
  item_name: string
  sku: string
  location: string
  qty: number
  picked_qty: number
  unit: string
  picked: boolean
  editPickedQty: number
}

const pickItems = computed<UiPickItem[]>(() => {
  const items = pickList.value?.items || []
  return items.map((it) => ({
    id: it.id,
    item_name: it.soItem?.item?.name || '-',
    sku: it.soItem?.item?.sku || '-',
    location: it.location?.code || '-',
    qty: Number(it.quantity || 0),
    picked_qty: Number(it.pickedQty || 0),
    unit: 'PCS',
    picked: Number(it.pickedQty || 0) >= Number(it.quantity || 0),
    editPickedQty: Number(it.pickedQty || 0),
  }))
})

const pendingCount = computed(() => pickItems.value.filter(i => !i.picked).length)
const allPicked = computed(() => pickItems.value.every(i => i.picked))
const packingValid = ref(false)
const validationIssues = ref<string[]>([])

function startScanner() {
  startScan((code: string) => {
    manualBarcode.value = code
    verifyItem()
  })
}

function stopScanner() { stopScan() }

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchPickList() {
  const res = await api<{ success: true; pickList: ApiPickList }>(`/api/pick-lists/${pickListId}`)
  pickList.value = (res as any).pickList
  const next = pickItems.value.find((i) => !i.picked)
  activeItemId.value = next?.id || (pickItems.value[0]?.id || '')
  packingValid.value = false
  validationIssues.value = []
}

async function fetchPickers() {
  loadingPickers.value = true
  try {
    const res = await api<{ success: true; users: ApiUser[] }>('/api/users', { query: { page: 1, limit: 200 } })
    pickers.value = (res as any).users || []
  } finally {
    loadingPickers.value = false
  }
}

type Option = { value: string; label: string }
const pickerOptions = computed<Option[]>(() => pickers.value.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })))

function pickerName(id: string) {
  return pickers.value.find((u) => u.id === id)?.name || id
}

const showAssign = ref(false)
const assignUserId = ref<string>('')

async function assignPicker() {
  if (!pickList.value) return
  if (!assignUserId.value) return
  saving.value = true
  try {
    await api(`/api/pick-lists/${pickList.value.id}/assign`, { method: 'POST', body: { userId: assignUserId.value } })
    toast.success('Picker assigned.')
    showAssign.value = false
    await fetchPickList()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function verifyItem() {
  if (!pickList.value) return
  if (!manualBarcode.value) return
  saving.value = true
  try {
    await api(`/api/pick-lists/${pickList.value.id}/scan`, {
      method: 'POST',
      body: { barcode: manualBarcode.value, qty: 1 }
    })
    toast.success('Scan recorded.')
    await fetchPickList()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
    manualBarcode.value = ''
  }
}

async function savePickedQty(pickItemId: string, pickedQty: number) {
  if (!pickList.value) return
  saving.value = true
  try {
    await api(`/api/pick-lists/items/${pickItemId}/confirm`, {
      method: 'POST',
      body: { pickedQty: Number(pickedQty || 0) }
    })
    toast.success('Picked qty updated.')
    await fetchPickList()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function validatePacking() {
  if (!pickList.value) return
  saving.value = true
  try {
    const res = await api<{ success: true; valid: boolean; issues: string[] }>(`/api/pick-lists/${pickList.value.id}/validate-packing`)
    packingValid.value = (res as any).valid
    validationIssues.value = (res as any).issues || []
    if (packingValid.value) toast.success('Valid: ready to complete.')
    else toast.warning('Ada selisih picking. Periksa issues.')
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function completePick() {
  if (!pickList.value) return
  const ok = window.confirm('Complete pick list ini? Stok akan dikurangi dari lokasi pick.')
  if (!ok) return

  saving.value = true
  try {
    if (!packingValid.value) {
      await validatePacking()
      if (!packingValid.value) return
    }

    await api(`/api/pick-lists/${pickList.value.id}/complete`, { method: 'POST' })
    toast.success('Pick list completed.')
    await fetchPickList()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([fetchPickList(), fetchPickers()])
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>

<style scoped>
@keyframes pickScan { 0%, 100% { top: 4px; } 50% { top: calc(100% - 4px); } }
.pick-scan-line { animation: pickScan 2s ease-in-out infinite; }
</style>
