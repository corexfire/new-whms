<template>
  <UiModal v-model="modelValue" title="Pembayaran" width="50vw" :showFooter="false">
    <div class="space-y-5">
      
      <!-- Total Display -->
      <div class="bg-primary-50 border border-primary-200 p-5 rounded-xl text-center">
        <p class="text-xs text-primary-600 font-medium uppercase tracking-wider">Total Pembayaran</p>
        <p class="text-4xl font-black text-primary-800 mt-1">{{ formatIdr(total) }}</p>
      </div>

      <!-- Payment Method Tabs -->
      <div class="flex gap-2">
        <button v-for="method in methods" :key="method.id" @click="activeMethod = method.id"
          :class="[
            'flex-1 p-3 rounded-xl border-2 transition-all text-center',
            activeMethod === method.id
              ? 'border-primary-500 bg-primary-50 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          ]"
        >
          <i :class="[method.icon, 'text-lg block mb-1', activeMethod === method.id ? 'text-primary-600' : 'text-slate-400']"></i>
          <p :class="['text-xs font-semibold', activeMethod === method.id ? 'text-primary-700' : 'text-slate-500']">{{ method.label }}</p>
        </button>
      </div>

      <!-- Cash Payment -->
      <div v-if="activeMethod === 'CASH'" class="space-y-4">
        <UiCurrencyInput label="Uang Diterima" v-model="cashReceived" />
        
        <!-- Quick cash buttons -->
        <div class="flex gap-2 flex-wrap">
          <button v-for="amt in quickAmounts" :key="amt" @click="cashReceived = amt"
            class="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-primary-50 hover:border-primary-300 transition-all">
            {{ formatIdr(amt) }}
          </button>
          <button @click="cashReceived = total"
            class="px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
            Uang Pas
          </button>
        </div>
        
        <div v-if="cashReceived >= total" class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
          <p class="text-xs text-emerald-600 font-medium">Kembalian</p>
          <p class="text-3xl font-black text-emerald-700 mt-1">{{ formatIdr(cashReceived - total) }}</p>
        </div>
      </div>

      <!-- QRIS -->
      <div v-if="activeMethod === 'QRIS'" class="text-center space-y-3">
        <div class="bg-white border-2 border-slate-200 rounded-xl p-6 inline-block mx-auto">
          <div class="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center">
            <div class="text-center">
              <i class="pi pi-qrcode text-6xl text-slate-300 block mb-2"></i>
              <p class="text-xs text-slate-400">QR Code QRIS</p>
              <p class="text-[10px] text-slate-400">akan di-generate dari backend</p>
            </div>
          </div>
        </div>
        <p class="text-xs text-slate-500">Arahkan aplikasi e-wallet customer ke QR Code di atas</p>
        <div class="text-left space-y-3">
          <UiInput label="Transaction ID / Ref" v-model="paymentReference" placeholder="Contoh: QRIS-12345 / MIDTRX..." required />
          <UiInput label="Provider (optional)" v-model="paymentProvider" placeholder="Contoh: BCA / Mandiri / OVO / GoPay" />
          <UiInput label="Catatan (optional)" v-model="paymentNotes" placeholder="Keterangan tambahan..." />
        </div>
        <Button label="Sudah Bayar (Verifikasi Manual)" icon="pi pi-check" severity="success" class="w-full" @click="processPayment" />
      </div>

      <!-- Cash Submit -->
      <div v-if="activeMethod === 'CASH'">
        <Button label="Proses Pembayaran Tunai" icon="pi pi-money-bill" class="w-full" severity="success" @click="processPayment" :disabled="cashReceived < total" />
      </div>

      <div v-else class="space-y-2">
        <div class="p-3 rounded-xl border bg-slate-50 border-slate-200 text-xs text-slate-600">
          Pastikan pembayaran non-tunai sudah diterima sebelum menekan tombol konfirmasi.
        </div>
        <div v-if="activeMethod !== 'QRIS'" class="space-y-3">
          <UiInput label="Transaction ID / Ref" v-model="paymentReference" placeholder="Contoh: EDC-12345 / Approval Code..." required />
          <UiInput label="Provider (optional)" v-model="paymentProvider" placeholder="Contoh: BCA / BNI / VISA / MasterCard / OVO / GoPay" />
          <UiInput label="Catatan (optional)" v-model="paymentNotes" placeholder="Keterangan tambahan..." />
        </div>
        <Button label="Konfirmasi Pembayaran" icon="pi pi-check" class="w-full" @click="processPayment" />
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const modelValue = defineModel<boolean>({ required: true })
const props = defineProps<{ total: number }>()
const emit = defineEmits<{ (e: 'paid', payload: { method: string; amountPaid: number; paymentReference?: string; paymentProvider?: string; notes?: string }): void }>()

const activeMethod = ref<'CASH' | 'QRIS' | 'DEBIT' | 'CREDIT' | 'EWALLET'>('CASH')
const cashReceived = ref(0)
const paymentReference = ref('')
const paymentProvider = ref('')
const paymentNotes = ref('')

const methods = ref<Array<{ id: typeof activeMethod.value; label: string; icon: string }>>([
  { id: 'CASH', label: 'Tunai', icon: 'pi pi-money-bill' },
  { id: 'QRIS', label: 'QRIS', icon: 'pi pi-qrcode' },
  { id: 'DEBIT', label: 'Debit', icon: 'pi pi-credit-card' },
  { id: 'CREDIT', label: 'Kredit', icon: 'pi pi-credit-card' },
  { id: 'EWALLET', label: 'E-Wallet', icon: 'pi pi-wallet' },
])

const quickAmounts = computed(() => {
  const t = props.total
  const amounts = [50000, 100000, 200000, 500000]
  // Add rounded-up amounts
  const roundedUp = Math.ceil(t / 50000) * 50000
  if (!amounts.includes(roundedUp) && roundedUp > t) amounts.push(roundedUp)
  return amounts.filter(a => a >= t * 0.5).sort((a, b) => a - b).slice(0, 5)
})

function processPayment() {
  const method = activeMethod.value
  const amountPaid = method === 'CASH' ? cashReceived.value : props.total
  const ref = paymentReference.value.trim()

  if (method !== 'CASH' && !ref) {
    toast.error('Transaction ID / Reference wajib diisi untuk pembayaran non-tunai.')
    return
  }

  toast.success(`Pembayaran ${method} berhasil!`)
  emit('paid', {
    method,
    amountPaid,
    paymentReference: method === 'CASH' ? undefined : ref,
    paymentProvider: method === 'CASH' ? undefined : (paymentProvider.value.trim() || undefined),
    notes: paymentNotes.value.trim() || undefined,
  })
  modelValue.value = false

  // Reset
  cashReceived.value = 0
  paymentReference.value = ''
  paymentProvider.value = ''
  paymentNotes.value = ''
}

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
}
</script>
