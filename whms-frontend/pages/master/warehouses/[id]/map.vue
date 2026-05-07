<template>
  <div class="h-full flex flex-col p-6 max-w-7xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Button icon="pi pi-arrow-left" text rounded size="small" @click="router.back()" />
          <h1 class="text-2xl font-bold text-slate-900">Interactive Location Map</h1>
        </div>
        <p class="text-sm text-slate-500 ml-10">Visualisasi layout rak dan bin pada {{ warehouseName || 'Gudang' }}</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-xs font-medium text-slate-600">
          <div class="w-4 h-4 rounded bg-white border border-slate-200"></div> Kosong
          <div class="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 ml-3"></div> Masih Ada Ruang
          <div class="w-4 h-4 rounded bg-yellow-100 border border-yellow-400 ml-3"></div> Hampir Penuh
          <div class="w-4 h-4 rounded bg-red-100 border border-red-300 ml-3"></div> Penuh
        </div>
      </div>
    </div>

    <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-auto">
      <div v-if="loading" class="flex flex-col items-center justify-center h-full text-slate-400">
        <i class="pi pi-spin pi-spinner text-3xl mb-4"></i>
        <span>Memuat data layout dari server...</span>
      </div>
      <div v-else-if="Object.keys(groupedLocations).length === 0" class="flex flex-col items-center justify-center h-full text-slate-400">
        <i class="pi pi-inbox text-5xl mb-4 text-slate-300"></i>
        <h3 class="text-lg font-medium text-slate-600">Belum Ada Lokasi</h3>
        <p class="text-sm mt-1">Tambahkan lokasi penyimpanan (Lorong, Rak, Bin) untuk {{ warehouseName }}</p>
      </div>
      <div v-else class="min-w-[800px] min-h-[600px] relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex items-start justify-start p-8 overflow-x-auto">
        
        <!-- Interactive Flex Container (Aisles) -->
        <div class="flex gap-6 w-full pb-4">
          
          <div v-for="(aisle, aisleName) in groupedLocations" :key="aisleName" class="min-w-[280px] flex flex-col gap-3 p-4 bg-slate-200/50 rounded-xl border border-slate-200">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Lorong {{ aisleName || '-' }}</h3>
            
            <div v-for="(rack, rackName) in aisle.racks" :key="rackName" class="w-full border bg-slate-100 rounded-lg p-3 flex flex-col gap-2 hover:border-primary-400 transition-colors shadow-sm">
              <div class="text-[10px] font-semibold text-slate-400">Rak {{ rackName || '-' }}</div>
              
              <div class="grid grid-cols-2 gap-2 w-full mt-1">
                <div v-for="bin in rack.bins" :key="bin.id" 
                  :class="[
                    'h-10 rounded flex items-center justify-center text-[10px] font-bold shadow-sm transition-all hover:scale-105',
                    getBinStatus(bin).class
                  ]"
                  v-tooltip.top="`${bin.code} (${getBinStatus(bin).text})`"
                  @click="inspectBin(bin)"
                >
                  {{ bin.bin || bin.level || '?' }}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
      
      <p class="text-xs text-slate-400 mt-4 text-center">
        * Layout matriks ini digenerasikan secara otomatis berdasarkan relasi gudang, lokasi penyimpanan, dan inventori dari database.
      </p>
    </div>
  </div>

  <!-- Bin Details Dialog -->
  <Dialog v-model:visible="showBinDetails" :header="`Detail Penyimpanan: ${selectedBinCode}`" :modal="true" class="w-full max-w-md">
    <p class="text-sm text-slate-500 mb-4">Daftar inventori yang tersimpan di lokasi ini.</p>
    
    <div v-if="selectedBinItems.length > 0" class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
      <div v-for="inv in selectedBinItems" :key="inv.id" class="p-3 border border-slate-200 rounded-lg flex items-center justify-between bg-slate-50">
        <div>
          <div class="font-medium text-slate-800">{{ inv.item?.name }}</div>
          <div class="text-xs text-slate-500">SKU: {{ inv.item?.code }}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-primary-700">{{ inv.onHandQty }} <span class="text-[10px] text-slate-500">{{ inv.item?.defaultUom || 'Pcs' }}</span></div>
          <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Tersedia</div>
        </div>
      </div>
    </div>
    <div v-else class="text-center p-6 text-slate-500">
      <i class="pi pi-box text-3xl mb-2 text-slate-300"></i>
      <p>Tidak ada item di lokasi ini</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="Tutup" severity="secondary" outlined @click="showBinDetails = false" />
        <Button label="Kelola Inventori" severity="primary" @click="showBinDetails = false; router.push('/inventory')" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { api } = useApi()

