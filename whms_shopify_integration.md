# WHMS ↔ Shopify Integration (Technical Documentation)

## 1) Scope
Dokumen ini menjelaskan setup, konfigurasi, dan troubleshooting integrasi Shopify pada WHMS, termasuk:
- OAuth connection + token management
- Flagging data (membedakan data lokal vs data dari Shopify)
- Sync pull/push (Products, Inventory, Orders, Customers) via queue + retry
- Audit log sync
- Webhook inventory real-time
- CRUD proxy endpoints untuk Products/Collections/Orders

## 2) Prerequisites
- Shopify store (domain `*.myshopify.com`)
- Shopify App (Custom App / Public App) dengan Admin API access
- Backend WHMS dapat diakses publik untuk callback OAuth dan webhooks (ngrok/reverse proxy untuk environment dev)
- Redis aktif (untuk BullMQ queue). Jika Redis tidak aktif, WHMS akan fallback menjalankan sync secara inline (tanpa retry queue).
- PostgreSQL aktif

## 3) Environment Variables (Backend)
Set di `whms-backend/.env` (contoh ada di `whms-backend/.env.example`):

- `BACKEND_PUBLIC_URL`
  - Base URL backend yang bisa diakses Shopify untuk webhooks.
  - Contoh: `https://your-public-backend.example.com`

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- Penting:
  - `SHOPIFY_API_KEY` dan `SHOPIFY_API_SECRET` adalah kredensial app untuk OAuth (public app / dev dashboard), bukan “Admin API access token”.
  - Jangan memasukkan token `shpat_.../shpca_...` ke `SHOPIFY_API_SECRET`.
- `SHOPIFY_SCOPES`
  - Default: `read_products,write_products,read_inventory,write_inventory,read_orders,write_orders`

- `SHOPIFY_API_VERSION`
  - Contoh valid: `2026-01`, `2025-10`, dst (mengikuti versi Admin API yang dipilih).
  - Referensi: https://shopify.dev/docs/api/admin-rest

- `SHOPIFY_REDIRECT_URI`
  - Harus persis sama dengan callback URL yang didaftarkan di Shopify App.
  - Contoh: `https://your-public-backend.example.com/api/integrations/shopify/oauth/callback`

- `SHOPIFY_TOKEN_ENCRYPTION_KEY`
  - Digunakan untuk enkripsi token di DB (AES-256-GCM).

## 4) Database Schema
Integrasi menambahkan field `dataSource` pada:
- `Item.dataSource` (LOCAL | SHOPIFY)
- `Product.dataSource` (LOCAL | SHOPIFY)
- `SalesOrder.dataSource` (LOCAL | SHOPIFY)

Dan tabel integrasi Shopify:
- `ShopifyStore` (koneksi toko + token)
- `ShopifyOAuthState` (CSRF state untuk OAuth)
- `ShopifyItemMapping` (mapping `Item` ↔ product/variant/inventory_item Shopify)
- `ShopifyOrderMapping` (mapping `SalesOrder` ↔ order Shopify)
- `ShopifyLocationMapping` (mapping `Warehouse` ↔ location Shopify)
- `ShopifySyncJob` (job queue)
- `ShopifyAuditLog` (audit log)
- `ShopifyWebhookSubscription` (tracking webhook)
- `ShopifyWebhookEvent` (idempotency webhook)

Setelah update schema:
- Jalankan `prisma generate`
- Terapkan perubahan schema ke DB (migrate/db push sesuai workflow tim)

## 5) UI (Frontend)
Menu:
- Integrations → Shopify - Connection
- Integrations → Shopify - Sync
- Integrations → Shopify - Settings
- Integrations → Shopify - Logs

## 6) Cara Connect (2 Mode)

### 6.1 Public App (OAuth)
1. User login ke WHMS (role: SUPER_ADMIN/MANAGER).
2. Buka `Integrations → Shopify - Connection`.
3. Input `shop` (misal: `my-store.myshopify.com`) → klik Connect.
4. WHMS memanggil:
   - `GET /api/integrations/shopify/oauth/start?shop=...`
5. Browser redirect ke Shopify authorize URL.
6. Shopify redirect balik ke:
   - `GET /api/integrations/shopify/oauth/callback?shop=...&code=...&state=...&hmac=...`
