import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncStatus } from '~/types/enums'

// Mock Dexie with vi.hoisted to avoid hoisting issues
const mockOfflineQueue = vi.hoisted(() => ({
  where: vi.fn().mockReturnThis(),
  equals: vi.fn().mockReturnThis(),
  anyOf: vi.fn().mockReturnThis(),
  sortBy: vi.fn().mockResolvedValue([]),
  toArray: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue(1),
  delete: vi.fn().mockResolvedValue(0),
  orderBy: vi.fn().mockReturnThis(),
  reverse: vi.fn().mockReturnThis(),
}))

vi.mock('~/services/db', () => ({
  db: {
    offline_queue: mockOfflineQueue,
    items_cache: { clear: vi.fn(), bulkPut: vi.fn() },
    locations_cache: { clear: vi.fn(), bulkPut: vi.fn() },
    sync_metadata: { put: vi.fn() }
  }
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3001' }
}))

vi.stubGlobal('$fetch', vi.fn())

import { SyncService } from '~/services/sync'

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chain mocks
    mockOfflineQueue.where.mockReturnThis()
    mockOfflineQueue.equals.mockReturnThis()
    mockOfflineQueue.anyOf.mockReturnThis()
    mockOfflineQueue.orderBy.mockReturnThis()
    mockOfflineQueue.reverse.mockReturnThis()
  })

  describe('getQueueStats()', () => {
    it('should return zeroed stats when queue is empty', async () => {
      mockOfflineQueue.toArray.mockResolvedValueOnce([])
      
      const stats = await SyncService.getQueueStats()
      expect(stats.total).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.synced).toBe(0)
      expect(stats.conflict).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.discarded).toBe(0)
    })

    it('should correctly count items by status', async () => {
      mockOfflineQueue.toArray.mockResolvedValueOnce([
        { status: SyncStatus.PENDING },
        { status: SyncStatus.PENDING },
        { status: SyncStatus.SYNCED },
        { status: SyncStatus.CONFLICT },
        { status: SyncStatus.FAILED },
        { status: SyncStatus.DISCARDED },
      ])
      
      const stats = await SyncService.getQueueStats()
      expect(stats.total).toBe(6)
      expect(stats.pending).toBe(2)
      expect(stats.synced).toBe(1)
      expect(stats.conflict).toBe(1)
      expect(stats.failed).toBe(1)
      expect(stats.discarded).toBe(1)
    })
  })

  describe('resolveConflict()', () => {
    it('should reset to PENDING when strategy is force', async () => {
      await SyncService.resolveConflict('test-id', 'force')
      
      expect(mockOfflineQueue.update).toHaveBeenCalledWith('test-id', {
        status: SyncStatus.PENDING,
        retry_count: 0,
        error_message: undefined
      })
    })

    it('should set DISCARDED when strategy is discard', async () => {
      await SyncService.resolveConflict('test-id', 'discard')
      
      expect(mockOfflineQueue.update).toHaveBeenCalledWith('test-id', {
        status: SyncStatus.DISCARDED,
        error_message: 'Discarded by user'
      })
    })
  })

  describe('retryFailed()', () => {
    it('should reset status and retry count', async () => {
      await SyncService.retryFailed('failed-id')
      
      expect(mockOfflineQueue.update).toHaveBeenCalledWith('failed-id', {
        status: SyncStatus.PENDING,
        retry_count: 0,
        error_message: undefined
      })
    })
  })

  describe('discardAction()', () => {
    it('should mark as DISCARDED', async () => {
      await SyncService.discardAction('some-id')
      
      expect(mockOfflineQueue.update).toHaveBeenCalledWith('some-id', {
        status: SyncStatus.DISCARDED,
        error_message: 'Discarded by user'
      })
    })
  })

  describe('syncAll()', () => {
    it('should do nothing if no pending items', async () => {
      mockOfflineQueue.sortBy.mockResolvedValueOnce([])
      
      await SyncService.syncAll()
      expect(vi.mocked($fetch)).not.toHaveBeenCalled()
    })

    it('should sync pending items and mark as SYNCED on success', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      
      const mockAction = {
        id: 'action-1',
        action_type: 'CONFIRM_PICK',
        payload: { pick_id: '123' },
        status: SyncStatus.PENDING,
        retry_count: 0,
        created_at: '2025-04-01T00:00:00Z'
      }

      mockOfflineQueue.sortBy.mockResolvedValueOnce([mockAction])
      vi.mocked($fetch).mockResolvedValueOnce({ success: true })
      
      // Mock localStorage
      vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue('test-token') })

      await SyncService.syncAll()
      
      expect(mockOfflineQueue.update).toHaveBeenCalledWith('action-1', {
        status: SyncStatus.SYNCED,
        retry_count: 1
      })
    })
  })

  describe('cleanupQueue()', () => {
    it('should delete synced and discarded items', async () => {
      await SyncService.cleanupQueue()
      
      expect(mockOfflineQueue.where).toHaveBeenCalledWith('status')
      expect(mockOfflineQueue.anyOf).toHaveBeenCalledWith([SyncStatus.SYNCED, SyncStatus.DISCARDED])
      expect(mockOfflineQueue.delete).toHaveBeenCalled()
    })
  })
})
