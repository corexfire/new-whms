<template>
  <div class="p-6">
    <UiDataTable
      title="Master Products"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-64 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search code or name..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button
              class="hidden lg:inline-flex whitespace-nowrap shrink-0"
              icon="pi pi-filter"
              label="Filters"
              severity="secondary"
              outlined
              size="small"
              @click="showFilterDialog = true"
            />
            <Button
              class="lg:hidden shrink-0"
              icon="pi pi-filter"
              severity="secondary"
              outlined
              size="small"
              aria-label="Filters"
              @click="showFilterDialog = true"
            />
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Product" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Product" @click="openDialog()" />
          </div>
        </div>
      </template>

      <template #status="{ data }">
        <span :class="data.is_active ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200'" class="text-xs font-bold px-2 py-0.5 rounded-full border">
          {{ data.is_active ? 'ACTIVE' : 'INACTIVE' }}
        </span>
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-pencil" @click="openDialog(data.id)" />
          <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="confirmDelete(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="editId ? 'Edit Product' : 'New Product'" width="55vw" confirmLabel="Simpan Data" @confirm="saveData">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UiInput label="Code" v-model="form.code" placeholder="Unique code e.g., TSH-CLS" required />
        <UiInput label="Nama Product" v-model="form.name" required />

        <UiSelect
          label="Category"
          v-model="form.categoryId"
          :options="categories"
          optionLabel="name"
          optionValue="id"
          placeholder="(Opsional)"
        />

        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white">
          <InputSwitch v-model="form.isActive" />
          <span class="text-sm font-medium text-slate-700">Active</span>
        </div>

        <div class="lg:col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Deskripsi (optional)</label>
          <Textarea v-model="form.description" rows="3" class="w-full bg-slate-50" placeholder="(Opsional)" />
        </div>
      </div>
    </UiModal>

    <UiModal v-model="showFilterDialog" title="Filters" width="520px">
      <div class="grid grid-cols-1 gap-4">
        <UiSelect
          label="Category"
          v-model="filterCategoryId"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="All Categories"
        />
        <UiSelect
          label="Status"
          v-model="filterIsActive"
          :options="activeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="All"
        />
      </div>
      <template #footer>
        <Button label="Clear" icon="pi pi-eraser" severity="secondary" outlined @click="clearFilters" />
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showFilterDialog = false" />
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INVENTORY_STAFF'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()

type ApiCategory = { id: string; name: string; description?: string | null }
type ApiProduct = {
  id: string
  code: string
  name: string
  description?: string | null
  categoryId?: string | null
  category?: ApiCategory | null
  isActive: boolean
  _count?: { items: number }
}

const categories = ref<ApiCategory[]>([])
const products = ref<ApiProduct[]>([])
const loading = ref(false)

const searchQuery = ref('')
const filterCategoryId = ref<string | null>(null)
const filterIsActive = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

const showDialog = ref(false)
const showFilterDialog = ref(false)
const editId = ref<string | null>(null)
const form = ref({ code: '', name: '', description: '', categoryId: null as string | null, isActive: true })

const categoryOptions = computed(() => [{ value: null, label: 'All Categories' }, ...categories.value.map((c) => ({ value: c.id, label: c.name }))])
const activeOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const rows = computed(() => {
  return products.value.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category?.name || '-',
    is_active: !!p.isActive,
    items_count: p._count?.items ?? 0,
    description: p.description || '-',
  }))
})

async function fetchCategories() {
  const res = await api<{ success: true; categories: ApiCategory[] }>('/api/master/categories')
  categories.value = (res as any).categories || []
}

async function fetchProducts() {
  loading.value = true
  try {
    const res = await api<{ success: true; products: ApiProduct[] }>('/api/master/products', {
      query: {
        search: searchQuery.value || undefined,
        categoryId: filterCategoryId.value || undefined,
        isActive: filterIsActive.value === 'ALL' ? undefined : filterIsActive.value === 'ACTIVE' ? 'true' : 'false',
      },
    })
    products.value = (res as any).products || []
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat products')
  } finally {
    loading.value = false
  }
}

function openDialog(id?: string) {
  if (id) {
    const p = products.value.find((x) => x.id === id)
    if (p) {
      editId.value = p.id
      form.value = {
        code: p.code,
        name: p.name,
        description: p.description || '',
        categoryId: (p.categoryId as any) || null,
        isActive: !!p.isActive,
      }
    }
  } else {
    editId.value = null
    form.value = { code: '', name: '', description: '', categoryId: null, isActive: true }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    toast.error('Code dan Nama product wajib diisi.')
    return
  }

  const body = {
    code: form.value.code.trim(),
    name: form.value.name.trim(),
    description: form.value.description || undefined,
    categoryId: form.value.categoryId || undefined,
    isActive: !!form.value.isActive,
  }

  try {
    if (editId.value) {
      await api(`/api/master/products/${editId.value}`, { method: 'PUT', body })
      toast.success('Product diperbarui.')
    } else {
      await api('/api/master/products', { method: 'POST', body })
      toast.success('Product ditambahkan.')
    }
    showDialog.value = false
    await fetchProducts()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan data')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Hapus product ini? Item yang terkait tidak akan ikut terhapus.')
  if (!ok) return
  try {
    await api(`/api/master/products/${id}`, { method: 'DELETE' })
    toast.success('Product dihapus.')
    await fetchProducts()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

function clearFilters() {
  filterCategoryId.value = null
  filterIsActive.value = 'ALL'
}

watch([searchQuery, filterCategoryId, filterIsActive], () => {
  fetchProducts()
})

onMounted(async () => {
  try {
    await fetchCategories()
  } finally {
    await fetchProducts()
  }
})

const columns = ref([
  { field: 'code', headerName: 'Code', width: 140, pinned: 'left' },
  { field: 'name', headerName: 'Nama', flex: 1, minWidth: 220 },
  { field: 'category', headerName: 'Category', width: 180 },
  { field: 'is_active', headerName: 'Status', width: 120, slotName: 'status' },
  { field: 'items_count', headerName: 'Items', width: 100 },
  { field: 'description', headerName: 'Deskripsi', flex: 1, minWidth: 260 },
  { field: 'actions', headerName: '', slotName: 'actions' },
])
</script>