7. WHMS:
   - Validasi `hmac`
   - Validasi `state` (anti-CSRF)
   - Exchange `code` → `access_token`
   - Simpan token terenkripsi ke `ShopifyStore`
8. Redirect ke halaman frontend connection.

Jika public app belum lolos review, Shopify bisa memblok instalasi pada store live dengan pesan “needs to be reviewed by Shopify”.

Referensi: https://community.shopify.dev/t/shopify-app-installation-and-access/13535

### 6.2 Custom App (Manual Token / Tanpa App Review)
Mode ini berguna untuk integrasi 1 store (internal) tanpa menunggu review public app.

**Link resmi Shopify untuk token custom app:**
- Admin API access tokens (custom app): https://shopify.dev/docs/apps/auth/admin-app-access-tokens
- REST Admin API authentication: https://shopify.dev/docs/api/admin-rest#authentication

**Langkah mendapatkan Admin API access token:**
1. Shopify Admin → Apps → Develop apps → buat/pilih Custom App.
2. Configure Admin API scopes sesuai kebutuhan (minimal `read_products` untuk pull products).
3. Klik Save.
4. Klik Install app (wajib).
5. Copy “Admin API access token” (biasanya prefix `shpca_...` atau `shpat_...`).

**Simpan token ke WHMS (disimpan di DB, bukan di .env):**
- UI: Integrations → Shopify - Connection → “Alternatif: Custom App Token”
- API:
  - `POST /api/integrations/shopify/connection/manual` body `{ "shop": "xxx.myshopify.com", "accessToken": "shpca_/shpat_..." }`

WHMS akan memvalidasi token dengan request `GET /shop.json` sebelum menyimpannya.

## 7) Webhooks (Real-time Inventory)
Endpoint webhook:
- `POST /api/integrations/shopify/webhooks/inventory_levels_update`
- `POST /api/integrations/shopify/webhooks/app_uninstalled`

Verifikasi webhook:
- Header `X-Shopify-Hmac-Sha256` diverifikasi menggunakan `SHOPIFY_API_SECRET` dan raw body.

Registrasi webhook dari WHMS:
- `POST /api/integrations/shopify/webhooks/ensure`
  - Membuat/menjaga webhook untuk:
    - `inventory_levels/update`
    - `app/uninstalled`

Idempotency:
- `X-Shopify-Webhook-Id` disimpan di `ShopifyWebhookEvent`. Duplikasi tidak diproses ulang.

Race/Conflict:
- Payload `updated_at` dibandingkan dengan `ShopifyItemMapping.lastShopifyInventoryUpdatedAt`. Update yang lebih lama akan di-skip.

## 8) Sync (Queue + Retry)
Trigger endpoint:
- Pull:
  - `POST /api/integrations/shopify/sync/pull` body `{ "type": "PRODUCTS" | "INVENTORY" | "ORDERS" | "CUSTOMERS" }`
- Push:
  - `POST /api/integrations/shopify/sync/push` body `{ "type": "PRODUCTS" | "INVENTORY" | "ORDERS" }`

Queue:
- BullMQ queue: `ShopifySyncQueue`
- Retry: exponential backoff
- Jika Redis tidak tersedia, endpoint sync akan fallback memproses job secara inline (tanpa queue).

Monitoring:
- `GET /api/integrations/shopify/sync/jobs`
- `GET /api/integrations/shopify/logs`

## 9) Location Mapping & Default Warehouse
Untuk inventory sync diperlukan:
1. Pilih `Default Warehouse` di halaman Settings.
2. Mapping warehouse tersebut ke Shopify location (Settings → Location Mapping).

Jika mapping tidak ada:
- push/pull inventory akan error dan tercatat di audit log.

Catatan:
- Mapping bersifat 1:1 untuk per store: satu `shopifyLocationId` hanya boleh dipakai oleh satu warehouse WHMS.

## 10) CRUD Proxy Endpoints (Shopify API)
Endpoint proxy (butuh auth):
- Products:
  - `GET /api/integrations/shopify/products`
  - `POST /api/integrations/shopify/products`
  - `PUT /api/integrations/shopify/products/:id`
  - `DELETE /api/integrations/shopify/products/:id`
- Collections (kategori Shopify berbasis custom_collections):
  - `GET /api/integrations/shopify/collections`
  - `POST /api/integrations/shopify/collections`
  - `PUT /api/integrations/shopify/collections/:id`
  - `DELETE /api/integrations/shopify/collections/:id`
