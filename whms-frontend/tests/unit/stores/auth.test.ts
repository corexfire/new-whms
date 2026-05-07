import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock $fetch and useRuntimeConfig since they are Nuxt globals
vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3001', wsUrl: 'http://localhost:3001' }
}))
vi.stubGlobal('navigateTo', vi.fn())

import { useAuthStore } from '~/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start unauthenticated', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(auth.token).toBeNull()
    expect(auth.permissions).toEqual([])
  })

  it('should login successfully and set user/token/permissions', async () => {
    const mockResponse = {
      data: {
        accessToken: 'test-token-123',
        user: { id: '1', email: 'test@test.com', first_name: 'Test', last_name: 'User', roles: ['MANAGER'] },
        permissions: ['purchase_orders.view', 'purchase_orders.create']
      }
    }

    const mockedFetch = vi.mocked($fetch)
    mockedFetch.mockResolvedValueOnce(mockResponse)

    const auth = useAuthStore()
    await auth.login('test@test.com', 'password123')

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe('test-token-123')
    expect(auth.user?.email).toBe('test@test.com')
    expect(auth.user?.roles).toContain('MANAGER')
    expect(auth.permissions).toHaveLength(2)
  })

  it('should logout and clear state', async () => {
    const auth = useAuthStore()
    
    // Manually set authenticated state
    auth.token = 'some-token'
    auth.user = { id: '1', email: 'a@b.com', first_name: 'A', last_name: 'B', roles: ['ADMIN'] }
    auth.permissions = ['*']
    
    expect(auth.isAuthenticated).toBe(true)

    // Mock location.href setter
    const originalLocation = globalThis.location
    Object.defineProperty(globalThis, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true
    })

    auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.token).toBeNull()
    expect(auth.permissions).toEqual([])
    expect(auth.isAuthenticated).toBe(false)

    // Restore
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true
    })
  })
})
