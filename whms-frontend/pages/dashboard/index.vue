<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dashboard WHMS</h1>
        <p class="text-sm text-slate-500">Ringkasan Operasional Gudang — {{ today }}</p>
      </div>
      <div class="flex gap-2 items-center">
        <Select v-model="selectedWarehouse" :options="['Semua Gudang', 'Gudang Pusat Cikarang', 'Hub Surabaya Transit']" size="small" class="w-52" />
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div v-for="kpi in kpis" :key="kpi.label" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-2 mb-2">
          <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', kpi.bgColor]">
            <i :class="[kpi.icon, kpi.iconColor, 'text-sm']"></i>
          </div>
        </div>
        <p class="text-xl font-bold text-slate-900">{{ kpi.value }}</p>
        <p class="text-[11px] text-slate-500 mt-0.5 leading-tight">{{ kpi.label }}</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Inbound vs Outbound Chart -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">Pergerakan Stok (7 Hari Terakhir)</h3>
        <div class="h-56 flex items-end gap-2 px-2">
          <div v-for="day in chartData" :key="day.label" class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full flex flex-col items-center gap-1 flex-1 justify-end">
              <div class="w-full bg-emerald-400 rounded-t transition-all hover:bg-emerald-500" :style="{ height: (day.inbound / maxChart * 100) + '%', minHeight: '4px' }"
                v-tooltip.top="`+${day.inbound} Inbound`"
              ></div>
              <div class="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500" :style="{ height: (day.outbound / maxChart * 100) + '%', minHeight: '4px' }"
                v-tooltip.top="`-${day.outbound} Outbound`"
              ></div>
            </div>
            <span class="text-[10px] text-slate-400 font-medium">{{ day.label }}</span>
          </div>
        </div>
        <div class="flex gap-4 mt-3 justify-center text-xs text-slate-500">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-400"></span> Inbound</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-400"></span> Outbound</span>
        </div>
      </div>

      <!-- Top Items -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">Top 5 Item Paling Laris (Bulan Ini)</h3>
        <div class="space-y-3">
          <div v-for="(item, idx) in topItems" :key="item.name" class="flex items-center gap-3">
            <span class="text-xs font-bold text-slate-400 w-5 text-right">#{{ idx + 1 }}</span>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <p class="text-sm font-semibold text-slate-800 truncate">{{ item.name }}</p>
                <span class="text-xs font-bold text-primary-700">{{ item.qty }} {{ item.unit }}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-primary-500 h-2 rounded-full transition-all" :style="{ width: (item.qty / topItems[0].qty * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Low Stock Alerts -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-slate-700">⚠️ Peringatan Stok Rendah</h3>
          <NuxtLink to="/inventory/summary" class="text-xs text-primary-600 font-semibold hover:underline">Lihat Semua</NuxtLink>
        </div>
        <div class="space-y-2">
          <div v-for="alert in lowStockAlerts" :key="alert.sku" class="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div>
              <p class="text-sm font-semibold text-slate-800">{{ alert.name }}</p>
              <p class="text-[10px] text-slate-500">SKU: {{ alert.sku }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold text-red-600">{{ alert.qty }} {{ alert.unit }}</p>
              <p class="text-[10px] text-red-500">Min: {{ alert.min }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Actions -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">📋 Tindakan Tertunda</h3>
        <div class="space-y-2">
          <div v-for="action in pendingActions" :key="action.label" class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-primary-50 cursor-pointer transition-colors">
            <div class="flex items-center gap-2">
              <div :class="['w-8 h-8 rounded-lg flex items-center justify-center text-white', action.color]">
                <i :class="[action.icon, 'text-sm']"></i>
              </div>
              <p class="text-sm font-medium text-slate-700">{{ action.label }}</p>
            </div>
            <span class="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">{{ action.count }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">🕐 Aktivitas Terbaru</h3>
        <div class="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
          <div v-for="log in recentActivity" :key="log.time" class="flex gap-3 pl-6 relative">
            <div :class="['absolute left-0 top-1 w-4 h-4 rounded-full border-2 z-10', log.dotColor]"></div>
            <div>
              <p class="text-xs font-semibold text-slate-700">{{ log.action }}</p>
              <p class="text-[10px] text-slate-400">{{ log.by }} · {{ log.time }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({})

import { ref, computed } from 'vue'

const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const selectedWarehouse = ref('Semua Gudang')

const kpis = ref([
  { label: 'Total SKU Aktif', value: '1,247', icon: 'pi pi-box', iconColor: 'text-primary-600', bgColor: 'bg-primary-50' },
  { label: 'Nilai Inventori', value: 'Rp 2.4M', icon: 'pi pi-wallet', iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { label: 'PO Aktif', value: '8', icon: 'pi pi-file', iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  { label: 'SO Pending', value: '5', icon: 'pi pi-shopping-cart', iconColor: 'text-violet-600', bgColor: 'bg-violet-50' },
  { label: 'Low Stock', value: '23', icon: 'pi pi-exclamation-triangle', iconColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  { label: 'Near Expiry', value: '12', icon: 'pi pi-clock', iconColor: 'text-red-600', bgColor: 'bg-red-50' },
])

const chartData = ref([
  { label: 'Sen', inbound: 120, outbound: 80 },
  { label: 'Sel', inbound: 45, outbound: 95 },
  { label: 'Rab', inbound: 200, outbound: 150 },
  { label: 'Kam', inbound: 80, outbound: 60 },
  { label: 'Jum', inbound: 150, outbound: 180 },
  { label: 'Sab', inbound: 30, outbound: 40 },
  { label: 'Min', inbound: 10, outbound: 5 },
])
const maxChart = computed(() => Math.max(...chartData.value.map(d => Math.max(d.inbound, d.outbound))))

const topItems = ref([
  { name: 'Susu UHT Full Cream 1L', qty: 450, unit: 'DUS' },
  { name: 'Kopi Arabika 1KG', qty: 320, unit: 'BAG' },
  { name: 'Minyak Goreng 2L', qty: 280, unit: 'BTL' },
  { name: 'Gula Pasir 1KG', qty: 210, unit: 'BAG' },
  { name: 'Teh Hijau Celup', qty: 150, unit: 'BOX' },
])

const lowStockAlerts = ref([
  { sku: 'ITEM-003', name: 'Gula Pasir 1KG', qty: 8, unit: 'BAG', min: 50 },
  { sku: 'ITEM-004', name: 'Teh Hijau Celup', qty: 0, unit: 'BOX', min: 20 },
  { sku: 'ITEM-008', name: 'Tepung Terigu 1KG', qty: 12, unit: 'BAG', min: 100 },
])

const pendingActions = ref([
  { label: 'PO Butuh Approval', count: 2, icon: 'pi pi-file-edit', color: 'bg-blue-500' },
  { label: 'GRN Draft', count: 1, icon: 'pi pi-download', color: 'bg-amber-500' },
  { label: 'Pick List Pending', count: 3, icon: 'pi pi-list', color: 'bg-violet-500' },
  { label: 'Opname Butuh Review', count: 1, icon: 'pi pi-search', color: 'bg-red-500' },
])

const recentActivity = ref([
  { action: 'GRN-2025-003 di-post', by: 'Andi Gudang', time: '10 menit lalu', dotColor: 'bg-white border-emerald-400' },
  { action: 'SO-2025-005 baru dibuat', by: 'Siti Kasir', time: '25 menit lalu', dotColor: 'bg-white border-blue-400' },
  { action: 'Stok ITEM-003 kritis (<10)', by: 'System', time: '1 jam lalu', dotColor: 'bg-white border-red-400' },
  { action: 'Transfer TRF-2025-001 received', by: 'Budi Picker', time: '2 jam lalu', dotColor: 'bg-white border-violet-400' },
  { action: 'Opname OPN-2025-001 dimulai', by: 'Super Admin', time: '3 jam lalu', dotColor: 'bg-white border-amber-400' },
])
</script>
