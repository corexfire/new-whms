<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <i class="pi pi-spin pi-spinner text-4xl text-primary-600"></i>
  </div>
</template>

<script setup lang="ts">
// Root route simply redirects based on auth status (handled by middleware usually, but good practice here)
const router = useRouter()
onMounted(() => {
  router.push('/dashboard')
})
</script>
