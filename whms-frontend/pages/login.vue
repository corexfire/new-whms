<template>
  <form @submit.prevent="handleLogin" class="flex flex-col gap-6 w-full">
    <div>
      <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
      <IconField iconPosition="left">
        <InputIcon class="pi pi-envelope text-slate-400" />
        <InputText id="email" v-model="email" type="email" autocomplete="email" class="w-full" placeholder="admin@whms.com" required />
      </IconField>
    </div>

    <div>
      <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Password</label>
      <IconField iconPosition="left">
        <InputIcon class="pi pi-lock text-slate-400" />
        <InputText id="password" v-model="password" type="password" autocomplete="current-password" class="w-full" placeholder="••••••••" required />
      </IconField>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <Checkbox id="remember-me" v-model="rememberMe" :binary="true" />
        <label for="remember-me" class="ml-2 block text-sm text-slate-900">
          Remember me
        </label>
      </div>

      <div class="text-sm">
        <NuxtLink to="/forgot-password" class="font-medium text-primary-600 hover:text-primary-500 transition-colors">
          Forgot your password?
        </NuxtLink>
      </div>
    </div>

    <div>
      <Button type="submit" :loading="loading" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold flex justify-center py-3 border-none transition-all">
        Log in to Dashboard
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'auth'
})

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

async function handleLogin() {
  if (!email.value || !password.value) return
  
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    toast.success('Login berhasil, selamat datang!')
    
    // Redirect to return url or dashboard
    const returnUrl = route.query.returnUrl as string || '/dashboard'
    router.push(returnUrl)
  } catch (error: any) {
    console.error(error)
    toast.error('Gagal login: Periksa email dan password Anda.')
  } finally {
    loading.value = false
  }
}
</script>
