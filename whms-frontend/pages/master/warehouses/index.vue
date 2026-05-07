<template>
  <div class="p-6">
    <UiDataTable
      title="Master Warehouses"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-56 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="Add Warehouse" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="Add Warehouse" @click="openDialog()" />
          </div>
        </div>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-map" @click="router.push(`/master/warehouses/${data.id}/map`)" />
          <Button text rounded size="small" icon="pi pi-pencil" @click="openDialog(data.id)" />
          <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="confirmDelete(data.id)" />
        </div>
      </template>
    </UiDataTable>

    <!-- Modal Form -->
    <UiModal v-model="showDialog" :title="editId ? 'Edit Warehouse' : 'New Warehouse'" width="40vw" confirmLabel="Simpan" @confirm="saveData">
      <div class="grid grid-cols-1 gap-4">
        <UiInput label="Kode Gudang" v-model="form.code" placeholder="Misal: WH-JKT-01" required />
        <UiInput label="Nama Gudang" v-model="form.name" placeholder="Misal: Gudang Pusat Jakarta" required />

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alamat Fisik</label>
          <Textarea v-model="form.address" rows="3" class="w-full bg-slate-50" />
        </div>
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const router = useRouter()
const { api } = useApi()
const searchQuery = ref('')
const showDialog = ref(false)
const editId = ref<string | null>(null)

const form = ref({
  code: '',
  name: '',
  address: ''
})

type ApiWarehouse = {
  id: string
  code: string
  name: string
  address?: string | null
  isActive: boolean
  _count?: { locations: number }
}
const warehouses = ref<ApiWarehouse[]>([])
const loading = ref(false)

const rows = computed(() => {
  return warehouses.value.map(w => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address || '-',
    locations: w._count?.locations ?? 0,
    status: w.isActive ? 'ACTIVE' : 'INACTIVE'
  }))
})

async function fetchWarehouses() {
  loading.value = true
  try {
    const res = await api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', {
      query: { search: searchQuery.value || undefined }
    })
    warehouses.value = res.warehouses
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat warehouses')
  } finally {
    loading.value = false
  }
}

const columns = ref([
  { field: 'code', headerName: 'Kode', width: 140 },
  { field: 'name', headerName: 'Nama Lokasi', flex: 1, minWidth: 200 },
  { field: 'locations', headerName: 'Locations', width: 110 },
  { field: 'address', headerName: 'Alamat', flex: 1, minWidth: 240 },
  { 
    field: 'status', 
    headerName: 'Status', 
    width: 140,
    cellRenderer: (params: any) => {
      let color
      switch(params.value) {
        case 'ACTIVE': color = '#059669'; break;
        case 'MAINTENANCE': color = '#d97706'; break;
        default: color = '#ef4444';
      }
      return `<strong style="color: ${color}">${params.value}</strong>`
    }
  },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

function openDialog(id?: string) {
  if (id) {
    const data = warehouses.value.find(w => w.id === id)
    if (data) {
      editId.value = data.id
      form.value = { code: data.code, name: data.name, address: data.address || '' }
    }
  } else {
    editId.value = null
    form.value = { code: '', name: '', address: '' }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.code || !form.value.name) return toast.error('Lengkapi kode dan nama gudang.')
  
  try {
    if (editId.value) {
      await api(`/api/warehouses/warehouses/${editId.value}`, { method: 'PUT', body: { ...form.value } })
      toast.success('Gudang diperbarui.')
    } else {
      await api('/api/warehouses', { method: 'POST', body: { ...form.value } })
      toast.success('Gudang baru ditambahkan.')
    }
    showDialog.value = false
    await fetchWarehouses()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan data')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Nonaktifkan warehouse ini?')
  if (!ok) return
  try {
    await api(`/api/warehouses/warehouses/${id}`, { method: 'DELETE' })
    toast.success('Warehouse dinonaktifkan.')
    await fetchWarehouses()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

watch(searchQuery, async () => {
  await fetchWarehouses()
})

onMounted(fetchWarehouses)
</script>
