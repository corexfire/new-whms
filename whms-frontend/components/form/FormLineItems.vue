<template>
  <!-- Reusable editable line-items table for PO/GRN/SO -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-slate-700">
        {{ title || 'Line Items' }}
      </h3>
      <Button v-if="!readonly" icon="pi pi-plus" label="Tambah Baris" text size="small" @click="addLine" />
    </div>

    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="w-full text-sm border-collapse">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-8">#</th>
            <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 min-w-[220px]">Nama Barang</th>
            <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Satuan</th>
            <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">Qty</th>
            <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Harga Satuan</th>
            <th v-if="showReceived" class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-32">Diterima</th>
            <th class="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-40">Subtotal</th>
            <th v-if="!readonly" class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 w-14"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="(line, idx) in modelValue" :key="idx" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-3 py-2 text-slate-400 text-xs">{{ idx + 1 }}</td>
            
            <!-- Item Name -->
            <td class="px-3 py-2">
              <div v-if="readonly" class="font-medium text-slate-800">{{ line.item_name }}</div>
              <InputText v-else v-model="line.item_name" size="small" class="w-full" placeholder="Cari atau ketik nama barang..." @focus="openItemSearch(idx)" />
            </td>

            <!-- Unit -->
            <td class="px-3 py-2">
              <div v-if="readonly" class="text-slate-600">{{ line.unit }}</div>
              <Select v-else v-model="line.unit" :options="line.available_units || ['PCS', 'DUS', 'BAL', 'KG']" size="small" class="w-full" />
            </td>

            <!-- Qty -->
            <td class="px-3 py-2 text-right">
              <div v-if="readonly" class="font-medium">{{ line.qty }}</div>
              <InputNumber v-else v-model="line.qty" :min="1" size="small" class="w-full text-right" @update:modelValue="recalcLine(idx)" />
            </td>

            <!-- Unit Price -->
            <td class="px-3 py-2 text-right">
              <div v-if="readonly" class="text-slate-700">{{ formatIdr(line.unit_price) }}</div>
              <InputNumber v-else v-model="line.unit_price" :min="0" size="small" class="w-full text-right" @update:modelValue="recalcLine(idx)" />
            </td>

            <!-- Received Qty (GRN only) -->
            <td v-if="showReceived" class="px-3 py-2 text-right">
              <InputNumber v-if="!readonly" v-model="line.received_qty" :min="0" :max="line.qty" size="small" class="w-full text-right" />
              <span v-else :class="['font-bold', line.received_qty >= line.qty ? 'text-emerald-600' : 'text-amber-600']">
                {{ line.received_qty }} / {{ line.qty }}
              </span>
            </td>

            <!-- Subtotal -->
            <td class="px-3 py-2 text-right">
              <span class="font-semibold text-slate-800">{{ formatIdr(line.qty * line.unit_price) }}</span>
            </td>

            <!-- Delete -->
            <td v-if="!readonly" class="px-3 py-2 text-center">
              <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeLine(idx)" :disabled="modelValue.length === 1" />
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="modelValue.length === 0">
            <td colspan="8" class="py-8 text-center text-slate-400 text-sm">
              <i class="pi pi-inbox text-2xl block mb-2 opacity-40"></i>
              Belum ada item. Klik "Tambah Baris" untuk memulai.
            </td>
          </tr>
        </tbody>
        
        <!-- Footer totals -->
        <tfoot v-if="modelValue.length > 0" class="bg-slate-50 border-t-2 border-slate-200">
          <tr>
            <td :colspan="showReceived ? 6 : 5" class="px-3 py-3 text-right text-sm font-bold text-slate-700">TOTAL:</td>
            <td class="px-3 py-3 text-right text-base font-bold text-primary-700">{{ formatIdr(grandTotal) }}</td>
            <td v-if="!readonly"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Tax & Discount section -->
    <div v-if="!readonly && showTax" class="flex justify-end gap-6 px-2 pt-2">
      <div class="flex items-center gap-2 text-sm text-slate-600">
        <span>Diskon Keseluruhan (%):</span>
        <InputNumber v-model="discountPct" :min="0" :max="100" suffix="%" size="small" class="w-24" />
      </div>
      <div class="flex items-center gap-2 text-sm text-slate-600">
        <span>PPN (%):</span>
        <InputNumber v-model="taxPct" :min="0" :max="100" suffix="%" size="small" class="w-20" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface LineItem {
  item_id?: string
  item_name: string
  unit: string
  qty: number
  unit_price: number
  received_qty?: number
  available_units?: string[]
}

const props = defineProps<{
  modelValue: LineItem[]
  readonly?: boolean
  showReceived?: boolean
  showTax?: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: LineItem[]): void
}>()

const discountPct = ref(0)
const taxPct = ref(11) // Default PPN Indonesia 11%

const grandTotal = computed(() => {
  return props.modelValue.reduce((sum, line) => sum + (line.qty * line.unit_price), 0)
})

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function addLine() {
  const lines = [...props.modelValue]
  lines.push({ item_name: '', unit: 'PCS', qty: 1, unit_price: 0, received_qty: 0 })
  emit('update:modelValue', lines)
}

function removeLine(idx: number) {
  const lines = [...props.modelValue]
  lines.splice(idx, 1)
  emit('update:modelValue', lines)
}

function recalcLine(_idx: number) {
  // Trigger reactivity for parent
  emit('update:modelValue', [...props.modelValue])
}

function openItemSearch(_lineIdx: number) {
  // In real implementation, open item search popup
  // and populate item_id, item_name, available_units, unit_price
}
</script>
