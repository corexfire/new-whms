import { useOfflineStore } from '~/stores/offline'
import { db } from '~/services/db'
import { SyncStatus } from '~/types/enums'
import { SyncService } from '~/services/sync'
import { onMounted, onUnmounted, computed } from 'vue'

export function useOffline() {
  const store = useOfflineStore()

  async function checkPendingCount() {
    try {
      const count = await db.offline_queue.where('status').equals(SyncStatus.PENDING).count()
      store.setPendingCount(count)
    } catch (e) {
      console.error('Failed to count pending offline actions', e)
    }
  }

  function handleOnline() {
    store.updateStatus(true)
    triggerSync()
  }

  function handleOffline() {
    store.updateStatus(false)
  }

  async function triggerSync() {
    if (!store.isOnline || store.isSyncing) return
    
    store.setSyncing(true)
    try {
      await SyncService.syncAll()
    } finally {
      await checkPendingCount()
      store.setSyncing(false)
    }
  }

  // Auto initialize listeners if called inside setup
  if (import.meta.client) {
    onMounted(() => {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      // Set initial status
      store.updateStatus(navigator.onLine)
      checkPendingCount()
      
      if (navigator.onLine) {
        triggerSync()
      }
    })

    onUnmounted(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    })
  }

  return {
    isOnline: computed(() => store.isOnline),
    pendingCount: computed(() => store.pendingCount),
    isSyncing: computed(() => store.isSyncing),
    triggerSync,
    refreshPendingCount: checkPendingCount
  }
}
