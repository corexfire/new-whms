# WHMS Backend Development Checklist
*Berdasarkan spesifikasi `prompt.md`*

Gunakan checklist ini untuk melacak progres pembuatan Warehouse Management System Backend (Node.js + Express + Prisma + TypeScript).
Berikan tanda `[x]` pada setiap item yang sudah selesai dikerjakan.

## 🌟 Fase 1: Inisialisasi & Setup Proyek
- [x] Inisialisasi proyek Node.js (`npm init -y`) di folder `whms-backend`
- [x] Install TypeScript & Setup `tsconfig.json` (Target: ES2022, module: CommonJS/NodeNext)
- [x] Install Express.js & tipe datanya (`express`, `@types/express`)
- [x] Setup lingkungan development (Nodemon / `tsx`, ESLint, Prettier, `.env`)
- [x] Setup Prisma ORM (`npm i -D prisma`, `npx prisma init`)
- [x] Konfigurasi koneksi PostgreSQL 16 di `.env` dan `schema.prisma`

## 📦 Fase 2: Database & Prisma Schema Design
- [x] Desain schema Prisma untuk Identitas & Auth (User, Role, Permission)
- [x] Desain schema Prisma untuk Master Data (Item, UoM, Category, Customer, Supplier, Warehouse, Location)
- [x] Desain schema Prisma untuk Inbound (PurchaseOrder, POItem, GRN, GRNItem)
- [x] Desain schema Prisma untuk Outbound (SalesOrder, SOItem, PickList, PickListItem)
- [x] Desain schema Prisma untuk Inventory & Tracking (Inventory, StockMovement, Lot, Serial)
- [x] Desain schema Prisma untuk Accounting (Account, JournalEntry, AR, AP)
- [x] Desain schema Prisma untuk Offline Sync (SyncMetadata, OfflineAction)
- [x] Jalankan migrasi awal (`npx prisma migrate dev --name init`)
- [x] Buat skrip seeder awal (Admin User, Roles, Master Data dasar)

## 🔐 Fase 3: Auth & Security (JWT + RBAC)
- [x] Setup struktur arsitektur: routes, controllers, services, middlewares
- [x] Buat Auth Service (Login, Register, Refresh Token) menggunakan `jsonwebtoken` dan `bcrypt`
- [x] Buat Middleware Autentikasi (`verifyToken`)
- [x] Buat Middleware Otorisasi / RBAC (`checkRole`, `checkPermission`)
- [x] Buat endpoint Profile & Update Password
- [x] Implementasi rate limiting & security headers (`helmet`, `cors`, `express-rate-limit`)

## 🏗️ Fase 4: Core Services & Integrations
- [x] Setup Redis 7 connection client (`ioredis`)
- [x] Setup BullMQ Queue Workers untuk asynchronous tasks (Background jobs)
- [x] Setup Socket.IO 4 server & Auth middleware untuk WebSocket
- [x] Setup MinIO/S3 client untuk Object Storage (Upload gambar/file)
- [x] Setup Nodemailer untuk pengiriman email (Resi, Notifikasi)
- [x] Setup Puppeteer & ExcelJS service untuk PDF & Excel Export

## 🏷️ Fase 5: Barcode & Label Service
- [x] Buat API Endpoint untuk generate JsBarcode format (Code-128, EAN-13, dll)
- [x] Buat ZPL / QZ Tray payload generator (integrasi dengan BullMQ printer queue)
- [x] Endpoint untuk simpan/load konfigurasi template label

## 📋 Fase 6: Master Data API & Controllers
- [x] API CRUD Items (dukungan multi-UoM conversion & varian/lot)
- [x] API CRUD Customers & Suppliers
- [x] API Hierarki Warehouse, Zone, Aisle, Rack, Bin (Location)
- [x] API Users & Role Management

## 🚛 Fase 7: Inbound (PO & GRN) API
- [x] API Purchase Orders (Draft, Approved, Closed)
- [x] API Penerimaan Barang / GRN (Goods Receipt Note)
- [x] Logika integrasi: GRN update Stock `+` tambah mutasi
- [x] Integrasi Jurnal Otomatis saat GRN Complete (Debit Inventory, Credit AP)
- [x] API Retur Supplier

## 📦 Fase 8: Outbound (SO & Picking) API
- [x] API Sales Orders (Draft, Picking, Shipped)
- [x] Algoritma Auto-Allocation untuk generate PickList berdasarkan lokasi & lot/FIFO
- [x] API Konfirmasi Picking (dari scanner user) & Validasi Packing
- [x] Translasi Jurnal SO Shipped (Revenue, HPP, AR, Inventory)
- [x] Tracking Resi pengiriman via Shipper integration (opsional)

## 🔄 Fase 9: Inventory, Stocktake & Monitoring API
- [x] API Rangkuman Stok (on-hand, allocated, available) & Riwayat pergerakan (Movements)
- [x] API Stocktake / Opname (Generate hitungan, verifikasi selisih, approval)
- [x] API Adjustments (Hilang / Rusak) & Internal Transfers antar Gudang
- [x] Socket.io event triggers untuk notifikasi stok kritis ke admin

## 🏪 Fase 10: Point of Sale (POS) API
- [x] API Checkout Kasir (Offline Sync Queue Processor)
- [x] API Validasi Shift Kasir (Open / Close shift & rekonsiliasi kas)
- [x] Integrasi otomatis jurnal POS (Kas, Revenue, HPP, Inventory)
- [x] Endpoint untuk sinkronisasi massal data offline (Bulk API)

## 📓 Fase 11: Accounting API
- [x] CRUD Chart of Accounts (COA)
- [x] Journal API: Endpoint manual entry (dengan validator trial balance = 0 toleransi 0.01)
- [x] API Ledger & Trial Balance Report (Hitung Mutasi)
- [x] API Account Receivable (AR) & Account Payable (AP) tracking & receipt

## 🚀 Fase 12: Finalisasi, Testing & Production
- [x] Tulis Unit & Integration Tests (Jest) untuk core services
- [x] Buat Dokumentasi API (Swagger / OpenAPI 3.0)
- [x] Konfigurasi Dockerfile & `docker-compose.yml` untuk deployment
- [x] Setup CI/CD pipelining dasar
- [x] Load Testing / Pen-Testing endpoint kritis
