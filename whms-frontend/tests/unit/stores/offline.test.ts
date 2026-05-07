import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOfflineStore } from '~/stores/offline'

describe('useOfflineStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start online with no pending items', () => {
    const store = useOfflineStore()
    expect(store.isOnline).toBe(true)
    expect(store.pendingCount).toBe(0)
    expect(store.isSyncing).toBe(false)
  })

  it('should update online status', () => {
    const store = useOfflineStore()
    
    store.updateStatus(false)
    expect(store.isOnline).toBe(false)
    
    store.updateStatus(true)
    expect(store.isOnline).toBe(true)
  })

  it('should update pending count', () => {
    const store = useOfflineStore()
    
    store.setPendingCount(5)
    expect(store.pendingCount).toBe(5)
    
    store.setPendingCount(0)
    expect(store.pendingCount).toBe(0)
  })

  it('should track syncing state', () => {
    const store = useOfflineStore()
    
    store.setSyncing(true)
    expect(store.isSyncing).toBe(true)
    
    store.setSyncing(false)
    expect(store.isSyncing).toBe(false)
  })
})
