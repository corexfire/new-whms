# WHMS Frontend Development Checklist
*Berdasarkan spesifikasi `prompt.md`*

Gunakan checklist ini untuk melacak progres pembuatan Warehouse Management System (Vue 3 + Nuxt 3).
Berikan tanda `[x]` pada setiap item yang sudah selesai dikerjakan.

## 🌟 Fase 1: Inisialisasi & Setup Proyek
- [x] Inisialisasi proyek Nuxt 3 (`npx nuxi@latest init whms-frontend`)
- [x] Konfigurasi `nuxt.config.ts` dasar (SSR = false / SPA mode)
- [x] Install & konfigurasi Tailwind CSS 3 (`@nuxtjs/tailwindcss`)
- [x] Install & konfigurasi PrimeVue 4
- [x] Install & konfigurasi Pinia & Pinia Persisted State (`@pinia/nuxt`, `@pinia-plugin-persistedstate/nuxt`)
- [x] Install VueUse (`@vueuse/nuxt`)
- [x] Install PWA Plugin (`@vite-pwa/nuxt`) & konfigurasi manifest/workbox
- [x] Install dependencies UI/Forms: `vee-validate`, `zod`, `vue-toastification`, `ag-grid-vue3`
- [x] Install dependencies tambahan: `socket.io-client`, `@zxing/library`, `jsbarcode`, `vue-qrcode`, `dexie`, `echarts`

## 📁 Fase 2: Struktur Direktori & Konfigurasi Inti
- [x] Buat kerangka direktori: `assets`, `components`, `composables`, `layouts`, `middleware`, `pages`, `plugins`, `services`, `stores`, `types`
- [x] Setup `types/api.d.ts`, `types/models.d.ts`, `types/enums.ts`
- [x] Buat file styling dasar `assets/css/main.css` & `transitions.css`
- [x] Konfigurasi Vite & runtimeConfig di `nuxt.config.ts` (API Base, WS URL)

## 🔐 Fase 3: State Management, Auth & RBAC
- [x] Buat store `stores/auth.ts` (state: user, token, permissions)
- [x] Buat store `stores/ui.ts`, `stores/notif.ts`, `stores/picking.ts`, `stores/pos.ts`
- [x] Buat middleware `middleware/auth.ts` (Global: route protection & redirect ke `/login`)
- [x] Buat middleware `middleware/rbac.ts` (Per-route: validasi role/permission)
- [x] Buat composable `useApi.ts` ($fetch wrapper, handle 401 & error)
- [x] Buat composable `usePermission.ts` (`can()` & `hasRole()`)
- [x] Buat layout `layouts/auth.vue`
- [x] Buat halaman `/login`, `/forgot-password`, dan `/reset-password`

## 🧩 Fase 4: Core Layout & UI Components
- [x] Buat layout utama `layouts/default.vue`
- [x] Buat layout khusus `layouts/pos.vue` & `layouts/fullscreen.vue`
- [x] Buat komponen shell inti: `AppSidebar.vue`, `AppTopBar.vue`, `AppNotifPanel.vue`
- [x] Buat base UI components (Atomic): 
  - [x] `UiButton.vue`
  - [x] `UiInput.vue` / `UiCurrencyInput.vue`
  - [x] `UiSelect.vue` (Async + Search)
  - [x] `UiBadge.vue`
  - [x] `UiModal.vue`
  - [x] `UiDatePicker.vue`
  - [x] `UiFileUpload.vue`
  - [x] `UiSkeleton.vue`
- [x] Konfigurasi AG Grid (`plugins/ag-grid.client.ts` & `UiDataTable.vue`)
- [x] Konfigurasi Toast notification (`plugins/toast.client.ts`)

## 📡 Fase 5: Offline-First & Services Setup
- [x] Setup Dexie.js database (`services/db.ts`) (items, locations, picklists, offline queue)
- [x] Buat store Dexie (cache, synced metadata, dll)
- [x] Buat `services/sync.ts` (SyncService untuk memadukan queue dengan endpoint bulk API)
- [x] Buat composable `useOffline.ts` untuk pantau `isOnline` dan memicu Sync
- [x] Buat banner PWA / offline state: `AppOfflineBanner.vue`

