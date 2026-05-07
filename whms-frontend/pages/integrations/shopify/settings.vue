<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Shopify Settings</h1>
        <p class="text-slate-600">Konfigurasi perilaku sync dan mapping lokasi stok.</p>
      </div>
      <div class="flex gap-2">
        <Button size="small" label="Save" :loading="saving" @click="save" />
        <Button size="small" icon="pi pi-refresh" text @click="load" />
      </div>
    </div>

    <div v-if="!connected" class="rounded-xl border border-slate-200 bg-white p-5">
      <div class="font-semibold text-slate-900">Shopify belum terkoneksi</div>
      <p class="text-sm text-slate-600 mt-1">Silakan connect Shopify dulu di menu Connection.</p>
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div class="font-semibold text-slate-900">General</div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Default Warehouse untuk stok Shopify</label>
          <Dropdown
            v-model="form.defaultWarehouseId"
            :options="warehouseOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Pilih warehouse"
            class="w-full"
          />
          <p class="text-xs text-slate-500">Warehouse ini dipakai saat push/pull inventory (jika tidak ada mapping spesifik).</p>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-slate-700">Auto-create Items dari Shopify</div>
            <div class="text-xs text-slate-500">Jika SKU belum ada di WHMS, buat item otomatis saat pull.</div>
          </div>
          <InputSwitch v-model="form.autoCreateItemsFromShopify" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-slate-700">Auto-create Orders dari Shopify</div>
            <div class="text-xs text-slate-500">Aktifkan jika order Shopify ingin dibuat sebagai Sales Order di WHMS.</div>
          </div>
          <InputSwitch v-model="form.autoCreateOrdersFromShopify" />
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div class="font-semibold text-slate-900">Location Mapping</div>
        <p class="text-sm text-slate-600">Mapping Warehouse WHMS ↔ Shopify Location untuk stok.</p>

        <div class="space-y-3">
          <div v-for="w in warehouses" :key="w.id" class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <div class="text-sm font-medium text-slate-900 truncate">{{ w.name }}</div>
            <Dropdown
              v-model="locationMappingByWarehouse[w.id]"
              :options="shopifyLocationOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Pilih Shopify location"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const { api } = useApi()
const toast = useToast()

const saving = ref(false)
const store = ref<any>(null)
const warehouses = ref<any[]>([])
const locationMappings = ref<any[]>([])
const shopifyLocations = ref<any[]>([])

const form = ref({
  defaultWarehouseId: null as string | null,
  autoCreateItemsFromShopify: true,
  autoCreateOrdersFromShopify: true,
})

const locationMappingByWarehouse = ref<Record<string, string | null>>({})

const connected = computed(() => !!store.value?.id)

const warehouseOptions = computed(() => {
  return warehouses.value.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))
})

const shopifyLocationOptions = computed(() => {
  return shopifyLocations.value.map((l) => ({ label: `${l.name} (${l.id})`, value: String(l.id) }))
})

async function load() {
  try {
    const res = await api<any>('/api/integrations/shopify/settings')
    store.value = res?.store || null
    warehouses.value = res?.warehouses || []
    locationMappings.value = res?.locationMappings || []
    shopifyLocations.value = res?.shopifyLocations || []

    const settings = store.value?.settings || {}
    form.value.defaultWarehouseId = settings.defaultWarehouseId || null
    form.value.autoCreateItemsFromShopify = settings.autoCreateItemsFromShopify !== false
    form.value.autoCreateOrdersFromShopify = settings.autoCreateOrdersFromShopify !== false

    const map: Record<string, string | null> = {}
    for (const w of warehouses.value) map[w.id] = null
    for (const m of locationMappings.value) {
      map[m.warehouseId] = String(m.shopifyLocationId)
    }
    locationMappingByWarehouse.value = map
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal memuat settings')
    store.value = null
  }
}

async function save() {
  if (!connected.value) return
  if (!form.value.defaultWarehouseId) {
    toast.error('Default warehouse wajib dipilih.')
    return
  }

  saving.value = true
  try {
    const mappings = Object.entries(locationMappingByWarehouse.value)
      .filter(([, shopifyLocationId]) => !!shopifyLocationId)
      .map(([warehouseId, shopifyLocationId]) => ({ warehouseId, shopifyLocationId }))

    await api('/api/integrations/shopify/settings', {
      method: 'PUT',
      body: {
        defaultWarehouseId: form.value.defaultWarehouseId,
        autoCreateItemsFromShopify: form.value.autoCreateItemsFromShopify,
        autoCreateOrdersFromShopify: form.value.autoCreateOrdersFromShopify,
        locationMappings: mappings,
      },
    })
    toast.success('Settings saved.')
    await load()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal menyimpan settings')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

