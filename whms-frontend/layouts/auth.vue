<template>
  <div class="app-shell min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-100 relative flex flex-col justify-center overflow-hidden py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center z-10 relative">
      <i class="pi pi-box text-primary-600 text-5xl mb-4"></i>
      <h2 class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">WHMS Dashboard</h2>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Sistem Manajemen Gudang & Logistik</p>
    </div>

    <div class="relative sm:mx-auto sm:w-full sm:max-w-md z-10 w-full px-4 sm:px-0">
      <div class="bg-white dark:bg-slate-900 py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-slate-200/60 dark:border-slate-800 ring-1 ring-slate-900/5 dark:ring-slate-800/40">
        <slot />
      </div>
    </div>
    
    <!-- Background Decals -->
    <div class="absolute -top-[20rem] -left-[20rem] w-[50rem] h-[50rem] rounded-full bg-primary-100/50 blur-3xl opacity-50 pointer-events-none"></div>
    <div class="absolute -bottom-[20rem] -right-[20rem] w-[50rem] h-[50rem] rounded-full bg-primary-200/30 blur-3xl opacity-50 pointer-events-none"></div>
  </div>
</template>

<script setup lang="ts">
// Simple minimal layout for auth logic
</script>

<style scoped>
/* Scoped auth styles if needed */
</style>
