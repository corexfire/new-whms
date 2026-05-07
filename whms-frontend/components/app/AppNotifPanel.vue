<template>
  <Sidebar v-model="visible" position="right" :baseZIndex="1000" class="w-full md:w-96 p-sidebar-sm shadow-2xl">
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-bell text-xl text-primary-600"></i>
        <h2 class="text-xl font-bold tracking-tight text-slate-800">Notifications</h2>
        <Badge v-if="notifStore.unreadCount > 0" :value="notifStore.unreadCount" severity="danger" class="ml-2"></Badge>
      </div>
    </template>
    
    <div class="flex flex-col h-full bg-slate-50 -mx-4 -mb-4 px-4 py-2 overflow-y-auto">
      <div v-if="notifStore.notifications.length === 0" class="flex flex-col items-center justify-center flex-1 text-slate-400 mt-12 gap-3">
        <i class="pi pi-inbox text-5xl opacity-50"></i>
        <p class="text-sm font-medium">All caught up!</p>
        <p class="text-xs">No pending notifications</p>
      </div>
      
      <div v-else class="space-y-3 pb-8">
        <div class="flex justify-between items-center mb-4">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Alerts</span>
          <Button label="Mark all read" text size="small" @click="notifStore.markAllRead()" />
        </div>

        <div v-for="notif in notifStore.notifications" :key="notif.id" 
          @click="notifStore.markRead(notif.id)"
          :class="[
            'p-4 rounded-xl border-l-4 cursor-pointer transition-all hover:shadow-md bg-white border border-slate-200/60',
            !notif.isRead ? 'shadow-sm' : 'opacity-70 bg-slate-100/50',
            notif.type === 'error' ? 'border-l-red-500' :
            notif.type === 'warning' ? 'border-l-amber-500' :
            notif.type === 'success' ? 'border-l-green-500' : 'border-l-blue-500'
          ]">
          <div class="flex items-start justify-between gap-3 relative">
            
            <i :class="[
              'pi mt-0.5 shrink-0',
              notif.type === 'error' ? 'pi-times-circle text-red-500' :
              notif.type === 'warning' ? 'pi-exclamation-triangle text-amber-500' :
              notif.type === 'success' ? 'pi-check-circle text-green-500' : 'pi-info-circle text-blue-500'
            ]"></i>
            
            <div class="flex-1">
              <h4 class="text-sm font-bold text-slate-900 leading-tight">{{ notif.title }}</h4>
              <p class="text-xs text-slate-600 mt-1 leading-snug">{{ notif.message }}</p>
              <div class="text-[10px] text-slate-400 mt-2 font-medium">
                {{ formatTimeSince(notif.createdAt) }}
              </div>
            </div>

            <div v-if="!notif.isRead" class="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary-500"></div>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { useNotifStore } from '~/stores/notif'
import { ref, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
const notifStore = useNotifStore()

function togglePanel() {
  visible.value = !visible.value
}

// Global listen from Topbar
onMounted(() => {
  window.addEventListener('toggle-notif-panel', togglePanel)
})

onUnmounted(() => {
  window.removeEventListener('toggle-notif-panel', togglePanel)
})

function formatTimeSince(isoString: string) {
  const d = new Date(isoString)
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diffDays = Math.round((d.getTime() - new Date().getTime()) / (1000 * 3600 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.round((d.getTime() - new Date().getTime()) / (1000 * 3600))
    if (diffHours === 0) {
      const diffMins = Math.round((d.getTime() - new Date().getTime()) / (1000 * 60))
      return relative.format(diffMins, 'minute')
    }
    return relative.format(diffHours, 'hour')
  }
  return relative.format(diffDays, 'day')
}
</script>
