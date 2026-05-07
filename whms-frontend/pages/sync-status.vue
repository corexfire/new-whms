<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Status Sinkronisasi</h1>
        <p class="text-sm text-slate-500">Kelola antrian offline dan pantau status sinkronisasi</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="handleCleanup"
          class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <i class="pi pi-trash mr-1.5"></i>
          Bersihkan Selesai
        </button>
        <button
          @click="handleSyncNow"
          :disabled="isSyncing || !isOnline"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <i :class="['pi', isSyncing ? 'pi-spin pi-spinner' : 'pi-refresh']"></i>
          {{ isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi Sekarang' }}
        </button>
      </div>
    </div>

    <!-- Connection Status -->
    <div :class="['p-4 rounded-xl border flex items-center gap-3', isOnline ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200']">
      <div :class="['w-3 h-3 rounded-full animate-pulse', isOnline ? 'bg-emerald-500' : 'bg-red-500']"></div>
      <span :class="['text-sm font-semibold', isOnline ? 'text-emerald-700' : 'text-red-700']">
        {{ isOnline ? 'Online — Terhubung ke server' : 'Offline — Data akan disimpan lokal' }}
      </span>
      <span v-if="lastSyncAt" class="text-xs text-slate-400 ml-auto">
        Terakhir sync: {{ lastSyncAt }}
      </span>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div v-for="stat in statsCards" :key="stat.label"
        @click="activeTab = stat.filterKey"
        :class="[
          'p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md',
          activeTab === stat.filterKey ? 'ring-2 ring-primary-400 border-primary-300 shadow-sm' : 'border-slate-200'
        ]"
      >
        <div class="flex items-center gap-2 mb-2">
          <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', stat.bgColor]">
            <i :class="[stat.icon, stat.iconColor, 'text-sm']"></i>
          </div>
        </div>
        <p class="text-2xl font-bold text-slate-900">{{ stat.count }}</p>
        <p class="text-xs text-slate-500 mt-0.5">{{ stat.label }}</p>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
      <button
        v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
          activeTab === tab.key
            ? 'bg-white text-primary-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Queue Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div v-if="filteredItems.length === 0" class="p-12 text-center">
        <i class="pi pi-inbox text-4xl text-slate-300 mb-3 block"></i>
        <p class="text-sm text-slate-500">Tidak ada item di antrian untuk filter ini</p>
      </div>
      
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="text-left p-3 font-semibold text-slate-600 w-40">ID</th>
            <th class="text-left p-3 font-semibold text-slate-600">Tipe Aksi</th>
            <th class="text-left p-3 font-semibold text-slate-600">Status</th>
            <th class="text-left p-3 font-semibold text-slate-600">Retry</th>
            <th class="text-left p-3 font-semibold text-slate-600">Pesan Error</th>
            <th class="text-left p-3 font-semibold text-slate-600">Waktu</th>
            <th class="text-right p-3 font-semibold text-slate-600 w-36">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-slate-50/50 transition-colors">
            <td class="p-3">
              <code class="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{{ item.id.substring(0, 8) }}...</code>
            </td>
            <td class="p-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <i :class="actionTypeIcon(item.action_type)"></i>
                {{ formatActionType(item.action_type) }}
              </span>
            </td>
            <td class="p-3">
              <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', statusBadgeClass(item.status)]">
                <span :class="['w-1.5 h-1.5 rounded-full', statusDotClass(item.status)]"></span>
                {{ item.status }}
              </span>
            </td>
            <td class="p-3 text-slate-500">{{ item.retry_count }}/5</td>
            <td class="p-3">
              <span v-if="item.error_message" class="text-xs text-red-600 line-clamp-2">{{ item.error_message }}</span>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
            <td class="p-3 text-xs text-slate-500">{{ formatDate(item.created_at) }}</td>
            <td class="p-3 text-right">
              <div class="flex gap-1 justify-end">
                <!-- CONFLICT actions -->
                <template v-if="item.status === 'CONFLICT'">
                  <button @click="handleResolve(item.id, 'force')" title="Paksa Kirim Ulang"
                    class="p-1.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                    <i class="pi pi-replay"></i>
                  </button>
                  <button @click="handleResolve(item.id, 'discard')" title="Buang"
                    class="p-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    <i class="pi pi-times"></i>
                  </button>
                </template>
                <!-- FAILED actions -->
                <template v-if="item.status === 'FAILED'">
                  <button @click="handleRetry(item.id)" title="Coba Lagi"
                    class="p-1.5 text-xs rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                    <i class="pi pi-refresh"></i>
                  </button>
                  <button @click="handleDiscard(item.id)" title="Buang"
                    class="p-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    <i class="pi pi-times"></i>
                  </button>
                </template>
                <!-- PENDING — view payload -->
                <button @click="showPayload(item)" title="Lihat Payload"
                  class="p-1.5 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  <i class="pi pi-eye"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Payload Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedItem" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="selectedItem = null"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
          <div class="p-5 border-b border-slate-100">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-slate-900">Detail Payload</h3>
              <button @click="selectedItem = null" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="pi pi-times text-lg"></i>
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-1">ID: {{ selectedItem.id }}</p>
          </div>
          <div class="p-5">
            <div class="bg-slate-50 rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre class="text-xs text-slate-700 font-mono whitespace-pre-wrap">{{ JSON.stringify(selectedItem.payload, null, 2) }}</pre>
            </div>
          </div>
          <div class="p-4 bg-slate-50 border-t border-slate-100 text-right">
            <button @click="selectedItem = null" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SyncService, type QueueStats } from '~/services/sync'
