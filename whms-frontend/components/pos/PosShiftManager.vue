<template>
  <UiModal
    v-model="modelValue"
    title="Manajemen Shift Kasir"
    width="40vw"
    :confirmLabel="activeShift ? 'Tutup Shift' : 'Buka Shift'"
    @confirm="toggleShift"
    :loading="loading"
  >
    <div class="space-y-5">
      
      <!-- Current Shift Status -->
      <div :class="['p-4 rounded-xl border-2 text-center', activeShift ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50']">
        <div class="flex items-center justify-center gap-2 mb-2">
          <span :class="['w-3 h-3 rounded-full', activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400']"></span>
          <span :class="['text-sm font-bold', activeShift ? 'text-emerald-700' : 'text-slate-500']">
            {{ activeShift ? 'SHIFT AKTIF' : 'SHIFT BELUM DIBUKA' }}
          </span>
        </div>
        <p v-if="activeShift" class="text-xs text-slate-500">Dimulai: {{ shiftStartTime }} · Kasir: {{ cashierName }}</p>
      </div>

      <!-- Open Shift Form -->
      <div v-if="!activeShift" class="space-y-4">
        <UiCurrencyInput label="Saldo Awal (Kas Pembukaan)" v-model="openingCash" required />
        <UiInput label="Catatan (optional)" v-model="notes" placeholder="Contoh: shift pagi, kas kecil, dsb." />
      </div>

      <!-- Close Shift Summary -->
      <div v-if="activeShift && summary" class="space-y-3">
        <h3 class="text-sm font-bold text-slate-700">Ringkasan Shift</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p class="text-xs text-blue-600 font-medium">Total Transaksi</p>
            <p class="text-lg font-bold text-blue-800">{{ summary.totalTransactions }}</p>
          </div>
          <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <p class="text-xs text-emerald-600 font-medium">Total Penjualan</p>
            <p class="text-lg font-bold text-emerald-800">{{ formatIdr(summary.totalSales) }}</p>
          </div>
          <div class="p-3 rounded-lg bg-violet-50 border border-violet-100">
            <p class="text-xs text-violet-600 font-medium">Tunai Masuk</p>
            <p class="text-lg font-bold text-violet-800">{{ formatIdr(cashIn) }}</p>
          </div>
          <div class="p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p class="text-xs text-amber-600 font-medium">Non-Tunai (QRIS/Transfer)</p>
            <p class="text-lg font-bold text-amber-800">{{ formatIdr(nonCashIn) }}</p>
          </div>
        </div>

        <UiCurrencyInput label="Kas Fisik di Laci (Hitung Manual)" v-model="closingCash" />
        
        <div v-if="closingCash > 0" :class="['p-3 rounded-lg border text-sm', variance === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200']">
          <p :class="variance === 0 ? 'text-emerald-700' : 'text-red-700'">
            <b>Expected Cash:</b> {{ formatIdr(expectedCash) }}
          </p>
          <p :class="variance === 0 ? 'text-emerald-700' : 'text-red-700'">
            <b>Selisih Kas:</b> {{ formatIdr(variance) }}
          </p>
        </div>
      </div>

    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

const toast = useToast()
const { api } = useApi()
const auth = useAuthStore()

const modelValue = defineModel<boolean>({ required: true })

type ApiShift = {
  id: string
  shiftNumber: string
  openingCash: number
  status: string
  openedAt: string
}

type ApiShiftSummary = {
  shiftId: string
  shiftNumber: string
  cashier: string
  openingCash: number
  closingCash?: number | null
  expectedCash: number
  variance?: number | null
  totalSales: number
  totalTransactions: number
  byPayment: Record<string, number>
}

const loading = ref(false)
const activeShift = ref<ApiShift | null>(null)
const summary = ref<ApiShiftSummary | null>(null)

const cashierName = computed(() => auth.user?.name || '-')
const shiftStartTime = computed(() => (activeShift.value?.openedAt ? new Date(activeShift.value.openedAt).toLocaleString('id-ID') : '-'))

const openingCash = ref(0)
const closingCash = ref(0)
const notes = ref('')

const cashIn = computed(() => (summary.value?.byPayment?.CASH || 0))
const nonCashIn = computed(() => {
  const by = summary.value?.byPayment || {}
  return Object.entries(by)
    .filter(([k]) => k !== 'CASH')
    .reduce((s, [, v]) => s + Number(v || 0), 0)
})

const expectedCash = computed(() => (activeShift.value ? activeShift.value.openingCash + cashIn.value : 0))
const variance = computed(() => (closingCash.value || 0) - expectedCash.value)

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchActiveShift() {
  try {
    const res = await api<{ success: true; shift: ApiShift | null }>('/api/shifts/active')
    activeShift.value = (res as any).shift
    if (activeShift.value) {
      const sum = await api(`/api/shifts/${activeShift.value.id}`)
      summary.value = sum as any
    } else {
      summary.value = null
    }
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function toggleShift() {
  loading.value = true
  try {
    if (!activeShift.value) {
      if (!Number.isFinite(Number(openingCash.value)) || Number(openingCash.value) < 0) return toast.error('Saldo awal tidak valid.')
      const res = await api<{ success: true; shift: ApiShift }>('/api/shifts/open', {
        method: 'POST',
        body: { openingCash: Number(openingCash.value), notes: notes.value || undefined }
      })
      activeShift.value = (res as any).shift
      await fetchActiveShift()
      toast.success('Shift berhasil dibuka.')
    } else {
      if (!Number.isFinite(Number(closingCash.value)) || Number(closingCash.value) <= 0) return toast.error('Kas fisik wajib diisi.')
      await api(`/api/shifts/${activeShift.value.id}/close`, {
        method: 'POST',
        body: {
          closingCash: Number(closingCash.value),
          expectedCash: Number(expectedCash.value),
          notes: notes.value || undefined,
        }
      })
      toast.success('Shift berhasil ditutup.')
      closingCash.value = 0
      await fetchActiveShift()
    }
    modelValue.value = false
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
}

watch(
  () => modelValue.value,
  async (open) => {
    if (!open) return
    openingCash.value = activeShift.value?.openingCash || 0
    notes.value = ''
    await fetchActiveShift()
  }
)
</script>
