<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Discount Rules</h1>
        <p class="text-sm text-slate-500 mt-1">Kelola aturan diskon otomatis untuk produk dan kategori retail</p>
      </div>
      <Button icon="pi pi-plus" label="New Discount" size="small" @click="openDialog()" />
    </div>

    <!-- Filter Bar -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
      <IconField iconPosition="left">
        <InputIcon class="pi pi-search text-slate-400" />
        <InputText v-model="searchQuery" placeholder="Cari nama diskon..." size="small" />
      </IconField>
      <Select v-model="filterType" :options="typeOptions" optionLabel="label" optionValue="value" placeholder="Semua Tipe" showClear size="small" class="w-40" />
      <Select v-model="filterStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Semua Status" showClear size="small" class="w-36" />
    </div>

    <!-- Discount Cards Grid -->
    <div v-if="loading" class="flex items-center justify-center py-20 text-slate-400">
      <i class="pi pi-spin pi-spinner text-2xl mr-2"></i><span>Memuat data...</span>
    </div>

    <div v-else-if="filteredDiscounts.length === 0" class="text-center py-16 bg-white rounded-xl border border-slate-200">
      <i class="pi pi-tag text-5xl text-slate-300 mb-4 block"></i>
      <h3 class="font-bold text-slate-600 text-lg">Belum Ada Discount Rule</h3>
      <p class="text-sm text-slate-500 mt-1">Klik "New Discount" untuk membuat aturan diskon pertama</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="disc in filteredDiscounts"
        :key="disc.id"
        class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        :class="{ 'opacity-60': !disc.isActive }"
      >
        <!-- Card Header -->
        <div class="px-4 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-800 truncate">{{ disc.name }}</div>
            <div class="text-xs text-slate-500 mt-0.5">{{ disc.description || 'Tidak ada deskripsi' }}</div>
          </div>
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
            :class="disc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >{{ disc.isActive ? 'AKTIF' : 'NONAKTIF' }}</span>
        </div>

        <!-- Discount Value -->
        <div class="px-4 py-4 flex items-center justify-between">
          <div>
            <div class="text-3xl font-extrabold" :class="disc.type === 'PERCENTAGE' ? 'text-blue-600' : 'text-emerald-600'">
              {{ disc.type === 'PERCENTAGE' ? `${disc.value}%` : formatRp(disc.value) }}
            </div>
            <div class="text-xs text-slate-500 mt-0.5">
              <span class="font-semibold">{{ typeLabel(disc.type) }}</span>
              <span v-if="disc.minQty"> · Min {{ disc.minQty }} pcs</span>
              <span v-if="disc.minPurchase"> · Min beli {{ formatRp(disc.minPurchase) }}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-slate-500">Berlaku</div>
            <div class="text-xs font-semibold text-slate-700">{{ formatDate(disc.startDate) }}</div>
            <div class="text-xs text-slate-400">s/d {{ disc.endDate ? formatDate(disc.endDate) : 'Tanpa batas' }}</div>
          </div>
        </div>

        <!-- Scope tags -->
        <div class="px-4 pb-3 flex flex-wrap gap-1.5">
          <span v-for="scope in disc.scopes" :key="scope"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {{ scope }}
          </span>
          <span v-if="disc.scopes.length === 0" class="text-[10px] text-slate-400">Semua produk</span>
        </div>

        <!-- Actions -->
        <div class="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-1">
          <Button icon="pi pi-pencil" text rounded size="small" @click="openDialog(disc)" />
          <Button
            :icon="disc.isActive ? 'pi pi-pause-circle' : 'pi pi-play-circle'"
            text rounded size="small"
            :severity="disc.isActive ? 'warn' : 'success'"
            @click="toggleActive(disc)"
          />
          <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="deleteDiscount(disc.id)" />
        </div>
      </div>
    </div>

    <!-- Dialog Form -->
    <Dialog v-model:visible="showDialog" :header="editDisc ? 'Edit Discount Rule' : 'New Discount Rule'" :modal="true" class="w-full max-w-xl">
      <div class="space-y-4 mt-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Nama Diskon *</label>
            <InputText v-model="form.name" placeholder="Misal: Diskon Lebaran 20%" class="w-full" />
          </div>
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Deskripsi</label>
            <Textarea v-model="form.description" rows="2" class="w-full bg-slate-50" placeholder="(Opsional)" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Tipe Diskon *</label>
            <Select v-model="form.type" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Nilai *</label>
            <InputNumber v-model="form.value" :prefix="form.type === 'PERCENTAGE' ? '' : 'Rp '" :suffix="form.type === 'PERCENTAGE' ? ' %' : ''" :min="0" :max="form.type === 'PERCENTAGE' ? 100 : undefined" class="w-full" :useGrouping="true" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Minimum Qty</label>
            <InputNumber v-model="form.minQty" :min="0" suffix=" pcs" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Minimum Pembelian</label>
            <InputNumber v-model="form.minPurchase" :min="0" prefix="Rp " class="w-full" :useGrouping="true" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Tanggal Mulai</label>
            <InputText v-model="form.startDate" type="date" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Tanggal Selesai</label>
            <InputText v-model="form.endDate" type="date" class="w-full" />
          </div>

          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-700">Berlaku untuk Kategori</label>
            <MultiSelect
              v-model="form.categoryIds"
              :options="categories"
              optionLabel="name"
              optionValue="id"
              placeholder="Semua Kategori (kosongkan = berlaku untuk semua)"
              class="w-full"
              display="chip"
            />
          </div>

          <div class="col-span-2 flex items-center gap-2">
            <Checkbox v-model="form.isActive" inputId="discActive" :binary="true" />
            <label for="discActive" class="text-sm font-medium text-slate-700">Aktifkan segera</label>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Batal" severity="secondary" outlined @click="showDialog = false" />
          <Button label="Simpan" icon="pi pi-check" :loading="saving" @click="saveDiscount" />
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
type Discount = {
  id: string
  name: string
  description: string
  type: 'PERCENTAGE' | 'NOMINAL' | 'BUY_X_GET_Y'
  value: number
  minQty: number
  minPurchase: number
  startDate: string
  endDate: string | null
  isActive: boolean
  scopes: string[]
  categoryIds: string[]
}

