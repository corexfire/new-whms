import Dexie, { type Table } from 'dexie'
import { OfflineActionType, SyncStatus } from '~/types/enums'

export interface OfflineAction {
  id: string
  action_type: OfflineActionType
  payload: any
  status: SyncStatus
  retry_count: number
  error_message?: string
  created_at: string
}

export interface SyncMetadata {
  module: string
  last_sync_at: string
}

export class WHMSDatabase extends Dexie {
  items_cache!: Table<any, string>
  locations_cache!: Table<any, string>
  active_picklists!: Table<any, string>
  pos_product_cache!: Table<any, string>
  offline_queue!: Table<OfflineAction, string>
  sync_metadata!: Table<SyncMetadata, string>

  constructor() {
    super('WHMSDatabase')
    
    // Version 1: Original schema
    this.version(1).stores({
      items_cache: 'id, sku, category_id',
      locations_cache: 'id, warehouse_id',    
      active_picklists: 'id, status',
      offline_queue: 'id, action_type, status, created_at',
      sync_metadata: 'module'
    })

    // Version 2: Add pos_product_cache table
    this.version(2).stores({
      items_cache: 'id, sku, category_id',
      locations_cache: 'id, warehouse_id',    
      active_picklists: 'id, status',
      pos_product_cache: 'id, sku, name, category_id, barcode',
      offline_queue: 'id, action_type, status, created_at',
      sync_metadata: 'module'
    })
  }

  // Helper method to add queue securely
  async enqueueAction(actionType: OfflineActionType, payload: any) {
    const action: OfflineAction = {
      id: crypto.randomUUID(),
      action_type: actionType,
      payload,
      status: SyncStatus.PENDING,
      retry_count: 0,
      created_at: new Date().toISOString()
    }
    await this.offline_queue.add(action)
    return action.id
  }
}

// Singleton instance
export const db = new WHMSDatabase()
