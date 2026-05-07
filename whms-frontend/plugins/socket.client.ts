import { defineNuxtPlugin } from '#app'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  // Base URL from Nuxt config WebSocket environment variable (fallback to API base)
  const wsUrl = (config.public.wsUrl as string) || (config.public.apiBase as string).replace('http', 'ws')

  const socket: Socket = io(wsUrl, {
    autoConnect: false,
    auth: {
      token: authStore.token
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  })

  // Watch for auth changes (token updates or logouts) to toggle socket connection
  nuxtApp.hook('app:mounted', () => {
    if (authStore.isAuthenticated) {
      socket.connect()
    }

    watch(() => authStore.isAuthenticated, (isAuth) => {
      if (isAuth) {
        socket.auth = { token: authStore.token }
        socket.connect()
      } else {
        socket.disconnect()
      }
    })
  })

  // Global connection error handling
  socket.on('connect_error', (err) => {
    console.error('Socket Connection Error:', err.message)
    if (err.message.includes('Unauthorized')) {
      authStore.logout() // Example: kick user out if socket auth fails fundamentally
    }
  })

  return {
    provide: {
      socket
    }
  }
})
