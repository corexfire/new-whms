<template>
  <div class="p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Shopify Sync</h1>
        <p class="text-slate-600">Jalankan sync pull/push dan pantau job queue.</p>
      </div>
      <div class="flex gap-2">
        <Button size="small" icon="pi pi-refresh" text @click="refresh" />
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="font-semibold text-slate-900">Sync Pull (Shopify → WHMS)</div>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Button size="small" label="Products" :loading="loadingPullProducts" @click="syncPull('PRODUCTS')" />
          <Button size="small" label="Inventory" :loading="loadingPullInventory" @click="syncPull('INVENTORY')" />
          <Button size="small" label="Orders" :loading="loadingPullOrders" @click="syncPull('ORDERS')" />
          <Button size="small" label="Customers" :loading="loadingPullCustomers" @click="syncPull('CUSTOMERS')" />
          <Button size="small" label="Collections" :loading="loadingPullCollections" @click="syncPull('COLLECTIONS')" />
          <Button size="small" label="Discounts" :loading="loadingPullDiscounts" @click="syncPull('DISCOUNTS')" />
          <Button size="small" label="Locations" :loading="loadingPullLocations" @click="syncPull('LOCATIONS')" />
          <Button size="small" label="Gift Cards" :loading="loadingPullGiftCards" @click="syncPull('GIFT_CARDS')" />
          <Button size="small" label="Companies (B2B)" :loading="loadingPullCompanies" @click="syncPull('COMPANIES')" />
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="font-semibold text-slate-900">Sync Push (WHMS → Shopify)</div>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button size="small" label="Products" :loading="loadingPushProducts" @click="syncPush('PRODUCTS')" />
          <Button size="small" label="Inventory" :loading="loadingPushInventory" @click="syncPush('INVENTORY')" />
          <Button size="small" label="Orders" :loading="loadingPushOrders" @click="syncPush('ORDERS')" />
          <Button size="small" label="Collections" :loading="loadingPushCollections" @click="syncPush('COLLECTIONS')" />
          <Button size="small" label="Discounts" :loading="loadingPushDiscounts" @click="syncPush('DISCOUNTS')" />
          <Button size="small" label="Gift Cards" :loading="loadingPushGiftCards" @click="syncPush('GIFT_CARDS')" />
        </div>
      </div>
    </div>

    <UiDataTable
      title="Latest Status per Type"
      :rowData="summaryRows"
      :columnDefs="summaryColumns"
      :exportable="false"
    >
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <UiBadge :value="data.status" />
        </div>
      </template>
    </UiDataTable>

    <UiDataTable
      title="Recent Sync Jobs"
      :rowData="rows"
      :columnDefs="columns"
      :exportable="true"
    >
      <template #actions="{ data }">
        <div class="flex items-center gap-2">
          <UiBadge :value="data.status" />
        </div>
      </template>
    </UiDataTable>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'

const { api } = useApi()
const toast = useToast()

const jobs = ref<any[]>([])
const summary = ref<any>({ latest: {}, counts: {} })

const loadingPullProducts = ref(false)
const loadingPullInventory = ref(false)
const loadingPullOrders = ref(false)
const loadingPullCustomers = ref(false)
const loadingPullCollections = ref(false)
const loadingPullDiscounts = ref(false)
const loadingPullLocations = ref(false)
const loadingPullGiftCards = ref(false)
const loadingPullCompanies = ref(false)
const loadingPushProducts = ref(false)
const loadingPushInventory = ref(false)
const loadingPushOrders = ref(false)
const loadingPushCollections = ref(false)
const loadingPushDiscounts = ref(false)
const loadingPushGiftCards = ref(false)

async function refresh() {
  const [jobsRes, summaryRes] = await Promise.all([
    api<any>('/api/integrations/shopify/sync/jobs', { query: { limit: 50 } }),
    api<any>('/api/integrations/shopify/sync/summary', { query: { limit: 500 } }),
  ])
  jobs.value = jobsRes?.jobs || []
  summary.value = summaryRes || { latest: {}, counts: {} }
}

