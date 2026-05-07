<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="shrink-0 bg-white border-b border-slate-200 px-4 py-3">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-lg font-black text-slate-900 leading-tight">Retail POS</p>
          <p class="text-xs text-slate-500">Point of Sale System</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            <i class="pi pi-user mr-1"></i>{{ cashierName }}
          </span>
          <span class="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {{ todayLabel }}
          </span>
          <Button
            icon="pi pi-inbox"
            label="Hold"
            size="small"
            severity="secondary"
            outlined
            @click="showHolds = true"
            :badge="holds.length ? String(holds.length) : undefined"
            badgeClass="p-badge-danger"
          />
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3">
        <div class="flex flex-col md:flex-row gap-3">
          <UiSelect
            v-model="selectedWarehouseId"
            :options="warehouseOptionsNoAll"
            optionLabel="label"
            optionValue="value"
            placeholder="Warehouse"
            class="md:w-72"
            :loading="loadingMasters"
          />

          <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white md:w-72">
            <span :class="['w-2 h-2 rounded-full', activeShift ? 'bg-emerald-500' : 'bg-amber-500']"></span>
            <span class="text-sm font-semibold text-slate-800">
              {{ activeShift ? `Shift: ${activeShift.shiftNumber}` : 'Shift belum dibuka' }}
            </span>
            <Button size="small" text :label="activeShift ? 'Kelola' : 'Buka'" @click="openShift()" class="ml-auto" />
          </div>

          <div class="flex items-center gap-2 md:flex-1">
            <UiInput v-model="barcode" placeholder="Scan barcode lalu Enter" class="flex-1" @keyup.enter="scanBarcode()" />
            <Button icon="pi pi-plus" @click="scanBarcode()" :disabled="!barcode.trim()" />
          </div>
        </div>

        <div class="flex flex-col md:flex-row gap-3">
          <div class="flex gap-2 md:w-[280px]">
            <Button
              size="small"
              :outlined="customerType !== 'WALKIN'"
              :severity="customerType === 'WALKIN' ? 'primary' : 'secondary'"
              label="Walk-in"
              @click="setCustomerType('WALKIN')"
              class="flex-1"
            />
            <Button
              size="small"
              :outlined="customerType !== 'MEMBER'"
              :severity="customerType === 'MEMBER' ? 'primary' : 'secondary'"
              label="Member"
              @click="setCustomerType('MEMBER')"
              class="flex-1"
            />
          </div>

          <div v-if="customerType === 'MEMBER'" class="flex gap-2 md:flex-1">
            <InputText v-model="customerSearch" placeholder="Cari member..." class="w-full" />
            <Button icon="pi pi-search" @click="fetchCustomers()" :loading="loadingCustomers" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex overflow-hidden">
      <div class="flex-1 min-w-0 p-4 overflow-hidden flex flex-col min-h-0">
        <div class="flex-1 min-h-0">
          <PosProductGrid :warehouseId="selectedWarehouseId" @addToCart="addToCart" />
        </div>
      </div>
      <aside class="w-[380px] shrink-0 border-l border-slate-200 bg-white p-4 overflow-hidden">
        <PosCart
          :items="cart"
          :discount="discountTotal"
          @removeItem="removeItem"
          @updateQty="updateQty"
          @clearCart="clearCart"
          @openPayment="handleOpenPayment"
          @holdOrder="holdOrder"
        />
      </aside>
    </div>

    <!-- POS Bottom Bar -->
    <div class="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1.5">
          <span :class="['w-2 h-2 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse']"></span>
          {{ isOnline ? 'Online' : 'Offline Mode' }}
        </span>
        <span class="text-slate-400">|</span>
        <span class="text-slate-400">Kasir: <b class="text-white">{{ cashierName }}</b></span>
        <span class="text-slate-400">|</span>
        <span class="text-slate-400">Shift dimulai: <b class="text-white">{{ shiftTime }}</b></span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="pendingSync > 0" class="text-amber-400 flex items-center gap-1">
          <i class="pi pi-sync text-xs"></i> {{ pendingSync }} transaksi pending sync
        </span>
        <button @click="openShift()" class="text-slate-300 hover:text-white transition-colors font-semibold">
          <i class="pi pi-cog mr-1"></i>Shift
        </button>
        <button @click="navigateToDashboard" class="text-slate-300 hover:text-white transition-colors font-semibold">
          <i class="pi pi-sign-out mr-1"></i>Keluar POS
        </button>
      </div>
    </div>

    <UiModal v-model="showHolds" title="Hold Transactions" width="70vw">
      <div class="space-y-3">
        <div v-if="holds.length === 0" class="py-10 text-center text-slate-500">
          <i class="pi pi-inbox text-3xl mb-2 block opacity-40"></i>
          <p class="text-sm font-semibold">Belum ada transaksi hold</p>
          <p class="text-xs text-slate-500 mt-1">Gunakan tombol Hold di cart untuk menyimpan transaksi sementara.</p>
        </div>

        <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 w-44">Waktu</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">Warehouse</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500">Customer</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-28">Items</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-36">Total</th>
                <th class="w-40"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="h in holds" :key="h.id" class="hover:bg-slate-50/50">
                <td class="px-3 py-2">{{ formatDateTime(h.createdAt) }}</td>
                <td class="px-3 py-2">{{ warehouseLabelById(h.warehouseId) }}</td>
                <td class="px-3 py-2">{{ h.customerName || 'Walk-in' }}</td>
                <td class="px-3 py-2 text-right font-semibold">{{ h.items.reduce((s, i) => s + i.qty, 0) }}</td>
                <td class="px-3 py-2 text-right font-bold">{{ formatIdr(h.items.reduce((s, i) => s + i.price * i.qty, 0)) }}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center justify-end gap-2">
                    <Button size="small" icon="pi pi-play" label="Resume" @click="resumeHold(h.id)" />
                    <Button size="small" icon="pi pi-trash" severity="danger" text @click="deleteHold(h.id)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="holds.length > 0" class="flex items-center justify-between">
          <div class="text-xs text-slate-500">{{ holds.length }} transaksi</div>
          <Button label="Clear All" icon="pi pi-trash" severity="danger" outlined size="small" @click="clearAllHolds()" />
        </div>
      </div>

      <template #footer>
        <Button label="Close" icon="pi pi-times" severity="secondary" text @click="showHolds = false" />
      </template>
    </UiModal>

    <!-- Payment Modal -->
    <PosPaymentModal v-model="showPayment" :total="grandTotal" @paid="onPaid" />
    
    <!-- Shift Manager -->
    <PosShiftManager v-model="showShift" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useOffline } from '~/composables/useOffline'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'
