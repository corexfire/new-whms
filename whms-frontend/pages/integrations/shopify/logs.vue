<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Shopify Audit Logs</h1>
        <p class="text-slate-600">Riwayat aktivitas sync dan webhook.</p>
      </div>
      <div class="flex gap-2 items-center">
        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Filter status" class="w-52" />
        <Button size="small" icon="pi pi-refresh" text @click="load" />
      </div>
    </div>

    <UiDataTable
      title="Logs"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
    >
      <template #actions="{ data }">
        <Button text size="small" icon="pi pi-eye" @click="openDetails(data.id)" />
      </template>
      <template #status="{ data }">
        <UiBadge :value="data.status" />
      </template>
    </UiDataTable>

    <UiModal v-model="detailsOpen" title="Log Details" width="60vw" confirmLabel="Close" :showCancel="false" @confirm="detailsOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="text-slate-500">Action</div>
            <div class="font-medium text-slate-900">{{ selectedLog?.action || '-' }}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="text-slate-500">Status</div>
            <div class="font-medium text-slate-900">{{ selectedLog?.status || '-' }}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="text-slate-500">Direction / Type</div>
            <div class="font-medium text-slate-900">{{ (selectedLog?.direction || '-') + ' / ' + (selectedLog?.type || '-') }}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="text-slate-500">Time</div>
            <div class="font-medium text-slate-900">{{ selectedLog?.createdAt || '-' }}</div>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white">
          <div class="px-4 py-2 border-b border-slate-200 text-sm font-semibold text-slate-900">Message</div>
          <div class="px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">{{ selectedLog?.message || '-' }}</div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white">
          <div class="px-4 py-2 border-b border-slate-200 text-sm font-semibold text-slate-900">Data</div>
          <pre class="px-4 py-3 text-xs text-slate-800 overflow-auto max-h-[50vh]">{{ selectedLogData }}</pre>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const { api } = useApi()
const toast = useToast()

const logs = ref<any[]>([])
const statusFilter = ref<string | null>(null)
const detailsOpen = ref(false)
const selectedLog = ref<any | null>(null)

const selectedLogData = computed(() => {
  try {
    return JSON.stringify(selectedLog.value?.data ?? null, null, 2)
  } catch {
    return String(selectedLog.value?.data ?? '')
  }
})

const statusOptions = [
  { label: 'All', value: null },
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'FAILED', value: 'FAILED' },
  { label: 'RUNNING', value: 'RUNNING' },
  { label: 'QUEUED', value: 'QUEUED' },
]

async function load() {
  try {
    const res = await api<any>('/api/integrations/shopify/logs', { query: { limit: 100, status: statusFilter.value || undefined } })
    logs.value = res?.logs || []
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat logs')
  }
}

const rows = computed(() => {
  return logs.value.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    action: l.action,
    direction: l.direction || '-',
    type: l.type || '-',
    entityType: l.entityType || '-',
    entityId: l.entityId || '-',
    status: l.status,
    message: l.message || '-',
  }))
})

function openDetails(id: string) {
  const found = logs.value.find((l) => l.id === id) || null
  selectedLog.value = found
  detailsOpen.value = true
}

const columns = ref([
  { field: 'createdAt', headerName: 'Time', minWidth: 180, flex: 1 },
  { field: 'action', headerName: 'Action', width: 160 },
  { field: 'direction', headerName: 'Dir', width: 90 },
  { field: 'type', headerName: 'Type', width: 170 },
  { field: 'entityType', headerName: 'Entity', width: 120 },
  { field: 'entityId', headerName: 'Entity ID', minWidth: 220, flex: 1 },
  { field: 'message', headerName: 'Message', minWidth: 260, flex: 2 },
  { field: 'status', headerName: 'Status', slotName: 'status', width: 130 },
  { field: 'actions', headerName: '', slotName: 'actions', width: 70 },
])

watch(statusFilter, load)
onMounted(load)
</script>
