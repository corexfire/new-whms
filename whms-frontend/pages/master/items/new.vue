<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Create New Item</h1>
        <p class="text-sm text-slate-500 mt-1">Definisikan informasi produk, SKU, dan struktur unit satuan beserta harganya.</p>
      </div>
      <div class="flex gap-2">
        <Button label="Cancel" severity="secondary" outlined @click="router.back()" />
        <Button label="Save Item" @click="saveItem" :loading="loading" />
      </div>
    </div>

    <!-- MAIN FORM -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Basic Details -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informasi Dasar</h2>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 sm:col-span-1 flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-700">
                SKU (Child) <span class="text-red-500">*</span>
              </label>
              <div class="flex gap-2">
                <InputText v-model="form.sku" class="w-full" placeholder="Contoh: SNK-CLS-BLK-40" />
                <Button severity="secondary" outlined label="Generate" @click="generateSku" />
              </div>
              <small class="text-slate-500">Parent SKU: {{ parentSku || '-' }}</small>
            </div>
            <UiInput label="Nama Barang" v-model="form.name" placeholder="Misal: Kopi Robusta 1KG" required class="col-span-2 sm:col-span-1" />
            
            <UiSelect
              label="Product"
              v-model="form.productId"
              :options="productOptions"
              optionLabel="label"
              optionValue="id"
              placeholder="(Opsional)"
              :loading="mastersLoading"
              class="col-span-2 sm:col-span-1"
            />
            <UiSelect
              label="Kategori"
              v-model="form.categoryId"
              :options="categories"
              optionLabel="name"
              optionValue="id"
              placeholder="(Opsional)"
              :loading="mastersLoading"
              class="col-span-2 sm:col-span-1"
            />
            <UiSelect label="Traceability (Lot/SN)" v-model="form.traceability" :options="['NONE', 'LOT', 'SERIAL_NUMBER']" class="col-span-2 sm:col-span-1" />

            <UiInput label="Warna" v-model="form.color" placeholder="(Opsional)" class="col-span-2 sm:col-span-1" />
            <UiInput label="Size" v-model="form.size" placeholder="(Opsional)" class="col-span-2 sm:col-span-1" />
            <UiInput label="Bahan" v-model="form.material" placeholder="(Opsional)" class="col-span-2 sm:col-span-1" />
            
            <div class="col-span-2 flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-700">Deskripsi</label>
              <Textarea v-model="form.description" rows="3" class="w-full bg-slate-50" placeholder="Detail atau catatan barang..." />
            </div>
          </div>
        </div>

        <!-- UOM System (Satuan Konversi) -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <div>
              <h2 class="text-lg font-semibold text-slate-800">Unit of Measure (UoM)</h2>
              <p class="text-xs text-slate-500">
                Aturan: Satuan dengan Conversion = 1 adalah satuan terbesar (Misal 1 DUS/BAL). Satuan pecahan (Misal PCS) nilainya > 1.
              </p>
            </div>
            <Button icon="pi pi-plus" label="Tambah Satuan" text size="small" @click="addUom" />
          </div>
          
          <div class="space-y-3">
            <div v-for="(unit, idx) in form.units" :key="idx" class="p-3 rounded-lg border border-slate-100 bg-slate-50 relative group">
              <div class="grid grid-cols-12 gap-3 items-end">
                <UiSelect
                  label="Nama Satuan (UoM)"
                  v-model="unit.uomId"
                  :options="uoms"
                  optionLabel="code"
                  optionValue="id"
                  placeholder="Pilih UoM"
                  :loading="mastersLoading"
                  class="col-span-3"
                />

                <div class="flex flex-col gap-1 col-span-2">
                  <label class="text-sm font-medium text-slate-700 text-xs">Conversion Rate</label>
                  <InputNumber v-model="unit.conversionRate" :min="1" suffix=" x" class="w-full" />
                </div>

                <div class="col-span-2">
                  <UiCurrencyInput label="Harga Jual Unit" v-model="unit.price" required />
                </div>

                <UiSelect
                  label="Barcode Type"
                  v-model="unit.barcodeType"
                  :options="barcodeTypeOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="col-span-2"
                />

                <div class="col-span-2 flex flex-col gap-1">
                  <label class="text-sm font-medium text-slate-700 text-xs">Barcode</label>
                  <div class="flex items-center gap-2">
                    <InputText v-model="unit.barcode" placeholder="Scan / input" class="w-full" @input="renderBarcode(unit)" />
                    <Button text rounded class="!w-9 !h-9 !p-0" aria-label="Scan" @click="openBarcodeScanner(unit)">
                      <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 7h2l1-2h4l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/>
                      </svg>
                    </Button>
                  </div>
                </div>

                <div class="col-span-1 flex items-end justify-end">
                  <Button icon="pi pi-trash" severity="danger" text rounded @click="form.units.splice(idx, 1)" :disabled="form.units.length === 1" />
                </div>
              </div>

              <div class="mt-3 bg-white border border-slate-200 rounded-lg p-3">
                <div class="text-[10px] text-slate-500 mb-2">Preview ({{ unit.barcodeType }})</div>
                <div v-if="!unit.barcode" class="text-xs text-slate-500">
                  Belum ada barcode. Scan atau isi manual untuk melihat preview.
                </div>
                <svg v-else :ref="(el) => setBarcodeSvgRef(unit, el)" class="w-full"></svg>
              </div>

              <span v-if="unit.conversionRate === 1 && idx === 0" class="absolute -top-3 left-4 bg-primary-100 text-primary-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-primary-200 shadow-sm">
                Satuan Terbesar (Level 1)
              </span>
            </div>
          </div>
          <div class="mt-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
            <p class="text-sm font-medium text-blue-800">Simulasi Harga:</p>
            <ul class="text-xs mt-2 space-y-1 text-slate-600 list-disc ml-4">
              <li v-for="(unit, i) in sortedUnits" :key="i">
                <b>1 {{ uomCode(unit.uomId) }}</b> = {{ unit.conversionRate }} Pcs Terkecil. Harga: Rp {{ unit.price?.toLocaleString('id-ID') }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Settings Sidebar -->
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 class="text-sm font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Catatan</h2>
          <p class="text-[10px] text-slate-500 leading-tight">
            Traceability: LOT mengaktifkan track lot + expiry, SERIAL_NUMBER mengaktifkan track lot saja.
          </p>
        </div>
      </div>
    </div>
  </div>

  <UiModal v-model="barcodeScannerOpen" title="Scan Barcode" width="600px">
    <div class="space-y-3">
      <div class="text-xs text-slate-500">Arahkan kamera ke barcode, hasil akan terisi otomatis.</div>
      <div v-if="barcodeScannerError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
        {{ barcodeScannerError }}
      </div>
      <video id="newItemBarcodeScannerVideo" class="w-full rounded-lg border border-slate-200 bg-black" autoplay playsinline></video>
    </div>
  </UiModal>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'
import { useScanner } from '~/composables/useScanner'
import JsBarcode from 'jsbarcode'

const router = useRouter()
const toast = useToast()
const { api } = useApi()
const loading = ref(false)

type ApiCategory = { id: string; name: string; description?: string | null }
type ApiUoM = { id: string; code: string; description?: string | null }
type ApiProduct = { id: string; code: string; name: string; description?: string | null; categoryId?: string | null }

const categories = ref<ApiCategory[]>([])
const uoms = ref<ApiUoM[]>([])
const products = ref<ApiProduct[]>([])
const mastersLoading = ref(false)
const barcodeScannerOpen = ref(false)
const barcodeScannerError = ref('')
const barcodeScannerTarget = ref<any>(null)
const { startScan, stopScan } = useScanner('newItemBarcodeScannerVideo')

const barcodeTypeOptions = [
  { label: 'CODE128', value: 'CODE128' },
  { label: 'EAN13', value: 'EAN13' }
]

const productOptions = computed(() => {
  return products.value.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }))
})