import type { CartItem } from '~/components/pos/PosCart.vue'

definePageMeta({ layout: 'pos', middleware: ['rbac'], roles: ['SUPER_ADMIN', 'CASHIER'] })

const router = useRouter()
const toast = useToast()
const { isOnline, pendingCount } = useOffline()
const { api } = useApi()
const auth = useAuthStore()

const cart = ref<CartItem[]>([])
const showPayment = ref(false)
const showShift = ref(false)
const pendingSync = computed(() => pendingCount.value)

type ApiWarehouse = { id: string; code: string; name: string }
type ApiCustomer = { id: string; code: string; name: string; phone?: string | null }
type ApiShift = { id: string; shiftNumber: string; openedAt: string; openingCash: number; status: string }

type Option = { value: string | null; label: string }

const loadingMasters = ref(false)
const warehouses = ref<ApiWarehouse[]>([])
const selectedWarehouseId = ref<string>('')

const customerType = ref<'WALKIN' | 'MEMBER'>('WALKIN')
const customerSearch = ref('')
const loadingCustomers = ref(false)
const customers = ref<ApiCustomer[]>([])
const selectedCustomerId = ref<string | null>(null)

const promoType = ref<'NONE' | 'PERCENT' | 'AMOUNT'>('NONE')
const promoValue = ref<number>(0)
const promoCode = ref('')

const barcode = ref('')

const activeShift = ref<ApiShift | null>(null)
const openingShift = ref(false)
const shiftOpeningCash = ref(0)
const shiftNotes = ref('')

const cashierName = computed(() => auth.user?.name || '-')
const shiftTime = computed(() => {
  if (!activeShift.value?.openedAt) return '-'
  return new Date(activeShift.value.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
})
const todayLabel = computed(() => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }))

type PromoType = 'NONE' | 'PERCENT' | 'AMOUNT'
type HoldRecord = {
  id: string
  createdAt: string
  warehouseId: string
  customerType: 'WALKIN' | 'MEMBER'
  customerId: string | null
  customerName: string | null
  promoType: PromoType
  promoValue: number
  promoCode: string
  items: CartItem[]
}

const showHolds = ref(false)
const holds = ref<HoldRecord[]>([])

const warehouseOptionsNoAll = computed<Option[]>(() => warehouses.value.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })))

