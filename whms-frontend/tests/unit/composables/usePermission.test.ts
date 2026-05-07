import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock Nuxt globals
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3001' }
}))

import { useAuthStore } from '~/stores/auth'
import { usePermission } from '~/composables/usePermission'

describe('usePermission', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('can()', () => {
    it('should return false when user has no permissions', () => {
      const { can } = usePermission()
      expect(can('view', 'purchase_orders')).toBe(false)
    })

    it('should return true when user has exact permission', () => {
      const auth = useAuthStore()
      auth.permissions = ['purchase_orders.view', 'purchase_orders.create']
      
      const { can } = usePermission()
      expect(can('view', 'purchase_orders')).toBe(true)
      expect(can('create', 'purchase_orders')).toBe(true)
      expect(can('delete', 'purchase_orders')).toBe(false)
    })

    it('should return true for super admin with wildcard', () => {
      const auth = useAuthStore()
      auth.permissions = ['*']
      
      const { can } = usePermission()
      expect(can('view', 'purchase_orders')).toBe(true)
      expect(can('delete', 'anything')).toBe(true)
    })
  })

  describe('hasRole()', () => {
    it('should return false when user has no roles', () => {
      const { hasRole } = usePermission()
      expect(hasRole('MANAGER')).toBe(false)
    })

    it('should return true when user has the role', () => {
      const auth = useAuthStore()
      auth.user = { id: '1', email: 'a@b.com', first_name: 'A', last_name: 'B', roles: ['MANAGER', 'INBOUND_STAFF'] }
      
      const { hasRole } = usePermission()
      expect(hasRole('MANAGER')).toBe(true)
      expect(hasRole('INBOUND_STAFF')).toBe(true)
      expect(hasRole('SUPER_ADMIN')).toBe(false)
    })
  })
})
