<template>
  <div v-if="!isOnline || pendingCount > 0" class="w-full shrink-0 z-50">
    <div 
      :class="[
        'w-full py-2 px-4 shadow-sm flex items-center justify-center gap-3 transition-colors',
        !isOnline ? 'bg-amber-500 text-amber-950 font-medium' : 'bg-primary-600 text-white shadow-inner font-medium'
      ]">
      
      <template v-if="!isOnline">
        <i class="pi pi-wifi text-lg opacity-70"></i>
        <span class="text-sm">You are currently offline. Tasks will be saved locally.</span>
        <span v-if="pendingCount > 0" class="text-xs bg-amber-600/30 text-amber-950 px-2 py-0.5 rounded-full ring-1 ring-amber-600 ml-2">
          {{ pendingCount }} pending
        </span>
      </template>
      
      <template v-else-if="pendingCount > 0">
        <i :class="['pi text-lg opacity-70', isSyncing ? 'pi-spin pi-sync' : 'pi-cloud-upload']"></i>
        <span class="text-sm">
          {{ isSyncing ? 'Syncing data to server...' : `You have ${pendingCount} unsynced actions.` }}
        </span>
        <Button v-if="!isSyncing" label="Sync Now" size="small" class="ml-4 py-1 px-3 bg-white/20 hover:bg-white/30 border-none text-white text-xs h-auto" @click="triggerSync" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOffline } from '~/composables/useOffline'

const { isOnline, pendingCount, isSyncing, triggerSync } = useOffline()
</script>
