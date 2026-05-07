<template>
  <div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
    <AppOfflineBanner />
    <main class="flex-1 min-h-0 w-full">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>
