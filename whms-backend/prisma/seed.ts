import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const resetKeepAuthOnly = args.has('--reset-keep-auth-only');
const shouldResetKeepAuth = resetKeepAuthOnly || args.has('--reset-keep-auth');
const authOnly = args.has('--auth-only');

const escapeIdentifier = (name: string) => name.replace(/"/g, '""');

async function resetDatabaseKeepLogin() {
  const keep = new Set(['User', 'Role', 'Permission', '_RolePermissions', '_prisma_migrations']);

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `;

  const toTruncate = (tables || [])
    .map((t) => String(t.tablename || '').trim())
    .filter(Boolean)
    .filter((t) => !keep.has(t))
    .map((t) => `"public"."${escapeIdentifier(t)}"`);

  if (!toTruncate.length) return;

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${toTruncate.join(', ')} RESTART IDENTITY CASCADE;`);
}

async function main() {
  console.log('Start seeding...');

  if (shouldResetKeepAuth) {
    console.log('Resetting database (keeping login data)...');
    await resetDatabaseKeepLogin();
    console.log('Reset finished.');
  }

  if (resetKeepAuthOnly) {
    console.log('Seeding finished.');
    return;
  }

  // 1. Create Default Master Permission
  const allPermission = await prisma.permission.upsert({
    where: { action_resource: { action: '*', resource: '*' } },
    update: {},
    create: {
      action: '*',
      resource: '*',
      description: 'Full Access to Everything',
    },
  });

  console.log(`Permission [*|*] upserted.`);

  // 2. Create SUPER_ADMIN Role with the * Permission
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      permissions: {
        connect: { id: allPermission.id },
      },
    },
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full control',
      permissions: {
        connect: { id: allPermission.id },
      },
    },
  });

  console.log(`Role [SUPER_ADMIN] upserted.`);

  // 3. Create initial Master Admin User
  const adminEmail = 'zubair.mi45@gmail.com';
  const rawPassword = 'Zubair12345@@';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
      roleId: superAdminRole.id,
    },
    create: {
      email: adminEmail,
      name: 'Zubair (Super Admin)',
      passwordHash: hashedPassword,
      roleId: superAdminRole.id,
      isActive: true,
    },
  });

  console.log(`User [${adminUser.email}] seeded successfully as SUPER_ADMIN.`);
  
  // Create OTHER roles requested in prompt.md
  const otherRoles = [
      'MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT',
      'INBOUND_STAFF', 'OUTBOUND_STAFF', 'INVENTORY_STAFF', 
      'CASHIER', 'AUDITOR'
  ];

  for (const roleName of otherRoles) {
      await prisma.role.upsert({
          where: { name: roleName },
          update: {},
          create: { name: roleName, description: `Role for ${roleName}` }
      });
      console.log(`Role [${roleName}] upserted.`);
  }

  if (authOnly) {
    console.log('Seeding finished.');
    return;
  }

  const categories = await Promise.all([
    (prisma.category as any).upsert({
      where: { name: 'Apparel' },
      update: { description: 'Pakaian' },
      create: { name: 'Apparel', description: 'Pakaian' }
    }),
    (prisma.category as any).upsert({
      where: { name: 'Footwear' },
      update: { description: 'Sepatu & sandal' },
      create: { name: 'Footwear', description: 'Sepatu & sandal' }
    }),
    (prisma.category as any).upsert({
      where: { name: 'Accessories' },
      update: { description: 'Aksesoris retail' },
      create: { name: 'Accessories', description: 'Aksesoris retail' }
    })
  ]);

  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const uoms = await Promise.all([
    prisma.uoM.upsert({
      where: { code: 'PCS' },
      update: { description: 'Unit eceran' },
      create: { code: 'PCS', description: 'Unit eceran' }
    }),
    prisma.uoM.upsert({
      where: { code: 'BOX' },
      update: { description: 'Kemasan box' },
      create: { code: 'BOX', description: 'Kemasan box' }
    })
  ]);

  const uomByCode = new Map(uoms.map((u) => [u.code, u]));

  const productTshirt = await (prisma as any).product.upsert({
    where: { code: 'TSHIRT-BASIC' },
    update: {
      name: 'T-Shirt Oversize Basic',
      description: 'T-Shirt basic oversize untuk retail',
      categoryId: categoryByName.get('Apparel')?.id
    },
    create: {
      code: 'TSHIRT-BASIC',
      name: 'T-Shirt Oversize Basic',
      description: 'T-Shirt basic oversize untuk retail',
      categoryId: categoryByName.get('Apparel')?.id,
      isActive: true
    }
  });

  const productSneakers = await (prisma as any).product.upsert({
    where: { code: 'SNK-CLS' },
    update: {
      name: 'Sneakers Classic',
      description: 'Sneakers harian untuk retail',
      categoryId: categoryByName.get('Footwear')?.id
    },
    create: {
      code: 'SNK-CLS',
      name: 'Sneakers Classic',
      description: 'Sneakers harian untuk retail',
      categoryId: categoryByName.get('Footwear')?.id,
      isActive: true
    }
  });

  const seedSuppliers: Array<{ code: string; name: string; address?: string; phone?: string; email?: string }> = [
    { code: 'SUP-0001', name: 'PT Indofood Nusantara', address: 'Jakarta', phone: '021-5551234', email: 'ap@indofoodnusantara.co.id' },
    { code: 'SUP-0002', name: 'CV Makmur Jaya Plastik', address: 'Bekasi', phone: '021-7778899', email: 'sales@makmurjayaplastik.co.id' },
    { code: 'SUP-0003', name: 'PT Sumber Tani Abadi', address: 'Bandung', phone: '022-7001122', email: 'finance@sumbertaniabadi.co.id' },
    { code: 'SUP-0004', name: 'PT Tekstil Maju Sejahtera', address: 'Cimahi', phone: '022-8800123', email: 'cs@tekstilmaju.co.id' },
    { code: 'SUP-0005', name: 'PT Kulit Sintetis Prima', address: 'Tangerang', phone: '021-29001234', email: 'order@kulitsintetisprima.co.id' },
    { code: 'SUP-0006', name: 'CV Karya Aksesoris', address: 'Surabaya', phone: '031-6007788', email: 'admin@karyaaksesoris.co.id' },
    { code: 'SUP-0007', name: 'PT Logistik Kemasan Indonesia', address: 'Karawang', phone: '0267-401122', email: 'billing@logistikkemasan.co.id' },
    { code: 'SUP-0008', name: 'PT Warna Indonesia Jaya', address: 'Semarang', phone: '024-8600123', email: 'sales@warnainjaya.co.id' },
    { code: 'SUP-0009', name: 'PT Solusi Mesin Jahit', address: 'Yogyakarta', phone: '0274-510123', email: 'service@solusimesinjahit.co.id' },
    { code: 'SUP-0010', name: 'CV Packaging Mandiri', address: 'Bogor', phone: '0251-8300123', email: 'finance@packagingmandiri.co.id' },
  ];

  for (const s of seedSuppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
      },
      create: {
        code: s.code,
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
      },
    });
  }

  console.log(`Suppliers seeded: ${seedSuppliers.length} suppliers upserted.`);

  const seedCustomers: Array<{ code: string; name: string; address?: string; phone?: string; email?: string }> = [
    { code: 'CUS-0001', name: 'Toko Bintang Rejeki', address: 'Jakarta Barat', phone: '0812-1000-0001', email: 'owner@bintangrejeki.id' },
    { code: 'CUS-0002', name: 'Alfamart Cab. Sudirman', address: 'Jakarta Pusat', phone: '0812-1000-0002', email: 'procurement@alfamart-sudirman.id' },
    { code: 'CUS-0003', name: 'Indomaret Cab. Gatot Subroto', address: 'Jakarta Selatan', phone: '0812-1000-0003', email: 'purchasing@indomaret-gatsu.id' },
    { code: 'CUS-0004', name: 'PT Distribusi Maju Jaya', address: 'Bekasi', phone: '0812-1000-0004', email: 'finance@distribusimaju.co.id' },
    { code: 'CUS-0005', name: 'CV Retail Sejahtera', address: 'Depok', phone: '0812-1000-0005', email: 'admin@retailsejahtera.co.id' },
    { code: 'CUS-0006', name: 'Deni Setiawan (Marketplace)', address: 'Bandung', phone: '0812-1000-0006', email: 'deni.setiawan@example.com' },
    { code: 'CUS-0007', name: 'Siti Rahma (Member)', address: 'Tangerang', phone: '0812-1000-0007', email: 'siti.rahma@example.com' },
    { code: 'CUS-0008', name: 'PT Katering Rasa Nusantara', address: 'Bogor', phone: '0812-1000-0008', email: 'purchasing@rasanusantara.co.id' },
    { code: 'CUS-0009', name: 'Hotel Grand Merdeka', address: 'Semarang', phone: '0812-1000-0009', email: 'accounting@grandmerdeka.id' },
    { code: 'CUS-0010', name: 'Restoran Sari Laut Bahari', address: 'Surabaya', phone: '0812-1000-0010', email: 'owner@sarilautbahari.id' },
  ];

  for (const c of seedCustomers) {
    await prisma.customer.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        address: c.address,
        phone: c.phone,
        email: c.email,
      },
      create: {
        code: c.code,
        name: c.name,
        address: c.address,
        phone: c.phone,
        email: c.email,
      },
    });
  }

  console.log(`Customers seeded: ${seedCustomers.length} customers upserted.`);

  const seedWarehouses: Array<{ code: string; name: string; address?: string }> = [
    { code: 'WH01', name: 'Gudang Pusat Cikarang', address: 'Cikarang, Bekasi' },
    { code: 'WH02', name: 'Hub Surabaya Transit', address: 'Surabaya, Jawa Timur' },
    { code: 'WH03', name: 'Store Jakarta Selatan', address: 'Jakarta Selatan' },
    { code: 'WH04', name: 'Return & QC Center', address: 'Tangerang' },
  ];

  const warehouseByCode = new Map<string, { id: string }>();
  for (const w of seedWarehouses) {
    const wh = await prisma.warehouse.upsert({
      where: { code: w.code },
      update: { name: w.name, address: w.address, isActive: true },
      create: { code: w.code, name: w.name, address: w.address, isActive: true },
    });
    warehouseByCode.set(w.code, { id: wh.id });
  }

  const seedLocations: Array<{ warehouseCode: string; code: string; zone?: string; aisle?: string; rack?: string; level?: string; bin?: string }> = [
    { warehouseCode: 'WH01', code: 'WH01-REC', zone: 'R', aisle: '00', rack: 'REC', level: '00', bin: '00' },
    { warehouseCode: 'WH01', code: 'WH01-QC', zone: 'Q', aisle: '00', rack: 'QC', level: '00', bin: '00' },
    { warehouseCode: 'WH01', code: 'WH01-A-01-A-01-A', zone: 'A', aisle: '01', rack: 'A', level: '01', bin: 'A' },
    { warehouseCode: 'WH01', code: 'WH01-B-01-A-01-A', zone: 'B', aisle: '01', rack: 'A', level: '01', bin: 'A' },
    { warehouseCode: 'WH01', code: 'WH01-SHP', zone: 'S', aisle: '00', rack: 'SHP', level: '00', bin: '00' },

    { warehouseCode: 'WH02', code: 'WH02-REC', zone: 'R', aisle: '00', rack: 'REC', level: '00', bin: '00' },
    { warehouseCode: 'WH02', code: 'WH02-A-01-A-01-A', zone: 'A', aisle: '01', rack: 'A', level: '01', bin: 'A' },
    { warehouseCode: 'WH02', code: 'WH02-SHP', zone: 'S', aisle: '00', rack: 'SHP', level: '00', bin: '00' },

    { warehouseCode: 'WH03', code: 'WH03-STO', zone: 'S', aisle: '00', rack: 'STO', level: '00', bin: '00' },
    { warehouseCode: 'WH03', code: 'WH03-SHP', zone: 'S', aisle: '00', rack: 'SHP', level: '00', bin: '00' },

    { warehouseCode: 'WH04', code: 'WH04-RET', zone: 'R', aisle: '00', rack: 'RET', level: '00', bin: '00' },
    { warehouseCode: 'WH04', code: 'WH04-QC', zone: 'Q', aisle: '00', rack: 'QC', level: '00', bin: '00' },
  ];

  for (const l of seedLocations) {
    const wh = warehouseByCode.get(l.warehouseCode);
    if (!wh) continue;
    await prisma.location.upsert({
      where: { code: l.code },
      update: {
        warehouseId: wh.id,
        zone: l.zone,
        aisle: l.aisle,
        rack: l.rack,
        level: l.level,
        bin: l.bin,
        isActive: true,
      },
      create: {
        warehouseId: wh.id,
        code: l.code,
        zone: l.zone,
        aisle: l.aisle,
        rack: l.rack,
        level: l.level,
        bin: l.bin,
        isActive: true,
      },
    });
  }

  console.log(`Warehouses seeded: ${seedWarehouses.length} warehouses upserted.`);
  console.log(`Locations seeded: ${seedLocations.length} locations upserted.`);

  const seedItems: Array<{
    sku: string
    name: string
    categoryId?: string
    productId?: string
    color?: string
    size?: string
    material?: string
    variantAttributes?: any
    price: number
    boxQty?: number
  }> = [
    {
      sku: 'TSHIRT-BASIC-BLK-S',
      name: 'T-Shirt Oversize Basic',
      categoryId: categoryByName.get('Apparel')?.id,
      productId: productTshirt.id,
      color: 'Black',
      size: 'S',
      material: 'Cotton',
      variantAttributes: { fit: 'OVERSIZE' },
      price: 99000,
      boxQty: 12
    },
    {
      sku: 'TSHIRT-BASIC-BLK-M',
      name: 'T-Shirt Oversize Basic',
      categoryId: categoryByName.get('Apparel')?.id,
      productId: productTshirt.id,
      color: 'Black',
      size: 'M',
      material: 'Cotton',
      variantAttributes: { fit: 'OVERSIZE' },
      price: 99000,
      boxQty: 12
    },
    {
      sku: 'TSHIRT-BASIC-WHT-L',
      name: 'T-Shirt Oversize Basic',
      categoryId: categoryByName.get('Apparel')?.id,
      productId: productTshirt.id,
      color: 'White',
      size: 'L',
      material: 'Cotton',
      variantAttributes: { fit: 'OVERSIZE' },
      price: 99000,
      boxQty: 12
    },
    {
      sku: 'SNK-CLS-BLK-40',
      name: 'Sneakers Classic',
      categoryId: categoryByName.get('Footwear')?.id,
      productId: productSneakers.id,
      color: 'Black',
      size: '40',
      material: 'Synthetic Leather',
      variantAttributes: { gender: 'UNISEX' },
      price: 299000,
      boxQty: 6
    },
    {
      sku: 'SNK-CLS-WHT-41',
      name: 'Sneakers Classic',
      categoryId: categoryByName.get('Footwear')?.id,
      productId: productSneakers.id,
      color: 'White',
      size: '41',
      material: 'Synthetic Leather',
      variantAttributes: { gender: 'UNISEX' },
      price: 299000,
      boxQty: 6
    }
  ];

  for (const it of seedItems) {
    await prisma.item.upsert({
      where: { sku: it.sku },
      update: {
        name: it.name,
        categoryId: it.categoryId,
        productId: it.productId,
        color: it.color,
        size: it.size,
        material: it.material,
        variantAttributes: it.variantAttributes,
        isActive: true
      } as any,
      create: {
        sku: it.sku,
        name: it.name,
        categoryId: it.categoryId,
        productId: it.productId,
        color: it.color,
        size: it.size,
        material: it.material,
        variantAttributes: it.variantAttributes,
        isActive: true,
        trackLot: false,
        trackExpiry: false,
        uoms: {
          create: [
            {
              uomId: uomByCode.get('PCS')!.id,
              conversionRate: 1,
              price: it.price,
              barcode: null
            },
            ...(it.boxQty ? [{
              uomId: uomByCode.get('BOX')!.id,
              conversionRate: it.boxQty,
              price: it.price * it.boxQty,
              barcode: null
            }] : [])
          ]
        }
      } as any
    });
  }

  const colors = ['Black', 'White', 'Blue', 'Navy', 'Red', 'Green', 'Yellow', 'Brown', 'Grey'];
  const apparelSizes = ['S', 'M', 'L', 'XL'];
  const footwearSizes = ['39', '40', '41', '42', '43'];

  const posTemplates: Array<{
    prefix: string;
    categoryName: 'Apparel' | 'Footwear' | 'Accessories';
    productId?: string;
    baseName: string;
    material?: string;
    basePrice: number;
    sizeList?: string[];
    boxQty?: number;
  }> = [
    { prefix: 'APP', categoryName: 'Apparel', productId: productTshirt.id, baseName: 'Classic Tee', material: 'Cotton', basePrice: 99000, sizeList: apparelSizes, boxQty: 12 },
    { prefix: 'APP', categoryName: 'Apparel', productId: productTshirt.id, baseName: 'Oversize Tee', material: 'Cotton', basePrice: 119000, sizeList: apparelSizes, boxQty: 12 },
    { prefix: 'APP', categoryName: 'Apparel', baseName: 'Hoodie Basic', material: 'Fleece', basePrice: 199000, sizeList: apparelSizes, boxQty: 8 },
    { prefix: 'APP', categoryName: 'Apparel', baseName: 'Denim Jeans', material: 'Denim', basePrice: 249000, sizeList: ['28', '30', '32', '34'], boxQty: 6 },
    { prefix: 'FTW', categoryName: 'Footwear', productId: productSneakers.id, baseName: 'Sneakers Classic', material: 'Synthetic Leather', basePrice: 299000, sizeList: footwearSizes, boxQty: 6 },
    { prefix: 'FTW', categoryName: 'Footwear', baseName: 'Running Shoes', material: 'Mesh', basePrice: 359000, sizeList: footwearSizes, boxQty: 6 },
    { prefix: 'FTW', categoryName: 'Footwear', baseName: 'Sandals', material: 'Rubber', basePrice: 149000, sizeList: footwearSizes, boxQty: 10 },
    { prefix: 'ACC', categoryName: 'Accessories', baseName: 'Baseball Cap', material: 'Polyester', basePrice: 79000, boxQty: 20 },
    { prefix: 'ACC', categoryName: 'Accessories', baseName: 'Leather Belt', material: 'Leather', basePrice: 129000, boxQty: 10 },
    { prefix: 'ACC', categoryName: 'Accessories', baseName: 'Backpack', material: 'Canvas', basePrice: 219000, boxQty: 5 },
  ];

  let barcodeCounter = 1000000;
  const generatedSkus: string[] = [];

  for (let i = 0; i < 90; i++) {
    const tpl = posTemplates[i % posTemplates.length];
    const color = colors[i % colors.length];
    const size = tpl.sizeList ? tpl.sizeList[i % tpl.sizeList.length] : undefined;
    const catId = categoryByName.get(tpl.categoryName)?.id;
    const baseSku = `${tpl.prefix}-${String(i + 1).padStart(4, '0')}-${color.slice(0, 3).toUpperCase()}${size ? `-${size}` : ''}`;
    const sku = `POS-${baseSku}`;

    const price = Math.round((tpl.basePrice + (i % 7) * 5000) / 1000) * 1000;
    const barcodePcs = `899${String(barcodeCounter++).padStart(10, '0')}`;
    const barcodeBox = tpl.boxQty ? `899${String(barcodeCounter++).padStart(10, '0')}` : null;

    await prisma.item.upsert({
      where: { sku },
      update: {
        name: `${tpl.baseName}`,
        categoryId: catId,
        productId: tpl.productId,
        color,
        size,
        material: tpl.material,
        variantAttributes: { brand: 'Demo', model: tpl.baseName },
        isActive: true,
      } as any,
      create: {
        sku,
        name: `${tpl.baseName}`,
        categoryId: catId,
        productId: tpl.productId,
        color,
        size,
        material: tpl.material,
        variantAttributes: { brand: 'Demo', model: tpl.baseName },
        isActive: true,
        trackLot: false,
        trackExpiry: false,
        uoms: {
          create: [
            {
              uomId: uomByCode.get('PCS')!.id,
              conversionRate: 1,
              price,
              barcode: barcodePcs,
            },
            ...(tpl.boxQty
              ? [
                  {
                    uomId: uomByCode.get('BOX')!.id,
                    conversionRate: tpl.boxQty,
                    price: price * tpl.boxQty,
                    barcode: barcodeBox,
                  },
                ]
              : []),
          ],
        },
      } as any,
    });

    generatedSkus.push(sku);
  }

  const allSeedSkus = [...seedItems.map((s) => s.sku), ...generatedSkus];
  const seededItems = await prisma.item.findMany({
    where: { sku: { in: allSeedSkus } },
    select: { id: true, sku: true },
  });

  const warehousesAll = await prisma.warehouse.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true },
  });

  const warehouseMainLocation = new Map<string, string>();
  for (const w of warehousesAll) {
    const locations = await prisma.location.findMany({
      where: { warehouseId: w.id, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true },
    });
    const preferred =
      locations.find((l) => /-STO$/.test(l.code)) ||
      locations.find((l) => /-A-01-/.test(l.code)) ||
      locations[0];
    if (preferred) warehouseMainLocation.set(w.id, preferred.id);
  }

  const seedInventoryRows: Array<{ itemId: string; locationId: string; onHandQty: number; allocatedQty: number; availableQty: number; itemLotId: null }> = [];

  for (const it of seededItems) {
    for (const w of warehousesAll) {
      const locId = warehouseMainLocation.get(w.id);
      if (!locId) continue;

      const qty = 5 + ((it.sku.length * 7 + w.code.charCodeAt(0)) % 70);
      seedInventoryRows.push({
        itemId: it.id,
        locationId: locId,
        itemLotId: null,
        onHandQty: qty,
        allocatedQty: 0,
        availableQty: qty,
      });
    }
  }

  const locationIdsTouched = Array.from(new Set(seedInventoryRows.map((r) => r.locationId)));
  const itemIdsTouched = Array.from(new Set(seedInventoryRows.map((r) => r.itemId)));

  for (const locationId of locationIdsTouched) {
    await prisma.inventory.deleteMany({
      where: { locationId, itemId: { in: itemIdsTouched }, itemLotId: null },
    });
  }

  for (let i = 0; i < seedInventoryRows.length; i += 500) {
    const chunk = seedInventoryRows.slice(i, i + 500);
    await prisma.inventory.createMany({ data: chunk as any });
  }

  console.log(`POS items generated: ${generatedSkus.length} items upserted.`);
  console.log(`Inventory seeded: ${seedInventoryRows.length} rows created across warehouses.`);

  const coaSeed: Array<{ code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; parentCode?: string }> = [
    { code: '1000', name: 'ASET', type: 'ASSET' },
    { code: '1100', name: 'Aset Lancar', type: 'ASSET', parentCode: '1000' },
    { code: '1110', name: 'Kas & Setara Kas', type: 'ASSET', parentCode: '1100' },
    { code: '1111', name: 'Kas Kecil', type: 'ASSET', parentCode: '1110' },
    { code: '1112', name: 'Kas Besar', type: 'ASSET', parentCode: '1110' },
    { code: '1120', name: 'Bank', type: 'ASSET', parentCode: '1100' },
    { code: '1121', name: 'Bank BCA', type: 'ASSET', parentCode: '1120' },
    { code: '1122', name: 'Bank Mandiri', type: 'ASSET', parentCode: '1120' },
    { code: '1130', name: 'Piutang Usaha', type: 'ASSET', parentCode: '1100' },
    { code: '1131', name: 'Piutang Dagang', type: 'ASSET', parentCode: '1130' },
    { code: '1139', name: 'Cadangan Kerugian Piutang', type: 'ASSET', parentCode: '1130' },
    { code: '1140', name: 'Persediaan', type: 'ASSET', parentCode: '1100' },
    { code: '1141', name: 'Persediaan Barang Dagang', type: 'ASSET', parentCode: '1140' },
    { code: '1142', name: 'Persediaan Dalam Perjalanan', type: 'ASSET', parentCode: '1140' },
    { code: '1150', name: 'Uang Muka & Biaya Dibayar Di Muka', type: 'ASSET', parentCode: '1100' },
    { code: '1151', name: 'Uang Muka Pembelian', type: 'ASSET', parentCode: '1150' },
    { code: '1152', name: 'Sewa Dibayar Di Muka', type: 'ASSET', parentCode: '1150' },
    { code: '1160', name: 'PPN Masukan', type: 'ASSET', parentCode: '1100' },
    { code: '1200', name: 'Aset Tidak Lancar', type: 'ASSET', parentCode: '1000' },
    { code: '1210', name: 'Aset Tetap', type: 'ASSET', parentCode: '1200' },
    { code: '1211', name: 'Peralatan', type: 'ASSET', parentCode: '1210' },
    { code: '1212', name: 'Kendaraan', type: 'ASSET', parentCode: '1210' },
    { code: '1213', name: 'Bangunan', type: 'ASSET', parentCode: '1210' },
    { code: '1220', name: 'Akumulasi Penyusutan', type: 'ASSET', parentCode: '1200' },
    { code: '1221', name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', parentCode: '1220' },
    { code: '1222', name: 'Akumulasi Penyusutan Kendaraan', type: 'ASSET', parentCode: '1220' },
    { code: '1223', name: 'Akumulasi Penyusutan Bangunan', type: 'ASSET', parentCode: '1220' },

    { code: '2000', name: 'LIABILITAS', type: 'LIABILITY' },
    { code: '2100', name: 'Liabilitas Lancar', type: 'LIABILITY', parentCode: '2000' },
    { code: '2110', name: 'Hutang Usaha', type: 'LIABILITY', parentCode: '2100' },
    { code: '2111', name: 'Hutang Dagang', type: 'LIABILITY', parentCode: '2110' },
    { code: '2120', name: 'Hutang Pajak', type: 'LIABILITY', parentCode: '2100' },
    { code: '2121', name: 'PPN Keluaran', type: 'LIABILITY', parentCode: '2120' },
    { code: '2122', name: 'PPh Terutang', type: 'LIABILITY', parentCode: '2120' },
    { code: '2130', name: 'Hutang Gaji', type: 'LIABILITY', parentCode: '2100' },
    { code: '2200', name: 'Liabilitas Jangka Panjang', type: 'LIABILITY', parentCode: '2000' },
    { code: '2210', name: 'Pinjaman Bank', type: 'LIABILITY', parentCode: '2200' },

    { code: '3000', name: 'EKUITAS', type: 'EQUITY' },
    { code: '3100', name: 'Modal', type: 'EQUITY', parentCode: '3000' },
    { code: '3110', name: 'Modal Disetor', type: 'EQUITY', parentCode: '3100' },
    { code: '3200', name: 'Laba Ditahan', type: 'EQUITY', parentCode: '3000' },
    { code: '3300', name: 'Laba/Rugi Tahun Berjalan', type: 'EQUITY', parentCode: '3000' },

    { code: '4000', name: 'PENDAPATAN', type: 'REVENUE' },
    { code: '4100', name: 'Penjualan', type: 'REVENUE', parentCode: '4000' },
    { code: '4110', name: 'Penjualan Barang', type: 'REVENUE', parentCode: '4100' },
    { code: '4120', name: 'Diskon Penjualan', type: 'REVENUE', parentCode: '4100' },
    { code: '4200', name: 'Pendapatan Lain-lain', type: 'REVENUE', parentCode: '4000' },

    { code: '5000', name: 'BEBAN', type: 'EXPENSE' },
    { code: '5100', name: 'Harga Pokok Penjualan', type: 'EXPENSE', parentCode: '5000' },
    { code: '5110', name: 'HPP Barang Dagang', type: 'EXPENSE', parentCode: '5100' },
    { code: '5200', name: 'Beban Operasional', type: 'EXPENSE', parentCode: '5000' },
    { code: '5210', name: 'Beban Gaji', type: 'EXPENSE', parentCode: '5200' },
    { code: '5220', name: 'Beban Sewa', type: 'EXPENSE', parentCode: '5200' },
    { code: '5230', name: 'Beban Listrik & Air', type: 'EXPENSE', parentCode: '5200' },
    { code: '5240', name: 'Beban Transportasi', type: 'EXPENSE', parentCode: '5200' },
    { code: '5250', name: 'Beban Perlengkapan', type: 'EXPENSE', parentCode: '5200' },
    { code: '5260', name: 'Beban Penyusutan', type: 'EXPENSE', parentCode: '5200' },
    { code: '5270', name: 'Beban Administrasi Bank', type: 'EXPENSE', parentCode: '5200' },
  ];

  const coaByCode = new Map<string, { id: string }>();
  for (const acc of coaSeed.filter((a) => !a.parentCode)) {
    const a = await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type, isActive: true, parentId: null } as any,
      create: { code: acc.code, name: acc.name, type: acc.type, isActive: true, parentId: null } as any,
    });
    coaByCode.set(acc.code, { id: a.id });
  }

  for (const acc of coaSeed.filter((a) => a.parentCode)) {
    const parent = coaByCode.get(acc.parentCode!);
    if (!parent) continue;
    const a = await prisma.chartOfAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type, isActive: true, parentId: parent.id } as any,
      create: { code: acc.code, name: acc.name, type: acc.type, isActive: true, parentId: parent.id } as any,
    });
    coaByCode.set(acc.code, { id: a.id });
  }

  console.log(`COA seeded: ${coaSeed.length} accounts upserted.`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
