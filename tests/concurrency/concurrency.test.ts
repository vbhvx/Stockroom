import { describe, it, expect } from "vitest";
import { InventoryService } from "@/server/services/inventory-service";
import { CatalogService } from "@/server/services/catalog-service";
import { db } from "@/db/client";

describe("Concurrency & Anti-Overselling Tests", () => {
  const orgId = "org_stockroom_main";
  const locationId = "loc_nj_warehouse";
  const actorId = "usr_inventory";

  it("prevents overselling when multiple concurrent orders compete for limited stock", async () => {
    // 1. Create a limited stock variant
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Hot Drop Limited Sneaker", slug: `hot-drop-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `HOT-DROP-${Date.now().toString().slice(-5)}` },
      actorId
    );

    // Stock exactly 5 units
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 5 },
      actorId
    );

    // 2. Launch 5 simultaneous parallel reservation attempts of 2 units each
    // Total requested = 10 units, but only 5 units exist!
    const attempts = [1, 2, 3, 4, 5].map(async (attemptId) => {
      try {
        await db.transaction(async (tx) => {
          await InventoryService.reserveStock(
            tx,
            orgId,
            locationId,
            variant.id,
            2,
            `ord_parallel_${attemptId}_${Date.now()}`,
            actorId
          );
        });
        return { success: true, attemptId };
      } catch (err: any) {
        return { success: false, attemptId, error: err.message };
      }
    });

    const results = await Promise.all(attempts);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Exactly 2 attempts (2 * 2 = 4 units) can succeed. The remaining 3 must fail due to insufficient inventory!
    expect(succeeded.length).toBe(2);
    expect(failed.length).toBe(3);

    // Verify balance invariants
    const balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    expect(balance.onHand).toBe(5);
    expect(balance.reserved).toBe(4);
    expect(balance.onHand - balance.reserved).toBe(1); // 1 remaining available, never negative!
  });
});