async function syncPull(
  type:
    | 'PRODUCTS'
    | 'INVENTORY'
    | 'ORDERS'
    | 'CUSTOMERS'
    | 'COLLECTIONS'
    | 'DISCOUNTS'
    | 'LOCATIONS'
    | 'GIFT_CARDS'
    | 'COMPANIES',
) {
  const loading =
    type === 'PRODUCTS'
      ? loadingPullProducts
      : type === 'INVENTORY'
        ? loadingPullInventory
        : type === 'ORDERS'
          ? loadingPullOrders
          : type === 'CUSTOMERS'
            ? loadingPullCustomers
            : type === 'COLLECTIONS'
              ? loadingPullCollections
              : type === 'DISCOUNTS'
                ? loadingPullDiscounts
                : type === 'LOCATIONS'
                  ? loadingPullLocations
                  : type === 'GIFT_CARDS'
                    ? loadingPullGiftCards
                    : loadingPullCompanies
  loading.value = true
  try {
    await api('/api/integrations/shopify/sync/pull', { method: 'POST', body: { type } })
    toast.success(`Pull queued: ${type}`)
    await refresh()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal queue pull sync')
  } finally {
    loading.value = false
  }
}

async function syncPush(type: 'PRODUCTS' | 'INVENTORY' | 'ORDERS' | 'COLLECTIONS' | 'DISCOUNTS' | 'GIFT_CARDS') {
  const loading =
    type === 'PRODUCTS'
      ? loadingPushProducts
      : type === 'INVENTORY'
        ? loadingPushInventory
        : type === 'ORDERS'
          ? loadingPushOrders
          : type === 'COLLECTIONS'
            ? loadingPushCollections
            : type === 'DISCOUNTS'
              ? loadingPushDiscounts
              : loadingPushGiftCards
  loading.value = true
  try {
    await api('/api/integrations/shopify/sync/push', { method: 'POST', body: { type } })
    toast.success(`Push queued: ${type}`)
    await refresh()
  } catch (e: any) {
    toast.error(e?.data?.error || e?.message || 'Gagal queue push sync')
  } finally {
    loading.value = false
  }
}

const rows = computed(() => {
  return jobs.value.map((j) => ({
    id: j.id,
    direction: j.direction,
    type: j.type,
    status: j.status,
    attempts: j.attempts,
    createdAt: j.createdAt,
    lastError: j.lastError || '-',
  }))
})

const summaryRows = computed(() => {
  const latest = summary.value?.latest || {}
  return Object.entries(latest).map(([key, j]: any) => ({
    key,
    direction: j.direction,
    type: j.type,
    status: j.status,
    attempts: j.attempts,
    createdAt: j.createdAt,
    lastError: j.lastError || '-',
  }))
})

const summaryColumns = ref([
  { field: 'direction', headerName: 'Direction', width: 120 },
  { field: 'type', headerName: 'Type', width: 180 },
  { field: 'attempts', headerName: 'Attempts', width: 110 },
  { field: 'createdAt', headerName: 'Last Created', minWidth: 180, flex: 1 },
  { field: 'lastError', headerName: 'Last Error', flex: 2, minWidth: 260 },
  { field: 'actions', headerName: 'Status', slotName: 'actions', width: 140 },
])

const columns = ref([
  { field: 'createdAt', headerName: 'Created', minWidth: 180, flex: 1 },
  { field: 'direction', headerName: 'Direction', width: 120 },
  { field: 'type', headerName: 'Type', width: 160 },
  { field: 'attempts', headerName: 'Attempts', width: 110 },
  { field: 'lastError', headerName: 'Last Error', flex: 2, minWidth: 260 },
  { field: 'actions', headerName: 'Status', slotName: 'actions', width: 140 },
])

onMounted(refresh)
</script>
