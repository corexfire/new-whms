========================================
WHMS
Warehouse Management System
Stack Frontend: Vue 3 + Nuxt 3 + Pinia + TypeScript
========================================

## 1. IDENTITAS & STACK TEKNOLOGI

Kamu adalah senior fullstack developer yang membangun Warehouse Management System (WHMS) production-ready untuk perusahaan distribusi/logistik Indonesia.

FRONTEND STACK (Vue 3):
- Framework:      Nuxt 3 (Vue 3 under the hood, SSR/SPA hybrid, Vite 5)
- Bahasa:         TypeScript 5 (strict mode)
- State:          Pinia + pinia-plugin-persistedstate
- Routing:        Vue Router 4 (built-in Nuxt 3)
- UI:             PrimeVue 4
- Styling:        Tailwind CSS 3 + scoped SFC CSS
- Form:           VeeValidate 4 + Zod resolver
- HTTP:           $fetch (ofetch Nuxt built-in) + useApi() composable
- Charts:         Vue-ECharts / ApexCharts Vue 3
- Table:          AG Grid Vue 3 (virtual scroll untuk >500 baris)
- Real-time:      Socket.IO Client + useSocket() composable
- Scanner:        ZXing-js (@zxing/library) + useScanner() composable
- Barcode Gen:    JsBarcode + vue-qrcode
- PWA/Offline:    vite-plugin-pwa + Workbox + Dexie.js (IndexedDB)
- Testing:        Vitest + Vue Test Utils + Playwright E2E
- Build:          Vite 5 (via Nuxt)

Syntax WAJIB: <script setup lang="ts"> + Composition API.
Tidak boleh ada Options API di codebase ini.

BACKEND STACK (tidak berubah dari spesifikasi v3):
Node.js 20, Express.js, TypeScript 5, Prisma ORM, PostgreSQL 16,
Redis 7, BullMQ, Socket.IO 4, JWT + RBAC, Puppeteer, ExcelJS,
JsBarcode, MinIO/S3, Nodemailer

========================================

## 2. PINIA STORES (State Management)

// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<string[]>([])
  const isAuthenticated = computed(() => !!user.value && !!token.value)
  async function login(email: string, password: string) {
    const res = await $fetch('/api/auth/login', { method:'POST', body:{email,password} })
    token.value = res.data.accessToken
    user.value = res.data.user
    permissions.value = res.data.permissions
  }
  function logout() { user.value = null; token.value = null; permissions.value = [] }
  return { user, token, permissions, isAuthenticated, login, logout }
}, { persist: true })

// stores/ui.ts — sidebarCollapsed, theme, language, loadingRoutes
// stores/notif.ts — notifications[], unreadCount, addNotif, markAllRead
// stores/picking.ts — activePickList, pickedItems[], confirmPick()
// stores/pos.ts — cart[], shift, cartTotal, addItem, checkout()

========================================

## 3. COMPOSABLES UTAMA

useApi()       — $fetch wrapper: auth header, error handling, 401 redirect
usePermission()— can(action, module) + hasRole(...roles)
useScanner()   — ZXing kamera scan → callback(result)
useSocket()    — Socket.IO connection + event handlers (notif, stock_alert)
useOffline()   — isOnline, pendingCount, triggerSync()
useDebounce()  — debounce untuk search input
usePrinter()   — printLabel(templateId, data) → BullMQ job

========================================

## 4. NUXT 3 MIDDLEWARE & AUTH GUARD

// middleware/auth.ts (global)
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const publicRoutes = ['/login', '/forgot-password']
  if (publicRoutes.includes(to.path)) return
  if (!auth.isAuthenticated) return navigateTo({ path: '/login', query: { returnUrl: to.fullPath } })
})

// middleware/rbac.ts (per-route)
export default defineNuxtRouteMiddleware((to) => {
  const { hasRole } = usePermission()
  const requiredRoles = to.meta.roles as string[] | undefined
  if (requiredRoles && !requiredRoles.some(r => hasRole(r))) return navigateTo('/403')
})

Setiap halaman definisikan:
definePageMeta({ middleware: ['auth','rbac'], roles: ['ROLE'], layout: 'default', title: '...' })

LAYOUTS:
- default.vue     → AppSidebar + AppTopBar + <slot>
- auth.vue        → Form centered (login, forgot)
- pos.vue         → Fullscreen kasir tanpa sidebar
- fullscreen.vue  → Picking/Putaway mobile (tanpa header/sidebar)

========================================

## 5. STRUKTUR DIREKTORI NUXT 3