const warehouseId = route.params.id as string
const warehouseName = ref('')
const loading = ref(true)

// Dialog State
const showBinDetails = ref(false)
const selectedBinCode = ref('')
const selectedBinItems = ref<any[]>([])

// Data State
const locations = ref<any[]>([])
const inventories = ref<any[]>([])

// Extract Hierarchy dynamically based on Storage data
const groupedLocations = computed(() => {
  const aisles: Record<string, { racks: Record<string, { bins: any[] }> }> = {}
  
  for (const loc of locations.value) {
    // If no aisle is set, use Zone or 'Utama' (Main)
    const a = loc.aisle || loc.zone || 'Utama'
    const r = loc.rack || '1'
    
    if (!aisles[a]) aisles[a] = { racks: {} }
    if (!aisles[a].racks[r]) aisles[a].racks[r] = { bins: [] }
    
    aisles[a].racks[r].bins.push(loc)
  }
  
  // Sort bins inside their respective racks for correct display order
  for (const a in aisles) {
    for (const r in aisles[a].racks) {
        aisles[a].racks[r].bins.sort((x, y) => (x.code || '').localeCompare(y.code || ''))
    }
  }
  
  return aisles
})

function getBinItems(locationId: string) {
  return inventories.value.filter(inv => inv.locationId === locationId && inv.onHandQty > 0)
}

function getBinStatus(loc: any) {
    const items = getBinItems(loc.id)
    const totalQty = items.reduce((sum, inv) => sum + (inv.onHandQty || 0), 0)
    
    if (totalQty === 0) return { class: 'bg-white text-slate-500 border border-slate-300 cursor-pointer', text: 'Kosong' }
    
    const capacity = loc.capacity || 100 // fallback if capacity is essentially null/0
    const ratio = totalQty / capacity
    
    if (ratio > 0.9) return { class: 'bg-red-100 text-red-700 border border-red-300 cursor-pointer', text: 'Penuh' }
    if (ratio > 0.5) return { class: 'bg-yellow-100 text-yellow-800 border border-yellow-400 cursor-pointer', text: 'Hampir Penuh' }
    return { class: 'bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-pointer', text: 'Masih Ada Ruang' }
}

async function fetchMapData() {
  loading.value = true
  try {
    const [locsRes, invRes, whRes] = await Promise.all([
      api<any>(`/api/warehouses/locations?warehouseId=${warehouseId}&limit=1000`),
      api<any>(`/api/inventory/warehouse/${warehouseId}`),
      api<any>(`/api/warehouses/warehouses/${warehouseId}`)
    ])
    locations.value = locsRes.locations || []
    inventories.value = invRes.inventories || []
    warehouseName.value = whRes.warehouse?.name || whRes.warehouse?.code || 'Gudang'
  } catch (err: any) {
    toast.error('Gagal memuat layout data: ' + err.message)
  } finally {
    loading.value = false
  }
}

function inspectBin(location: any) {
  selectedBinCode.value = location.code
  selectedBinItems.value = getBinItems(location.id)
  showBinDetails.value = true
}

onMounted(() => {
  fetchMapData()
})
</script>
