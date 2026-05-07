<template>
  <div class="app-shell h-screen flex flex-col overflow-hidden bg-white dark:bg-slate-950 dark:text-slate-100 font-sans">
    <AppOfflineBanner />
    <div class="flex-1 flex w-full overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col w-0 overflow-hidden">
      <AppTopBar />
      <main class="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-white dark:bg-slate-950">
        <slot />
      </main>
    </div>
    </div>
    <!-- Off-canvas Notif Panel -->
    <AppNotifPanel />
  </div>
</template>

<script setup lang="ts">
// Default layout wrap components
// Imports handle auto by nuxt via dirs `components/app` prefix `App`
import { useUIStore } from '~/stores/ui'
const uiStore = useUIStore()

</script>