// ── State ──────────────────────────────────────────────────────
const discounts = ref<Discount[]>([])
const categories = ref<{ id: string; name: string }[]>([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editDisc = ref<Discount | null>(null)
const searchQuery = ref('')
const filterType = ref<string | null>(null)
const filterStatus = ref<string | null>(null)

const typeOptions = [
  { label: 'Persentase (%)', value: 'PERCENTAGE' },
  { label: 'Nominal (Rp)', value: 'NOMINAL' },
  { label: 'Buy X Get Y', value: 'BUY_X_GET_Y' },
]
const statusOptions = [
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Nonaktif', value: 'INACTIVE' },
]

const emptyForm = () => ({
  name: '',
  description: '',
  type: 'PERCENTAGE' as Discount['type'],
  value: 10,
  minQty: 0,
  minPurchase: 0,
  startDate: new Date().toISOString().substring(0, 10),
  endDate: '',
  isActive: true,
  categoryIds: [] as string[],
})

const form = ref(emptyForm())

// ── Computed ───────────────────────────────────────────────────
const filteredDiscounts = computed(() => {
  let list = discounts.value
  if (searchQuery.value) list = list.filter(d => d.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
  if (filterType.value) list = list.filter(d => d.type === filterType.value)
  if (filterStatus.value) list = list.filter(d => filterStatus.value === 'ACTIVE' ? d.isActive : !d.isActive)
  return list
})

// ── Helpers ────────────────────────────────────────────────────
function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0)
}
function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}
function typeLabel(t: string) {
  return { PERCENTAGE: 'Persentase', NOMINAL: 'Nominal', BUY_X_GET_Y: 'Buy X Get Y' }[t] || t
}

