import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { Role } from "../src/server/authorization/roles";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

async function seed() {
  const connectionString = process.env.DATABASE_URL || "postgres://vaibhavsaini@localhost:5432/stockroom";
  console.log(`Seeding database at ${connectionString}...`);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // 1. Organizations
    console.log("Creating organizations...");
    const [orgMain] = await db
      .insert(schema.organizations)
      .values({
        id: "org_stockroom_main",
        name: "Stockroom Global Commerce",
        slug: "stockroom-global",
      })
      .onConflictDoNothing()
      .returning();

    const [orgAcme] = await db
      .insert(schema.organizations)
      .values({
        id: "org_acme_retail",
        name: "Acme Retail Group",
        slug: "acme-retail",
      })
      .onConflictDoNothing()
      .returning();

    // 2. Stores
    console.log("Creating stores...");
    await db
      .insert(schema.stores)
      .values([
        {
          id: "store_nyc",
          organizationId: "org_stockroom_main",
          name: "Flagship Manhattan Store",
          currency: "USD",
          timezone: "America/New_York",
          status: "active",
        },
        {
          id: "store_london",
          organizationId: "org_stockroom_main",
          name: "London Covent Garden Hub",
          currency: "GBP",
          timezone: "Europe/London",
          status: "active",
        },
        {
          id: "store_acme_boston",
          organizationId: "org_acme_retail",
          name: "Acme Boston Outlet",
          currency: "USD",
          timezone: "America/New_York",
          status: "active",
        },
      ])
      .onConflictDoNothing();

    // 3. Locations
    console.log("Creating inventory locations...");
    await db
      .insert(schema.inventoryLocations)
      .values([
        {
          id: "loc_nj_warehouse",
          organizationId: "org_stockroom_main",
          storeId: "store_nyc",
          name: "Main Distribution Center NJ",
          locationCode: "WH-NJ-01",
          status: "active",
        },
        {
          id: "loc_nyc_stockroom",
          organizationId: "org_stockroom_main",
          storeId: "store_nyc",
          name: "Manhattan Backroom Stock",
          locationCode: "SR-NYC-01",
          status: "active",
        },
        {
          id: "loc_acme_wh1",
          organizationId: "org_acme_retail",
          storeId: "store_acme_boston",
          name: "Acme Boston Distribution",
          locationCode: "WH-ACME-01",
          status: "active",
        },
      ])
      .onConflictDoNothing();

    // 4. Staff Users & Memberships
    console.log("Creating staff users and RBAC memberships...");
    const staffDefinitions: Array<{
      id: string;
      email: string;
      name: string;
      role: Role;
      orgId: string;
      storeId?: string;
    }> = [
      { id: "usr_owner", email: "owner@stockroom.internal", name: "Elena Vance (Owner)", role: "owner", orgId: "org_stockroom_main" },
      { id: "usr_admin", email: "admin@stockroom.internal", name: "Marcus Brody (Admin)", role: "admin", orgId: "org_stockroom_main" },
      { id: "usr_catalog", email: "catalog@stockroom.internal", name: "Chloe Bennett (Catalog Mgr)", role: "catalog_manager", orgId: "org_stockroom_main" },
      { id: "usr_inventory", email: "inventory@stockroom.internal", name: "Devon Reed (Inventory Mgr)", role: "inventory_manager", orgId: "org_stockroom_main" },
      { id: "usr_order", email: "order@stockroom.internal", name: "Sarah Connor (Order Mgr)", role: "order_manager", orgId: "org_stockroom_main" },
      { id: "usr_fulfillment", email: "fulfillment@stockroom.internal", name: "Jack Reacher (Fulfillment)", role: "fulfillment_staff", orgId: "org_stockroom_main" },
      { id: "usr_finance", email: "finance@stockroom.internal", name: "Gordon Gekko (Finance)", role: "finance_staff", orgId: "org_stockroom_main" },
      { id: "usr_support", email: "support@stockroom.internal", name: "Pam Beesly (Support)", role: "support_staff", orgId: "org_stockroom_main" },
      { id: "usr_viewer", email: "viewer@stockroom.internal", name: "Arthur Dent (Auditor/Viewer)", role: "viewer", orgId: "org_stockroom_main" },
      { id: "usr_acme_admin", email: "admin@acme.internal", name: "Wile E. Coyote (Acme Admin)", role: "admin", orgId: "org_acme_retail" },
    ];

    for (const staff of staffDefinitions) {
      await db
        .insert(schema.users)
        .values({
          id: staff.id,
          email: staff.email,
          name: staff.name,
          passwordHash,
        })
        .onConflictDoNothing();

      await db
        .insert(schema.staffMemberships)
        .values({
          id: `mem_${staff.id}`,
          organizationId: staff.orgId,
          storeId: staff.storeId || null,
          userId: staff.id,
          role: staff.role,
          status: "active",
        })
        .onConflictDoNothing();
    }

    // 5. Products & Variants
    console.log("Creating catalog products, sellable variants, and prices...");
    const productsData = [
      {
        id: "prod_hoodie",
        name: "Ultra-Comfort Merino Wool Hoodie",
        slug: "ultra-comfort-merino-wool-hoodie",
        brand: "Stockroom Apparel",
        description: "100% sustainably sourced merino wool performance hoodie with thermo-regulating fibers.",
        status: "active" as const,
        variants: [
          { id: "var_hoodie_m_nvy", sku: "HOODIE-M-NVY", barcode: "8901234567890", attributes: { size: "M", color: "Navy" }, priceMinor: 12900 },
          { id: "var_hoodie_l_nvy", sku: "HOODIE-L-NVY", barcode: "8901234567891", attributes: { size: "L", color: "Navy" }, priceMinor: 12900 },
          { id: "var_hoodie_m_gry", sku: "HOODIE-M-GRY", barcode: "8901234567892", attributes: { size: "M", color: "Heather Grey" }, priceMinor: 12900 },
        ],
      },
      {
        id: "prod_bottle",
        name: "Aerospace Grade Titanium Water Bottle 750ml",
        slug: "titanium-water-bottle-750ml",
        brand: "Stockroom Gear",
        description: "Ultra-lightweight vacuum insulated bottle with anti-microbial pure titanium construction.",
        status: "active" as const,
        variants: [
          { id: "var_bottle_matte", sku: "BOTTLE-750-MATTE", barcode: "8901234567893", attributes: { finish: "Matte Black" }, priceMinor: 8900 },
          { id: "var_bottle_polished", sku: "BOTTLE-750-POLISHED", barcode: "8901234567894", attributes: { finish: "Raw Titanium" }, priceMinor: 9500 },
        ],
      },
      {
        id: "prod_wallet",
        name: "Minimalist Full-Grain Leather Cardholder",
        slug: "minimalist-leather-cardholder",
        brand: "Stockroom Leather",
        description: "Hand-stitched vegetable tanned Italian leather with RFID blocking foil.",
        status: "active" as const,
        variants: [
          { id: "var_wallet_blk", sku: "WALLET-LTHR-BLK", barcode: "8901234567895", attributes: { color: "Obsidian Black" }, priceMinor: 4900 },
          { id: "var_wallet_brn", sku: "WALLET-LTHR-BRN", barcode: "8901234567896", attributes: { color: "Cognac Brown" }, priceMinor: 4900 },
        ],
      },
      {
        id: "prod_keyboard",
        name: "Custom Mechanical Keyboard 75% Gasket Mount",
        slug: "custom-mechanical-keyboard-75",
        brand: "Stockroom Tech",
        description: "CNC aluminum case, hot-swappable PCB, lubricated linear switches, and sound-dampening poron foam.",
        status: "active" as const,
        variants: [
          { id: "var_kb_blk", sku: "KB-75-LIN-BLK", barcode: "8901234567897", attributes: { color: "Anodized Black", switches: "Linear 45g" }, priceMinor: 19900 },
          { id: "var_kb_wht", sku: "KB-75-LIN-WHT", barcode: "8901234567898", attributes: { color: "E-White", switches: "Linear 45g" }, priceMinor: 21900 },
        ],
      },
    ];

    for (const p of productsData) {
      await db
        .insert(schema.products)
        .values({
          id: p.id,
          organizationId: "org_stockroom_main",
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          description: p.description,
          status: p.status,
        })
        .onConflictDoNothing();

      for (const v of p.variants) {
        await db
          .insert(schema.productVariants)
          .values({
            id: v.id,
            organizationId: "org_stockroom_main",
            productId: p.id,
            sku: v.sku,
            barcode: v.barcode,
            variantAttributes: v.attributes,
            unitOfMeasure: "unit",
            weight: 350,
            status: "active",
          })
          .onConflictDoNothing();

        // USD Price
        await db
          .insert(schema.productPrices)
          .values({
            id: `prc_${v.id}_usd`,
            organizationId: "org_stockroom_main",
            storeId: "store_nyc",
            variantId: v.id,
            currency: "USD",
            amountMinor: v.priceMinor,
            effectiveFrom: new Date(),
          })
          .onConflictDoNothing();

        // GBP Price
        await db
          .insert(schema.productPrices)
          .values({
            id: `prc_${v.id}_gbp`,
            organizationId: "org_stockroom_main",
            storeId: "store_london",
            variantId: v.id,
            currency: "GBP",
            amountMinor: Math.round(v.priceMinor * 0.8),
            effectiveFrom: new Date(),
          })
          .onConflictDoNothing();

        // Initialize inventory balances with 100 on-hand at Main WH, 25 at NYC storefront
        await db
          .insert(schema.inventoryBalances)
          .values({
            id: `bal_${v.id}_nj`,
            organizationId: "org_stockroom_main",
            locationId: "loc_nj_warehouse",
            variantId: v.id,
            onHand: 100,
            reserved: 0,
            version: 1,
          })
          .onConflictDoNothing();

        await db
          .insert(schema.inventoryMovements)
          .values({
            id: `mov_init_${v.id}_nj`,
            organizationId: "org_stockroom_main",
            locationId: "loc_nj_warehouse",
            variantId: v.id,
            movementType: "receipt",
            quantityDelta: 100,
            referenceType: "receipt",
            referenceId: `REC-INITIAL-${v.sku}`,
            reason: "Initial warehouse stock receipt",
            actorId: "usr_inventory",
            idempotencyKey: `init_rec_${v.id}_nj`,
          })
          .onConflictDoNothing();

        await db
          .insert(schema.inventoryBalances)
          .values({
            id: `bal_${v.id}_nyc`,
            organizationId: "org_stockroom_main",
            locationId: "loc_nyc_stockroom",
            variantId: v.id,
            onHand: 25,
            reserved: 0,
            version: 1,
          })
          .onConflictDoNothing();

        await db
          .insert(schema.inventoryMovements)
          .values({
            id: `mov_init_${v.id}_nyc`,
            organizationId: "org_stockroom_main",
            locationId: "loc_nyc_stockroom",
            variantId: v.id,
            movementType: "receipt",
            quantityDelta: 25,
            referenceType: "receipt",
            referenceId: `REC-STORE-${v.sku}`,
            reason: "Initial retail storefront intake",
            actorId: "usr_inventory",
            idempotencyKey: `init_rec_${v.id}_nyc`,
          })
          .onConflictDoNothing();
      }
    }

    // 6. Seed sample real orders and fulfillments
    console.log("Seeding sample orders and workflows...");
    const sampleOrderId = "ord_seed_1001";
    await db
      .insert(schema.orders)
      .values({
        id: sampleOrderId,
        organizationId: "org_stockroom_main",
        storeId: "store_nyc",
        orderNumber: "ORD-9281-7412",
        source: "internal_dashboard",
        orderStatus: "processing",
        currency: "USD",
        subtotalMinor: 25800,
        discountMinor: 0,
        taxMinor: 0,
        shippingMinor: 1500,
        totalMinor: 27300,
        customerReference: "alice.walker@example.com (Alice Walker)",
        idempotencyKey: "seed_order_1001_key",
      })
      .onConflictDoNothing();

    await db
      .insert(schema.orderLines)
      .values([
        {
          id: "line_seed_1",
          orderId: sampleOrderId,
          variantId: "var_hoodie_m_nvy",
          skuSnapshot: "HOODIE-M-NVY",
          productNameSnapshot: "Ultra-Comfort Merino Wool Hoodie",
          quantityOrdered: 2,
          quantityFulfilled: 0,
          unitPriceMinor: 12900,
          discountMinor: 0,
          taxMinor: 0,
          lineTotalMinor: 25800,
        },
      ])
      .onConflictDoNothing();

    // Reserve 2 units of HOODIE-M-NVY
    await db
      .insert(schema.inventoryMovements)
      .values({
        id: "mov_seed_res_1",
        organizationId: "org_stockroom_main",
        locationId: "loc_nj_warehouse",
        variantId: "var_hoodie_m_nvy",
        movementType: "reservation",
        quantityDelta: 2,
        referenceType: "order",
        referenceId: sampleOrderId,
        reason: `Reserved 2 units for order ${sampleOrderId}`,
        actorId: "usr_order",
        idempotencyKey: `res_${sampleOrderId}_var_hoodie_m_nvy`,
      })
      .onConflictDoNothing();

    await db
      .update(schema.inventoryBalances)
      .set({ reserved: 2 })
      .where(eq(schema.inventoryBalances.id, "bal_var_hoodie_m_nvy_nj"));

    // Payment for sample order
    await db
      .insert(schema.payments)
      .values({
        id: "pay_seed_1001",
        organizationId: "org_stockroom_main",
        orderId: sampleOrderId,
        provider: "simulated",
        providerPaymentId: "sim_pay_seed_99812",
        paymentStatus: "captured",
        currency: "USD",
        authorizedAmountMinor: 27300,
        capturedAmountMinor: 27300,
        refundedAmountMinor: 0,
        idempotencyKey: "seed_pay_1001_key",
      })
      .onConflictDoNothing();

    // Audit Event for seed order
    await db
      .insert(schema.auditEvents)
      .values({
        id: "aud_seed_001",
        organizationId: "org_stockroom_main",
        storeId: "store_nyc",
        actorId: "usr_order",
        action: "order.created",
        resourceType: "order",
        resourceId: sampleOrderId,
        reason: "Seed transaction for testing operational dashboard",
      })
      .onConflictDoNothing();

    console.log("Database seeded successfully with all roles, products, inventory, and orders!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
