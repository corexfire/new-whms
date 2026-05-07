<template>
  <div class="p-6">
    <UiDataTable
      title="Master Suppliers"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-56 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search supplier..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Supplier" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Supplier" @click="openDialog()" />
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

    <!-- Modal Form -->
    <UiModal v-model="showDialog" :title="editId ? 'Edit Supplier' : 'New Supplier'" width="45vw" confirmLabel="Simpan Data" @confirm="saveData">
      <div class="grid grid-cols-2 gap-4">
        <UiInput label="Kode Supplier" v-model="form.code" placeholder="Unique code e.g., SUP-001" required class="col-span-2 sm:col-span-1" />
        <UiInput label="Nama Perusahaan/Toko" v-model="form.name" required class="col-span-2 sm:col-span-1" />
        <UiInput label="Email" v-model="form.email" type="email" />
        <UiInput label="No. Telepon" v-model="form.phone" />
        <div class="col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alamat Lengkap</label>
          <Textarea v-model="form.address" rows="3" class="w-full bg-slate-50" />
        </div>
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'INBOUND_STAFF'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()
const searchQuery = ref('')
const showDialog = ref(false)
const editId = ref<string | null>(null)

const form = ref({
  code: '',
  name: '',
  email: '',
  phone: '',
  address: ''
})

type ApiSupplier = {
  id: string
  code: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
}
const suppliers = ref<ApiSupplier[]>([])
const loading = ref(false)

const rows = computed(() => {
  return suppliers.value.map(s => ({
    id: s.id,
    code: s.code,
    name: s.name,
    phone: s.phone || '-',
    email: s.email || '-',
    address: s.address || '-'
  }))
})

async function fetchSuppliers() {
  loading.value = true
  try {
    const res = await api<{ success: true; suppliers: ApiSupplier[] }>('/api/partners/suppliers', {
      query: { search: searchQuery.value || undefined, page: 1, limit: 200 }
    })
    suppliers.value = res.suppliers
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat suppliers')
  } finally {
    loading.value = false
  }
}

function openDialog(id?: string) {
  if (id) {
    const data = suppliers.value.find(s => s.id === id)
    if (data) {
      editId.value = data.id
      form.value = { code: data.code, name: data.name, email: data.email || '', phone: data.phone || '', address: data.address || '' }
    }
  } else {
    editId.value = null
    form.value = { code: '', name: '', email: '', phone: '', address: '' }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.code || !form.value.name) {
    toast.error('Kode dan Nama pemasok wajib diisi.')
    return
  }
  try {
    if (editId.value) {
      await api(`/api/partners/suppliers/${editId.value}`, { method: 'PUT', body: { ...form.value } })
      toast.success('Pemasok diperbarui.')
    } else {
      await api('/api/partners/suppliers', { method: 'POST', body: { ...form.value } })
      toast.success('Pemasok baru ditambahkan.')
    }
    showDialog.value = false
    await fetchSuppliers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan data')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Hapus supplier ini?')
  if (!ok) return
  try {
    await api(`/api/partners/suppliers/${id}`, { method: 'DELETE' })
    toast.success('Pemasok dihapus.')
    await fetchSuppliers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

watch(searchQuery, async () => {
  await fetchSuppliers()
})

onMounted(fetchSuppliers)

const columns = ref([
  { field: 'code', headerName: 'Kode', width: 120 },
  { field: 'name', headerName: 'Nama Pemasok', flex: 1, minWidth: 200 },
  { field: 'phone', headerName: 'Telepon', width: 140 },
  { field: 'email', headerName: 'Email', width: 180 },
  { field: 'address', headerName: 'Alamat', flex: 1, minWidth: 240 },
  { field: 'actions', headerName: '', slotName: 'actions' }
])
</script>
