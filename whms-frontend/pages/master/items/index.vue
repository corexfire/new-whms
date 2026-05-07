<template>
  <div class="p-6">
    <UiDataTable
      title="Master Items"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :pagination="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-64 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search SKU or Name..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-refresh" label="Refresh" severity="secondary" outlined size="small" :loading="loading" @click="fetchItems" />
            <Button class="lg:hidden shrink-0" icon="pi pi-refresh" severity="secondary" outlined size="small" aria-label="Refresh" :loading="loading" @click="fetchItems" />
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Item" size="small" @click="router.push('/master/items/new')" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Item" @click="router.push('/master/items/new')" />
          </div>
        </div>
      </template>
      <template #image="{ data }">
        <div class="flex items-center justify-center">
          <img
            v-if="data.image_url"
            :src="data.image_url"
            class="w-10 h-10 rounded-lg object-cover border border-slate-200"
          />
          <div v-else class="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
            <svg class="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5zm3-1a1 1 0 0 0-1 1v9.586l2.293-2.293a1 1 0 0 1 1.414 0L13 15.586l1.293-1.293a1 1 0 0 1 1.414 0L20 18.586V5a1 1 0 0 0-1-1H7zm13 17v-1.586l-4-4-1.293 1.293a1 1 0 0 1-1.414 0L9 13.414l-5 5V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1zM8.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
            </svg>
          </div>
        </div>
      </template>
      <template #color="{ data }">
        <span
          v-if="data.color_raw"
          class="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-semibold border"
          :style="colorChipStyle(data.color_raw)"
        >
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: colorHex(data.color_raw) }"></span>
          {{ data.color_raw }}
        </span>
        <span v-else class="text-slate-400 text-xs">-</span>
      </template>
      <template #barcode="{ data }">
        <div
          v-if="data.barcode_value"
          class="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer hover:border-slate-300 hover:shadow-sm"
          v-html="generateQrSvg(String(data.barcode_value).trim(), { size: 42, margin: 1 })"
          @click="openItemLabel(data._raw, String(data.barcode_value).trim())"
        ></div>
        <span v-else class="text-slate-400 text-xs">-</span>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" class="!w-9 !h-9 !p-0" aria-label="View" @click="router.push(`/master/items/${data.id}`)">
            <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5c-5.5 0-9.5 4.5-10.7 6.3a1.2 1.2 0 0 0 0 1.4C2.5 14.5 6.5 19 12 19s9.5-4.5 10.7-6.3a1.2 1.2 0 0 0 0-1.4C21.5 9.5 17.5 5 12 5zm0 12c-3.4 0-6.3-2.8-7.8-4.9C5.7 9.8 8.6 7 12 7s6.3 2.8 7.8 4.9C18.3 14.2 15.4 17 12 17zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
            </svg>
          </Button>
          <Button text rounded size="small" class="!w-9 !h-9 !p-0" aria-label="Edit" @click="openEdit(data._raw)">
            <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm18.71-11.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2-1.66z"/>
            </svg>
          </Button>
          <Button text rounded size="small" class="!w-9 !h-9 !p-0" aria-label="Barcode" @click="openBarcodeViewer(data.id)">
            <svg class="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 5h2v14H3V5zm4 0h1v14H7V5zm3 0h2v14h-2V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5z"/>
            </svg>
          </Button>
          <Button text rounded size="small" severity="danger" class="!w-9 !h-9 !p-0" aria-label="Delete" @click="confirmDelete(data.id)">
            <svg class="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/>
            </svg>
          </Button>
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" title="Edit Item" width="70vw">
      <div v-if="editForm" class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UiInput label="SKU" v-model="editForm.sku" disabled />
          <UiInput label="Nama Barang" v-model="editForm.name" required />

          <UiSelect
            label="Product"
            v-model="editForm.productId"
            :options="productOptions"
            optionLabel="label"
            optionValue="id"
            placeholder="(Opsional)"
          />

          <UiSelect
            label="Kategori"
            v-model="editForm.categoryId"
            :options="categories"
            optionLabel="name"
            optionValue="id"
            placeholder="(Opsional)"
          />

          <UiSelect
            label="Traceability"
            v-model="editForm.traceability"
            :options="['NONE', 'LOT', 'SERIAL_NUMBER']"
          />

          <UiInput label="Warna" v-model="editForm.color" placeholder="(Opsional)" />
          <UiInput label="Size" v-model="editForm.size" placeholder="(Opsional)" />
          <UiInput label="Bahan" v-model="editForm.material" placeholder="(Opsional)" />

          <div class="lg:col-span-2 flex flex-col gap-1">
            <label class="text-sm font-medium text-slate-700">Deskripsi</label>
            <Textarea v-model="editForm.description" rows="3" class="w-full bg-slate-50" placeholder="(Opsional)" />
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-800">Unit of Measure (UoM)</h3>
              <p class="text-[10px] text-slate-500">ConversionRate = 1 adalah unit terbesar.</p>
            </div>
            <Button icon="pi pi-plus" label="Tambah Satuan" text size="small" @click="addUom" />
          </div>

          <div class="space-y-3">
            <div v-for="(unit, idx) in editForm.uoms" :key="unit._key" class="p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div class="grid grid-cols-12 gap-3 items-end">
                <UiSelect
                  label="UoM"
                  v-model="unit.uomId"
                  :options="uoms"
                  optionLabel="code"
                  optionValue="id"
                  placeholder="Pilih UoM"
                  class="col-span-3"
                  :disabled="!!unit.id"
                />

                <div class="flex flex-col gap-1 col-span-2">
                  <label class="text-sm font-medium text-slate-700 text-xs">Conversion Rate</label>
                  <InputNumber v-model="unit.conversionRate" :min="1" suffix=" x" class="w-full" />
                </div>

                <div class="col-span-2">
                  <UiCurrencyInput label="Harga" v-model="unit.price" />
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
                  <Button icon="pi pi-trash" severity="danger" text rounded @click="removeUom(idx)" :disabled="editForm.uoms.length === 1" />
                </div>
              </div>

              <div class="mt-3 bg-white border border-slate-200 rounded-lg p-3">
                <div class="text-[10px] text-slate-500 mb-2">Preview</div>
                <div v-if="!unit.barcode" class="text-xs text-slate-500">
                  Belum ada barcode. Scan atau isi manual untuk melihat preview.
                </div>
                <div v-else class="grid grid-cols-2 gap-4 items-center justify-items-center">
                  <div class="w-full text-center">
                    <div class="text-[10px] text-slate-400 mb-1">1D ({{ unit.barcodeType }})</div>
                    <svg :ref="(el) => setBarcodeSvgRef(unit, el)" class="w-full h-14"></svg>
                  </div>
                  <div class="flex flex-col items-center">
                    <div class="text-[10px] text-slate-400 mb-1">2D (QR Code)</div>
                    <div class="w-[90px] h-[90px]" v-html="generateQrSvg(unit.barcode)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between w-full">
          <Button v-if="editForm?.id" label="Delete" icon="pi pi-trash" severity="danger" text :loading="deleting" @click="deleteItem" />
          <div class="flex gap-2">
            <Button label="Cancel" icon="pi pi-times" severity="secondary" text @click="showDialog = false" />
            <Button label="Save" icon="pi pi-check" :loading="saving" @click="saveEdit" />
          </div>
        </div>
      </template>
    </UiModal>

    <UiModal v-model="barcodeScannerOpen" title="Scan Barcode" width="600px">
      <div class="space-y-3">
        <div class="text-xs text-slate-500">Arahkan kamera ke barcode, hasil akan terisi otomatis.</div>
        <div v-if="barcodeScannerError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {{ barcodeScannerError }}
        </div>
        <video id="itemBarcodeScannerVideo" class="w-full rounded-lg border border-slate-200 bg-black" autoplay playsinline></video>
      </div>
    </UiModal>

    <UiModal v-model="barcodeViewerOpen" title="Barcodes" width="70vw" :loading="barcodeViewerLoading">
      <div v-if="barcodeViewerItem" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-500">SKU</p>
            <p class="font-semibold text-slate-800">{{ barcodeViewerItem.sku }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500">Name</p>
            <p class="font-semibold text-slate-800">{{ barcodeViewerItem.name }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <div v-for="u in barcodeViewerUoms" :key="u.id" class="p-3 border border-slate-200 rounded-lg">
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-slate-800 w-20">{{ u.uom.code }}</span>
              <span class="text-xs text-slate-500 w-24">Conv {{ u.conversionRate }}x</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 w-20 text-center">
                {{ u.barcodeTypeLocal }}
              </span>
              <span class="text-xs font-mono text-slate-700 truncate flex-1">{{ u.barcodeLocal || '-' }}</span>
              <div class="flex items-center gap-2">
                <Button text rounded size="small" icon="pi pi-copy" :disabled="!u.barcodeLocal" @click="copyBarcode(u)" />
                <Button text rounded size="small" icon="pi pi-download" :disabled="!u.barcodeLocal" @click="downloadBarcodePng(u)" />
                <Button text rounded size="small" icon="pi pi-print" :disabled="!u.barcodeLocal" @click="printBarcode(u)" />
              </div>
            </div>

            <div class="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div class="text-[10px] text-slate-500 mb-2">Preview</div>
              <div v-if="!u.barcodeLocal" class="text-xs text-slate-500">
                Barcode belum diisi untuk UoM ini.
              </div>
              <div v-else class="grid grid-cols-2 gap-4 items-center justify-items-center">
                <div class="w-full text-center">
                  <div class="text-[10px] text-slate-400 mb-1">1D Barcode</div>
                  <svg :ref="(el) => setBarcodeViewerSvgRef(u, el)" class="w-full h-16"></svg>
                </div>
                <div class="flex flex-col items-center">
                  <div class="text-[10px] text-slate-400 mb-1">2D QR Code</div>
                  <div class="w-[120px] h-[120px]" v-html="generateQrSvg(u.barcodeLocal)"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="py-10 text-center text-slate-500">
        <i class="pi pi-qrcode text-3xl mb-2 block opacity-40"></i>
        <p class="text-sm font-semibold">Tidak ada data</p>
      </div>

      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="barcodeViewerOpen = false" />
        <Button label="Kelola Barcodes" icon="pi pi-external-link" severity="secondary" outlined @click="openManageBarcodes()" :disabled="!barcodeViewerItem" />
      </template>
    </UiModal>

    <UiModal v-model="itemLabelOpen" title="Item Label" width="520px">
      <div v-if="itemLabelItem" class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-xs text-slate-500">SKU</div>
            <div class="font-semibold text-slate-900 break-all">{{ itemLabelItem.sku }}</div>
            <div class="text-xs text-slate-500 mt-2">Nama</div>
            <div class="text-sm text-slate-800 break-words">{{ itemLabelItem.name }}</div>
            <div class="text-xs text-slate-500 mt-2">Product / Category</div>
            <div class="text-sm text-slate-700 break-words">
              {{ itemLabelItem.product ? itemLabelItem.product.code + ' — ' + itemLabelItem.product.name : '-' }} · {{ itemLabelItem.category?.name || '-' }}
            </div>
          </div>
          <div class="shrink-0 w-[140px] h-[140px] bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden" v-html="generateQrSvg(itemLabelQrValue, { size: 160, margin: 2 })"></div>
        </div>
        <div class="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 break-all">
          {{ itemLabelQrValue }}
        </div>
      </div>
      <div v-else class="py-8 text-center text-slate-500">
        <p class="text-sm font-semibold">Tidak ada data</p>
      </div>
      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="itemLabelOpen = false" />
        <Button label="Print Label" icon="pi pi-print" @click="printItemLabel()" :disabled="!itemLabelItem" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'
import { useScanner } from '~/composables/useScanner'
import JsBarcode from 'jsbarcode'
import { generateQrSvg } from '~/composables/useQrSvg'

const router = useRouter()
const toast = useToast()
const { api } = useApi()

const searchQuery = ref('')

type ApiCategory = { id: string; name: string; description?: string | null }
type ApiUoM = { id: string; code: string; description?: string | null }
type ApiItemUoM = { id: string; uomId: string; conversionRate: number; price: number; barcode?: string | null; barcodeType?: 'CODE128' | 'EAN13' | 'QR_CODE'; uom: ApiUoM }
type ApiProduct = { id: string; code: string; name: string; description?: string | null; categoryId?: string | null }
type ApiItemImage = { id: string; itemId: string; filename: string; mimeType: string; size: number; createdAt: string }
type ApiItem = {
  id: string
  sku: string
  name: string
  description?: string | null
  categoryId?: string | null
  category?: ApiCategory | null
  productId?: string | null
  product?: ApiProduct | null
  color?: string | null
  size?: string | null
  material?: string | null
  variantAttributes?: any
  isActive: boolean
  trackLot: boolean
  trackExpiry: boolean
  uoms: ApiItemUoM[]
  images?: ApiItemImage[]
}

type BarcodeViewerUomRow = ApiItemUoM & {
  barcodeLocal: string
  barcodeTypeLocal: 'CODE128' | 'EAN13' | 'QR_CODE'
  _svgEl: any | null
}

type EditUomRow = {
  _key: string
  id?: string
  uomId: string | null
  conversionRate: number
  price: number
  barcode: string
  barcodeType: 'CODE128' | 'EAN13' | 'QR_CODE'
  _svgEl?: any
}

type EditForm = {
  id: string
  sku: string
  name: string
  description: string
  categoryId: string | null
  productId: string | null
  traceability: 'NONE' | 'LOT' | 'SERIAL_NUMBER'
  color: string
  size: string
  material: string
  uoms: EditUomRow[]
}

const items = ref<ApiItem[]>([])
const loading = ref(false)

const categories = ref<ApiCategory[]>([])
const uoms = ref<ApiUoM[]>([])
const products = ref<ApiProduct[]>([])

const productOptions = computed(() => {
  return products.value.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }))
})

