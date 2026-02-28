import { describe, it, expect } from "vitest";
import { CatalogService } from "@/server/services/catalog-service";
import { OrderService } from "@/server/services/order-service";
import { StaffService } from "@/server/services/staff-service";

describe("Multi-Tenant Organization Scoping & Isolation Tests", () => {
  const orgA = "org_stockroom_main";
  const orgB = "org_acme_retail";

  it("ensures products created in Org A are invisible to Org B", async () => {
    const slugA = `org-a-exclusive-${Date.now()}`;
    await CatalogService.createProduct(
      orgA,
      { name: "Org A Secret Product", slug: slugA },
      "usr_catalog"
    );

    const orgBProducts = await CatalogService.listProducts(orgB, { search: slugA });
    expect(orgBProducts).toHaveLength(0);

    const orgAProducts = await CatalogService.listProducts(orgA, { search: slugA });
    expect(orgAProducts.length).toBeGreaterThan(0);
  });

  it("prevents Org B from querying or modifying Org A orders", async () => {
    const orderA = await OrderService.createOrder(
      orgA,
      {
        storeId: "store_nyc",
        locationId: "loc_nj_warehouse",
        customerReference: "isolated@example.com",
        lines: [{ variantId: "var_hoodie_m_nvy", quantity: 1 }],
      },
      "usr_order"
    );

    // Org B attempts to retrieve orderA
    await expect(
      OrderService.getOrderDetails(orgB, orderA.id)
    ).rejects.toThrow(/not found/i);

    // Org B attempts to transition status
    await expect(
      OrderService.transitionStatus(orgB, orderA.id, "cancelled", "Malicious attempt", "usr_acme_admin")
    ).rejects.toThrow(/not found/i);
  });

  it("ensures staff lists are strictly isolated per tenant", async () => {
    const staffOrgA = await StaffService.listStaff(orgA);
    const staffOrgB = await StaffService.listStaff(orgB);

    const orgAEmails = staffOrgA.map((s) => s.email);
    const orgBEmails = staffOrgB.map((s) => s.email);

    expect(orgAEmails).toContain("owner@stockroom.internal");
    expect(orgBEmails).not.toContain("owner@stockroom.internal");
    expect(orgBEmails).toContain("admin@acme.internal");
    expect(orgAEmails).not.toContain("admin@acme.internal");
  });
});

