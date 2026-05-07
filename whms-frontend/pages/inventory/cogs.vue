<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">COGS & Overhead Calculator</h1>
        <p class="text-sm text-slate-500 mt-1">Perhitungan Harga Pokok Penjualan (HPP) dan Overhead untuk produk retail baju</p>
      </div>
      <div class="flex gap-2">
        <Button icon="pi pi-refresh" label="Refresh" severity="secondary" outlined size="small" :loading="loading" @click="fetchData" />
        <Button icon="pi pi-print" label="Print Laporan" size="small" @click="printReport" />
      </div>
    </div>

    <!-- Period & Filter Bar -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-600">Periode</label>
        <div class="flex gap-2 items-center">
          <InputText v-model="filterMonth" type="month" size="small" class="w-40" />
        </div>
      </div>
      <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label class="text-xs font-semibold text-slate-600">Kategori Produk</label>
        <Select v-model="filterCategory" :options="categoryOptions" optionLabel="name" optionValue="id" placeholder="Semua Kategori" size="small" showClear class="w-full" />
      </div>
      <Button label="Hitung" icon="pi pi-calculator" size="small" @click="calculate" :loading="calculating" />
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total HPP</div>
        <div class="text-2xl font-extrabold text-slate-800">{{ formatRp(summary.totalCogs) }}</div>
        <div class="text-xs text-slate-400 mt-1">Biaya pokok semua unit terjual</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Overhead</div>
        <div class="text-2xl font-extrabold text-amber-600">{{ formatRp(summary.totalOverhead) }}</div>
        <div class="text-xs text-slate-400 mt-1">Biaya operasional dialokasikan</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">HPP per Unit (avg)</div>
        <div class="text-2xl font-extrabold text-blue-600">{{ formatRp(summary.avgCogsPerUnit) }}</div>
        <div class="text-xs text-slate-400 mt-1">Rata-rata across semua SKU</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Gross Profit</div>
        <div class="text-2xl font-extrabold" :class="summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'">
          {{ formatRp(summary.grossProfit) }}
        </div>
        <div class="text-xs text-slate-400 mt-1">Revenue − HPP − Overhead</div>
      </div>
    </div>

    <!-- Two columns: Overhead Config + Component breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Overhead Config Panel -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800">⚙️ Konfigurasi Overhead</h2>
          <div class="flex gap-1">
            <Button icon="pi pi-save" label="Simpan" severity="success" text size="small" :loading="savingConfig" @click="saveOverhead" />
            <Button icon="pi pi-plus" text rounded size="small" @click="addOverheadItem" />
          </div>
        </div>
        <p class="text-xs text-slate-500">Masukkan biaya overhead operasional bulanan. Akan dialokasikan proporsional ke per-unit terjual.</p>

        <div class="space-y-3">
          <div v-for="(item, i) in overheadItems" :key="i" class="p-3 border border-slate-100 rounded-lg bg-slate-50">
            <div class="flex items-center gap-2 mb-2">
              <Select v-model="item.type" :options="overheadTypeOptions" optionLabel="label" optionValue="value" size="small" class="flex-1" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeOverheadItem(i)" />
            </div>
            <div class="flex gap-2">
              <InputText v-model="item.label" placeholder="Keterangan" size="small" class="flex-1" />
              <InputNumber v-model="item.amount" :min="0" size="small" class="w-36" prefix="Rp " :useGrouping="true" />
            </div>
          </div>
        </div>

        <div class="border-t border-slate-200 pt-3 flex justify-between items-center">
          <span class="text-sm font-semibold text-slate-600">Total Overhead</span>
          <span class="font-bold text-amber-600">{{ formatRp(totalOverheadInput) }}</span>
        </div>

        <!-- Alokasi Method -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-600">Metode Alokasi Overhead</label>
          <Select v-model="allocationMethod" :options="allocationOptions" optionLabel="label" optionValue="value" size="small" />
        </div>
      </div>

      <!-- Component COGS table -->
      <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-slate-800">📦 Komponen HPP per SKU</h2>
          <Button v-if="cogsRows.length > 0" icon="pi pi-check-circle" label="Selesaikan (Settle)" severity="primary" size="small" :loading="settling" @click="saveSettlement" />
        </div>
        <p class="text-xs text-slate-500">Dihitung berdasarkan harga beli masuk (Purchase Price) + proporsi overhead per unit terjual.</p>

        <div v-if="calculating" class="flex items-center justify-center py-16 text-slate-400">
          <i class="pi pi-spin pi-spinner text-2xl mr-2"></i>
          <span>Menghitung HPP...</span>
        </div>
        <div v-else-if="cogsRows.length === 0" class="text-center py-12 text-slate-400">
          <i class="pi pi-calculator text-4xl mb-3 text-slate-300 block"></i>
          <p class="font-medium text-slate-600">Pilih periode & klik Hitung</p>
          <p class="text-sm mt-1">Sistem akan mengambil data penjualan dan biaya pembelian</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-slate-800 text-white text-xs">
                <th class="px-3 py-2 text-left rounded-tl-lg">SKU</th>
                <th class="px-3 py-2 text-left">Nama Item</th>
                <th class="px-3 py-2 text-right">Qty Terjual</th>
                <th class="px-3 py-2 text-right">Harga Beli/unit</th>
                <th class="px-3 py-2 text-right">Overhead/unit</th>
                <th class="px-3 py-2 text-right">HPP/unit</th>
                <th class="px-3 py-2 text-right">Total HPP</th>
                <th class="px-3 py-2 text-right rounded-tr-lg">Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in cogsRows" :key="row.sku"
                :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
                class="hover:bg-blue-50 transition-colors"
              >
                <td class="px-3 py-2 font-mono text-xs text-slate-500 border-b border-slate-100">{{ row.sku }}</td>
                <td class="px-3 py-2 font-medium text-slate-800 border-b border-slate-100 max-w-[180px] truncate">{{ row.name }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100 font-semibold">{{ row.qtySold }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100 text-slate-600">{{ formatRp(row.purchasePricePerUnit) }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100 text-amber-600">{{ formatRp(row.overheadPerUnit) }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100 font-bold text-blue-700">{{ formatRp(row.cogsPerUnit) }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100 font-bold text-slate-800">{{ formatRp(row.totalCogs) }}</td>
                <td class="px-3 py-2 text-right border-b border-slate-100">
                  <span :class="row.marginPct >= 0 ? 'text-emerald-600' : 'text-red-600'" class="font-bold">
                    {{ row.marginPct.toFixed(1) }}%
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold text-sm">
                <td colspan="2" class="px-3 py-3 text-slate-700">TOTAL</td>
                <td class="px-3 py-3 text-right">{{ totalQtySold }}</td>
                <td class="px-3 py-3"></td>
                <td class="px-3 py-3 text-right text-amber-600">{{ formatRp(summary.totalOverhead) }}</td>
                <td class="px-3 py-3"></td>
                <td class="px-3 py-3 text-right text-slate-800">{{ formatRp(summary.totalCogs) }}</td>
                <td class="px-3 py-3 text-right" :class="summary.avgMarginPct >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  {{ summary.avgMarginPct.toFixed(1) }}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Overhead Breakdown Pie chart (visual) -->
    <div v-if="cogsRows.length > 0" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 class="font-bold text-slate-800 mb-4">📊 Breakdown Komposisi HPP</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="row in cogsRows.slice(0, 9)" :key="row.sku" class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium text-slate-700 truncate max-w-[140px]" :title="row.name">{{ row.name }}</span>
            <span class="text-xs text-slate-500">HPP {{ formatRp(row.cogsPerUnit) }}/pcs</span>
          </div>
          <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
              :style="{ width: `${Math.min((row.purchasePricePerUnit / row.cogsPerUnit) * 100, 100).toFixed(0)}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-[10px] text-slate-500">
            <span>Harga Beli {{ ((row.purchasePricePerUnit / row.cogsPerUnit) * 100).toFixed(0) }}%</span>
            <span>Overhead {{ ((row.overheadPerUnit / row.cogsPerUnit) * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['rbac'], roles: ['SUPER_ADMIN', 'MANAGER'] })

import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useApi } from '~/composables/useApi'
import { generateQrSvg } from '~/composables/useQrSvg'

const toast = useToast()
const { api } = useApi()

// ── Filter state ──────────────────────────────────────────────
const today = new Date()
const filterMonth = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
const filterCategory = ref<string | null>(null)
const loading = ref(false)
const calculating = ref(false)

// ── Master data ───────────────────────────────────────────────
const categoryOptions = ref<{ id: string; name: string }[]>([])
const savingConfig = ref(false)
const settling = ref(false)

// ── Overhead config ───────────────────────────────────────────
const overheadTypeOptions = [
  { label: '🏢 Sewa Gudang/Toko', value: 'RENT' },
  { label: '⚡ Listrik & Utilitas', value: 'UTILITY' },
  { label: '👷 Gaji Karyawan', value: 'LABOR' },
  { label: '🚚 Ongkos Kirim Inbound', value: 'FREIGHT' },
  { label: '📦 Biaya Packaging', value: 'PACKAGING' },
  { label: '🔧 Maintenance', value: 'MAINTENANCE' },
  { label: '📣 Pemasaran', value: 'MARKETING' },
  { label: '📋 Administrasi', value: 'ADMIN' },
  { label: '🔧 Lain-lain', value: 'OTHER' },
]

const allocationOptions = [
  { label: 'Proporsional (berdasarkan Qty terjual)', value: 'QTY' },
  { label: 'Rata-rata per SKU', value: 'SKU' },
  { label: 'Proporsional (berdasarkan nilai HPP)', value: 'VALUE' },
]

const allocationMethod = ref('QTY')

type OverheadItem = { type: string; label: string; amount: number }
const overheadItems = ref<OverheadItem[]>([])

// Fetch saved overhead when period changes
watch(filterMonth, () => {
  fetchOverhead()
})

async function fetchOverhead() {
  try {
    const res = await api<{ success: boolean; overheads: any[] }>(`/api/inventory/cogs/overhead/${filterMonth.value}`)
    if (res.success && res.overheads.length > 0) {
      overheadItems.value = res.overheads.map(o => ({
        type: o.type,
        label: o.label,
        amount: o.amount
      }))
    } else {
      // Default template if nothing saved
      overheadItems.value = [
        { type: 'RENT', label: 'Sewa Toko / Gudang', amount: 5000000 },
        { type: 'LABOR', label: 'Gaji Staff Gudang', amount: 3500000 },
        { type: 'UTILITY', label: 'Listrik & Air', amount: 800000 },
        { type: 'PACKAGING', label: 'Tas, Hanger, Tag', amount: 1200000 },
      ]
    }
  } catch {
    // Silent fail
  }
}

async function saveOverhead() {
  savingConfig.value = true
  try {
    const res = await api<{ success: boolean }>('/api/inventory/cogs/overhead', {
      method: 'POST',
      body: {
        period: filterMonth.value,
        items: overheadItems.value
      }
    })
    if (res.success) {
      toast.success('Konfigurasi overhead berhasil disimpan.')
    }
  } catch (e: any) {
    toast.error('Gagal menyimpan overhead: ' + (e?.message || ''))
  } finally {
    savingConfig.value = false
  }
}

const totalOverheadInput = computed(() => overheadItems.value.reduce((s, o) => s + (o.amount || 0), 0))

function addOverheadItem() {
  overheadItems.value.push({ type: 'OTHER', label: '', amount: 0 })
}
function removeOverheadItem(i: number) {
  overheadItems.value.splice(i, 1)
}

// ── COGS calculation state ────────────────────────────────────
type CogsRow = {
  sku: string
  name: string
  qtySold: number
  purchasePricePerUnit: number
  overheadPerUnit: number
  cogsPerUnit: number
  totalCogs: number
  sellingPrice: number
  marginPct: number
}

const cogsRows = ref<CogsRow[]>([])

const totalQtySold = computed(() => cogsRows.value.reduce((s, r) => s + r.qtySold, 0))

const summary = computed(() => {
  const totalCogs = cogsRows.value.reduce((s, r) => s + r.totalCogs, 0)
  const totalOverhead = cogsRows.value.reduce((s, r) => s + r.overheadPerUnit * r.qtySold, 0)
  const totalRevenue = cogsRows.value.reduce((s, r) => s + r.sellingPrice * r.qtySold, 0)
  const grossProfit = totalRevenue - totalCogs
  const avgCogsPerUnit = totalQtySold.value > 0 ? totalCogs / totalQtySold.value : 0
  const avgMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  return { totalCogs, totalOverhead, grossProfit, avgCogsPerUnit, avgMarginPct }
})

function formatRp(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0)
}

async function fetchData() {
  loading.value = true
  try {
    const [catRes] = await Promise.all([
      api<{ success: boolean; categories: any[] }>('/api/master/categories'),
    ])
    categoryOptions.value = catRes.categories || []
  } catch (e: any) {
    toast.error('Gagal memuat data master: ' + (e?.message || ''))
  } finally {
    loading.value = false
  }
}

async function calculate() {
  calculating.value = true
  cogsRows.value = []
  try {
    const res = await api<{ success: boolean; summary: any; rows: any[] }>('/api/inventory/cogs/report', {
      query: {
        period: filterMonth.value,
        categoryId: filterCategory.value || undefined,
        allocationMethod: allocationMethod.value
      }
    })
    
    if (res.success) {
      cogsRows.value = res.rows || []
      // The summary is computed based on cogsRows anyway, but we can verify consistency
      if (cogsRows.value.length === 0) {
        toast.info('Tidak ada data penjualan keluar di periode ini.')
      } else {
        toast.success(`HPP berhasil dihitung untuk ${cogsRows.value.length} SKU.`)
      }
    }
  } catch (e: any) {
    toast.error('Gagal menghitung COGS: ' + (e?.message || ''))
  } finally {
    calculating.value = false
  }
}

async function saveSettlement() {
  settling.value = true
  try {
    const res = await api<{ success: boolean }>('/api/inventory/cogs/settle', {
      method: 'POST',
      body: {
        period: filterMonth.value,
        summary: summary.value,
        rows: cogsRows.value
      }
    })
    if (res.success) {
      toast.success(`Report periode ${filterMonth.value} berhasil diselesaikan & disimpan ke history.`)
    }
  } catch (e: any) {
    toast.error('Gagal menyimpan settlement: ' + (e?.message || ''))
  } finally {
    settling.value = false
  }
}

function printReport() {
  const [year, month] = filterMonth.value.split('-').map(Number)
  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const overheadRows = overheadItems.value.map(o =>
    `<tr><td>${o.label || o.type}</td><td class="num">${formatRp(o.amount)}</td></tr>`
  ).join('')
  const itemRows = cogsRows.value.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${r.sku}</td>
      <td>${r.name}</td>
      <td class="num">${r.qtySold}</td>
      <td class="num">${formatRp(r.purchasePricePerUnit)}</td>
      <td class="num amber">${formatRp(r.overheadPerUnit)}</td>
      <td class="num bold blue">${formatRp(r.cogsPerUnit)}</td>
      <td class="num bold">${formatRp(r.totalCogs)}</td>
      <td class="num ${r.marginPct >= 0 ? 'green' : 'red'} bold">${r.marginPct.toFixed(1)}%</td>
    </tr>
  `).join('')

  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return toast.error('Popup diblokir browser')

  win.document.open()
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Laporan COGS & Overhead — ${periodLabel}</title>
      <meta charset="utf-8"/>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;color:#0f172a;padding:28px 36px}
        h1{font-size:18px;font-weight:800;margin-bottom:2px}
        .sub{font-size:11px;color:#64748b;margin-bottom:20px}
        .kpi{display:flex;gap:16px;margin-bottom:20px}
        .kpi-card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
        .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px}
        .kpi-val{font-size:17px;font-weight:800;color:#0f172a}
        .kpi-val.amber{color:#d97706}.kpi-val.blue{color:#2563eb}.kpi-val.green{color:#059669}.kpi-val.red{color:#dc2626}
        section{margin-bottom:24px}
        h2{font-size:13px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#1e3a5f;color:#fff}
        thead th{padding:7px 10px;text-align:left;font-size:10px;font-weight:600}
        thead th.num{text-align:right}
        tbody tr:nth-child(even){background:#f8fafc}
        tbody td{padding:6px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
        td.num{text-align:right;font-variant-numeric:tabular-nums}
        td.mono{font-family:monospace;font-size:10px;color:#475569}
        td.bold{font-weight:700}
        td.amber{color:#d97706}td.blue{color:#2563eb}td.green{color:#059669}td.red{color:#dc2626}
        tfoot tr{background:#1e3a5f;color:#fff;font-weight:700}
        tfoot td{padding:7px 10px}
        .footer{margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
        @media print{body{padding:16px 20px}}
      </style>
    </head><body>
      <h1>Laporan COGS & Overhead — ${periodLabel}</h1>
      <div class="sub">Dicetak: ${printDate} &nbsp;·&nbsp; Metode Alokasi: ${allocationMethod.value}</div>

      <div class="kpi">
        <div class="kpi-card"><div class="kpi-label">Total HPP</div><div class="kpi-val">${formatRp(summary.value.totalCogs)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Overhead</div><div class="kpi-val amber">${formatRp(summary.value.totalOverhead)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gross Profit</div><div class="kpi-val ${summary.value.grossProfit >= 0 ? 'green' : 'red'}">${formatRp(summary.value.grossProfit)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Avg Margin</div><div class="kpi-val blue">${summary.value.avgMarginPct.toFixed(1)}%</div></div>
      </div>

      <section>
        <h2>Komponen Overhead Bulanan</h2>
        <table>
          <thead><tr><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>
          <tbody>${overheadRows}</tbody>
          <tfoot><tr><td>TOTAL OVERHEAD</td><td class="num">${formatRp(totalOverheadInput.value)}</td></tr></tfoot>
        </table>
      </section>

      <section>
        <h2>Detail HPP per SKU</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>SKU</th><th>Nama Item</th>
              <th class="num">Qty</th><th class="num">Harga Beli</th>
              <th class="num">Overhead/unit</th><th class="num">HPP/unit</th>
              <th class="num">Total HPP</th><th class="num">Margin</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">TOTAL</td>
              <td class="num">${totalQtySold.value}</td>
              <td></td>
              <td class="num">${formatRp(summary.value.totalOverhead)}</td>
              <td></td>
              <td class="num">${formatRp(summary.value.totalCogs)}</td>
              <td class="num">${summary.value.avgMarginPct.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div class="footer">
        <span>WHMS — Warehouse Management System &nbsp;·&nbsp; Retail Baju</span>
        <span>Total ${cogsRows.value.length} SKU terhitung</span>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `)
  win.document.close()
}

onMounted(() => {
  fetchData()
  fetchOverhead()
})
</script>
