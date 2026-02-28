import { describe, it, expect } from "vitest";
import { InventoryService } from "@/server/services/inventory-service";
import { CatalogService } from "@/server/services/catalog-service";
import { db } from "@/db/client";
import { inventoryBalances } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Inventory Balance-to-Ledger Reconciliation Tests", () => {
  const orgId = "org_stockroom_main";
  const locationId = "loc_nj_warehouse";
  const actorId = "usr_inventory";

  it("reconciles accurate ledger movements when no discrepancy exists", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Recon Clean Product", slug: `recon-clean-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `RECON-CLEAN-${Date.now().toString().slice(-5)}` },
      actorId
    );

    // Receive 50
    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 50 },
      actorId
    );

    // Adjust +10
    await InventoryService.adjustInventory(
      orgId,
      { locationId, variantId: variant.id, quantityDelta: 10, reason: "Adjustment test" },
      actorId
    );

    const report = await InventoryService.reconcileInventory(orgId, locationId, variant.id);

    expect(report.discrepancyDetected).toBe(false);
    expect(report.storedOnHand).toBe(60);
    expect(report.calculatedOnHand).toBe(60);
    expect(report.differenceOnHand).toBe(0);
  });

  it("detects discrepancy and generates auditable compensating correction", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Recon Drift Product", slug: `recon-drift-${Date.now()}` },
      actorId
    );
    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: `RECON-DRIFT-${Date.now().toString().slice(-5)}` },
      actorId
    );

    await InventoryService.receiveStock(
      orgId,
      { locationId, variantId: variant.id, quantity: 40 },
      actorId
    );

    // Simulate an external physical discrepancy by artificially altering the stored balance
    const balance = await InventoryService.getOrCreateBalance(db, orgId, locationId, variant.id);
    await db
      .update(inventoryBalances)
      .set({ onHand: 35 }) // Stored is 35, ledger says 40
      .where(eq(inventoryBalances.id, balance.id));

    // Run reconciliation check
    const report = await InventoryService.reconcileInventory(orgId, locationId, variant.id);
    expect(report.discrepancyDetected).toBe(true);
    expect(report.storedOnHand).toBe(35);
    expect(report.calculatedOnHand).toBe(40);
    expect(report.differenceOnHand).toBe(-5);

    // Perform authorized repair
    const repairResult = await InventoryService.repairDiscrepancy(
      orgId,
      locationId,
      variant.id,
      "Resolved cycle count discrepancy: reconciling ledger to match physical count of 35",
      actorId
    );

    expect(repairResult.repaired).toBe(true);
    expect(repairResult.balance.onHand).toBe(35);
    expect(repairResult.movement?.movementType).toBe("correction");

    // Verify subsequent reconciliation is clean
    const postRepairReport = await InventoryService.reconcileInventory(orgId, locationId, variant.id);
    expect(postRepairReport.discrepancyDetected).toBe(false);
    expect(postRepairReport.storedOnHand).toBe(35);
    expect(postRepairReport.calculatedOnHand).toBe(35);
  });
});
