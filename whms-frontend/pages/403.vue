<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
    <div class="text-center max-w-md">
      <!-- Shield Icon with pulse animation -->
      <div class="relative inline-block mb-8">
        <div class="w-28 h-28 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse-slow">
          <div class="w-20 h-20 bg-red-200 rounded-full flex items-center justify-center">
            <i class="pi pi-lock text-4xl text-red-500"></i>
          </div>
        </div>
        <div class="absolute -top-1 -right-1 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
          <i class="pi pi-times text-white text-xs font-bold"></i>
        </div>
      </div>

      <!-- Text -->
      <h1 class="text-3xl font-bold text-slate-800 mb-3">Akses Ditolak</h1>
      <p class="text-slate-500 mb-2">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      <p class="text-xs text-slate-400 mb-8">
        Hubungi administrator jika Anda merasa ini adalah kesalahan.
      </p>

      <!-- User role info -->
      <div v-if="currentRole" class="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-sm text-slate-600">
        <i class="pi pi-user text-xs"></i>
        Role Anda: <span class="font-semibold text-slate-800">{{ currentRole }}</span>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          @click="goBack"
          class="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:shadow-sm transition-all"
        >
          <i class="pi pi-arrow-left mr-2"></i>
          Kembali
        </button>
        <NuxtLink
          to="/dashboard"
          class="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 hover:shadow-md transition-all"
        >
          <i class="pi pi-home mr-2"></i>
          Ke Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'auth'
})

useHead({ title: '403 — Akses Ditolak' })

const auth = useAuthStore()
const router = useRouter()

const currentRole = computed(() => auth.user?.role || '')

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/dashboard')
  }
}
</script>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}
.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}
</style>
