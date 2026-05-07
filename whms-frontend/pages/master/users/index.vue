<template>
  <div class="p-6">
    <UiDataTable
      title="User Management"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
      :quickFilterText="searchQuery"
    >
      <template #toolbar>
        <div class="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
          <IconField iconPosition="left" class="hidden sm:block flex-1 min-w-56 max-w-[420px]">
            <InputIcon class="pi pi-search text-slate-400" />
            <InputText v-model="searchQuery" class="w-full" placeholder="Search user..." size="small" />
          </IconField>
          <div class="flex items-center gap-2 shrink-0">
            <Button class="hidden lg:inline-flex whitespace-nowrap shrink-0" icon="pi pi-user-plus" label="New User" size="small" @click="openDialog()" />
            <Button class="lg:hidden shrink-0" icon="pi pi-user-plus" size="small" aria-label="New User" @click="openDialog()" />
          </div>
        </div>
      </template>
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <Button text rounded size="small" icon="pi pi-pencil" @click="openDialog(data._raw.id)" />
          <Button text rounded size="small" icon="pi pi-refresh" @click="openReset(data._raw.id)" />
          <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="confirmDelete(data._raw.id)" />
        </div>
      </template>
    </UiDataTable>

    <!-- Modal Form -->
    <UiModal v-model="showDialog" :title="editId ? 'Edit User' : 'New User'" width="40vw" confirmLabel="Simpan" @confirm="saveData">
      <div class="grid grid-cols-2 gap-4">
        <UiInput label="Nama" v-model="form.name" required class="col-span-2" />
        <UiInput label="Email Login" v-model="form.email" type="email" required class="col-span-2" :disabled="!!editId" />

        <UiInput v-if="!editId" label="Password" v-model="form.password" type="password" required class="col-span-2" />
        
        <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label class="text-sm font-medium text-slate-700">Role / Hak Akses</label>
          <UiSelect
            v-model="form.roleId"
            :options="roles"
            optionLabel="name"
            optionValue="id"
            placeholder="Pilih role"
          />
        </div>
        
        <!-- Toggle Status via PrimeVue -->
        <div class="col-span-2 mt-2 flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
          <div>
             <h4 class="text-sm font-bold text-slate-800">Status Akun</h4>
             <p class="text-[10px] text-slate-500">Akun tidak aktif tidak dapat login ke sistem/PWA.</p>
          </div>
          <ToggleSwitch v-model="form.isActive" />
        </div>

      </div>
    </UiModal>

    <UiModal v-model="showReset" title="Reset Password" width="420px" confirmLabel="Reset" @confirm="doResetPassword">
      <div class="space-y-4">
        <UiInput label="New Password" v-model="resetPassword" type="password" required />
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN'] })

import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()
const searchQuery = ref('')
const showDialog = ref(false)
const editId = ref<string | null>(null)
const showReset = ref(false)
const resetUserId = ref<string | null>(null)
const resetPassword = ref('')

const form = ref({
  name: '',
  email: '',
  password: '',
  roleId: '',
  isActive: true
})

type ApiRole = { id: string; name: string }
type ApiUser = { id: string; email: string; name: string; roleId: string; isActive: boolean; role?: ApiRole | null }
const users = ref<ApiUser[]>([])
const roles = ref<ApiRole[]>([])
const loading = ref(false)

const rows = computed(() => {
  return users.value.map(u => ({
    email: u.email,
    name: u.name,
    role: u.role?.name || '-',
    status: u.isActive ? 'ACTIVE' : 'INACTIVE',
    _raw: u
  }))
})

const columns = ref([
  { field: 'name', headerName: 'Nama', width: 220 },
  { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
  { field: 'role', headerName: 'Role', width: 180 },
  { field: 'status', headerName: 'Status', width: 120 },
  { field: 'actions', headerName: '', slotName: 'actions' }
])

async function fetchRoles() {
  const res = await api<{ success: true; roles: ApiRole[] }>('/api/users/roles')
  roles.value = res.roles
}

async function fetchUsers() {
  loading.value = true
  try {
    const res = await api<{ success: true; users: ApiUser[] }>('/api/users', {
      query: { search: searchQuery.value || undefined, page: 1, limit: 200 }
    })
    users.value = res.users
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat users')
  } finally {
    loading.value = false
  }
}

function openDialog(id?: string) {
  if (id) {
    const data = users.value.find(u => u.id === id)
    if (data) {
      editId.value = data.id
      form.value = { 
        name: data.name, 
        email: data.email, 
        password: '',
        roleId: data.roleId,
        isActive: data.isActive
      }
    }
  } else {
    editId.value = null
    form.value = { name: '', email: '', password: '', roleId: roles.value[0]?.id || '', isActive: true }
  }
  showDialog.value = true
}

async function saveData() {
  if (!form.value.name || !form.value.email) return toast.error('Lengkapi nama dan email.')
  if (!editId.value && !form.value.password) return toast.error('Password wajib untuk user baru.')
  if (!form.value.roleId) return toast.error('Role wajib dipilih.')
  try {
    if (editId.value) {
      await api(`/api/users/users/${editId.value}`, { method: 'PUT', body: { name: form.value.name, roleId: form.value.roleId, isActive: form.value.isActive } })
      toast.success('User diperbarui.')
    } else {
      await api('/api/users', { method: 'POST', body: { email: form.value.email, password: form.value.password, name: form.value.name, roleId: form.value.roleId } })
      toast.success('User dibuat.')
    }
    showDialog.value = false
    await fetchUsers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan user')
  }
}

function openReset(id: string) {
  resetUserId.value = id
  resetPassword.value = ''
  showReset.value = true
}

async function doResetPassword() {
  if (!resetUserId.value) return
  if (!resetPassword.value) return toast.error('Isi password baru.')
  try {
    await api(`/api/users/users/${resetUserId.value}/reset-password`, { method: 'POST', body: { newPassword: resetPassword.value } })
    toast.success('Password direset.')
    showReset.value = false
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal reset password')
  }
}

async function confirmDelete(id: string) {
  const ok = window.confirm('Nonaktifkan user ini?')
  if (!ok) return
  try {
    await api(`/api/users/users/${id}`, { method: 'DELETE' })
    toast.success('User dinonaktifkan.')
    await fetchUsers()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menghapus user')
  }
}

onMounted(async () => {
  await fetchRoles()
  await fetchUsers()
})
</script>
