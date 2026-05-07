<template>
  <div class="p-6">
    <UiDataTable
      title="Master Categories"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-56 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search category..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Category" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Category" @click="openDialog()" />
          </div>
        </div>
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-pencil" @click="openDialog(data.id)" />
          <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="confirmDelete(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <UiModal v-model="showDialog" :title="editId ? 'Edit Category' : 'New Category'" width="45vw" confirmLabel="Simpan Data" @confirm="saveData">
      <div class="grid grid-cols-1 gap-4">
        <UiInput label="Nama Category" v-model="form.name" required />
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Deskripsi (optional)</label>
          <Textarea v-model="form.description" rows="3" class="w-full bg-slate-50" placeholder="(Opsional)" />
        </div>
      </div>
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

type ApiCategory = {
  id: string
  name: string
  description?: string | null
  _count?: { items: number }
}

const categories = ref<ApiCategory[]>([])
const loading = ref(false)
const searchQuery = ref('')

const showDialog = ref(false)
const editId = ref<string | null>(null)
const form = ref({ name: '', description: '' })

const rows = computed(() => {
  return categories.value.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || '-',
    items_count: c._count?.items ?? 0,
  }))
})

async function fetchCategories() {
  loading.value = true
  try {
    const res = await api<{ success: true; categories: ApiCategory[] }>('/api/master/categories', {
      query: { search: searchQuery.value || undefined },
    })
    categories.value = (res as any).categories || []
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat categories')
  } finally {
    loading.value = false
  }
}

function openDialog(id?: string) {
  if (id) {
    const c = categories.value.find((x) => x.id === id)
    if (c) {
      editId.value = c.id
      form.value = { name: c.name, description: c.description || '' }
    }
  } else {
    editId.value = null
    form.value = { name: '', description: '' }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.name.trim()) {
    toast.error('Nama category wajib diisi.')
    return
  }
  try {
    if (editId.value) {
      await api(`/api/master/categories/${editId.value}`, { method: 'PUT', body: { name: form.value.name.trim(), description: form.value.description || undefined } })
      toast.success('Category diperbarui.')
    } else {
      await api('/api/master/categories', { method: 'POST', body: { name: form.value.name.trim(), description: form.value.description || undefined } })
      toast.success('Category ditambahkan.')
    }
    showDialog.value = false
    await fetchCategories()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan data')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Hapus category ini?')
  if (!ok) return
  try {
    await api(`/api/master/categories/${id}`, { method: 'DELETE' })
    toast.success('Category dihapus.')
    await fetchCategories()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

watch(searchQuery, () => {
  fetchCategories()
})

onMounted(fetchCategories)

const columns = ref([
  { field: 'name', headerName: 'Nama', flex: 1, minWidth: 200 },
  { field: 'description', headerName: 'Deskripsi', flex: 1, minWidth: 260 },
  { field: 'items_count', headerName: 'Items', width: 100 },
  { field: 'actions', headerName: '', slotName: 'actions' },
])
</script>
