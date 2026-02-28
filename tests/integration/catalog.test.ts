import { describe, it, expect } from "vitest";
import { CatalogService } from "@/server/services/catalog-service";

describe("Catalog Management Integration Tests", () => {
  const orgId = "org_stockroom_main";
  const actorId = "usr_catalog";

  it("creates a product and sellable variant with unique SKU", async () => {
    const testSlug = `test-jacket-${Date.now()}`;
    const testSku = `JKT-${Date.now().toString().slice(-6)}`;

    const product = await CatalogService.createProduct(
      orgId,
      {
        name: "All-Weather Technical Shell Jacket",
        slug: testSlug,
        brand: "Stockroom Outerwear",
        status: "active",
      },
      actorId
    );

    expect(product.id).toBeDefined();
    expect(product.name).toBe("All-Weather Technical Shell Jacket");

    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      {
        sku: testSku,
        barcode: "1234567890123",
        variantAttributes: { size: "XL", color: "Stealth Black" },
        unitOfMeasure: "unit",
        price: {
          storeId: "store_nyc",
          currency: "USD",
          amountMinor: 24900, // $249.00
        },
      },
      actorId
    );

    expect(variant.id).toBeDefined();
    expect(variant.sku).toBe(testSku);

    // Verify duplicate SKU in the same organization is rejected
    await expect(
      CatalogService.createVariant(
        orgId,
        product.id,
        {
          sku: testSku,
        },
        actorId
      )
    ).rejects.toThrow(/already exists/i);
  });

  it("sets and updates store-specific pricing in minor units", async () => {
    const testSku = `PRC-TEST-${Date.now().toString().slice(-5)}`;
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Pricing Test Product", slug: `pricing-test-${Date.now()}` },
      actorId
    );

    const variant = await CatalogService.createVariant(
      orgId,
      product.id,
      { sku: testSku },
      actorId
    );

    const price = await CatalogService.setProductPrice(
      orgId,
      "store_nyc",
      variant.id,
      "USD",
      15999, // $159.99
      actorId
    );

    expect(price.amountMinor).toBe(15999);
    expect(price.currency).toBe("USD");
  });

  it("archives a product without deleting historical records", async () => {
    const product = await CatalogService.createProduct(
      orgId,
      { name: "Archive Me Product", slug: `archive-me-${Date.now()}` },
      actorId
    );

    const archived = await CatalogService.archiveProduct(orgId, product.id, actorId);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeDefined();

    // Still readable
    const retrieved = await CatalogService.getProduct(orgId, product.id);
    expect(retrieved.status).toBe("archived");
  });
});