pages/         → Semua halaman (file-based routing)
components/ui/ → UiButton, UiInput, UiSelect, UiBadge, UiModal, UiDataTable, UiSkeleton
components/app/→ AppSidebar, AppTopBar, AppNotifPanel, AppOfflineBanner
composables/   → useApi, useAuth, usePermission, useScanner, useSocket, useOffline
stores/        → auth, ui, notif, picking, pos (Pinia)
services/      → db.ts (Dexie), sync.ts (SyncService), label.ts (LabelService)
middleware/    → auth.ts (global), rbac.ts (per-route)
layouts/       → default, auth, pos, fullscreen
plugins/       → pinia-persist.client.ts, toast.client.ts, ag-grid.client.ts
types/         → api.d.ts, models.d.ts, enums.ts

========================================

## 6. OFFLINE-FIRST (Dexie.js + vite-plugin-pwa)

Dexie stores:
- items_cache, locations_cache, active_picklists
- pos_product_cache, offline_queue, sync_metadata

OfflineAction schema:
{ id: UUID, action_type: ENUM, payload: JSON, status: PENDING|SYNCED|CONFLICT|FAILED,
  retry_count: number, created_at: ISO }

Action types: CONFIRM_PICK | PUTAWAY_ITEM | STOCK_COUNT | POS_SALE | POS_RETURN | LABEL_PRINT

SyncService.syncAll():
1. Ambil PENDING dari offline_queue (ORDER BY created_at)
2. POST /api/sync/bulk → { actions }
3. 200 → update SYNCED, 409 → CONFLICT (tampil di /sync-status), 5xx → retry max 5
4. Pull fresh cache dari server → bulkPut ke Dexie

Security: IndexedDB enkripsi AES-256, device registration wajib, remote wipe endpoint,
          max offline 7 hari → require re-login

========================================

## 7. RBAC — 9 ROLE

SUPER_ADMIN, MANAGER, FINANCE_MANAGER, ACCOUNTANT,
INBOUND_STAFF, OUTBOUND_STAFF, INVENTORY_STAFF, CASHIER, AUDITOR

Guard di template: v-if="can('approve','purchase_orders')"
Guard di route: definePageMeta({ roles: ['MANAGER','SUPER_ADMIN'] })
Guard di API: rbacMiddleware(['MANAGER','SUPER_ADMIN']) (backend Express)

========================================

## 8. PETA HALAMAN & HUBUNGAN

Auth: /login → /dashboard (sukses), /forgot-password (link)
Dashboard: KPI → klik alert stok kritis → /master/items (filter min_stock)
PO flow: /inbound/purchase-orders → /new → detail → [Buat GRN] → GRN Form → Putaway (fullscreen)
SO flow: /outbound/sales-orders → /new → detail → [Picking] → pick fullscreen → Packing → Shipping
Shipping → delivered → AR aktif → /accounting/receivables → terima bayar → jurnal AR otomatis
Stock Opname: /inventory/stocktake → proses → approve → jurnal adjustment → stok update
POS: /pos (fullscreen) → checkout → stok berkurang + jurnal POS otomatis
Monitoring → klik alert → halaman terkait (PO, SO, item, printer)
Audit Log → klik entity_ref → buka halaman detail dokumen

========================================

## 9. JURNAL OTOMATIS (Backend JournalService)

GRN_COMPLETE:      Dr 1310 Persediaan / Cr 2110 Hutang Supplier
SO_SHIPPED:        Dr 1210 AR + Cr 4100 Revenue; Dr 5110 HPP + Cr 1310 Persediaan
AP_PAYMENT:        Dr 2110 Hutang Supplier / Cr 1120 Bank
AR_RECEIPT:        Dr 1120 Bank / Cr 1210 Piutang Customer
STOCK_ADJUSTMENT:  Dr 5500 Beban / Cr 1310 (kurang) | Dr 1310 / Cr 4900 (lebih)
CUSTOMER_RETURN:   Dr 4300 Retur + Cr 1210; Dr 1310 + Cr 5110
SUPPLIER_RETURN:   Dr 2110 Hutang / Cr 1310 Persediaan
POS_SALE:          Dr Kas/Bank + Cr 4100; Dr 5110 + Cr 1310
POS_VOID:          Reverse semua jurnal transaksi terkait

Validasi: Debit total HARUS = Kredit total (toleransi 0.01)
Jika tidak balance → throw AppError('JOURNAL_UNBALANCED', 500)

========================================

## 10. POS (Point of Sale)

Page: /pos.vue dengan layout: 'pos' (fullscreen, touch-optimized)
Store: usePOSStore (Pinia) — cart, shift, cartTotal, addItem, checkout()
Offline: transaksi masuk offline_queue jika isOnline = false
Components: PosProductGrid, PosCart, PosPaymentModal, PosQrisModal, PosShiftManager