import { SyncStatus } from '~/types/enums'
import type { OfflineAction } from '~/services/db'

definePageMeta({
  middleware: [],
  layout: 'default'
})

useHead({ title: 'Status Sinkronisasi — WHMS' })

const { isOnline, isSyncing, triggerSync, refreshPendingCount } = useOffline()

const allItems = ref<OfflineAction[]>([])
const stats = ref<QueueStats>({ pending: 0, synced: 0, conflict: 0, failed: 0, discarded: 0, total: 0 })
const activeTab = ref<string>('all')
const selectedItem = ref<OfflineAction | null>(null)
const lastSyncAt = ref<string>('')

const tabs = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Pending' },
  { key: 'conflict', label: 'Conflict' },
  { key: 'failed', label: 'Failed' },
  { key: 'synced', label: 'Synced' },
]

const statsCards = computed(() => [
  { label: 'Pending', count: stats.value.pending, filterKey: 'pending', icon: 'pi pi-clock', iconColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  { label: 'Synced', count: stats.value.synced, filterKey: 'synced', icon: 'pi pi-check-circle', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { label: 'Conflict', count: stats.value.conflict, filterKey: 'conflict', icon: 'pi pi-exclamation-triangle', iconColor: 'text-orange-600', bgColor: 'bg-orange-50' },
  { label: 'Failed', count: stats.value.failed, filterKey: 'failed', icon: 'pi pi-times-circle', iconColor: 'text-red-600', bgColor: 'bg-red-50' },
  { label: 'Discarded', count: stats.value.discarded, filterKey: 'discarded', icon: 'pi pi-ban', iconColor: 'text-slate-500', bgColor: 'bg-slate-100' },
])

const filteredItems = computed(() => {
  if (activeTab.value === 'all') return allItems.value
  const statusMap: Record<string, string> = {
    pending: SyncStatus.PENDING,
    synced: SyncStatus.SYNCED,
    conflict: SyncStatus.CONFLICT,
    failed: SyncStatus.FAILED,
    discarded: SyncStatus.DISCARDED,
  }
  return allItems.value.filter(i => i.status === statusMap[activeTab.value])
})

async function loadData() {
  allItems.value = await SyncService.getQueueItems()
  stats.value = await SyncService.getQueueStats()
}

async function handleSyncNow() {
  await triggerSync()
  await loadData()
}

async function handleResolve(id: string, strategy: 'force' | 'discard') {
  await SyncService.resolveConflict(id, strategy)
  await loadData()
  if (strategy === 'force') await handleSyncNow()
}

async function handleRetry(id: string) {
  await SyncService.retryFailed(id)
  await loadData()
  await handleSyncNow()
}

async function handleDiscard(id: string) {
  await SyncService.discardAction(id)
  await loadData()
}

async function handleCleanup() {
  await SyncService.cleanupQueue()
  await loadData()
}

function showPayload(item: OfflineAction) {
  selectedItem.value = item
}

function formatActionType(type: string) {
  return type.replace(/_/g, ' ')
}

function actionTypeIcon(type: string) {
  const icons: Record<string, string> = {
    CONFIRM_PICK: 'pi pi-check-square',
    PUTAWAY_ITEM: 'pi pi-download',
    STOCK_COUNT: 'pi pi-calculator',
    POS_SALE: 'pi pi-shopping-cart',
    POS_RETURN: 'pi pi-replay',
    LABEL_PRINT: 'pi pi-print',
  }
  return icons[type] || 'pi pi-file'
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    SYNCED: 'bg-emerald-50 text-emerald-700',
    CONFLICT: 'bg-orange-50 text-orange-700',
    FAILED: 'bg-red-50 text-red-700',
    DISCARDED: 'bg-slate-100 text-slate-500',
  }
  return map[status] || 'bg-slate-100 text-slate-700'
}

function statusDotClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-500',
    SYNCED: 'bg-emerald-500',
    CONFLICT: 'bg-orange-500',
    FAILED: 'bg-red-500',
    DISCARDED: 'bg-slate-400',
  }
  return map[status] || 'bg-slate-400'
}

function formatDate(isoDate: string) {
  if (!isoDate) return '—'
  const d = new Date(isoDate)
  return d.toLocaleString('id-ID', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(async () => {
  await loadData()
  // Check last sync metadata
  try {
    const { db } = await import('~/services/db')
    const meta = await db.sync_metadata.get('global')
    if (meta) lastSyncAt.value = formatDate(meta.last_sync_at)
  } catch (_) { /* ignore */ }
})
</script>