const showDialog = ref(false)
const editForm = ref<EditForm | null>(null)
const originalUoms = ref<ApiItemUoM[]>([])
const saving = ref(false)
const deleting = ref(false)
const barcodeScannerOpen = ref(false)
const barcodeScannerError = ref('')
const barcodeScannerTarget = ref<EditUomRow | null>(null)
const { startScan, stopScan } = useScanner('itemBarcodeScannerVideo')

const barcodeViewerOpen = ref(false)
const barcodeViewerLoading = ref(false)
const barcodeViewerItem = ref<ApiItem | null>(null)
const barcodeViewerUoms = ref<BarcodeViewerUomRow[]>([])

const itemLabelOpen = ref(false)
const itemLabelItem = ref<ApiItem | null>(null)
const itemLabelQrValue = ref('')

const barcodeTypeOptions = [
  { label: 'CODE128', value: 'CODE128' },
  { label: 'EAN13', value: 'EAN13' },
  { label: 'QR Code', value: 'QR_CODE' }
]

const rows = computed(() => {
  return items.value.map((item) => {
    const baseUom = item.uoms?.[0]
    const primaryImg = item.images?.[0]
    const barcodeUom = item.uoms?.find((u) => !!u.barcode) || null
    const qrValue = String((barcodeUom?.barcode || item.sku || '') as any).trim()
    return {
      id: item.id,
      parent_sku: item.product?.code || item.sku.split('-').slice(0, 2).join('-'),
      sku: item.sku,
      name: item.name,
      product: item.product ? `${item.product.code} — ${item.product.name}` : '-',
      category: item.category?.name || '-',
      color_raw: item.color || '',
      size: item.size || '-',
      material: item.material || '-',
      base_uom: baseUom?.uom?.code || '-',
      base_price: baseUom?.price ?? null,
      track_lot: item.trackLot ? 'YES' : 'NO',
      track_expiry: item.trackExpiry ? 'YES' : 'NO',
      image_url: primaryImg ? `${apiBase}/uploads/items/${item.id}/${primaryImg.filename}` : '',
      barcode_value: qrValue,
      barcode_type: 'QR_CODE',
      _raw: item
    }
  })
})