- Orders:
  - `GET /api/integrations/shopify/orders`
  - `POST /api/integrations/shopify/orders`
  - `GET /api/integrations/shopify/orders/:id`
  - `PUT /api/integrations/shopify/orders/:id`
  - `POST /api/integrations/shopify/orders/:id/cancel`
  - `POST /api/integrations/shopify/orders/:id/close`
  - `DELETE /api/integrations/shopify/orders/:id`

## 11) Di mana melihat data hasil pull Shopify?
Item hasil pull products akan masuk ke master items WHMS:
- UI: Master Data → Items
- Ciri: field `Item.dataSource = SHOPIFY`

Customer hasil pull customers akan masuk ke master customers WHMS:
- UI: Master Data → Customers
- Ciri: `Customer.code` berformat `SHOPIFY-<shopifyCustomerId>`

Order hasil pull orders akan masuk ke Sales Order:
- UI: Outbound → Sales Orders
- Ciri: field `SalesOrder.dataSource = SHOPIFY`

## 12) Reset Data (Hapus Semua Data Kecuali Login)
Tujuan: menyiapkan database kosong untuk simulasi end-to-end, tapi tetap bisa login.

Perintah dijalankan dari folder backend:
- Reset data saja (keep login, tanpa mengubah user/role/permission):
  - `npx tsx prisma/seed.ts --reset-keep-auth-only`
- Reset data (keep login) + seed auth saja (membuat role/permission & admin jika dibutuhkan):
  - `npx tsx prisma/seed.ts --reset-keep-auth --auth-only`
- Reset data (keep login) + reseed demo data default:
  - `npx tsx prisma/seed.ts --reset-keep-auth`

Catatan:
- Reset ini akan mengosongkan semua tabel di schema `public` kecuali `User`, `Role`, `Permission`, tabel relasi role-permission, dan tabel migrasi Prisma.
- Koneksi Shopify akan ikut terhapus, jadi setelah reset perlu connect ulang.

## 13) Step Pengujian (Simulasi Aplikasi + Integrasi Shopify)
Berikut alur pengujian yang disarankan untuk memastikan relasi modul berjalan dan integrasi Shopify tervalidasi.

### 13.1 Persiapan
1. Reset data (opsional tapi direkomendasikan untuk simulasi bersih):
   - `npx tsx prisma/seed.ts --reset-keep-auth --auth-only`
2. Jalankan backend + frontend (dev).
3. Login menggunakan user yang tersedia (SUPER_ADMIN/MANAGER).

### 13.2 Setup Master Data Minimum (WHMS)
1. Master Data → Warehouses: buat 1 warehouse (misal `WH01`).
2. Master Data → Storage Locations: buat minimal 1 lokasi aktif di warehouse tersebut.
3. Master Data → Items:
   - Buat minimal 1 item lokal (SKU wajib) untuk kebutuhan pengujian inventory/penjualan.
4. Master Data → Customers & Suppliers:
   - Buat 1 customer & 1 supplier lokal (untuk pengujian flow inbound/outbound lokal).

### 13.3 Setup Integrasi Shopify
1. Integrations → Shopify - Connection:
   - Connect via OAuth atau Custom App Token.
2. Integrations → Shopify - Settings:
   - Set Default Warehouse.
   - Mapping warehouse → Shopify Location.
   - Aktifkan opsi auto-create (jika ingin pull products/orders otomatis membuat data).

### 13.4 Pengujian Sync Pull (Shopify → WHMS)
1. Integrations → Shopify - Sync:
   - Pull Products
   - Validasi:
     - Master Data → Items bertambah (dataSource SHOPIFY).
     - Mapping Shopify item terbuat (dipakai untuk push inventory).
2. Pull Customers
   - Validasi:
     - Master Data → Customers bertambah.
     - `Customer.code` menggunakan `SHOPIFY-...`.
3. Pull Orders
   - Validasi:
     - Outbound → Sales Orders bertambah (dataSource SHOPIFY).
4. Pull Inventory
   - Validasi:
     - Inventory → Stock Summary berubah sesuai stok Shopify untuk location yang dipetakan.

