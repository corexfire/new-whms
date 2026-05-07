<template>
  <div class="p-6">
    <div class="flex flex-wrap gap-2 items-center mb-4">
      <UiSelect
        v-model="filterType"
        :options="typeOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Tipe Akun"
        class="w-44"
      />
      <UiSelect
        v-model="filterIsActive"
        :options="activeOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Status"
        class="w-36"
      />
      <IconField iconPosition="left" class="hidden sm:block">
        <InputIcon class="pi pi-search text-slate-400" />
        <InputText v-model="searchQuery" placeholder="Cari kode / nama akun..." size="small" />
      </IconField>
      <Button icon="pi pi-plus" label="Tambah Akun" size="small" @click="openCreate()" />
      <Button icon="pi pi-sitemap" label="Expand All" size="small" severity="secondary" outlined @click="expandAll()" />
      <Button icon="pi pi-minus" label="Collapse All" size="small" severity="secondary" outlined @click="collapseAll()" />
      <Button icon="pi pi-refresh" text rounded @click="refreshAll()" :loading="loadingTree || loadingFlat" />
    </div>

    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h2 class="text-sm font-bold text-slate-700">Chart of Accounts (Tree View)</h2>
        <div class="text-xs text-slate-500">
          {{ flatAccounts.length }} akun
        </div>
      </div>

      <TreeTable
        :value="filteredTreeNodes"
        v-model:expandedKeys="expandedKeys"
        :loading="loadingTree"
        scrollable
        scrollHeight="calc(100vh - 260px)"
        class="text-sm"
      >
        <Column field="code" header="Kode" expander style="width: 140px">
          <template #body="{ node }">
            <span v-if="node.data.isGroup" class="font-bold text-slate-700">{{ node.data.groupLabel }}</span>
            <span v-else class="font-mono text-slate-700">{{ node.data.code }}</span>
          </template>
        </Column>

        <Column field="name" header="Nama Akun" style="min-width: 320px">
          <template #body="{ node }">
            <span :class="node.data.isGroup ? 'font-bold text-slate-800' : 'text-slate-800'">
              {{ node.data.name }}
            </span>
            <span v-if="node.data.description" class="block text-xs text-slate-500 mt-0.5">
              {{ node.data.description }}
            </span>
          </template>
        </Column>

        <Column field="type" header="Tipe" style="width: 140px">
          <template #body="{ node }">
            <span v-if="node.data.type" class="text-xs font-bold px-2 py-0.5 rounded-full border" :class="typeChipClass(node.data.type)">
              {{ node.data.type }}
            </span>
          </template>
        </Column>

        <Column field="balance" header="Saldo" style="width: 190px">
          <template #body="{ node }">
            <span v-if="node.data.isGroup" class="text-slate-400">-</span>
            <span v-else class="font-semibold">{{ formatIdr(node.data.balance) }}</span>
          </template>
        </Column>

        <Column header="Status" style="width: 130px">
          <template #body="{ node }">
            <span v-if="node.data.isGroup" class="text-slate-400">-</span>
            <span
              v-else
              class="text-xs font-bold px-2 py-0.5 rounded-full border"
              :class="node.data.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'"
            >
              {{ node.data.isActive ? 'ACTIVE' : 'INACTIVE' }}
            </span>
          </template>
        </Column>

        <Column header="" style="width: 120px">
          <template #body="{ node }">
            <div v-if="!node.data.isGroup" class="flex items-center gap-1 justify-end">
              <Button text rounded size="small" icon="pi pi-pencil" @click="openEdit(node.data.id)" />
              <Button text rounded size="small" severity="danger" icon="pi pi-trash" @click="deleteAccount(node.data.id)" />
            </div>
          </template>
        </Column>
      </TreeTable>
    </div>

    <UiModal v-model="showDialog" :title="editId ? 'Edit Akun' : 'Tambah Akun Baru'" width="45vw" confirmLabel="Simpan" @confirm="saveAccount" :loading="saving">
      <div class="space-y-4">
        <UiInput label="Kode Akun" v-model="form.code" placeholder="Misal: 1112" required :disabled="Boolean(editId)" />
        <UiInput label="Nama Akun" v-model="form.name" placeholder="Misal: Kas Besar" required />
        <UiSelect
          label="Tipe Akun"
          v-model="form.type"
          :options="typeOptionsNoAll"
          optionLabel="label"
          optionValue="value"
          required
          :disabled="Boolean(editId)"
        />
        <UiSelect
          label="Akun Induk (Parent)"
          v-model="form.parentId"
          :options="parentOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="(Root)"
        />
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-slate-700">Deskripsi</label>
          <Textarea v-model="form.description" rows="2" class="w-full bg-slate-50" placeholder="Optional..." />
        </div>
        <div class="flex items-center gap-2 mt-2">
          <Checkbox v-model="form.isActive" inputId="cactive" :binary="true" />
          <label for="cactive" class="text-sm font-medium text-slate-700">Akun Aktif</label>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const toast = useToast()
