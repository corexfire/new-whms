import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '~/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<string[]>([])

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  async function login(email: string, password: string) {
    const res = await $fetch<any>('/api/auth/login', {
      baseURL: useRuntimeConfig().public.apiBase as string,
      method: 'POST',
      body: { email, password }
    })
    
    token.value = res.data.accessToken
    user.value = res.data.user
    permissions.value = res.data.permissions
  }

  function logout() {
    user.value = null
    token.value = null
    permissions.value = []
    
    if (import.meta.client) (globalThis as any).location.href = '/login'
  }

  return {
    user,
    token,
    permissions,
    isAuthenticated,
    login,
    logout
  }
}, {
  persist: true
} as any)