### 13.5 Pengujian Sync Push (WHMS → Shopify)
1. Pastikan Pull Products sudah dilakukan (agar ada mapping inventory_item_id).
2. Inventory → Adjustments:
   - Buat adjustment untuk item yang berasal dari Shopify (atau item yang sudah punya mapping).
3. Integrations → Shopify - Sync:
   - Push Inventory
4. Validasi di Shopify Admin:
   - Stok variant berubah di location yang sama.

### 13.6 Pengujian Webhook Inventory (Real-time)
1. Integrations → Shopify - Settings/Logs:
   - Pastikan webhook sudah didaftarkan (atau panggil endpoint ensure webhook).
2. Ubah stok di Shopify (Adjust quantity).
3. Validasi di WHMS:
   - Inventory → Stock Summary ikut berubah.
   - Integrations → Shopify - Logs mencatat event webhook.

### 13.7 Observability (Wajib untuk pengujian)
1. Integrations → Shopify - Sync:
   - Cek “Recent Sync Jobs” untuk status QUEUED/RUNNING/SUCCESS/FAILED.
2. Integrations → Shopify - Logs:
   - Audit trail untuk sync started/finished/failed dan error detail.

## 14) Relasi Antar Modul/Menu (Ringkasan untuk Pengujian)
Menu utama dan relasinya (berdasarkan alur data):
- Master Data
  - Items: pusat referensi SKU untuk inbound/outbound/inventory/Shopify mapping.
  - Warehouses & Storage Locations: dipakai oleh inventory, putaway, transfer, dan Shopify location mapping.
  - Customers: dipakai oleh Sales Orders (lokal) dan juga target pull Customers dari Shopify.
  - Suppliers: dipakai oleh Purchase Orders dan proses inbound.
- Inbound
  - Purchase Orders → Goods Receipt Note → Putaway Task → berdampak ke Inventory (stock on hand).
- Outbound
  - Sales Orders → Pick Lists → Packing Station → Shipping & Delivery → berdampak ke Inventory movements.
- Inventory
  - Stock Summary sebagai output akhir dari inbound/outbound/adjustments/transfer dan juga inventory sync dari Shopify.
  - Adjustments untuk simulasi perubahan stok sebelum push inventory ke Shopify.
- POS
  - Transaksi POS akan mengurangi inventory dan menambah data penjualan.
- Integrations → Shopify
  - Connection menghasilkan `ShopifyStore`.
  - Settings mengikat warehouse ↔ location Shopify (prasyarat inventory sync).
  - Sync menghasilkan master data (Items/Customers/Sales Orders) dan update Inventory.
  - Logs untuk verifikasi semua skenario di atas.

## 15) Troubleshooting
1. OAuth redirect error / invalid state
   - Pastikan `SHOPIFY_REDIRECT_URI` sama persis dengan yang didaftarkan pada Shopify App.
   - Pastikan server time tidak jauh (state expiry 10 menit).

2. Webhook 401 invalid HMAC
   - Pastikan `SHOPIFY_API_SECRET` benar.
   - Pastikan backend menyimpan raw body untuk route webhook (harus melalui endpoint yang disediakan).

3. Sync queue unavailable / Redis tidak aktif
   - Redis belum jalan atau `REDIS_URL` salah.
   - WHMS akan menjalankan sync mode inline (tanpa queue) atau bisa tetap error jika ada error Shopify API.

4. Inventory sync gagal (missing mapping)
   - Set `Default Warehouse` dan mapping ke Shopify Location di Settings.

5. Item tidak terbuat saat pull
   - Pastikan `Auto-create Items from Shopify` aktif.
   - Pastikan SKU di Shopify terisi.

6. Shopify API 401 “Invalid API key or access token”
   - Ini berarti token yang dipakai untuk `X-Shopify-Access-Token` salah.
   - Pastikan kamu memakai “Admin API access token” dari custom app (bukan `SHOPIFY_API_SECRET` yang prefix-nya sering `shpss_`).
   - Referensi perbedaan token/prefix (community): https://community.shopify.dev/t/token-not-working/25653

7. App “needs to be reviewed by Shopify”
   - Jika public app belum lolos review, instalasi pada store live bisa diblok.
   - Solusi cepat untuk internal: gunakan mode “Custom App (Manual Token)”.
   - Referensi: https://community.shopify.dev/t/shopify-app-installation-and-access/13535
