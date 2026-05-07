<template>
  <form @submit.prevent="handleForgotPassword" class="flex flex-col gap-6 w-full">
    <div class="mb-4 text-center">
      <p class="text-sm text-slate-600">
        Masukkan email yang terdaftar. Kami akan mengirimkan instruksi untuk mengatur ulang kata sandi Anda.
      </p>
    </div>

    <div>
      <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
      <IconField iconPosition="left">
        <InputIcon class="pi pi-envelope text-slate-400" />
        <InputText id="email" v-model="email" type="email" autocomplete="email" class="w-full" placeholder="admin@whms.com" required />
      </IconField>
    </div>

    <div>
      <Button type="submit" :loading="loading" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold flex justify-center py-3 border-none transition-all">
        Kirim Instruksi
      </Button>
    </div>
    
    <div class="text-center text-sm">
      <NuxtLink to="/login" class="font-medium text-slate-600 hover:text-slate-900 transition-colors">
        <i class="pi pi-arrow-left mr-1 text-xs"></i> Kembali ke Login
      </NuxtLink>
    </div>
  </form>
</template>

<script setup lang="ts">
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'auth'
})

const email = ref('')
const loading = ref(false)
const toast = useToast()
const config = useRuntimeConfig()

async function handleForgotPassword() {
  if (!email.value) return
  
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      baseURL: config.public.apiBase as string,
      method: 'POST',
      body: { email: email.value }
    })
    
    toast.success('Instruksi pemulihan telah dikirim ke email Anda.')
    email.value = ''
  } catch (error: any) {
    console.error(error)
    toast.error(error.data?.message || 'Gagal mengirim instruksi pemulihan.')
  } finally {
    loading.value = false
  }
}
</script>
