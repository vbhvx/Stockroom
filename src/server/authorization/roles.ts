export type Role =
  | "owner"
  | "admin"
  | "catalog_manager"
  | "inventory_manager"
  | "order_manager"
  | "fulfillment_staff"
  | "finance_staff"
  | "support_staff"
  | "viewer";

export type Permission =
  | "canManageCatalog"
  | "canChangePrice"
  | "canReceiveStock"
  | "canAdjustInventory"
  | "canManageReservations"
  | "canViewOrder"
  | "canCancelOrder"
  | "canInitiateRefund"
  | "canApproveRefund"
  | "canDispatchFulfillment"
  | "canManageStaff"
  | "canViewAuditHistory"
  | "canExportData";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
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
  ],
  admin: [
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
  ],
  catalog_manager: [
    "canManageCatalog",
    "canChangePrice",
    "canViewOrder",
    "canExportData",
  ],
  inventory_manager: [
    "canReceiveStock",
    "canAdjustInventory",
    "canManageReservations",
    "canViewOrder",
    "canExportData",
  ],
  order_manager: [
    "canViewOrder",
    "canCancelOrder",
    "canManageReservations",
    "canExportData",
  ],
  fulfillment_staff: [
    "canViewOrder",
    "canDispatchFulfillment",
  ],
  finance_staff: [
    "canViewOrder",
    "canInitiateRefund",
    "canApproveRefund",
    "canViewAuditHistory",
    "canExportData",
  ],
  support_staff: [
    "canViewOrder",
  ],
  viewer: [
    "canViewOrder",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: Role '${role}' lacks required permission '${permission}'`);
  }
}

