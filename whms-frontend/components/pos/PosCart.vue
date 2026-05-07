<template>
  <div class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <!-- Cart Header -->
    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
      <h2 class="text-sm font-bold text-slate-700">
        <i class="pi pi-shopping-cart mr-1.5"></i> Keranjang
        <span v-if="items.length" class="text-xs text-slate-400 ml-1">({{ items.length }} item)</span>
      </h2>
      <button v-if="items.length" @click="$emit('clearCart')" class="text-xs text-red-500 hover:text-red-700 font-semibold">
        <i class="pi pi-trash text-[10px] mr-1"></i>Kosongkan
      </button>
    </div>

    <!-- Cart Items -->
    <div class="flex-1 overflow-y-auto divide-y divide-slate-100">
      <div v-if="items.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400 py-12">
        <i class="pi pi-shopping-cart text-4xl mb-3 opacity-30"></i>
        <p class="text-sm">Keranjang kosong</p>
        <p class="text-xs mt-1">Klik produk untuk menambahkan</p>
      </div>

      <div v-for="(item, idx) in items" :key="idx" class="px-4 py-3 hover:bg-slate-50/50 transition-colors">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">{{ item.name }}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">@ {{ formatIdr(item.price) }} / {{ item.unit }}</p>
          </div>
          <button @click="$emit('removeItem', idx)" class="text-slate-400 hover:text-red-500 transition-colors shrink-0 p-1">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>
        
        <div class="flex items-center justify-between mt-2">
          <!-- Qty stepper -->
          <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button @click="$emit('updateQty', idx, -1)" class="px-2.5 py-1 text-slate-500 hover:bg-slate-100 transition-colors text-sm font-bold">−</button>
            <span class="px-3 py-1 text-sm font-bold text-slate-800 bg-slate-50 min-w-[2.5rem] text-center">{{ item.qty }}</span>
            <button @click="$emit('updateQty', idx, 1)" class="px-2.5 py-1 text-slate-500 hover:bg-slate-100 transition-colors text-sm font-bold">+</button>
          </div>
          <span class="text-sm font-bold text-slate-800">{{ formatIdr(item.price * item.qty) }}</span>
        </div>
      </div>
    </div>

    <!-- Cart Footer / Totals -->
    <div class="shrink-0 border-t-2 border-slate-200 bg-slate-50">
      <div class="px-4 py-3 space-y-1.5">
        <div class="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span class="font-semibold">{{ formatIdr(subtotal) }}</span>
        </div>
        <div v-if="discount > 0" class="flex justify-between text-sm text-emerald-600">
          <span>Diskon</span>
          <span class="font-semibold">- {{ formatIdr(discount) }}</span>
        </div>
        <div class="flex justify-between text-sm text-slate-600">
          <span>PPN (11%)</span>
          <span class="font-semibold">{{ formatIdr(tax) }}</span>
        </div>
        <div class="border-t border-slate-200 pt-2 flex justify-between text-lg font-bold text-slate-900">
          <span>TOTAL</span>
          <span class="text-primary-700">{{ formatIdr(grandTotal) }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="px-4 pb-4 flex gap-2">
        <button @click="$emit('openPayment')" :disabled="items.length === 0"
          :class="[
            'flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
            items.length > 0
              ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          ]">
          <i class="pi pi-credit-card"></i> Bayar
        </button>
        <button @click="$emit('holdOrder')" :disabled="items.length === 0"
          :class="[
            'px-4 py-3 rounded-xl text-sm font-semibold transition-all border',
            items.length > 0
              ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
              : 'border-slate-200 text-slate-400 cursor-not-allowed'
          ]">
          <i class="pi pi-pause"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  qty: number
  unit: string
}

const props = defineProps<{
  items: CartItem[]
  discount?: number
}>()

defineEmits<{
  (e: 'removeItem', idx: number): void
  (e: 'updateQty', idx: number, delta: number): void
  (e: 'clearCart'): void
  (e: 'openPayment'): void
  (e: 'holdOrder'): void
}>()

const subtotal = computed(() => props.items.reduce((s, i) => s + i.price * i.qty, 0))
const discount = computed(() => props.discount || 0)
const tax = computed(() => (subtotal.value - discount.value) * 0.11)
const grandTotal = computed(() => subtotal.value - discount.value + tax.value)

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
}
</script>