const customerOptions = computed<Option[]>(() => customers.value.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}${c.phone ? ` (${c.phone})` : ''}` })))

const promoTypeOptions = ref<Array<{ label: string; value: 'NONE' | 'PERCENT' | 'AMOUNT' }>>([
  { label: 'Tidak Ada', value: 'NONE' },
  { label: 'Percent (%)', value: 'PERCENT' },
  { label: 'Nominal', value: 'AMOUNT' },
])

const subtotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0))
const discountTotal = computed(() => {
  if (promoType.value === 'NONE') return 0
  const base = subtotal.value
  const v = Number(promoValue.value || 0)
  if (!Number.isFinite(v) || v <= 0) return 0
  if (promoType.value === 'PERCENT') return Math.min(base, (base * v) / 100)
  return Math.min(base, v)
})
const taxAmount = computed(() => Math.max(0, (subtotal.value - discountTotal.value) * 0.11))
const grandTotal = computed(() => subtotal.value - discountTotal.value + taxAmount.value)

function addToCart(product: any) {
  const existing = cart.value.find(i => i.id === product.id)
  if (existing) {
    existing.qty++
  } else {
    cart.value.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      qty: 1,
      unit: product.unit
    })
  }
}

function removeItem(idx: number) {
  cart.value.splice(idx, 1)
}

function updateQty(idx: number, delta: number) {
  const item = cart.value[idx]
  if (!item) return
  item.qty += delta
  if (item.qty <= 0) cart.value.splice(idx, 1)
}

function clearCart() {
  cart.value = []
  promoType.value = 'NONE'
  promoValue.value = 0
  promoCode.value = ''
}

function holdsKey() {
  return 'pos-holds-v1'
}

function loadHoldRecords(): HoldRecord[] {
  try {
    const raw = localStorage.getItem(holdsKey())
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed as HoldRecord[]
  } catch {
    return []
  }
}

function saveHoldRecords(list: HoldRecord[]) {
  localStorage.setItem(holdsKey(), JSON.stringify(list))
}

function refreshHolds() {
  holds.value = loadHoldRecords().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function holdOrder() {
  if (cart.value.length === 0) return
  if (!selectedWarehouseId.value) return toast.error('Warehouse wajib dipilih.')

  const list = loadHoldRecords()
  const selectedCustomer = customers.value.find((c) => c.id === selectedCustomerId.value)

  const record: HoldRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    warehouseId: selectedWarehouseId.value,
    customerType: customerType.value,
    customerId: customerType.value === 'MEMBER' ? selectedCustomerId.value : null,
    customerName: customerType.value === 'MEMBER' ? (selectedCustomer?.name || null) : null,
    promoType: promoType.value,
    promoValue: Number(promoValue.value || 0),
    promoCode: promoCode.value || '',
    items: cart.value.map((c) => ({ ...c })),
  }

  list.push(record)
  saveHoldRecords(list)
  refreshHolds()
  toast.info(`Pesanan di-hold (${cart.value.length} item). Bisa dilanjutkan nanti.`)
  clearCart()
}

function formatIdr(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v || 0))
}

function warehouseLabelById(id: string) {
  const w = warehouses.value.find((x) => x.id === id)
  return w ? `${w.code} — ${w.name}` : id
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function resumeHold(id: string) {
  const list = loadHoldRecords()
  const idx = list.findIndex((h) => h.id === id)
  if (idx === -1) return
  const h = list[idx]

  selectedWarehouseId.value = h.warehouseId
  customerType.value = h.customerType
  selectedCustomerId.value = h.customerId
  promoType.value = h.promoType
  promoValue.value = h.promoValue
  promoCode.value = h.promoCode
  cart.value = h.items.map((it) => ({ ...it }))

  list.splice(idx, 1)
  saveHoldRecords(list)
  refreshHolds()
  showHolds.value = false
  toast.success('Transaksi hold dilanjutkan.')
}

function deleteHold(id: string) {
  const ok = window.confirm('Hapus transaksi hold ini?')
  if (!ok) return
  const list = loadHoldRecords().filter((h) => h.id !== id)
  saveHoldRecords(list)
  refreshHolds()
}

function clearAllHolds() {
  const ok = window.confirm('Hapus semua transaksi hold?')
  if (!ok) return
  saveHoldRecords([])
  refreshHolds()
}

function errMsg(e: any) {
  return e?.data?.error || e?.data?.message || e?.message || 'Terjadi kesalahan'
}

async function fetchMasters() {
  loadingMasters.value = true
  try {
    const res = await api<{ success: true; warehouses: ApiWarehouse[] }>('/api/warehouses', { query: { page: 1, limit: 200 } })
    warehouses.value = (res as any).warehouses || []
    if (!selectedWarehouseId.value) selectedWarehouseId.value = warehouses.value[0]?.id || ''
  } finally {
    loadingMasters.value = false
  }
}

async function fetchActiveShift() {
  const res = await api<{ success: true; shift: ApiShift | null }>('/api/shifts/active')
  activeShift.value = (res as any).shift
}

function setCustomerType(t: 'WALKIN' | 'MEMBER') {
  customerType.value = t
  if (t === 'WALKIN') selectedCustomerId.value = null
}

async function fetchCustomers() {
  loadingCustomers.value = true
  try {
    const res = await api<{ success: true; customers: ApiCustomer[] }>('/api/partners/customers', {
      query: { search: customerSearch.value || undefined, page: 1, limit: 50 },
    })
    customers.value = (res as any).customers || []
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    loadingCustomers.value = false
  }
}

async function scanBarcode() {
  const code = barcode.value.trim()
  if (!code) return
  try {
    const res = await api<any>(`/api/items/barcode/${encodeURIComponent(code)}`)
    const item = (res as any).item
    const uom = (res as any).uom
    if (!item) return toast.error('Barang tidak ditemukan dari barcode.')
    addToCart({
      id: item.id,
      sku: item.sku,
      name: item.name,
      price: Number(uom?.price || 0),
      unit: uom?.uom?.code || 'PCS',
    })
    barcode.value = ''
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

async function onPaid(payload: { method: string; amountPaid: number; paymentReference?: string; paymentProvider?: string; notes?: string }) {
  if (!activeShift.value) return toast.error('Shift belum dibuka.')
  if (!selectedWarehouseId.value) return toast.error('Warehouse wajib dipilih.')
  if (customerType.value === 'MEMBER' && !selectedCustomerId.value) return toast.error('Pilih customer member.')

  try {
    const res = await api('/api/pos/checkout', {
      method: 'POST',
      body: {
        shiftId: activeShift.value.id,
        warehouseId: selectedWarehouseId.value,
        customerId: customerType.value === 'MEMBER' ? selectedCustomerId.value : undefined,
        promoCode: promoType.value === 'NONE' ? undefined : (promoCode.value || undefined),
        discountTotal: discountTotal.value,
        taxRate: 0.11,
        paymentMethod: payload.method,
        amountPaid: payload.amountPaid,
        paymentReference: payload.paymentReference,
        paymentProvider: payload.paymentProvider,
        notes: payload.notes,
        items: cart.value.map((c) => ({
          itemId: c.id,
          quantity: c.qty,
          unitPrice: c.price,
          discount: 0,
        })),
      },
    })
    const receiptNumber = (res as any).receiptNumber || (res as any).transaction?.receiptNumber
    const change = (res as any).change
    toast.success(`Transaksi selesai. Struk: ${receiptNumber || '-'}${typeof change === 'number' ? ` · Kembalian: Rp ${Math.round(change).toLocaleString('id-ID')}` : ''}`)
    clearCart()
    await fetchActiveShift()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
}

function openShift() {
  showShift.value = true
}

async function openShiftDirect() {
  if (activeShift.value) return
  if (!Number.isFinite(Number(shiftOpeningCash.value)) || Number(shiftOpeningCash.value) < 0) return toast.error('Saldo awal tidak valid.')

  openingShift.value = true
  try {
    await api('/api/shifts/open', {
      method: 'POST',
      body: { openingCash: Number(shiftOpeningCash.value), notes: shiftNotes.value || undefined },
    })
    toast.success('Shift berhasil dibuka.')
    await fetchActiveShift()
  } catch (e: any) {
    toast.error(errMsg(e))
  } finally {
    openingShift.value = false
  }
}

function handleOpenPayment() {
  if (!activeShift.value) {
    toast.error('Shift belum dibuka. Buka shift dulu sebelum checkout.')
    openShift()
    return
  }
  showPayment.value = true
}

function navigateToDashboard() {
  router.push('/dashboard')
}

watch(
  () => showShift.value,
  async (open) => {
    if (!open) await fetchActiveShift()
  }
)

onMounted(async () => {
  try {
    await fetchMasters()
    await fetchActiveShift()
    shiftOpeningCash.value = 0
    shiftNotes.value = ''
    refreshHolds()
  } catch (e: any) {
    toast.error(errMsg(e))
  }
})
</script>
