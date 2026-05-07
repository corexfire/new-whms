<template>
  <div class="p-6">
    <UiDataTable
      title="Master Customers"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-56 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search customer..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-plus" label="New Customer" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-plus" size="small" aria-label="New Customer" @click="openDialog()" />
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
    <UiModal v-model="showDialog" :title="editId ? 'Edit Customer' : 'New Customer'" width="45vw" confirmLabel="Simpan Data" @confirm="saveData">
      <div class="grid grid-cols-2 gap-4">
        <UiInput label="Kode Customer" v-model="form.code" placeholder="Unique code e.g., CUST-001" required class="col-span-2 sm:col-span-1" />
        <UiInput label="Nama Pelanggan/Toko" v-model="form.name" required class="col-span-2 sm:col-span-1" />
        <UiInput label="Email" v-model="form.email" type="email" class="col-span-2 sm:col-span-1" />
        <UiInput label="No. Telepon" v-model="form.phone" class="col-span-2 sm:col-span-1" />
        
        <div class="col-span-2 flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Alamat Pengiriman Utama</label>
          <Textarea v-model="form.address" rows="3" class="w-full bg-slate-50" />
        </div>
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER', 'OUTBOUND_STAFF', 'CASHIER'] })

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

type ApiCustomer = {
  id: string
  code: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
}
const customers = ref<ApiCustomer[]>([])
const loading = ref(false)

const rows = computed(() => {
  return customers.value.map(c => ({
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone || '-',
    email: c.email || '-',
    address: c.address || '-'
  }))
})

async function fetchCustomers() {
  loading.value = true
  try {
    const res = await api<{ success: true; customers: ApiCustomer[] }>('/api/partners/customers', {
      query: { search: searchQuery.value || undefined, page: 1, limit: 200 }
    })
    customers.value = res.customers
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat customers')
  } finally {
    loading.value = false
  }
}

function openDialog(id?: string) {
  if (id) {
    const data = customers.value.find(c => c.id === id)
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
    toast.error('Kode dan Nama pelanggan wajib diisi.')
    return
  }
  try {
    if (editId.value) {
      await api(`/api/partners/customers/${editId.value}`, { method: 'PUT', body: { ...form.value } })
      toast.success('Pelanggan diperbarui.')
    } else {
      await api('/api/partners/customers', { method: 'POST', body: { ...form.value } })
      toast.success('Pelanggan baru ditambahkan.')
    }
    showDialog.value = false
    await fetchCustomers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan data')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Hapus customer ini?')
  if (!ok) return
  try {
    await api(`/api/partners/customers/${id}`, { method: 'DELETE' })
    toast.success('Pelanggan dihapus.')
    await fetchCustomers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus')
  }
}

watch(searchQuery, async () => {
  await fetchCustomers()
})

onMounted(fetchCustomers)

const columns = ref([
  { field: 'code', headerName: 'Kode', width: 120 },
  { field: 'name', headerName: 'Nama Pelanggan', flex: 1, minWidth: 200 },
  { field: 'phone', headerName: 'Telepon', width: 140 },
  { field: 'email', headerName: 'Email', width: 180 },
  { field: 'address', headerName: 'Alamat', flex: 1, minWidth: 240 },
  { field: 'actions', headerName: '', slotName: 'actions' }
])
</script>
