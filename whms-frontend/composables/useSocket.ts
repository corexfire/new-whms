import { useNuxtApp } from '#app'
import { onMounted, onUnmounted } from 'vue'

export function useSocketEvent(eventName: string, callback: (payload: any) => void) {
  const { $socket } = useNuxtApp()
  const socket = $socket as ReturnType<typeof import('socket.io-client').io>

  onMounted(() => {
    if (socket) {
      socket.on(eventName, callback)
    }
  })

  onUnmounted(() => {
    if (socket) {
      socket.off(eventName, callback)
    }
  })

  // Expose emit functionality if needed strictly within this context
  const emitEvent = (payload: any) => {
    if (socket) {
      socket.emit(eventName, payload)
    }
  }

  return { emitEvent }
}

export function useSocketConnection() {
  const { $socket } = useNuxtApp()
  const socket = $socket as ReturnType<typeof import('socket.io-client').io>

  return {
    isConnected: computed(() => socket.connected),
    socketId: computed(() => socket.id)
  }
}