const parentSku = computed(() => {
  if (!form.value.productId) return ''
  return products.value.find(p => p.id === form.value.productId)?.code || ''
})

const form = ref({
  sku: '',
  name: '',
  categoryId: null as string | null,
  productId: null as string | null,
  description: '',
  traceability: 'NONE' as 'NONE' | 'LOT' | 'SERIAL_NUMBER',
  color: '',
  size: '',
  material: '',
  units: [
    { uomId: null as string | null, barcode: '', barcodeType: 'CODE128' as 'CODE128' | 'EAN13', conversionRate: 1, price: 0, _svgEl: null as any }
  ]
})

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

// Menurut Rule user_global: Satuan dgn conversion rate 1 (terkecil hitungan rasio induk) adalah Satuan Terbesar DUS/BAL.
const sortedUnits = computed(() => {
  return [...form.value.units].sort((a, b) => a.conversionRate - b.conversionRate)
})

function addUom() {
  form.value.units.push({
    uomId: null,
    barcode: '',
    barcodeType: 'CODE128',
    conversionRate: 1,
    price: 0,
    _svgEl: null
  })
}

function uomCode(uomId: string | null) {
  if (!uomId) return '-'
  return uoms.value.find(u => u.id === uomId)?.code || '-'
}

function toTrackFlags(traceability: 'NONE' | 'LOT' | 'SERIAL_NUMBER') {
  if (traceability === 'LOT') return { trackLot: true, trackExpiry: true }
  if (traceability === 'SERIAL_NUMBER') return { trackLot: true, trackExpiry: false }
  return { trackLot: false, trackExpiry: false }
}

