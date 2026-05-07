import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppNotification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  type: 'info' | 'warning' | 'error' | 'success'
}

export const useNotifStore = defineStore('notif', () => {
  const notifications = ref<AppNotification[]>([])

  const unreadCount = computed(() => notifications.value.filter((n: AppNotification) => !n.isRead).length)

  function addNotif(notif: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) {
    notifications.value.unshift({
      ...notif,
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: new Date().toISOString()
    })
  }

  function markAllRead() {
    notifications.value.forEach((n: AppNotification) => { n.isRead = true })
  }

  function markRead(id: string) {
    const found = notifications.value.find((x: AppNotification) => x.id === id)
    if (found) found.isRead = true
  }

  return {
    notifications,
    unreadCount,
    addNotif,
    markAllRead,
    markRead
  }
})
