<script setup lang="ts">

useHead({
  title: 'WHMS — Warehouse Management System',
  meta: [
    { name: 'description', content: 'Modern Warehouse Management System' }
  ]
})

const isDark = useState<boolean>('isDark', () => false)

function applyTheme(v: boolean) {
  isDark.value = v
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('theme', v ? 'dark' : 'light')
  }
}

if (import.meta.client) {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') applyTheme(true)
  else if (saved === 'light') applyTheme(false)
  else applyTheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* Global CSS is imported in nuxt.config.ts */
</style>