const { api } = useApi()
const searchQuery = ref('')
const filterType = ref<AccountType | 'ALL'>('ALL')
const filterIsActive = ref<boolean | null>(null)
const showDialog = ref(false)
const editId = ref<string | null>(null)
const loadingTree = ref(false)
const loadingFlat = ref(false)
const saving = ref(false)

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type ApiAccount = {
  id: string
  code: string
  name: string
  type: AccountType
  description?: string | null
  isActive: boolean
  parentId?: string | null
  parent?: { id: string; code: string; name: string } | null
  balance: number
}

type Option = { value: any; label: string }
type ApiTreeNode = ApiAccount & { children?: ApiTreeNode[] }
type ApiTreeGroup = { type: AccountType; accounts: ApiTreeNode[] }
type TreeNode = { key: string; data: any; children?: TreeNode[] }

const typeOptions = ref<Array<{ label: string; value: AccountType | 'ALL' }>>([
  { label: 'All', value: 'ALL' },
  { label: 'ASSET', value: 'ASSET' },
  { label: 'LIABILITY', value: 'LIABILITY' },
  { label: 'EQUITY', value: 'EQUITY' },
  { label: 'REVENUE', value: 'REVENUE' },
  { label: 'EXPENSE', value: 'EXPENSE' },
])

const typeOptionsNoAll = computed(() => typeOptions.value.filter((o) => o.value !== 'ALL'))

const activeOptions = ref<Array<{ label: string; value: boolean | null }>>([
  { label: 'All', value: null },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
])

const flatAccounts = ref<ApiAccount[]>([])
const treeNodes = ref<TreeNode[]>([])
const expandedKeys = ref<Record<string, boolean>>({})

const parentOptions = computed<Option[]>(() => {
  const type = form.value.type
  const opts = flatAccounts.value
    .filter((a) => a.type === type && a.id !== editId.value)
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))
  return [{ value: null, label: '(Root)' }, ...opts]
})

const form = ref<{
  code: string
  name: string
  type: AccountType
  parentId: string | null
  description: string
  isActive: boolean
}>({
  code: '',
  name: '',
  type: 'ASSET',
  parentId: null,
  description: '',
  isActive: true,
})

function typeChipClass(t: AccountType) {
  const m: Record<AccountType, string> = {
    ASSET: 'bg-blue-50 text-blue-700 border-blue-200',
    LIABILITY: 'bg-amber-50 text-amber-700 border-amber-200',
    EQUITY: 'bg-violet-50 text-violet-700 border-violet-200',
    REVENUE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPENSE: 'bg-red-50 text-red-700 border-red-200',
  }
  return m[t]
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v || 0))
}

function normalizeText(s: string) {
  return (s || '').toLowerCase().trim()
}

function filterTree(nodes: TreeNode[], predicate: (n: TreeNode) => boolean): TreeNode[] {
  const out: TreeNode[] = []
  for (const n of nodes) {
    const kids = Array.isArray(n.children) ? filterTree(n.children, predicate) : []
    const keep = predicate(n) || kids.length > 0
    if (keep) out.push({ ...n, children: kids })
  }
  return out
}

function toTreeTableNodes(groups: ApiTreeGroup[]): TreeNode[] {
  return groups.map((g) => ({
    key: `TYPE-${g.type}`,
    data: { isGroup: true, groupLabel: g.type, name: g.type, type: g.type },
    children: (g.accounts || []).map((a) => mapAccountNode(a)),
  }))
}

