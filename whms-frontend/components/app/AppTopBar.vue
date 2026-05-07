<template>
  <header class="app-topbar bg-white dark:bg-slate-950 shadow-sm border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 z-10">
    
    <!-- Left: Mobile Toggle & Breadcrumb -->
    <div class="flex items-center gap-4">
      <Button
        class="lg:hidden"
        icon="pi pi-bars"
        severity="secondary"
        text
        rounded
        aria-label="Toggle sidebar"
        @click="uiStore.toggleSidebar"
      />

      <nav class="hidden sm:flex" aria-label="Breadcrumb">
        <ol class="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-300">
          <li>
            <NuxtLink to="/dashboard" class="hover:text-primary-600 transition-colors">
              <i class="pi pi-home"></i>
            </NuxtLink>
          </li>
          <li v-for="(crumb, idx) in breadcrumbs" :key="idx" class="flex items-center space-x-2">
            <i class="pi pi-chevron-right text-xs text-slate-300 dark:text-slate-600"></i>
            <span v-if="idx === breadcrumbs.length - 1" class="font-medium text-slate-900 dark:text-slate-100" aria-current="page">{{ crumb.title }}</span>
            <NuxtLink v-else :to="crumb.path" class="hover:text-primary-600 transition-colors">{{ crumb.title }}</NuxtLink>
          </li>
        </ol>
      </nav>
    </div>

    <!-- Right: Actions & User -->
    <div class="flex items-center gap-2 lg:gap-4">
      
      <!-- Global Search (Icon only for now) -->
      <Button icon="pi pi-search" text rounded severity="secondary" aria-label="Search" />

      <Button
        text
        rounded
        severity="secondary"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <svg v-if="isDark" class="w-[18px] h-[18px] text-slate-500 dark:text-slate-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 18a1 1 0 0 1 1 1v0a1 1 0 1 1-2 0 1 1 0 0 1 1-1zm10-8a1 1 0 0 1-1 1h-2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zM5 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zm14.07 7.07a1 1 0 0 1-1.41 0l-1.42-1.42a1 1 0 1 1 1.41-1.41l1.42 1.41a1 1 0 0 1 0 1.42zM7.76 7.76a1 1 0 0 1-1.41 0L4.93 6.34a1 1 0 1 1 1.41-1.41l1.42 1.41a1 1 0 0 1 0 1.42zm11.31-1.42a1 1 0 0 1 0 1.42l-1.42 1.42a1 1 0 1 1-1.41-1.41l1.41-1.42a1 1 0 0 1 1.42 0zM7.76 16.24a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0z"/>
        </svg>
        <svg v-else class="w-[18px] h-[18px] text-slate-500 dark:text-slate-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3a1 1 0 0 0-1.18 1.18A9 9 0 1 0 22.18 15.68 1 1 0 0 0 21 14.5z"/>
        </svg>
      </Button>
      
      <!-- Quick Add (PO, SO, GRN, etc) -->
      <div class="relative hidden sm:block">
        <Button icon="pi pi-plus" label="New" size="small" outlined severity="secondary" @click="toggleQuickMenu" aria-haspopup="true" aria-controls="quick_menu" />
        <Menu ref="quickMenu" id="quick_menu" :model="quickActions" :popup="true" />
      </div>

      <!-- Notifications -->
      <div class="relative">
        <Button icon="pi pi-bell" text rounded severity="secondary" aria-label="Notifications" @click="toggleNotifPanel" />
        <span v-if="notifStore.unreadCount > 0" class="absolute top-1 right-1 flex h-2.5 w-2.5 pointer-events-none">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      </div>

      <div class="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

      <!-- User Profile Dropdown -->
      <div class="relative cursor-pointer" @click="toggleUserMenu">
        <div class="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
          <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 shadow-sm">
            {{ userInitials }}
          </div>
          <div class="hidden md:flex flex-col items-start leading-none pr-1">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ auth.user?.name || 'Admin' }}</span>
            <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{{ userRole }}</span>
          </div>
          <i class="pi pi-angle-down text-slate-400 text-xs hidden md:block"></i>
        </div>
        
        <Menu ref="userMenu" :model="userActions" :popup="true" />
      </div>

    </div>
  </header>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useUIStore } from '~/stores/ui'
import { useNotifStore } from '~/stores/notif'
import { ref, computed, onMounted } from 'vue'

const auth = useAuthStore()
const uiStore = useUIStore()
const notifStore = useNotifStore()
const route = useRoute()
const router = useRouter()

const quickMenu = ref()
const userMenu = ref()
const isDark = useState<boolean>('isDark', () => false)

function applyTheme(v: boolean) {
  isDark.value = v
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('theme', v ? 'dark' : 'light')
  }
}

function toggleTheme() {
  applyTheme(!isDark.value)
}

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') return applyTheme(true)
  if (saved === 'light') return applyTheme(false)
  applyTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
})

const userInitials = computed(() => {
  if (!auth.user) return 'W'
  const parts = auth.user.name?.split(' ') || []
  const first = parts[0]?.charAt(0) || ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : ''
  return (first + last).toUpperCase() || 'W'
})

const userRole = computed(() => {
  if (!auth.user?.role) return 'STAFF'
  return auth.user.role.replace('_', ' ')
})

// Simple breadcrumb generator based on route path
const breadcrumbs = computed(() => {
  const paths = route.path.split('/').filter(p => p)
  if (paths.length === 0 || paths[0] === 'dashboard') return []
  
  let currentPath = ''
  return paths.map((p, i) => {
    currentPath += `/${p}`
    return {
      title: p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' '),
      path: currentPath
    }
  })
})

const quickActions = ref([
  { label: 'Purchase Order', icon: 'pi pi-file-export', command: () => router.push('/inbound/purchase-orders/new') },
  { label: 'Sales Order', icon: 'pi pi-file-import', command: () => router.push('/outbound/sales-orders/new') },
  { separator: true },
  { label: 'Stock Adjustment', icon: 'pi pi-percentage', command: () => router.push('/inventory/adjustments/new') }
])

const userActions = ref([
  { label: 'My Profile', icon: 'pi pi-user', command: () => router.push('/settings/profile') },
  { label: 'System Settings', icon: 'pi pi-cog', command: () => router.push('/settings/general') },
  { separator: true },
  { label: 'Logout', icon: 'pi pi-sign-out', command: () => auth.logout() }
])

function toggleQuickMenu(event: any) {
  quickMenu.value.toggle(event)
}

function toggleUserMenu(event: any) {
  userMenu.value.toggle(event)
}

function toggleNotifPanel() {
  // We can emit an event or just use a boolean in notifStore if we had one
  // For now, let's just make it a route or use a ref in NotifPanel
  window.dispatchEvent(new CustomEvent('toggle-notif-panel'))
}
</script>
