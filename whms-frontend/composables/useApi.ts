import { useAuthStore } from '~/stores/auth'
import { useToast } from 'vue-toastification'

export function useApi() {
  const auth = useAuthStore()
  const config = useRuntimeConfig()
  const toast = useToast()

  const api = $fetch.create({
    baseURL: config.public.apiBase as string,
    onRequest({ options }) {
      if (auth.token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${auth.token}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        // Token expired or invalid
        auth.logout()
        toast.error('Session expired, please login again.')
      } else if (response.status === 403) {
        toast.error('You do not have permission for this action.')
      } else {
        toast.error(response._data?.message || 'An error occurred')
      }
    }
  })

  return { api }
}