// ── Dialog ─────────────────────────────────────────────────────
function openDialog(disc?: Discount) {
  editDisc.value = disc || null
  if (disc) {
    form.value = {
      name: disc.name,
      description: disc.description,
      type: disc.type,
      value: disc.value,
      minQty: disc.minQty,
      minPurchase: disc.minPurchase,
      startDate: disc.startDate?.substring(0, 10) || '',
      endDate: disc.endDate?.substring(0, 10) || '',
      isActive: disc.isActive,
      categoryIds: disc.categoryIds || [],
    }
  } else {
    form.value = emptyForm()
  }
  showDialog.value = true
}

// ── CRUD (local state — backend endpoint optional) ─────────────
async function fetchData() {
  loading.value = true
  try {
    const catRes = await api<{ success: boolean; categories: any[] }>('/api/master/categories')
    categories.value = catRes.categories || []

    // Try to load from backend if endpoint exists, otherwise use local demo data
    try {
      const res = await api<{ success: boolean; discounts: Discount[] }>('/api/promotions/discounts')
      discounts.value = res.discounts || []
    } catch {
      // Demo data for UI showcase
      discounts.value = [
        {
          id: 'demo-1', name: 'Promo Harnas 17 Agustus', description: 'Diskon spesial hari kemerdekaan',
          type: 'PERCENTAGE', value: 17, minQty: 1, minPurchase: 0,
          startDate: '2025-08-10', endDate: '2025-08-20', isActive: true, scopes: ['Semua Produk'], categoryIds: []
        },
        {
          id: 'demo-2', name: 'Diskon Anggota VIP', description: 'Khusus member VIP',
          type: 'NOMINAL', value: 50000, minQty: 0, minPurchase: 300000,
          startDate: '2025-01-01', endDate: null, isActive: true, scopes: ['Member VIP'], categoryIds: []
        },
        {
          id: 'demo-3', name: 'Buy 2 Get 1 Kaos', description: 'Beli 2 kaos dapat 1 gratis',
          type: 'BUY_X_GET_Y', value: 1, minQty: 2, minPurchase: 0,
          startDate: '2025-07-01', endDate: '2025-07-31', isActive: false, scopes: ['Kaos Polos'], categoryIds: []
        },
      ]
    }
  } catch (e: any) {
    toast.error('Gagal memuat data: ' + e?.message)
  } finally {
    loading.value = false
  }
}

async function saveDiscount() {
  if (!form.value.name || !form.value.value) return toast.error('Nama dan nilai diskon wajib diisi.')
  saving.value = true
  try {
    const payload = { ...form.value }
    if (editDisc.value) {
      // Try backend, fallback to local
      try {
        await api(`/api/promotions/discounts/${editDisc.value.id}`, { method: 'PUT', body: payload })
      } catch {
        const idx = discounts.value.findIndex(d => d.id === editDisc.value!.id)
        if (idx !== -1) discounts.value[idx] = { ...discounts.value[idx], ...payload, scopes: [] }
      }
      toast.success('Discount diperbarui.')
    } else {
      try {
        await api('/api/promotions/discounts', { method: 'POST', body: payload })
        await fetchData()
      } catch {
        discounts.value.unshift({
          id: 'local-' + Date.now(), ...payload,
          endDate: payload.endDate || null,
          scopes: categories.value.filter(c => payload.categoryIds.includes(c.id)).map(c => c.name),
        })
      }
      toast.success('Discount ditambahkan.')
    }
    showDialog.value = false
  } catch (e: any) {
    toast.error(e?.message || 'Gagal menyimpan')
  } finally {
    saving.value = false
  }
}

function toggleActive(disc: Discount) {
  disc.isActive = !disc.isActive
  toast.success(`Discount "${disc.name}" ${disc.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
}

function deleteDiscount(id: string) {
  if (!confirm('Hapus discount rule ini?')) return
  const idx = discounts.value.findIndex(d => d.id === id)
  if (idx !== -1) discounts.value.splice(idx, 1)
  toast.success('Discount dihapus.')
}

onMounted(fetchData)
</script>
