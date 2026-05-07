import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOfflineStore = defineStore('offline', () => {
  const isOnline = ref(true)
  const pendingCount = ref(0)
  const isSyncing = ref(false)

  // Real-time listener registration is mostly handled inside useOffline() composable
  // but we store the reactive truth here so other components can access it easily
  
  function updateStatus(status: boolean) {
    isOnline.value = status
  }
  
  function setPendingCount(count: number) {
    pendingCount.value = count
  }
  
  function setSyncing(status: boolean) {
    isSyncing.value = status
  }

  return {
    isOnline,
    pendingCount,
    isSyncing,
    updateStatus,
    setPendingCount,
    setSyncing
  }
})
