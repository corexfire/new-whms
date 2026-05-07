import { db } from './db'
import { SyncStatus } from '~/types/enums'

export interface QueueStats {
  pending: number
  synced: number
  conflict: number
  failed: number
  discarded: number
  total: number
}

/**
 * SyncService
 * 
 * Handles the background sync of the offline queue with the main server,
 * conflict resolution, retry logic, and cache refresh.
 */
export const SyncService = {
  
  async syncAll() {
    console.log('SyncService: Starting offline queue replay...')
    
    // 1. Get all pending actions from IndexedDB sorted by created_at (oldest first)
    const pendings = await db.offline_queue
      .where('status').equals(SyncStatus.PENDING)
      .sortBy('created_at')

    if (pendings.length === 0) {
      console.log('SyncService: No pending actions.')
      return
    }

    console.log(`SyncService: Found ${pendings.length} pending actions.`)

    const apiConfig = useRuntimeConfig().public.apiBase as string

    // 2. Loop through and process each one
    for (const action of pendings) {
      if (!navigator.onLine) {
        console.warn('SyncService: Connection lost mid-sync. Aborting.')
        break
      }

      action.retry_count = (action.retry_count || 0) + 1

      try {
        await $fetch<any>('/api/sync/bulk', {
          baseURL: apiConfig,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${window.localStorage.getItem('auth-token')}`
          },
          body: {
            actions: [action]
          }
        })

        // Status 200/201 OK -> SYNCED
        await db.offline_queue.update(action.id, {
          status: SyncStatus.SYNCED,
          retry_count: action.retry_count
        })

      } catch (err: any) {
        // Status 409 Conflict -> CONFLICT
        if (err.response?.status === 409) {
          await db.offline_queue.update(action.id, {
            status: SyncStatus.CONFLICT,
            retry_count: action.retry_count,
            error_message: err.response._data?.message || 'Conflict detected'
          })
        } else {
          // Status 5xx Server Error or Network failure -> keep PENDING unless retry_count > 5
          if (action.retry_count >= 5) {
            await db.offline_queue.update(action.id, {
              status: SyncStatus.FAILED,
              retry_count: action.retry_count,
              error_message: 'Max retry attempts reached'
            })
          } else {
            await db.offline_queue.update(action.id, {
              retry_count: action.retry_count,
              error_message: err.message || 'Temporary network failure'
            })
          }
        }
      }
    }
    
    console.log('SyncService: Sync iteration complete.')
  },

  /**
   * Resolve a CONFLICT action by either forcing a retry or discarding it
   */
  async resolveConflict(id: string, strategy: 'force' | 'discard') {
    if (strategy === 'force') {
      // Reset to PENDING so it gets picked up in next syncAll
      await db.offline_queue.update(id, {
        status: SyncStatus.PENDING,
        retry_count: 0,
        error_message: undefined
      })
    } else {
      await db.offline_queue.update(id, {
        status: SyncStatus.DISCARDED,
        error_message: 'Discarded by user'
      })
    }
  },

  /**
   * Retry a FAILED action by resetting status/retry_count
   */
  async retryFailed(id: string) {
    await db.offline_queue.update(id, {
      status: SyncStatus.PENDING,
      retry_count: 0,
      error_message: undefined
    })
  },

  /**
   * Discard an action (mark as DISCARDED)
   */
  async discardAction(id: string) {
    await db.offline_queue.update(id, {
      status: SyncStatus.DISCARDED,
      error_message: 'Discarded by user'
    })
  },

  /**
   * Get queue statistics grouped by status
   */
  async getQueueStats(): Promise<QueueStats> {
    const all = await db.offline_queue.toArray()
    const stats: QueueStats = {
      pending: 0,
      synced: 0,
      conflict: 0,
      failed: 0,
      discarded: 0,
      total: all.length
    }
    for (const item of all) {
      switch (item.status) {
        case SyncStatus.PENDING: stats.pending++; break
        case SyncStatus.SYNCED: stats.synced++; break
        case SyncStatus.CONFLICT: stats.conflict++; break
        case SyncStatus.FAILED: stats.failed++; break
        case SyncStatus.DISCARDED: stats.discarded++; break
      }
    }
    return stats
  },

  /**
   * Get all queue items, optionally filtered by status
   */
  async getQueueItems(statusFilter?: SyncStatus) {
    if (statusFilter) {
      return db.offline_queue.where('status').equals(statusFilter).sortBy('created_at')
    }
    return db.offline_queue.orderBy('created_at').reverse().toArray()
  },

  /**
   * Pull fresh data cache from the server after successful sync
   */
  async pullFreshCache() {
    const apiConfig = useRuntimeConfig().public.apiBase as string
    const authToken = window.localStorage.getItem('auth-token')

    try {
      // Refresh items cache
      const items = await $fetch<any>('/api/items', {
        baseURL: apiConfig,
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (items?.data) {
        await db.items_cache.clear()
        await db.items_cache.bulkPut(items.data)
      }

      // Refresh locations cache
      const locations = await $fetch<any>('/api/locations', {
        baseURL: apiConfig,
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (locations?.data) {
        await db.locations_cache.clear()
        await db.locations_cache.bulkPut(locations.data)
      }

      // Update sync metadata
      await db.sync_metadata.put({
        module: 'global',
        last_sync_at: new Date().toISOString()
      })

      console.log('SyncService: Cache refreshed successfully.')
    } catch (err) {
      console.error('SyncService: Failed to refresh cache:', err)
    }
  },

  /**
   * Clear all synced and discarded items from the queue (cleanup)
   */
  async cleanupQueue() {
    await db.offline_queue
      .where('status')
      .anyOf([SyncStatus.SYNCED, SyncStatus.DISCARDED])
      .delete()
    console.log('SyncService: Queue cleanup complete.')
  }
}