const apiBase = useRuntimeConfig().public.apiBase as string

function colorHex(color: string) {
  const c = color.trim().toLowerCase()
  if (c === 'black') return '#111827'
  if (c === 'white') return '#ffffff'
  if (c === 'red') return '#ef4444'
  if (c === 'blue') return '#3b82f6'
  if (c === 'green') return '#22c55e'
  if (c === 'yellow') return '#f59e0b'
  if (c === 'gray' || c === 'grey') return '#64748b'
  return '#0ea5e9'
}

function colorChipStyle(color: string) {
  const hex = colorHex(color)
  const text = color.trim().toLowerCase() === 'white' ? '#0f172a' : '#0f172a'
  return {
    backgroundColor: `${hex}20`,
    borderColor: `${hex}40`,
    color: text
  } as any
}
function toTraceability(item: ApiItem): EditForm['traceability'] {
  if (item.trackLot && item.trackExpiry) return 'LOT'
  if (item.trackLot) return 'SERIAL_NUMBER'
  return 'NONE'
}

function toTrackFlags(traceability: EditForm['traceability']) {
  if (traceability === 'LOT') return { trackLot: true, trackExpiry: true }
  if (traceability === 'SERIAL_NUMBER') return { trackLot: true, trackExpiry: false }
  return { trackLot: false, trackExpiry: false }
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
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
  }
}