Payment: Tunai (kembalian auto), QRIS (generate QR + webhook polling),
         Transfer Bank, Kartu Debit/Kredit, Kredit Customer

Shift: open (input opening_cash) → transaksi → close (count closing_cash → selisih)
Receipt: cetak via ESC/POS thermal printer 80mm atau email ke customer

========================================

## 11. BARCODE & LABEL

Generate: JsBarcode (Code-128, EAN-13, ITF-14) + vue-qrcode
Scanner:  ZXing-js → useScanner() composable → getUserMedia kamera
          Valid scan: border hijau + bip pendek. Invalid: border merah + bip panjang

Label templates di DB (JSON → konversi ke ZPL saat print):
- Item M (100×50mm): Logo + Barcode + SKU + Nama + QR + Lot + Expire
- Rack (50×30mm): Kode bin besar + QR + kapasitas
- Shipping: Header SO + Alamat besar + Resi barcode + QR tracking

Print: usePrinter() → POST /api/label/print → BullMQ job → ZPL via TCP:9100

Format kode lokasi: {WH}-{ZONE}-{AISLE}-{RACK}-{LEVEL}-{BIN}
Contoh: WH01-A-02-C-03-B

========================================

CATATAN PENTING:
- SFC <script setup lang="ts"> WAJIB — tidak ada Options API
- Auto-import aktif via Nuxt: tidak perlu import ref, computed, onMounted
- Semua currency: toLocaleString('id-ID', {style:'currency',currency:'IDR'})
- Semua datetime simpan UTC, tampilkan WIB (UTC+7)
- Semua async data di pages: useAsyncData('key', () => useApi().api('...'))
- Health check endpoint backend: GET /api/health → {status,db,redis,storage,uptime}
- Backup DB: pg_dump harian 02:00 WIB → S3 AES-256, retensi 30 hari


========================================

Struktur folder

Buat struktur direktori Nuxt 3 berikut:

whms-frontend/
├── assets/
│   ├── css/
│   │   ├── main.css          # Tailwind directives + CSS variables
│   │   └── transitions.css   # Vue transition classes
│   └── fonts/                # Font lokal jika ada
│
├── components/
│   ├── app/
│   │   ├── AppSidebar.vue    # Navigasi sidebar 2-level + collapse
│   │   ├── AppTopBar.vue     # Header: breadcrumb + search + notif + user
│   │   ├── AppNotifPanel.vue # Slide-over panel notifikasi
│   │   └── AppOfflineBanner.vue # Banner mode offline + sync status
│   ├── ui/                   # Atomic components
│   │   ├── UiButton.vue      # Button (variant: primary/secondary/danger/ghost)
│   │   ├── UiInput.vue       # Input dengan prefix/suffix/error
│   │   ├── UiSelect.vue      # Select dengan search + async
│   │   ├── UiBadge.vue       # Status badge color-coded
│   │   ├── UiModal.vue       # Modal dengan teleport ke body
│   │   ├── UiDataTable.vue   # AG Grid wrapper dengan export
│   │   ├── UiCurrencyInput.vue # Format Rupiah otomatis
│   │   ├── UiDatePicker.vue  # Date + range picker
│   │   ├── UiFileUpload.vue  # Dropzone + preview
│   │   └── UiSkeleton.vue    # Loading skeleton
│   ├── forms/
│   │   ├── FormBarcode.vue   # Scan + generate barcode
│   │   ├── FormLineItems.vue # Tabel editable items (PO/SO/GRN)
│   │   └── FormAutoComplete.vue # Async search dropdown
│   └── charts/
│       ├── ChartKpiCard.vue  # KPI card dengan angka + trend
│       ├── ChartLine.vue     # Line chart (ECharts Vue)
│       └── ChartDonut.vue    # Donut chart
│
├── composables/
│   ├── useApi.ts             # $fetch wrapper dengan auth & error
│   ├── useAuth.ts            # login, logout, token refresh
│   ├── usePermission.ts      # can(), hasRole()
│   ├── useScanner.ts         # ZXing barcode scanner
│   ├── useSocket.ts          # Socket.IO connection + events
│   ├── useOffline.ts         # online/offline + pending sync count
│   ├── useDebounce.ts        # debounce untuk search input
│   ├── usePrinter.ts         # ZPL print via TCP / QZ Tray
│   └── useCurrency.ts        # format Rupiah, parse angka
│
├── layouts/
│   ├── default.vue           # Dashboard shell (sidebar + topbar)
│   ├── auth.vue              # Login/forgot password layout
│   ├── pos.vue               # POS fullscreen (tanpa sidebar)
│   └── fullscreen.vue        # Picking/Putaway mobile fullscreen
│
├── middleware/
│   ├── auth.ts               # Global: cek isAuthenticated
│   └── rbac.ts               # Per-route: cek role dari meta.roles
│
├── pages/
│   ├── index.vue             # Redirect ke /dashboard
│   ├── login.vue
│   ├── forgot-password.vue
│   ├── reset-password/[token].vue
│   ├── dashboard/
│   │   ├── index.vue         # Dashboard utama (KPI + grafik)
│   │   └── manager.vue       # Dashboard manajer
│   ├── master/
│   │   ├── items/
│   │   │   ├── index.vue     # List barang (AG Grid)
│   │   │   ├── new.vue       # Form tambah
│   │   │   └── [id]/
│   │   │       ├── index.vue # Detail (tabs)
│   │   │       └── edit.vue
│   │   ├── suppliers/[...].vue
│   │   ├── customers/[...].vue
│   │   ├── warehouses/
│   │   │   ├── index.vue
│   │   │   └── [id]/map.vue  # Grid interaktif
│   │   ├── locations/index.vue
│   │   └── users/index.vue
│   ├── inbound/
│   │   ├── purchase-orders/[...].vue
│   │   ├── grn/[...].vue
│   │   ├── putaway/[...].vue
│   │   └── returns/index.vue
│   ├── outbound/
│   │   ├── sales-orders/[...].vue
│   │   ├── pick-list/[...].vue
│   │   ├── packing/[id].vue
│   │   ├── shipping/[...].vue
│   │   └── returns/index.vue
│   ├── inventory/
│   │   ├── summary.vue
│   │   ├── movements.vue
│   │   ├── stocktake/[...].vue
│   │   ├── adjustments/[...].vue
│   │   ├── transfers/[...].vue
│   │   └── lots/index.vue
│   ├── accounting/
│   │   ├── coa.vue
│   │   ├── journal/[...].vue
│   │   ├── ledger.vue
│   │   ├── trial-balance.vue
│   │   ├── payables.vue
│   │   ├── receivables.vue
│   │   └── period-close.vue
│   ├── pos.vue               # Layout: pos
│   ├── monitoring/index.vue
│   ├── reports/[type].vue
│   ├── sync-status.vue
│   └── settings/[section].vue
│
├── plugins/
│   ├── pinia-persist.client.ts # pinia-plugin-persistedstate
│   ├── toast.client.ts         # vue-toastification
│   └── ag-grid.client.ts       # AG Grid Vue license + theme
│
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   └── sw.js                   # Service Worker (gen oleh vite-plugin-pwa)
│
├── server/                   # Nuxt server routes (BFF opsional)
│   └── api/                  # Proxy ke backend jika diperlukan
│
├── services/
│   ├── sync.ts               # SyncService: offline queue processing
│   ├── label.ts              # LabelService: ZPL generate + print
│   └── db.ts                 # Dexie.js instance (IndexedDB)
│
├── stores/
│   ├── auth.ts               # useAuthStore (Pinia)
│   ├── ui.ts                 # useUIStore
│   ├── notif.ts              # useNotifStore
│   ├── picking.ts            # usePickingStore
│   └── pos.ts                # usePOSStore (cart, shift, offline)
│
├── types/
│   ├── api.d.ts              # API response types
│   ├── models.d.ts           # Domain models: Item, PO, GRN, SO...
│   └── enums.ts              # Status enums, role enums
│
├── nuxt.config.ts            # Nuxt config: modules, runtimeConfig, pwa
├── tailwind.config.ts
├── vite.config.ts
└── vitest.config.ts

// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: { strict: true },

  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
    'nuxt-lodash',
  ],

  pinia: { storesDirs: ['./stores/**'] },

  vueuse: { ssrHandlers: true },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'WHMS — Warehouse Management System',
      short_name: 'WHMS',
      theme_color: '#1F4E79',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      runtimeCaching: [
        { urlPattern: /\/api\/.*/, handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 } }
      ]
    }
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3001',
      wsUrl:   process.env.WS_URL || 'http://localhost:3001',
    }
  },

  imports: {
    dirs: ['stores', 'composables', 'services']
  },

  components: [
    { path: '~/components/ui', prefix: 'Ui' },
    { path: '~/components/app', prefix: 'App' },
    { path: '~/components/forms', prefix: 'Form' },
    { path: '~/components/charts', prefix: 'Chart' },
  ],

  css: ['~/assets/css/main.css'],

  ssr: false, // SPA mode — semua render di client (warehouse app internal)
})