function normalizeSkuPart(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, '-')
}

function colorToSkuCode(color: string) {
  const c = color.trim().toLowerCase()
  if (!c) return ''
  if (c === 'black') return 'BLK'
  if (c === 'white') return 'WHT'
  if (c === 'red') return 'RED'
  if (c === 'blue') return 'BLU'
  if (c === 'green') return 'GRN'
  if (c === 'yellow') return 'YEL'
  return normalizeSkuPart(color).slice(0, 3)
}

function generateSku() {
  const base = parentSku.value
  if (!base) {
    toast.error('Pilih Product (Parent SKU) dulu.')
    return
  }
  const colorCode = colorToSkuCode(form.value.color || '')
  const sizeCode = normalizeSkuPart(form.value.size || '')
  if (!colorCode || !sizeCode) {
    toast.error('Isi Warna dan Size untuk generate SKU.')
    return
  }
  form.value.sku = `${base}-${colorCode}-${sizeCode}`
}

function setBarcodeSvgRef(u: any, el: any) {
  u._svgEl = el
  if (el) renderBarcode(u)
}

function renderBarcode(u: any) {
  if (!u._svgEl) return
  const v = String(u.barcode || '').trim()
  u._svgEl.innerHTML = ''
  if (!v) return
  try {
    JsBarcode(u._svgEl, v, {
      format: u.barcodeType || 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 40,
      margin: 0
    })
  } catch {
    u._svgEl.innerHTML = ''
  }
}

async function openBarcodeScanner(u: any) {
  barcodeScannerTarget.value = u
  barcodeScannerOpen.value = true
  barcodeScannerError.value = ''
  await nextTick()
  try {
    await startScan((text) => {
      if (barcodeScannerTarget.value) {
        barcodeScannerTarget.value.barcode = text
        renderBarcode(barcodeScannerTarget.value)
      }
      barcodeScannerOpen.value = false
    })
  } catch (e: any) {
    barcodeScannerError.value = e?.message || 'Gagal membuka kamera. Pastikan izin kamera di browser dan gunakan https atau localhost.'
    toast.error(barcodeScannerError.value)
  }
}

async function fetchMasters() {
  mastersLoading.value = true
  try {
    const [catRes, uomRes, prodRes] = await Promise.all([
      api<{ success: true; categories: ApiCategory[] }>('/api/master/categories'),
      api<{ success: true; uoms: ApiUoM[] }>('/api/master/uoms'),
      api<{ success: true; products: ApiProduct[] }>('/api/master/products')
    ])
    categories.value = catRes.categories
    uoms.value = uomRes.uoms
    products.value = prodRes.products
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    mastersLoading.value = false
  }
}

async function saveItem() {
  if (!form.value.name || !form.value.sku) {
    toast.error('Lengkapi form wajib.')
    return
  }
  if (!parentSku.value) {
    toast.error('Product (Parent SKU) wajib dipilih.')
    return
  }
  
  // Validasi logic UoM
  if (form.value.units.length === 0) {
    toast.error('Harus mendefinisikan minimal 1 Satuan (UoM).')
    return
  }
  
  const hasBaseUnit = form.value.units.some(u => u.conversionRate === 1)
  if (!hasBaseUnit) {
    toast.error('Harus ada 1 satuan unit terbesar dengan ConversionRate = 1')
    return
  }

  const validUoms = form.value.units.every(u => !!u.uomId && u.conversionRate >= 1 && u.price >= 0)
  if (!validUoms) {
    toast.error('Periksa UoM: wajib pilih UoM, conversion >= 1, dan harga valid.')
    return
  }
  
  loading.value = true
  
  try {
    const { trackLot, trackExpiry } = toTrackFlags(form.value.traceability)
    await api('/api/items', {
      method: 'POST',
      body: {
        sku: form.value.sku,
        name: form.value.name,
        description: form.value.description || undefined,
        categoryId: form.value.categoryId || undefined,
        productId: form.value.productId || undefined,
        color: form.value.color || undefined,
        size: form.value.size || undefined,
        material: form.value.material || undefined,
        trackLot,
        trackExpiry,
        uoms: form.value.units.map(u => ({
          uomId: u.uomId,
          conversionRate: u.conversionRate,
          price: u.price,
          barcode: u.barcode || undefined,
          barcodeType: u.barcodeType
        }))
      }
    })
    toast.success('Berhasil menyimpan barang ' + form.value.name)
    router.push('/master/items')
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

onMounted(fetchMasters)

watch(() => form.value.units, (val) => {
  val.forEach((u: any) => renderBarcode(u))
}, { deep: true })

watch(barcodeScannerOpen, (v) => {
  if (!v) stopScan()
})
</script>
