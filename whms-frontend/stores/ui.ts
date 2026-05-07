import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const theme = ref('light')
  const language = ref('id')
  const loadingRoutes = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    theme,
    language,
    loadingRoutes,
    toggleSidebar
  }
}, {
  persist: true
})
