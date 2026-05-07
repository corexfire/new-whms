<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Integrasi Shopify</h1>
        <p class="text-slate-600">Kelola koneksi OAuth dan status koneksi toko Shopify.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="connected" severity="danger" size="small" label="Disconnect" @click="disconnect" />
        <Button v-if="connected" size="small" label="Ensure Webhooks" @click="ensureWebhooks" />
        <Button size="small" icon="pi pi-refresh" text @click="loadStatus" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="flex items-center justify-between">
          <div class="font-semibold text-slate-900">Status Koneksi</div>
          <div>
            <UiBadge :value="connected ? 'SUCCESS' : 'FAILED'" />
          </div>
        </div>

        <div class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <div class="text-slate-500">Shop</div>
            <div class="font-medium text-slate-900 truncate max-w-[60%]">{{ store?.shop || '-' }}</div>
          </div>
          <div class="flex justify-between gap-4">
            <div class="text-slate-500">Scope</div>
            <div class="font-medium text-slate-900 truncate max-w-[60%]">{{ store?.scope || '-' }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="font-semibold text-slate-900">Connect Shopify</div>
        <p class="text-sm text-slate-600 mt-1">Masukkan domain toko. Contoh: my-store.myshopify.com</p>

        <div class="mt-4 flex gap-2">
          <InputText v-model="shop" class="w-full" placeholder="my-store.myshopify.com" />
          <Button :disabled="connecting" :loading="connecting" label="Connect" @click="startOAuth" />
        </div>

        <div v-if="callbackInfo" class="mt-4 rounded-lg border p-3 text-sm"
          :class="callbackInfo.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'">
          <div class="font-semibold">
            {{ callbackInfo.connected ? 'Koneksi berhasil' : 'Koneksi gagal' }}
          </div>
          <div v-if="callbackInfo.message" class="mt-1">{{ callbackInfo.message }}</div>
        </div>

        <div class="mt-6 pt-5 border-t border-slate-200">
          <div class="font-semibold text-slate-900">Alternatif: Custom App Token</div>
          <p class="text-sm text-slate-600 mt-1">Gunakan ini jika Public App kamu belum lolos review Shopify. Input Admin API access token dari Custom App.</p>

          <div class="mt-4 space-y-2">
            <InputText v-model="manual.shop" class="w-full" placeholder="my-store.myshopify.com" />
            <InputText v-model="manual.accessToken" class="w-full" type="password" placeholder="Admin API access token (shpat_...)" />
            <Button :disabled="manualConnecting" :loading="manualConnecting" label="Connect via Token" class="w-full" @click="connectManual" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const { api } = useApi()
const toast = useToast()
const route = useRoute()

type StoreInfo = {
  id: string
  shop: string
  scope?: string | null
  settings?: Record<string, any>
}

const store = ref<StoreInfo | null>(null)
const connecting = ref(false)
const shop = ref('')
const manualConnecting = ref(false)
const manual = ref({ shop: '', accessToken: '' })

const connected = computed(() => !!store.value?.id)

const callbackInfo = computed(() => {
  const q = route.query as any
  if (q.connected === undefined) return null
  const ok = String(q.connected) === '1'
  return {
    connected: ok,
    message: ok ? (q.shop ? `Shop: ${q.shop}` : '') : (q.error ? String(q.error) : 'OAuth failed'),
  }
})

async function loadStatus() {
  const res = await api<any>('/api/integrations/shopify/connection')
  store.value = res?.store || null
}

async function startOAuth() {
  if (!shop.value.trim()) {
    toast.error('Shop domain wajib diisi.')
    return
  }
  connecting.value = true
  try {
    const res = await api<any>('/api/integrations/shopify/oauth/start', { query: { shop: shop.value.trim() } })
    const url = res?.url
    if (!url) throw new Error('Missing OAuth URL')
    window.location.href = url
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memulai OAuth')
  } finally {
    connecting.value = false
  }
}

async function connectManual() {
  if (!manual.value.shop.trim()) {
    toast.error('Shop domain wajib diisi.')
    return
  }
  if (!manual.value.accessToken.trim()) {
    toast.error('Access token wajib diisi.')
    return
  }

  manualConnecting.value = true
  try {
    await api('/api/integrations/shopify/connection/manual', {
      method: 'POST',
      body: { shop: manual.value.shop.trim(), accessToken: manual.value.accessToken.trim() },
    })
    toast.success('Connected via token.')
    manual.value = { shop: '', accessToken: '' }
    await loadStatus()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal connect via token')
  } finally {
    manualConnecting.value = false
  }
}

async function disconnect() {
  const ok = window.confirm('Disconnect Shopify store?')
  if (!ok) return
  try {
    await api('/api/integrations/shopify/connection/disconnect', { method: 'POST' })
    toast.success('Disconnected.')
    await loadStatus()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal disconnect')
  }
}

async function ensureWebhooks() {
  try {
    const res = await api<any>('/api/integrations/shopify/webhooks/ensure', { method: 'POST' })
    toast.success(`Webhooks updated: ${(res?.results || []).length}`)
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal ensure webhooks')
  }
}

onMounted(loadStatus)
</script>
