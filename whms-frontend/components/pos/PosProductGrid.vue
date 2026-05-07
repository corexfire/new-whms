<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="bg-white border border-slate-200 rounded-xl p-3 mb-3">
      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div class="flex-1 relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            ref="searchEl"
            v-model="search"
            type="text"
            placeholder="Barcode / Nama / SKU / Warna"
            class="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
            @keydown.enter.prevent="fetchCatalog()"
          />
          <button
            v-if="search"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 w-7 h-7 rounded-full hover:bg-slate-100"
            @click="search = ''"
            type="button"
            aria-label="Clear search"
          >
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <UiSelect
          v-model="color"
          :options="colorOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Warna"
          class="md:w-56"
        />

        <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white md:w-56">
          <Checkbox v-model="inStockOnly" inputId="inStockOnly" :binary="true" />
          <label for="inStockOnly" class="text-sm font-medium text-slate-700">In Stock</label>
        </div>

        <div class="flex items-center gap-2">
          <Button icon="pi pi-refresh" text rounded @click="fetchCatalog()" :loading="loading" />
          <span class="text-xs text-slate-500">Total: {{ lastTotal ?? products.length }}</span>
        </div>
      </div>

      <div class="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
        <button
          v-for="cat in categoryTabs"
          :key="cat.id || 'ALL'"
          @click="activeCategoryId = cat.id"
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0',
            activeCategoryId === cat.id
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          ]"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p class="text-xs font-semibold text-slate-600">
          {{ !props.warehouseId ? 'Pilih warehouse untuk menampilkan produk' : loading ? 'Loading...' : lastError ? 'Gagal memuat katalog' : '' }}
        </p>
        <div class="flex items-center gap-2">
          <span v-if="dataSource === 'ITEM_MASTER'" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Fallback
          </span>
          <div v-if="lastError" class="flex items-center gap-2">
            <span class="text-xs text-red-600">{{ lastError }}</span>
            <Button label="Coba Lagi" icon="pi pi-refresh" size="small" severity="secondary" outlined @click="fetchCatalog()" />
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 p-3 overflow-y-auto">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div
            v-for="product in products"
            :key="product.id"
            class="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-primary-400 hover:shadow-md transition-all"
          >
            <div class="relative">
              <div class="w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden">
                <i class="pi pi-box text-3xl text-slate-300"></i>
              </div>
              <span class="absolute top-2 right-2 text-xs font-bold bg-white/90 border border-slate-200 text-slate-800 px-2 py-1 rounded-full">
                {{ formatIdr(product.price) }}
              </span>
              <button
                type="button"
                class="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-slate-800 active:scale-[0.97]"
                @click="$emit('addToCart', product)"
              >
                <i class="pi pi-plus text-sm"></i>
              </button>
            </div>
            <div class="p-3">
              <p class="text-sm font-semibold text-slate-800 truncate">{{ product.name }}</p>
              <p class="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{{ product.sku }}</p>
              <div class="flex items-center justify-between mt-2">
                <span
                  v-if="product.color"
                  class="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  :style="colorChipStyle(product.color)"
                >
                  {{ product.color }}
                </span>
                <span :class="[
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  product.stock > 10 ? 'text-emerald-700 bg-emerald-50' : product.stock > 0 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                ]">
                  Stock: {{ product.stock }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="products.length === 0 && !loading && props.warehouseId && !lastError" class="py-14 text-center text-slate-500">
          <i class="pi pi-search text-3xl mb-2 block opacity-40"></i>
          <p class="text-sm font-semibold">Produk tidak ditemukan</p>
          <p class="text-xs text-slate-500 mt-1">Coba cari dengan SKU / nama / barcode / warna, atau matikan filter In Stock.</p>
          <div class="mt-3 flex items-center justify-center gap-2">
            <Button v-if="inStockOnly" label="Tampilkan Semua" size="small" severity="secondary" outlined @click="inStockOnly = false" />
            <Button label="Refresh" icon="pi pi-refresh" size="small" severity="secondary" outlined @click="fetchCatalog()" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const emit = defineEmits<{
  (e: 'addToCart', product: any): void
}>()

const props = defineProps<{ warehouseId?: string | null }>()

const toast = useToast()
const { api } = useApi()

const search = ref('')
const color = ref<string | null>(null)
const activeCategoryId = ref<string | null>(null)
const loading = ref(false)
const inStockOnly = ref(false)
const lastError = ref<string | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const dataSource = ref<'POS_CATALOG' | 'ITEM_MASTER'>('POS_CATALOG')
const lastTotal = ref<number | null>(null)

type ApiCategory = { id: string; name: string }
type ApiItem = {
  id: string
  sku: string
  name: string
  color?: string | null
  uoms?: Array<{ conversionRate: number; price: number; uom: { code: string } }>
}
type CatalogProduct = {
  id: string
  sku: string
  name: string
  color?: string | null
  price: number
  unit: string
  stock: number
}

type Option = { value: string | null; label: string }

const categories = ref<ApiCategory[]>([])
const products = ref<CatalogProduct[]>([])

const categoryTabs = computed(() => [
  { id: null, label: 'Semua' },
  ...categories.value.map((c) => ({ id: c.id, label: c.name })),
])

const colorOptions = computed<Option[]>(() => {
  const colors = new Set<string>()
  for (const it of products.value) {
    const c = (it.color || '').trim()
    if (c) colors.add(c)
  }
  return [{ value: null, label: 'Semua Warna' }, ...Array.from(colors).sort().map((c) => ({ value: c, label: c }))]
})

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  const res = await api<{ success: true; categories: ApiCategory[] }>('/api/master/categories')
  categories.value = (res as any).categories || []
}

