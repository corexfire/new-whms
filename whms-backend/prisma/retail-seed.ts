/**
 * retail-seed.ts
 * -------------------------------------------------
 * Comprehensive seed data for all WMS operational modules:
 *  - Purchase Orders + GRN + Putaway
 *  - Sales Orders + PickList + Shipment
 *  - Supplier Returns + Customer Returns
 *  - Stocktake + Stock Adjustments
 *  - Item Lots (for /inventory/lots)
 *  - Stock Movements (for /inventory/cogs)
 *
 * Run: npx tsx prisma/retail-seed.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function pad(n: number, len = 5) { return String(n).padStart(len, '0'); }

async function main() {
  console.log('\n🚀 Starting retail operational seed...\n');

  // ── Load existing master data ──────────────────────────────────────────────
  const items = await prisma.item.findMany({
    take: 15,
    orderBy: { sku: 'asc' },
    include: { uoms: { include: { uom: true } } }
  });
  if (items.length === 0) throw new Error('No items found — run main seed first.');

  const suppliers = await prisma.supplier.findMany({ take: 5 });
  const customers = await prisma.customer.findMany({ take: 8 });
  const warehouses = await prisma.warehouse.findMany({ where: { isActive: true } });
  const locations = await prisma.location.findMany({ where: { isActive: true }, include: { warehouse: true } });

  const whMain = warehouses.find(w => w.code === 'WH01') || warehouses[0];
  const whReturn = warehouses.find(w => w.code === 'WH04') || warehouses[warehouses.length - 1];

  const locRec = locations.find(l => l.warehouseId === whMain.id && l.code.includes('REC')) || locations.find(l => l.warehouseId === whMain.id);
  const locQC  = locations.find(l => l.warehouseId === whMain.id && l.code.includes('QC'))  || locRec;
  const locMain = locations.find(l => l.warehouseId === whMain.id && l.code.includes('A-01')) || locRec;
  const locShip = locations.find(l => l.warehouseId === whMain.id && l.code.includes('SHP')) || locMain;
  const locRet   = locations.find(l => l.warehouseId === whReturn.id && l.code.includes('RET')) || locations[0];

  if (!locRec || !locMain) throw new Error('Locations not found — run main seed first.');

  const uomPcs = await prisma.uoM.findUnique({ where: { code: 'PCS' } });
  if (!uomPcs) throw new Error('UoM PCS not found.');

  // ── 1. ITEM LOTS ──────────────────────────────────────────────────────────
  console.log('📦  Seeding Item Lots...');
  const lots: any[] = [];
  const lotSeeds = [
    { item: items[0], lot: 'LOT-2025-001', expiry: daysFromNow(180) },
    { item: items[1], lot: 'LOT-2025-002', expiry: daysFromNow(120) },
    { item: items[2], lot: 'LOT-2025-003', expiry: daysFromNow(240) },
    { item: items[3], lot: 'LOT-2025-004', expiry: daysFromNow(90) },
    { item: items[4], lot: 'LOT-2025-005', expiry: daysFromNow(60) },
    { item: items[5], lot: 'LOT-2025-006', expiry: daysFromNow(300) },
    { item: items[6], lot: 'LOT-2025-007', expiry: daysFromNow(150) },
    { item: items[7], lot: 'LOT-2025-008', expiry: daysFromNow(365) },
    { item: items[8], lot: 'LOT-2025-009', expiry: daysFromNow(45) },
    { item: items[9], lot: 'LOT-2025-010', expiry: daysFromNow(200) },
  ];
  for (const l of lotSeeds) {
    const existing = await prisma.itemLot.findFirst({ where: { lotNumber: l.lot } });
    if (!existing) {
      const created = await prisma.itemLot.create({
        data: {
          itemId: l.item.id,
          lotNumber: l.lot,
          expiryDate: l.expiry,
          manufactured: daysAgo(30),
          isActive: true,
        }
      });
      lots.push(created);
    } else {
      lots.push(existing);
    }
  }
  console.log(`   ✅  ${lots.length} lots seeded.`);

  // ── 2. PURCHASE ORDERS ──────────────────────────────────────────────────────
  console.log('🛒  Seeding Purchase Orders...');
  const poStatuses = ['APPROVED', 'APPROVED', 'CLOSED', 'PARTIAL', 'APPROVED', 'CLOSED', 'APPROVED', 'CLOSED', 'APPROVED', 'CLOSED'];
  const createdPOs: any[] = [];

  for (let i = 0; i < 10; i++) {
    const sup = suppliers[i % suppliers.length];
    const poNumber = `PO-2025-${pad(i + 1)}`;
    const qty1 = rnd(10, 50);
    const qty2 = rnd(5, 30);
    const item1 = items[i % items.length];
    const item2 = items[(i + 1) % items.length];
    const price1 = item1.uoms[0]?.price || 50000;
    const price2 = item2.uoms[0]?.price || 75000;
    const total = qty1 * price1 + qty2 * price2;

    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (!existing) {
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: sup.id,
          orderDate: daysAgo(30 - i * 2),
          expectedDate: daysAgo(20 - i * 2),
          status: poStatuses[i],
          totalAmount: total,
          items: {
            create: [
              { itemId: item1.id, quantity: qty1, unitPrice: price1, totalPrice: qty1 * price1 },
              { itemId: item2.id, quantity: qty2, unitPrice: price2, totalPrice: qty2 * price2 },
            ]
          }
        },
        include: { items: true }
      });
      createdPOs.push(po);
    } else {
      const po = await prisma.purchaseOrder.findUnique({ where: { poNumber }, include: { items: true } });
      if (po) createdPOs.push(po);
    }
  }
  console.log(`   ✅  ${createdPOs.length} POs seeded.`);

  // ── 3. GOODS RECEIPT NOTES (GRN) ──────────────────────────────────────────
  console.log('📥  Seeding GRNs...');
  const createdGRNs: any[] = [];

  for (let i = 0; i < 10; i++) {
    const po = createdPOs[i];
    const grnNumber = `GRN-2025-${pad(i + 1)}`;
    const existing = await prisma.goodsReceipt.findUnique({ where: { grnNumber } });
    if (!existing) {
      const grn = await prisma.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: po.id,
          receiptDate: daysAgo(25 - i * 2),
          status: i < 8 ? 'COMPLETED' : 'DRAFT',
          notes: `Penerimaan barang untuk PO ${po.poNumber}`,
          items: {
            create: po.items.map((poi: any) => ({
              poItemId: poi.id,
              itemId: poi.itemId,
              receivedQty: Math.floor(poi.quantity * (i < 8 ? 1 : 0.5)),
            }))
          }
        },
        include: { items: true }
      });
      createdGRNs.push(grn);
    } else {
      const grn = await prisma.goodsReceipt.findUnique({ where: { grnNumber }, include: { items: true } });
      if (grn) createdGRNs.push(grn);
    }
  }
  console.log(`   ✅  ${createdGRNs.length} GRNs seeded.`);

  // ── 4. PUTAWAY TASKS ────────────────────────────────────────────────────────
  console.log('📋  Seeding Putaway Tasks...');
  for (let i = 0; i < 10; i++) {
    const grn = createdGRNs[i];
    const putawayNumber = `PTA-2025-${pad(i + 1)}`;
    const existing = await prisma.putawayTask.findUnique({ where: { putawayNumber } });
    if (!existing) {
      const po = createdPOs[i];
      await prisma.putawayTask.create({
        data: {
          putawayNumber,
          goodsReceiptId: grn.id,
          fromLocationId: locRec!.id,
          status: i < 8 ? 'COMPLETED' : 'DRAFT',
          notes: `Putaway dari GRN ${grn.grnNumber}`,
          completedAt: i < 8 ? daysAgo(23 - i * 2) : null,
          items: {
            create: po.items.map((poi: any) => ({
              itemId: poi.itemId,
              quantity: poi.quantity,
              toLocationId: locMain!.id,
              status: i < 8 ? 'ASSIGNED' : 'PENDING',
            }))
          }
        }
      });
    }
  }
  console.log(`   ✅  10 Putaway tasks seeded.`);

  // ── 5. SUPPLIER RETURNS ───────────────────────────────────────────────────
  console.log('↩️   Seeding Supplier Returns...');
  const returnReasons = ['DEFECTIVE', 'WRONG_ITEM', 'OVERDELIVERY', 'DAMAGE_IN_TRANSIT', 'QUALITY_ISSUE'];
  for (let i = 0; i < 10; i++) {
    const sup = suppliers[i % suppliers.length];
    const item = items[i % items.length];
    const returnNumber = `SR-2025-${pad(i + 1)}`;
    const existing = await prisma.supplierReturn.findUnique({ where: { returnNumber } });
    if (!existing) {
      await prisma.supplierReturn.create({
        data: {
          returnNumber,
          supplierId: sup.id,
          reason: returnReasons[i % returnReasons.length],
          status: i < 7 ? (i < 5 ? 'COMPLETED' : 'SUBMITTED') : 'DRAFT',
          items: {
            create: [{
              itemId: item.id,
              quantity: rnd(1, 10),
              notes: 'Barang cacat / tidak sesuai spesifikasi. Perlu ditukar dengan barang baru.',
            }]
          }
        }
      });
    }
  }
  console.log(`   ✅  10 Supplier Returns seeded.`);

  // ── 6. SALES ORDERS ───────────────────────────────────────────────────────
  console.log('💼  Seeding Sales Orders...');
  const soStatuses = ['SHIPPED', 'DELIVERED', 'PACKED', 'SHIPPED', 'DELIVERED', 'PICKING', 'APPROVED', 'DELIVERED', 'SHIPPED', 'PACKED'];
  const createdSOs: any[] = [];

  for (let i = 0; i < 10; i++) {
    const cus = customers[i % customers.length];
    const soNumber = `SO-2025-${pad(i + 1)}`;
    const item1 = items[i % items.length];
    const item2 = items[(i + 2) % items.length];
    const qty1 = rnd(1, 5);
    const qty2 = rnd(1, 3);
    const price1 = (item1.uoms[0]?.price || 100000) * 1.35;
    const price2 = (item2.uoms[0]?.price || 80000) * 1.35;
    const total = qty1 * price1 + qty2 * price2;

    const existing = await prisma.salesOrder.findUnique({ where: { soNumber } });
    if (!existing) {
      const so = await prisma.salesOrder.create({
        data: {
          soNumber,
          customerId: cus.id,
          orderDate: daysAgo(20 - i),
          status: soStatuses[i],
          totalAmount: total,
          items: {
            create: [
              { itemId: item1.id, quantity: qty1, unitPrice: price1, totalPrice: qty1 * price1 },
              { itemId: item2.id, quantity: qty2, unitPrice: price2, totalPrice: qty2 * price2 },
            ]
          }
        },
        include: { items: true, customer: true }
      });
      createdSOs.push(so);
    } else {
      const so = await prisma.salesOrder.findUnique({ where: { soNumber }, include: { items: true, customer: true } });
      if (so) createdSOs.push(so);
    }
  }
  console.log(`   ✅  ${createdSOs.length} Sales Orders seeded.`);

  // ── 7. PICK LISTS ─────────────────────────────────────────────────────────
  console.log('📝  Seeding Pick Lists...');
  const createdPLs: any[] = [];

  for (let i = 0; i < 10; i++) {
    const so = createdSOs[i];
    const pickNumber = `PKL-2025-${pad(i + 1)}`;
    const existing = await prisma.pickList.findUnique({ where: { pickNumber } });
    const plStatus = i < 8 ? 'COMPLETED' : 'IN_PROGRESS';
    if (!existing) {
      const pl = await prisma.pickList.create({
        data: {
          pickNumber,
          salesOrderId: so.id,
          status: plStatus,
          items: {
            create: so.items.map((soi: any) => ({
              soItemId: soi.id,
              locationId: locMain!.id,
              quantity: soi.quantity,
              pickedQty: i < 8 ? soi.quantity : 0,
            }))
          }
        },
        include: { items: true }
      });
      createdPLs.push(pl);
    } else {
      const pl = await prisma.pickList.findUnique({ where: { pickNumber }, include: { items: true } });
      if (pl) createdPLs.push(pl);
    }
  }
  console.log(`   ✅  ${createdPLs.length} Pick Lists seeded.`);

  // ── 8. SHIPMENTS ──────────────────────────────────────────────────────────
  console.log('🚚  Seeding Shipments...');
  const carriers = ['JNE REG', 'J&T Express', 'SiCepat HALU', 'Anteraja', 'GoPosKil', 'Ninja Xpress', 'Lion Parcel', 'RPX', 'Pos Indonesia', 'SAP Express'];
  const shipStatuses = ['DELIVERED', 'DELIVERED', 'IN_TRANSIT', 'DELIVERED', 'PICKED_UP', 'DELIVERED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PENDING', 'DELIVERED'];

  for (let i = 0; i < 10; i++) {
    const so = createdSOs[i];
    const awbNumber = `AWB-${new Date().getFullYear()}${pad(i + 1, 6)}`;
    const existing = await prisma.shipment.findUnique({ where: { awbNumber } });
    if (!existing) {
      const shipment = await prisma.shipment.create({
        data: {
          awbNumber,
          salesOrderId: so.id,
          carrier: carriers[i % carriers.length],
          trackingNumber: `TRK${pad(100000 + i, 8)}`,
          recipientName: so.customer!.name,
          recipientPhone: so.customer!.phone || '0812-1234-5678',
          recipientAddress: so.customer!.address || 'Jakarta, Indonesia',
          weight: rnd(3, 25) * 100 / 100,
          notes: i % 3 === 0 ? 'Fragile — handle with care' : null,
          status: shipStatuses[i],
        }
      });
      // Add tracking history for completed shipments
      if (i < 8) {
        await prisma.shipmentTracking.create({
          data: {
            shipmentId: shipment.id,
            status: 'PICKED_UP',
            location: 'Gudang Pusat Cikarang',
            description: 'Paket diambil oleh kurir',
            timestamp: daysAgo(10 - i),
          }
        });
        if (i < 6) {
          await prisma.shipmentTracking.create({
            data: {
              shipmentId: shipment.id,
              status: 'DELIVERED',
              location: so.customer!.address || 'Jakarta',
              description: 'Paket diterima oleh penerima',
              timestamp: daysAgo(8 - i),
            }
          });
        }
      }
    }
  }
  console.log(`   ✅  10 Shipments seeded.`);

  // ── 9. CUSTOMER RETURNS ────────────────────────────────────────────────────
  console.log('🔄  Seeding Customer Returns...');
  const custReturnReasons = ['WRONG_SIZE', 'DEFECTIVE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'DUPLICATE_ORDER', 'WRONG_ITEM', 'QUALITY_ISSUE', 'DAMAGED', 'WRONG_COLOR', 'OTHER'];
  for (let i = 0; i < 10; i++) {
    const cus = customers[i % customers.length];
    const so = createdSOs[i % createdSOs.length];
    const item = items[i % items.length];
    const returnNumber = `CR-2025-${pad(i + 1)}`;
    const existing = await prisma.customerReturn.findUnique({ where: { returnNumber } });
    if (!existing) {
      await prisma.customerReturn.create({
        data: {
          returnNumber,
          customerId: cus.id,
          salesOrderId: so.id,
          reason: custReturnReasons[i % custReturnReasons.length],
          notes: 'Customer meminta pengembalian barang',
          status: i < 5 ? 'COMPLETED' : i < 8 ? 'SUBMITTED' : 'DRAFT',
          items: {
            create: [{
              itemId: item.id,
              quantity: rnd(1, 2),
              lotNumber: null,
              notes: `Retur: ${custReturnReasons[i % custReturnReasons.length].toLowerCase().replace(/_/g, ' ')}`
            }]
          }
        }
      });
    }
  }
  console.log(`   ✅  10 Customer Returns seeded.`);

  // ── 10. STOCKTAKE (OPNAME) ─────────────────────────────────────────────────
  console.log('🗂️   Seeding Stocktakes...');
  const stocktakeStatuses = ['COMPLETED', 'APPROVED', 'IN_PROGRESS', 'DRAFT', 'PENDING_APPROVAL', 'COMPLETED', 'APPROVED', 'COMPLETED', 'DRAFT', 'IN_PROGRESS'];
  for (let i = 0; i < 10; i++) {
    const wh = warehouses[i % warehouses.length];
    const stocktakeNumber = `ST-2025-${pad(i + 1)}`;
    const existing = await prisma.stocktake.findUnique({ where: { stocktakeNumber } });
    if (!existing) {
      const wh_locations = locations.filter(l => l.warehouseId === wh.id);
      const st = await prisma.stocktake.create({
        data: {
          stocktakeNumber,
          warehouseId: wh.id,
          name: `Opname ${['Bulanan', 'Mingguan', 'Triwulan', 'Tahunan', 'Mendadak'][i % 5]} - ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt'][i]}`,
          stocktakeDate: daysAgo(15 - i),
          status: stocktakeStatuses[i],
          notes: `Opname periode ${new Date().getFullYear()}`,
        }
      });

      // Add counts for first 5 items per stocktake
      for (let j = 0; j < Math.min(5, items.length); j++) {
        const item = items[j];
        const loc = wh_locations[j % wh_locations.length] || wh_locations[0];
        if (!loc) continue;

        const sysQty = rnd(10, 100);
        const countedQty = sysQty + rnd(-5, 5); // slight variance

        // Find or create inventory record (null lot)
        let inv = await prisma.inventory.findFirst({
          where: { itemId: item.id, locationId: loc.id, itemLotId: null },
        });
        if (!inv) {
          inv = await prisma.inventory.create({
            data: { itemId: item.id, locationId: loc.id, itemLotId: null, onHandQty: sysQty, allocatedQty: 0, availableQty: sysQty },
          });
        }
        await prisma.stocktakeCount.create({
          data: {
            stocktakeId: st.id,
            inventoryId: inv.id,
            itemId: item.id,
            locationId: loc.id,
            systemQty: sysQty,
            countedQty: countedQty,
            notes: Math.abs(countedQty - sysQty) > 0 ? 'Selisih ditemukan — perlu verifikasi' : null,
          }
        });
      }
    }
  }
  console.log(`   ✅  10 Stocktakes seeded.`);

  // ── 11. STOCK ADJUSTMENTS ─────────────────────────────────────────────────
  console.log('⚖️   Seeding Stock Adjustments...');
  const adjReasons = ['DAMAGED', 'LOST', 'FOUND', 'CORRECTION', 'EXPIRED', 'DAMAGED', 'OTHER', 'CORRECTION', 'LOST', 'FOUND'];
  for (let i = 0; i < 10; i++) {
    const item = items[i % items.length];
    const loc = locations[i % locations.length];
    const adjustmentNumber = `ADJ-2025-${pad(i + 1)}`;
    const existing = await prisma.stockAdjustment.findUnique({ where: { adjustmentNumber } });
    if (!existing) {
      const prevQty = rnd(20, 100);
      const delta = adjReasons[i].includes('LOST') || adjReasons[i] === 'DAMAGED' || adjReasons[i] === 'EXPIRED'
        ? -rnd(1, 5)
        : rnd(1, 5);
      await prisma.stockAdjustment.create({
        data: {
          adjustmentNumber,
          itemId: item.id,
          locationId: loc.id,
          quantity: delta,
          reason: adjReasons[i],
          notes: `Penyesuaian stok — ${adjReasons[i].toLowerCase().replace(/_/g, ' ')}`,
          previousQty: prevQty,
          newQty: prevQty + delta,
          createdBy: 'seed-script',
        }
      });
    }
  }
  console.log(`   ✅  10 Stock Adjustments seeded.`);

  // ── 12. STOCK MOVEMENTS (for COGS page) ───────────────────────────────────
  console.log('📊  Seeding Stock Movements...');
  const movTypes = ['IN', 'OUT', 'OUT', 'IN', 'OUT', 'OUT', 'TRANSFER', 'OUT', 'IN', 'OUT'];
  const movRefs = ['PO', 'SO', 'SO', 'GRN', 'SO', 'SO', 'TRANSFER', 'SO', 'GRN', 'SO'];

  for (let i = 0; i < 10; i++) {
    const item = items[i % items.length];
    const loc = locations[i % locations.length];
    const movType = movTypes[i];
    const qty = movType === 'OUT' ? -rnd(1, 8) : rnd(5, 30);

    await prisma.stockMovement.create({
      data: {
        itemId: item.id,
        locationId: loc.id,
        type: movType,
        quantity: qty,
        referenceId: `REF-2025-${pad(i + 1)}`,
        remarks: `Stock movement ${movType} — ${item.sku}`,
        createdAt: daysAgo(15 - i),
      } as any
    });
  }
  console.log(`   ✅  10 Stock Movements seeded.`);

  // ── 13. Update inventory with stock in storages ────────────────────────────
  console.log('🔄  Distributing inventory across storage locations...');
  const storageLocations = locations.filter(l =>
    !l.code.includes('REC') && !l.code.includes('QC') && !l.code.includes('SHP') && !l.code.includes('RET')
  );

  for (let i = 0; i < Math.min(items.length, 12); i++) {
    const item = items[i];
    const targetLoc = storageLocations[i % storageLocations.length];
    if (!targetLoc) continue;

    const onHand = rnd(15, 80);
    const allocated = rnd(0, Math.floor(onHand * 0.3));
    const available = onHand - allocated;

    const existingInv = await prisma.inventory.findFirst({
      where: { itemId: item.id, locationId: targetLoc.id, itemLotId: null },
    });
    if (existingInv) {
      await prisma.inventory.update({
        where: { id: existingInv.id },
        data: { onHandQty: onHand, allocatedQty: allocated, availableQty: available },
      });
    } else {
      await prisma.inventory.create({
        data: { itemId: item.id, locationId: targetLoc.id, itemLotId: null, onHandQty: onHand, allocatedQty: allocated, availableQty: available },
      });
    }
  }
  // Also seed inventory for lots (non-null itemLotId — upsert works fine)
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    const storLoc = storageLocations[i % storageLocations.length];
    if (!storLoc) continue;
    const onHand = rnd(5, 30);
    await prisma.inventory.upsert({
      where: {
        itemId_locationId_itemLotId: {
          itemId: lot.itemId,
          locationId: storLoc.id,
          itemLotId: lot.id,
        }
      },
      update: { onHandQty: onHand, allocatedQty: 0, availableQty: onHand },
      create: {
        itemId: lot.itemId,
        locationId: storLoc.id,
        itemLotId: lot.id,
        onHandQty: onHand,
        allocatedQty: 0,
        availableQty: onHand,
      }
    });
  }
  console.log(`   ✅  Inventory distributed across ${storageLocations.length} storage locations.`);

  // ── 14. PROMOTIONS (Bundles & Discounts) ───────────────────────────────
  console.log('🎁  Seeding Promotions...');
  const categories = await prisma.category.findMany();
  
  // Seed Bundles
  const bundleSeeds = [
    { name: 'Paket Casual Pria - S', price: 199000, desc: 'Kaos polos + Celana chino size S', itemIndices: [ { i: 0, q: 1 }, { i: 1, q: 1 } ] },
    { name: 'Paket 3 Kaos Warna', price: 225000, desc: 'Hemat beli 3 kaos sekaligus', itemIndices: [ { i: 2, q: 3 } ] },
    { name: 'Paket Office Starter', price: 450000, desc: 'Kemeja + Celana Bahan + Ikat Pinggang', itemIndices: [ { i: 3, q: 1 }, { i: 4, q: 1 }, { i: 5, q: 1 } ] }
  ];

  for (const b of bundleSeeds) {
    const existing = await (prisma as any).bundle.findFirst({ where: { name: b.name } });
    if (!existing) {
      await (prisma as any).bundle.create({
        data: {
          name: b.name,
          description: b.desc,
          bundlePrice: b.price,
          isActive: true,
          items: {
            create: b.itemIndices.map(bi => {
              const item = items[bi.i % items.length];
              return {
                itemId: item.id,
                quantity: bi.q,
                unitPrice: item.uoms[0]?.price || 100000
              };
            })
          }
        }
      });
    }
  }

  // Seed Discount Rules
  const discountSeeds = [
    { name: 'Promo Harnas 17 Agustus', type: 'PERCENTAGE', value: 17, minQty: 1, startDate: daysAgo(10), endDate: daysFromNow(10) },
    { name: 'Diskon Anggota VIP', type: 'NOMINAL', value: 50000, minPurchase: 300000, startDate: daysAgo(30) },
    { name: 'Buy 2 Get 1 Kaos', type: 'BUY_X_GET_Y', value: 1, minQty: 2, startDate: daysAgo(5), endDate: daysFromNow(20) }
  ];

  for (const r of discountSeeds) {
    const existing = await (prisma as any).discountRule.findFirst({ where: { name: r.name } });
    if (!existing) {
      await (prisma as any).discountRule.create({
        data: {
          name: r.name,
          type: r.type as any,
          value: r.value,
          minQty: r.minQty || 0,
          minPurchase: r.minPurchase || 0,
          startDate: r.startDate,
          endDate: r.endDate || null,
          isActive: true,
          categories: {
            connect: categories.slice(0, 2).map(c => ({ id: c.id }))
          }
        }
      });
    }
  }
  console.log(`   ✅  Promotions seeded.`);

  console.log('\n✅  Retail operational seed completed successfully!\n');
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