async function fetchItems() {
  loading.value = true
  try {
    const res = await api<{ success: true; items: ApiItem[] }>('/api/items', {
      query: {
        search: searchQuery.value || undefined,
        page: 1,
        limit: 200
      }
    })
    items.value = res.items
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function onRowClicked(e: any) {
  const item: ApiItem | undefined = e?.data?._raw
  if (!item) return
  openEdit(item)
}

function onCellDoubleClicked(e: any) {
  const item: ApiItem | undefined = e?.data?._raw
  if (!item) return
  openEdit(item)
}

function openEdit(item: ApiItem) {
  originalUoms.value = item.uoms || []
  editForm.value = {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description || '',
    categoryId: item.categoryId || null,
    productId: item.productId || null,
    traceability: toTraceability(item),
    color: item.color || '',
    size: item.size || '',
    material: item.material || '',
    uoms: (item.uoms || []).map((u) => ({
      _key: u.id,
      id: u.id,
      uomId: u.uomId,
      conversionRate: u.conversionRate,
      price: u.price,
      barcode: u.barcode || '',
      barcodeType: (u.barcodeType || 'CODE128') as any,
      _svgEl: null
    }))
  }
  const ef = editForm.value
  if (ef && ef.uoms.length === 0) {
    ef.uoms.push({ _key: String(Date.now()), uomId: null, conversionRate: 1, price: 0, barcode: ef.sku, barcodeType: 'QR_CODE', _svgEl: null })
  } else if (ef) {
    ef.uoms = ef.uoms.map((u) => ({
      ...u,
      barcodeType: u.barcode ? u.barcodeType : 'QR_CODE',
      barcode: u.barcode || ef.sku
    }))
  }
  showDialog.value = true
}

function addUom() {
  const ef = editForm.value
  if (!ef) return
  ef.uoms.push({ _key: String(Date.now() + Math.random()), uomId: null, conversionRate: 1, price: 0, barcode: ef.sku, barcodeType: 'QR_CODE', _svgEl: null })
}

function removeUom(idx: number) {
  if (!editForm.value) return
  if (editForm.value.uoms.length <= 1) return
  editForm.value.uoms.splice(idx, 1)
}

function setBarcodeSvgRef(u: EditUomRow, el: any) {
  u._svgEl = el
  if (el) renderBarcode(u)
}

function renderBarcode(u: EditUomRow) {
  if (!u._svgEl) return
  const v = String(u.barcode || '').trim()
  u._svgEl.innerHTML = ''
  if (!v) return
  if (u.barcodeType === 'QR_CODE') return
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

function setBarcodeViewerSvgRef(u: BarcodeViewerUomRow, el: any) {
  u._svgEl = el
  if (el) renderBarcodeViewer(u)
}

function renderBarcodeViewer(u: BarcodeViewerUomRow) {
  if (!u._svgEl) return
  const v = String(u.barcodeLocal || '').trim()
  u._svgEl.innerHTML = ''
  if (!v) return
  if (u.barcodeTypeLocal === 'QR_CODE') return
  try {
    JsBarcode(u._svgEl, v, {
      format: u.barcodeTypeLocal || 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 40,
      margin: 0
    })
  } catch {
    u._svgEl.innerHTML = ''
  }
}

function barcodeViewerBarcodeOptions(u: BarcodeViewerUomRow) {
  return {
    format: u.barcodeTypeLocal || 'CODE128',
    displayValue: true,
    fontSize: 12,
    height: 40,
    margin: 0
  }
}

async function copyBarcode(u: BarcodeViewerUomRow) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    toast.success('Barcode copied')
  } catch {
    toast.error('Gagal copy barcode')
  }
}

function downloadBarcodePng(u: BarcodeViewerUomRow) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v) return
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, v, barcodeViewerBarcodeOptions(u))
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    const sku = String(barcodeViewerItem.value?.sku || 'item')
    const unit = String(u?.uom?.code || 'UOM')
    a.download = `${sku}-${unit}-${v}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    toast.error('Gagal generate PNG')
  }
}

function printBarcode(u: BarcodeViewerUomRow) {
  const v = String(u.barcodeLocal || '').trim()
  if (!v || !u._svgEl) return
  const win = window.open('', '_blank')
  if (!win) return toast.error('Popup diblokir browser')

  const sku = String(barcodeViewerItem.value?.sku || '')
  const name = String(barcodeViewerItem.value?.name || '')
  const unit = String(u?.uom?.code || '')
  const svg = u._svgEl.outerHTML

  win.document.open()
  win.document.write(`
    <html>
      <head>
        <title>Barcode</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
          .label { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; max-width: 420px; }
          .meta { font-size: 12px; color: #334155; margin-bottom: 8px; }
          .sku { font-weight: 700; }
          .name { color: #64748b; }
          .unit { font-weight: 700; margin-left: 8px; }
          svg { width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="meta"><span class="sku">${sku}</span><span class="unit">${unit}</span></div>
          <div class="meta name">${name}</div>
          ${svg}
        </div>
      </body>
    </html>
  `)
  win.document.close()
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
    }
  }, 50)
}

function openItemLabel(item: ApiItem, qrValue: string) {
  itemLabelItem.value = item
  itemLabelQrValue.value = String(qrValue || item?.sku || '').trim()
  itemLabelOpen.value = true
}

function printItemLabel() {
  if (!itemLabelItem.value) return
  const qr = String(itemLabelQrValue.value || itemLabelItem.value.sku || '').trim()
  if (!qr) return

  const win = window.open('', '_blank')
  if (!win) return toast.error('Popup diblokir browser')

  const sku = String(itemLabelItem.value.sku || '')
  const name = String(itemLabelItem.value.name || '')
  const product = itemLabelItem.value.product ? `${itemLabelItem.value.product.code} — ${itemLabelItem.value.product.name}` : '-'
  const category = itemLabelItem.value.category?.name || '-'
  const svg = generateQrSvg(qr, { size: 220, margin: 2 })

  win.document.open()
  win.document.write(`
    <html>
      <head>
        <title>Item Label</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
          .tag { border: 2px solid #0f172a; border-radius: 14px; padding: 16px; width: 360px; }
          .sku { font-weight: 800; letter-spacing: 0.04em; font-size: 14px; margin-bottom: 6px; word-break: break-all; }
          .name { font-size: 12px; color: #334155; margin-bottom: 10px; }
          .meta { font-size: 11px; color: #64748b; margin-bottom: 12px; }
          .qr { width: 220px; height: 220px; margin: 0 auto 10px; }
          .qr svg { width: 100%; height: 100%; }
          .value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 10px; color: #475569; word-break: break-all; text-align: center; }
        </style>
      </head>
      <body>
        <div class="tag">
          <div class="sku">${sku}</div>
          <div class="name">${name}</div>
          <div class="meta">${product} · ${category}</div>
          <div class="qr">${svg}</div>
          <div class="value">${qr}</div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
    </html>
  `)
  win.document.close()
}

async function openBarcodeViewer(itemId: string) {
  barcodeViewerOpen.value = true
  barcodeViewerLoading.value = true
  barcodeViewerItem.value = null
  barcodeViewerUoms.value = []
  try {
    const res = await api<{ success: true; item: ApiItem }>(`/api/items/${itemId}`)
    barcodeViewerItem.value = (res as any).item
    barcodeViewerUoms.value = (barcodeViewerItem.value?.uoms || []).map((u: ApiItemUoM) => ({
      ...u,
      barcodeLocal: u.barcode || barcodeViewerItem.value?.sku || '',
      barcodeTypeLocal: u.barcodeType || (u.barcode ? 'CODE128' : 'QR_CODE'),
      _svgEl: null,
    }))
    await nextTick()
    barcodeViewerUoms.value.forEach((u) => renderBarcodeViewer(u))
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat barcode')
    barcodeViewerOpen.value = false
  } finally {
    barcodeViewerLoading.value = false
  }
}

function openManageBarcodes() {
  if (!barcodeViewerItem.value?.id) return
  barcodeViewerOpen.value = false
  router.push(`/master/items/${barcodeViewerItem.value.id}/barcodes`)
}

async function openBarcodeScanner(u: EditUomRow) {
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

async function saveEdit() {
  if (!editForm.value) return
  if (!editForm.value.name || !editForm.value.sku) {
    toast.error('Lengkapi form wajib.')
    return
  }
  const validUoms = editForm.value.uoms.every((u) => !!u.uomId && u.conversionRate >= 1 && u.price >= 0)
  if (!validUoms) {
    toast.error('Periksa UoM: wajib pilih UoM, conversion >= 1, dan harga valid.')
    return
  }
  const hasBaseUnit = editForm.value.uoms.some((u) => u.conversionRate === 1)
  if (!hasBaseUnit) {
    toast.error('Harus ada 1 satuan unit terbesar dengan ConversionRate = 1')
    return
  }

  saving.value = true
  try {
    const { trackLot, trackExpiry } = toTrackFlags(editForm.value.traceability)
    await api(`/api/items/${editForm.value.id}`, {
      method: 'PUT',
      body: {
        name: editForm.value.name,
        description: editForm.value.description || undefined,
        categoryId: editForm.value.categoryId || undefined,
        productId: editForm.value.productId || undefined,
        color: editForm.value.color || undefined,
        size: editForm.value.size || undefined,
        material: editForm.value.material || undefined,
        trackLot,
        trackExpiry
      }
    })

    const edited = editForm.value.uoms
    const editedById = new Map<string, EditUomRow>()
    for (const u of edited) {
      if (u.id) editedById.set(u.id, u)
    }

    const deletes = originalUoms.value.filter((ou) => !editedById.has(ou.id))
    const updates = originalUoms.value
      .map((ou) => ({ ou, nu: editedById.get(ou.id) }))
      .filter((x): x is { ou: ApiItemUoM; nu: EditUomRow } => !!x.nu)
      .filter(({ ou, nu }) =>
        ou.conversionRate !== nu.conversionRate ||
        ou.price !== nu.price ||
        (ou.barcode || '') !== nu.barcode ||
        (ou.barcodeType || 'CODE128') !== nu.barcodeType
      )

    const creates = edited.filter((u) => !u.id && u.uomId)

    for (const d of deletes) {
      await api(`/api/items/uoms/${d.id}`, { method: 'DELETE' })
    }
    for (const { ou, nu } of updates) {
      await api(`/api/items/uoms/${ou.id}`, {
        method: 'PATCH',
        body: {
          conversionRate: nu.conversionRate,
          price: nu.price,
          barcode: nu.barcode || undefined,
          barcodeType: nu.barcodeType
        }
      })
    }
    for (const c of creates) {
      await api(`/api/items/${editForm.value.id}/uoms`, {
        method: 'POST',
        body: {
          uomId: c.uomId,
          conversionRate: c.conversionRate,
          price: c.price,
          barcode: c.barcode || undefined,
          barcodeType: c.barcodeType
        }
      })
    }

    toast.success('Item berhasil diupdate.')
    showDialog.value = false
    editForm.value = null
    originalUoms.value = []
    await fetchItems()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteItem() {
  if (!editForm.value?.id) return
  const ok = window.confirm('Hapus item ini? Aksi tidak dapat dibatalkan.')
  if (!ok) return

  deleting.value = true
  try {
    await api(`/api/items/${editForm.value.id}`, { method: 'DELETE' })
    toast.success('Item berhasil dihapus.')
    showDialog.value = false
    editForm.value = null
    originalUoms.value = []
    await fetchItems()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    deleting.value = false
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Hapus item ini?')
  if (!ok) return
  deleting.value = true
  try {
    await api(`/api/items/${id}`, { method: 'DELETE' })
    toast.success('Item berhasil dihapus.')
    await fetchItems()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    deleting.value = false
  }
}

let searchTimer: any = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchItems()
  }, 350)
})

onMounted(async () => {
  await fetchMasters()
  await fetchItems()
})

watch(() => editForm.value?.uoms, (val) => {
  if (!val) return
  val.forEach((u) => renderBarcode(u))
}, { deep: true })

watch(barcodeScannerOpen, (v) => {
  if (!v) stopScan()
})

const columns = ref([
  { field: 'image', headerName: ' ', slotName: 'image' },
  { field: 'parent_sku', headerName: 'SKU Parent', width: 140 },
  { field: 'sku', headerName: 'SKU Child', width: 160, pinned: 'left' },
  { field: 'name', headerName: 'Item Name', flex: 1, minWidth: 200 },
  { field: 'product', headerName: 'Product', width: 220 },
  { field: 'category', headerName: 'Category', width: 140 },
  { field: 'color_raw', headerName: 'Warna', width: 140, slotName: 'color' },
  { field: 'size', headerName: 'Size', width: 90 },
  { field: 'material', headerName: 'Bahan', width: 140 },
  { field: 'barcode_value', headerName: 'Barcode', width: 220, slotName: 'barcode' },
  { 
    field: 'base_price',
    headerName: 'Base Price', 
    width: 140,
    valueFormatter: (p: any) => p.value == null ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.value)
  },
  { field: 'base_uom', headerName: 'Base UoM', width: 120 },
  { field: 'track_lot', headerName: 'Lot', width: 90 },
  { field: 'track_expiry', headerName: 'Expiry', width: 90 }
  ,{ field: 'actions', headerName: ' ', slotName: 'actions' }
])
</script>