function mapAccountNode(a: ApiTreeNode): TreeNode {
  return {
    key: a.id,
    data: {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      balance: a.balance,
      isActive: a.isActive,
      description: a.description,
      parentId: a.parentId,
      isGroup: false,
    },
    children: (a.children || []).map((c) => mapAccountNode(c)),
  }
}

const filteredTreeNodes = computed(() => {
  let base = treeNodes.value

  if (filterType.value !== 'ALL') {
    base = base.filter((n) => n.data?.isGroup && n.data?.type === filterType.value)
  }

  const q = normalizeText(searchQuery.value)
  const activeFilter = filterIsActive.value

  if (!q && activeFilter === null) return base

  return filterTree(base, (n) => {
    if (n.data?.isGroup) return false
    if (activeFilter !== null && Boolean(n.data?.isActive) !== activeFilter) return false
    if (!q) return true
    const code = normalizeText(n.data?.code || '')
    const name = normalizeText(n.data?.name || '')
    return code.includes(q) || name.includes(q)
  })
})

async function fetchFlatAccounts() {
  loadingFlat.value = true
  try {
    const res = await api<{ success: true; accounts: ApiAccount[] }>('/api/coa', {
      query: {
        type: undefined,
        isActive: undefined,
        search: undefined,
      },
    })
    flatAccounts.value = (res as any).accounts || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingFlat.value = false
  }
}

async function fetchTree() {
  loadingTree.value = true
  try {
    const res = await api<{ success: true; tree: ApiTreeGroup[] }>('/api/coa/tree')
    treeNodes.value = toTreeTableNodes((res as any).tree || [])
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingTree.value = false
  }
}

function expandAll() {
  const keys: Record<string, boolean> = {}
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      keys[n.key] = true
      if (n.children?.length) walk(n.children)
    }
  }
  walk(treeNodes.value)
  expandedKeys.value = keys
}

function collapseAll() {
  expandedKeys.value = {}
}

async function refreshAll() {
  await Promise.all([fetchFlatAccounts(), fetchTree()])
}

function openCreate() {
  editId.value = null
  form.value = { code: '', name: '', type: 'ASSET', parentId: null, description: '', isActive: true }
  showDialog.value = true
}

async function openEdit(id: string) {
  saving.value = true
  try {
    const res = await api<{ success: true; account: ApiAccount }>(`/api/coa/${id}`)
    const a = (res as any).account as ApiAccount
    editId.value = a.id
    form.value = {
      code: a.code,
      name: a.name,
      type: a.type,
      parentId: a.parentId || null,
      description: a.description || '',
      isActive: Boolean(a.isActive),
    }
    showDialog.value = true
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function saveAccount() {
  if (!form.value.code || !form.value.name) return toast.error('Lengkapi kode dan nama akun.')
  saving.value = true
  try {
    if (editId.value) {
      await api(`/api/coa/${editId.value}`, {
        method: 'PUT',
        body: {
          name: form.value.name,
          parentId: form.value.parentId || undefined,
          description: form.value.description || undefined,
          isActive: form.value.isActive,
        },
      })
      toast.success('Akun diperbarui.')
    } else {
      await api('/api/coa', {
        method: 'POST',
        body: {
          code: form.value.code,
          name: form.value.name,
          type: form.value.type,
          parentId: form.value.parentId || undefined,
          description: form.value.description || undefined,
          isActive: form.value.isActive,
        },
      })
      toast.success('Akun baru ditambahkan.')
    }
    showDialog.value = false
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function deleteAccount(id: string) {
  if (!window.confirm('Hapus akun ini?')) return
  saving.value = true
  try {
    const res = await api(`/api/coa/${id}`, { method: 'DELETE' })
    const msg = (res as any).message
    toast.success(msg || 'Akun dihapus / dinonaktifkan.')
    await refreshAll()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

watch(
  () => form.value.type,
  () => {
    form.value.parentId = null
  }
)

onMounted(async () => {
  await refreshAll()
})
</script>
