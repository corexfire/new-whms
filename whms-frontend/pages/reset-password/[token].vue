<template>
  <form @submit.prevent="handleResetPassword" class="flex flex-col gap-6 w-full">
    <div class="mb-4 text-center">
      <p class="text-sm text-slate-600">
        Silakan masukkan kata sandi baru Anda.
      </p>
    </div>

    <div>
      <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Kata Sandi Baru</label>
      <IconField iconPosition="left">
        <InputIcon class="pi pi-lock text-slate-400" />
        <InputText id="password" v-model="password" type="password" class="w-full" required />
      </IconField>
    </div>

    <div>
      <label for="confirm-password" class="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Kata Sandi</label>
      <IconField iconPosition="left">
        <InputIcon class="pi pi-lock text-slate-400" />
        <InputText id="confirm-password" v-model="confirmPassword" type="password" class="w-full" required />
      </IconField>
      <small v-if="password && confirmPassword && password !== confirmPassword" class="text-red-500 mt-1 block">Kata sandi tidak cocok</small>
    </div>

    <div>
      <Button type="submit" :loading="loading" :disabled="password !== confirmPassword" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold flex justify-center py-3 border-none transition-all">
        Ganti Kata Sandi
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'auth'
})

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const toast = useToast()
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

async function handleResetPassword() {
  if (!password.value || password.value !== confirmPassword.value) return
  
  loading.value = true
  try {
    const token = route.params.token
    await $fetch('/api/auth/reset-password', {
      baseURL: config.public.apiBase as string,
      method: 'POST',
      body: { 
        token, 
        password: password.value 
      }
    })
    
    toast.success('Kata sandi berhasil diubah. Silakan login kembali.')
    router.push('/login')
  } catch (error: any) {
    console.error(error)
    toast.error(error.data?.message || 'Gagal mengubah kata sandi.')
  } finally {
    loading.value = false
  }
}
</script>
