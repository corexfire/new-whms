<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Bundle Items</h1>
        <p class="text-sm text-slate-500 mt-1">Buat paket bundling produk retail dengan harga spesial</p>
      </div>
      <Button icon="pi pi-plus" label="New Bundle" size="small" @click="openDialog()" />
    </div>

    <!-- Bundles Grid -->
    <div v-if="loading" class="flex items-center justify-center py-20 text-slate-400">
      <i class="pi pi-spin pi-spinner text-2xl mr-2"></i><span>Memuat data...</span>
    </div>

    <div v-else-if="bundles.length === 0" class="text-center py-16 bg-white rounded-xl border border-slate-200">
      <i class="pi pi-gift text-5xl text-slate-300 mb-4 block"></i>
      <h3 class="font-bold text-slate-600 text-lg">Belum Ada Bundle Produk</h3>
      <p class="text-sm text-slate-500 mt-1">Klik "New Bundle" untuk membuat paket bundling pertama</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="bundle in bundles" :key="bundle.id"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        :class="{ 'opacity-60': !bundle.isActive }"
      >
        <!-- Header with discount badge -->
        <div class="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pt-5 pb-10 text-white">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <div class="font-extrabold text-lg leading-tight">{{ bundle.name }}</div>
              <div class="text-blue-100 text-xs mt-0.5">{{ bundle.description || 'Paket bundling' }}</div>
            </div>
            <span class="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
              :class="bundle.isActive ? 'bg-emerald-400 text-white' : 'bg-white/30 text-white'">
              {{ bundle.isActive ? 'AKTIF' : 'NONAKTIF' }}
            </span>
          </div>
          <!-- Price badge floating down -->
          <div class="absolute -bottom-5 left-5">
            <div class="bg-white rounded-xl shadow-md px-4 py-2 flex items-center gap-3 border border-slate-100">
              <div>
                <div class="text-[10px] text-slate-400 leading-none mb-0.5">Harga Bundle</div>
                <div class="text-xl font-extrabold text-emerald-600 leading-none">{{ formatRp(bundle.bundlePrice) }}</div>
              </div>
              <div v-if="bundle.savings > 0" class="border-l border-slate-200 pl-3">
                <div class="text-[10px] text-slate-400 leading-none mb-0.5">Hemat</div>
                <div class="text-sm font-bold text-red-500 leading-none">{{ formatRp(bundle.savings) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Items in bundle -->
        <div class="pt-10 px-5 pb-4 space-y-2">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Isi Paket ({{ bundle.items.length }} Item)</div>
          <div v-for="bi in bundle.items" :key="bi.itemId" class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">{{ bi.qty }}</span>
              <div>
                <div class="text-sm font-medium text-slate-800 leading-tight">{{ bi.itemName }}</div>
                <div class="text-[10px] text-slate-400 font-mono">{{ bi.sku }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-semibold text-slate-600">{{ formatRp(bi.unitPrice) }}</div>
              <div class="text-[10px] text-slate-400">/pcs</div>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-between text-xs">
            <span class="text-slate-500">Harga normal total:</span>
            <span class="font-semibold text-slate-600 line-through">{{ formatRp(bundle.normalPrice) }}</span>
          </div>
        </div>

        <!-- Validity & Actions -->
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div class="text-[10px] text-slate-500">
            {{ bundle.endDate ? `s/d ${formatDate(bundle.endDate)}` : 'Berlaku tanpa batas' }}
          </div>
          <div class="flex gap-1">
            <Button icon="pi pi-pencil" text rounded size="small" @click="openDialog(bundle)" />
            <Button
              :icon="bundle.isActive ? 'pi pi-pause-circle' : 'pi pi-play-circle'"
              text rounded size="small"
              :severity="bundle.isActive ? 'warn' : 'success'"
              @click="toggleActive(bundle)"
            />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="deleteBundle(bundle.id)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog Form -->
    <Dialog v-model:visible="showDialog" :header="editBundle ? 'Edit Bundle' : 'New Bundle Package'" :modal="true" class="w-full max-w-2xl">
      <div class="space-y-5 mt-2">
        <!-- Basic info -->
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Nama Bundle *</label>
            <InputText v-model="form.name" placeholder="Misal: Paket Casual Pria - Kaos + Celana" class="w-full" />
          </div>
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Deskripsi</label>
            <Textarea v-model="form.description" rows="2" class="w-full bg-slate-50" placeholder="(Opsional)" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Harga Bundle (Rp) *</label>
            <InputNumber v-model="form.bundlePrice" :min="0" prefix="Rp " class="w-full" :useGrouping="true" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Stok Tersedia (opsional)</label>
            <InputNumber v-model="form.stock" :min="0" suffix=" pcs" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Berlaku Hingga</label>
            <InputText v-model="form.endDate" type="date" class="w-full" />
          </div>
          <div class="flex items-end pb-1 gap-2">
            <Checkbox v-model="form.isActive" inputId="bundleActive" :binary="true" />
            <label for="bundleActive" class="text-sm font-medium text-slate-700">Aktifkan segera</label>
          </div>
        </div>

        <Divider />

        <!-- Bundle items -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-slate-800">📦 Isi Paket Bundle</h3>
            <Button icon="pi pi-plus" label="Tambah Item" text size="small" @click="addBundleItem" />
          </div>

          <div class="space-y-3">
            <div v-for="(bi, i) in form.items" :key="i" class="flex items-end gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div class="flex-1 flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-600">Item</label>
                <Select
                  v-model="bi.itemId"
                  :options="itemOptions"
                  optionLabel="label"
                  optionValue="id"
                  placeholder="Pilih item..."
                  filter
                  class="w-full"
                  @change="onSelectItem(bi)"
                />
              </div>
              <div class="w-24 flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-600">Qty</label>
                <InputNumber v-model="bi.qty" :min="1" class="w-full" />
              </div>
              <div class="w-32 flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-600">Hrg Satuan</label>
                <InputNumber v-model="bi.unitPrice" :min="0" prefix="Rp " class="w-full" :useGrouping="true" />
              </div>
              <Button icon="pi pi-trash" severity="danger" text rounded @click="removeBundleItem(i)" />
            </div>
          </div>

          <!-- Summary -->
          <div v-if="form.items.length > 0" class="mt-4 bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Total harga normal</span>
              <span class="font-semibold text-slate-800">{{ formatRp(normalPriceCalc) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Harga Bundle</span>
              <span class="font-bold text-emerald-600">{{ formatRp(form.bundlePrice) }}</span>
            </div>
            <div class="flex justify-between text-sm border-t border-slate-100 pt-2">
              <span class="font-semibold text-slate-700">Hemat</span>
              <span class="font-extrabold text-red-500">{{ formatRp(normalPriceCalc - form.bundlePrice) }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Batal" severity="secondary" outlined @click="showDialog = false" />
          <Button label="Simpan Bundle" icon="pi pi-check" :loading="saving" @click="saveBundle" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

// ── Types ──────────────────────────────────────────────────────
type BundleItem = { itemId: string; sku: string; itemName: string; qty: number; unitPrice: number }
type Bundle = {
  id: string
  name: string
  description: string
  bundlePrice: number
  normalPrice: number
  savings: number
  stock: number | null
  endDate: string | null
  isActive: boolean
  items: BundleItem[]
}

// ── State ──────────────────────────────────────────────────────
const bundles = ref<Bundle[]>([])
const itemOptions = ref<{ id: string; label: string; price: number; sku: string; name: string }[]>([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editBundle = ref<Bundle | null>(null)

const emptyForm = () => ({
  name: '',
  description: '',
  bundlePrice: 0,
  stock: null as number | null,
  endDate: '',
  isActive: true,
  items: [] as { itemId: string; sku: string; itemName: string; qty: number; unitPrice: number }[],
})

const form = ref(emptyForm())

const normalPriceCalc = computed(() => form.value.items.reduce((s, i) => s + (i.unitPrice * i.qty), 0))

// ── Helpers ────────────────────────────────────────────────────
function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0)
}
function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

// ── Dialog ─────────────────────────────────────────────────────
function openDialog(bundle?: Bundle) {
  editBundle.value = bundle || null
  if (bundle) {
    form.value = {
      name: bundle.name,
      description: bundle.description,
      bundlePrice: bundle.bundlePrice,
      stock: bundle.stock,
      endDate: bundle.endDate?.substring(0, 10) || '',
      isActive: bundle.isActive,
      items: bundle.items.map(i => ({ ...i })),
    }
  } else {
    form.value = emptyForm()
  }
  showDialog.value = true
}

function addBundleItem() {
  form.value.items.push({ itemId: '', sku: '', itemName: '', qty: 1, unitPrice: 0 })
}

function removeBundleItem(i: number) {
  form.value.items.splice(i, 1)
}

function onSelectItem(bi: { itemId: string; sku: string; itemName: string; qty: number; unitPrice: number }) {
  const found = itemOptions.value.find(o => o.id === bi.itemId)
  if (found) {
    bi.sku = found.sku
    bi.itemName = found.name
    bi.unitPrice = found.price
  }
}

// ── CRUD ───────────────────────────────────────────────────────
async function fetchData() {
  loading.value = true
  try {
    const itemsRes = await api<{ success: boolean; items: any[] }>('/api/items', { query: { limit: 500 } })
    itemOptions.value = (itemsRes.items || []).map((item: any) => ({
      id: item.id,
      label: `${item.sku} — ${item.name}`,
      price: item.uoms?.[0]?.price || 0,
      sku: item.sku,
      name: item.name,
    }))

    try {
      const res = await api<{ success: boolean; bundles: Bundle[] }>('/api/promotions/bundles')
      bundles.value = res.bundles || []
    } catch {
      // Demo data
      bundles.value = [
        {
          id: 'demo-b1',
          name: 'Paket Casual Pria — S',
          description: 'Kaos polos + Celana chino size S',
          bundlePrice: 199000,
          normalPrice: 260000,
          savings: 61000,
          stock: 20,
          endDate: null,
          isActive: true,
          items: [
            { itemId: '1', sku: 'KPS-S-WHT', itemName: 'Kaos Polos Size S Putih', qty: 1, unitPrice: 85000 },
            { itemId: '2', sku: 'CLC-S-BLK', itemName: 'Celana Chino Size S Hitam', qty: 1, unitPrice: 175000 },
          ]
        },
        {
          id: 'demo-b2',
          name: 'Paket 3 Kaos Warna',
          description: 'Hemat beli 3 kaos sekaligus',
          bundlePrice: 225000,
          normalPrice: 285000,
          savings: 60000,
          stock: null,
          endDate: '2025-12-31',
          isActive: true,
          items: [
            { itemId: '3', sku: 'KPS-M-MLT', itemName: 'Kaos Polos Size M (3 Warna)', qty: 3, unitPrice: 95000 },
          ]
        },
      ]
    }
  } catch (e: any) {
    toast.error('Gagal memuat data: ' + e?.message)
  } finally {
    loading.value = false
  }
}

async function saveBundle() {
  if (!form.value.name || form.value.bundlePrice <= 0) return toast.error('Nama dan harga bundle wajib diisi.')
  if (form.value.items.length === 0) return toast.error('Tambahkan minimal 1 item dalam bundle.')
  if (form.value.items.some(i => !i.itemId)) return toast.error('Semua item harus dipilih.')

  saving.value = true
  try {
    const normalPrice = normalPriceCalc.value
    const savings = normalPrice - form.value.bundlePrice

    if (editBundle.value) {
      const idx = bundles.value.findIndex(b => b.id === editBundle.value!.id)
      if (idx !== -1) {
        bundles.value[idx] = {
          ...bundles.value[idx],
          ...form.value,
          normalPrice,
          savings,
          endDate: form.value.endDate || null,
        }
      }
      toast.success('Bundle diperbarui.')
    } else {
      bundles.value.unshift({
        id: 'local-' + Date.now(),
        ...form.value,
        normalPrice,
        savings,
        endDate: form.value.endDate || null,
      })
      toast.success('Bundle ditambahkan.')
    }
    showDialog.value = false
  } catch (e: any) {
    toast.error(e?.message || 'Gagal menyimpan')
  } finally {
    saving.value = false
  }
}

function toggleActive(bundle: Bundle) {
  bundle.isActive = !bundle.isActive
  toast.success(`Bundle "${bundle.name}" ${bundle.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
}

function deleteBundle(id: string) {
  if (!confirm('Hapus bundle ini?')) return
  const idx = bundles.value.findIndex(b => b.id === id)
  if (idx !== -1) bundles.value.splice(idx, 1)
  toast.success('Bundle dihapus.')
}

onMounted(fetchData)
</script>