async function fetchCatalog() {
  if (!props.warehouseId) {
    products.value = []
    lastError.value = null
    dataSource.value = 'POS_CATALOG'
    lastTotal.value = null
    return
  }

  loading.value = true
  try {
    const res = await api<{ success: true; products: CatalogProduct[]; total?: number }>('/api/pos/catalog', {
      query: {
        warehouseId: props.warehouseId,
        search: search.value || undefined,
        categoryId: activeCategoryId.value || undefined,
        color: color.value || undefined,
        inStockOnly: String(inStockOnly.value),
        page: 1,
        limit: 200,
      },
    })
    const apiProducts = (res as any).products || []
    products.value = apiProducts
    lastTotal.value = (res as any).total ?? apiProducts.length
    lastError.value = null
    dataSource.value = 'POS_CATALOG'

    if (products.value.length === 0) {
      const fallback = await api<{ success: true; items: ApiItem[] }>('/api/items', {
        query: {
          search: search.value || undefined,
          categoryId: activeCategoryId.value || undefined,
          color: color.value || undefined,
          page: 1,
          limit: 200,
        },
      })

      const items = (fallback as any).items || []
      products.value = items.map((it: ApiItem) => {
        const uoms = Array.isArray(it.uoms) ? it.uoms : []
        const base = uoms.find((u) => Number(u.conversionRate) === 1) || uoms[0]
        const unit = base?.uom?.code || 'PCS'
        const price = Number(base?.price || 0)
        return { id: it.id, sku: it.sku, name: it.name, color: it.color, price, unit, stock: 0 }
      })
      dataSource.value = 'ITEM_MASTER'
      lastTotal.value = items.length
    }
  } catch (e: any) {
    const msg = errMsg(e)
    try {
      const fallback = await api<{ success: true; items: ApiItem[] }>('/api/items', {
        query: {
          search: search.value || undefined,
          categoryId: activeCategoryId.value || undefined,
          color: color.value || undefined,
          page: 1,
          limit: 200,
        },
      })

      const items = (fallback as any).items || []
      products.value = items.map((it: ApiItem) => {
        const uoms = Array.isArray(it.uoms) ? it.uoms : []
        const base = uoms.find((u) => Number(u.conversionRate) === 1) || uoms[0]
        const unit = base?.uom?.code || 'PCS'
        const price = Number(base?.price || 0)
        return { id: it.id, sku: it.sku, name: it.name, color: it.color, price, unit, stock: 0 }
      })
      dataSource.value = 'ITEM_MASTER'
      lastTotal.value = items.length
      lastError.value = null
    } catch {
      lastError.value = msg
      toast.error(lastError.value)
      dataSource.value = 'POS_CATALOG'
      lastTotal.value = null
    }
  } finally {
    loading.value = false
  }
}

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
}

function hashHue(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 360
  return h
}

function parseColorNameToRgb(input: string): { r: number; g: number; b: number } | null {
  const s = (input || '').trim().toLowerCase()
  const named: Record<string, string> = {
    black: '#111827',
    white: '#ffffff',
    grey: '#6b7280',
    gray: '#6b7280',
    navy: '#1e3a8a',
    blue: '#2563eb',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#f59e0b',
    brown: '#92400e',
    orange: '#f97316',
    purple: '#7c3aed',
    pink: '#db2777',
  }
  const hex = named[s]
  if (!hex) return null
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return { r, g, b }
}

function colorChipStyle(colorName: string) {
  const rgb = parseColorNameToRgb(colorName)
  if (rgb) {
    const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
    const text = lum > 0.7 ? '#111827' : '#ffffff'
    const border = lum > 0.7 ? '#e5e7eb' : 'rgba(255,255,255,0.35)'
    return { backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, color: text, borderColor: border }
  }

  const h = hashHue(colorName)
  const bg = `hsl(${h} 70% 45%)`
  return { backgroundColor: bg, color: '#ffffff', borderColor: 'rgba(255,255,255,0.35)' }
}

let t: any = null
watch([search, activeCategoryId, color, inStockOnly, () => props.warehouseId], () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => fetchCatalog(), 250)
})

onMounted(async () => {
  try {
    await fetchMasters()
  } finally {
    await fetchCatalog()
    searchEl.value?.focus()
  }
})
</script>