## 📸 Fase 6: Hardware Intergration (Barcode, Socket, Printer)
- [x] Buat composable `useScanner.ts` (ZXing-js untuk kamera browser)
- [x] Setup Socket.io client (`plugins/socket.client.ts`)
- [x] Buat composable `useSocket.ts`
- [x] Setup Web Serial API / QZ Tray untuk Print Thermal (`utils/printer.ts`)
- [x] Buat `services/label.ts` dan/atau `usePrinter.ts` (Print ZPL / BullMQ / QZ Tray)
- [x] Buat komponen generator: `FormBarcode.vue` (JsBarcode / vue-qrcode)

## 🗃️ Fase 7: Master Data Management
- [x] Halaman Master Barang (`/master/items` - list, new, edit, detail var/lot)
- [x] Penanganan Relasi & Konversi UoM untuk Barang
- [x] Halaman Master Supplier & Customer
- [x] Halaman Hierarki Gudang & Lokasi Rak List
- [x] Halaman Master Role & User
- [x] Grid Map Gudang Interaktif (`/master/warehouses/[id]/map.vue`)
- [x] Halaman User Management & Roles (`/master/users`)

## 🚛 Fase 8: Modul Inbound (Barang Masuk)
- [x] Modul Purchase Orders (List, Detail, Cetak PO)
- [x] Buat form editable line items (`FormLineItems.vue`)
- [x] Modul Goods Receipt Note / GRN (Konversi PO → GRN)
- [x] Layar Putaway Items (Layout fullscreen mobile-friendly + kamera scanner)
- [x] Modul Supplier Returns

## 📦 Fase 9: Modul Outbound (Barang Keluar)
- [x] Modul Sales Orders (SO - List, Create, Approve)
- [x] Generate Pick List otomatis / alokasi stock otomatis
- [x] Layar Picking Barang (Fullscreen + verify dengan Scanner)
- [x] Layar Packing & Quality Control (Validasi isi packing)
- [x] Layar Shipping (Cetak label resi dengan barcode & tracking info)
- [x] Modul Customer Returns

## 📊 Fase 10: Modul Inventory & Analytics
- [x] Halaman Inventory Summary & Movements
- [x] Modul Stocktake / Opname (Proses hitung offline + approval manager)
- [x] Layar Stock Adjustments
- [x] Layar Internal / Inter-warehouse Transfers
- [x] Halaman Lot & Kedaluwarsa management (`/inventory/lots`)
- [x] Dashboard Utama (KPI, Grafik `ChartLine.vue`, Notifikasi Stok kritis)

## 🏪 Fase 11: Modul POS (Point of Sale)
- [x] Halaman `/pos` (Menggunakan layout `pos.vue`)
- [x] Product Grid Kasir + Cart (`PosProductGrid`, `PosCart`)
- [x] Manajemen Shift (`PosShiftManager` - open & closing cash)
- [x] Layar Pembayaran (`PosPaymentModal`, `PosQrisModal`)
- [x] Mekanisme Fallback POS ke Transaksi Offline (sinkronisasi saat online)

## 📓 Fase 12: Modul Accounting
- [x] Halaman Chart of Accounts (COA)
- [x] Daftar Transaksi Jurnal Otomatis / Manual Journal (`/accounting/journal`)
- [x] Buku Besar (Ledger) & Trial Balance
- [x] Modul AR (Receivables / Terima Bayar dari SO)
- [x] Modul AP (Payables / Pembayaran ke Supplier)

## 🚀 Fase 13: Finalisasi, Testing & Build
- [x] Tes sinkronisasi database offline → online (Sync Conflict Handling)
- [x] Review RBAC di setiap route penting
- [x] Review Journal Ledger Balancing logic (di integrasi form-form master/transaksi)
- [x] Unit Testing & E2E (Vitest / Playwright) jika diwajibkan
- [x] Check Manifest PWA dan Workbox offline caching
- [x] Test Build untuk Production (`npx nuxi build`)
