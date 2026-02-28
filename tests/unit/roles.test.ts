import { describe, it, expect } from "vitest";
import {
  hasPermission,
  assertPermission,
  ROLE_PERMISSIONS,
  Role,
  Permission,
} from "@/server/authorization/roles";

describe("Staff Roles & Access Control Matrix", () => {
  it("Owner and Admin possess all granular permissions", () => {
    const allPermissions: Permission[] = [
      "canManageCatalog",
      "canChangePrice",
      "canReceiveStock",
      "canAdjustInventory",
      "canManageReservations",
      "canViewOrder",
      "canCancelOrder",
      "canInitiateRefund",
      "canApproveRefund",
      "canDispatchFulfillment",
      "canManageStaff",
      "canViewAuditHistory",
      "canExportData",
    ];

    for (const perm of allPermissions) {
      expect(hasPermission("owner", perm)).toBe(true);
      expect(hasPermission("admin", perm)).toBe(true);
    }
  });

  it("Viewer only has canViewOrder permission and lacks write permissions", () => {
    expect(hasPermission("viewer", "canViewOrder")).toBe(true);
    expect(hasPermission("viewer", "canManageCatalog")).toBe(false);
    expect(hasPermission("viewer", "canReceiveStock")).toBe(false);
    expect(hasPermission("viewer", "canAdjustInventory")).toBe(false);
    expect(hasPermission("viewer", "canCancelOrder")).toBe(false);
    expect(hasPermission("viewer", "canInitiateRefund")).toBe(false);
    expect(hasPermission("viewer", "canDispatchFulfillment")).toBe(false);
    expect(hasPermission("viewer", "canManageStaff")).toBe(false);
  });

  it("Catalog Manager has catalog and price permissions but cannot receive stock or refund", () => {
    expect(hasPermission("catalog_manager", "canManageCatalog")).toBe(true);
    expect(hasPermission("catalog_manager", "canChangePrice")).toBe(true);
    expect(hasPermission("catalog_manager", "canReceiveStock")).toBe(false);
    expect(hasPermission("catalog_manager", "canInitiateRefund")).toBe(false);
  });

  it("Inventory Manager has stock receipt and adjustment permissions", () => {
    expect(hasPermission("inventory_manager", "canReceiveStock")).toBe(true);
    expect(hasPermission("inventory_manager", "canAdjustInventory")).toBe(true);
    expect(hasPermission("inventory_manager", "canManageReservations")).toBe(true);
    expect(hasPermission("inventory_manager", "canManageCatalog")).toBe(false);
    expect(hasPermission("inventory_manager", "canInitiateRefund")).toBe(false);
  });

  it("Finance Staff can initiate and approve refunds", () => {
    expect(hasPermission("finance_staff", "canInitiateRefund")).toBe(true);
    expect(hasPermission("finance_staff", "canApproveRefund")).toBe(true);
    expect(hasPermission("finance_staff", "canAdjustInventory")).toBe(false);
  });

  it("assertPermission throws descriptive Forbidden error when permission is lacking", () => {
    expect(() => assertPermission("viewer", "canAdjustInventory")).toThrow(
      "Forbidden: Role 'viewer' lacks required permission 'canAdjustInventory'"
    );
  });
});

