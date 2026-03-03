import { describe, it, expect } from "vitest";
import { StaffService } from "@/server/services/staff-service";
import { assertPermission } from "@/server/authorization/roles";
import { defaultPaymentAdapter } from "@/server/integrations/payments/simulated-adapter";
import { PaymentService } from "@/server/services/payment-service";

describe("Security & Access Control Enforcement Tests", () => {
  const orgId = "org_stockroom_main";

  it("blocks a Viewer role from sensitive write operations", () => {
    // Asserting permissions for viewer must throw Forbidden error
    expect(() => assertPermission("viewer", "canAdjustInventory")).toThrow(/Forbidden/);
    expect(() => assertPermission("viewer", "canInitiateRefund")).toThrow(/Forbidden/);
    expect(() => assertPermission("viewer", "canManageStaff")).toThrow(/Forbidden/);
    expect(() => assertPermission("viewer", "canManageCatalog")).toThrow(/Forbidden/);
  });

  it("prevents demoting or removing the organization's sole remaining Owner", async () => {
    const staff = await StaffService.listStaff(orgId);
    const ownerMembership = staff.find((s) => s.role === "owner");
    expect(ownerMembership).toBeDefined();

    // Attempting to demote sole owner to admin must be blocked
    await expect(
      StaffService.updateStaffRole(
        orgId,
        ownerMembership!.membershipId,
        "admin",
        "malicious_actor"
      )
    ).rejects.toThrow(/Cannot demote the organization's sole remaining Owner/i);

    // Attempting to delete sole owner must be blocked
    await expect(
      StaffService.removeStaff(
        orgId,
        ownerMembership!.membershipId,
        "malicious_actor"
      )
    ).rejects.toThrow(/Cannot remove the organization's sole remaining Owner/i);
  });

  it("rejects unauthorized webhook payloads missing valid HMAC signatures", async () => {
    const unverifiedPayload = JSON.stringify({
      eventId: "evil_hacker_event",
      eventType: "payment.captured",
      providerPaymentId: "fake_id",
      status: "captured",
    });

    await expect(
      PaymentService.processWebhook(
        "simulated",
        unverifiedPayload,
        "v1=tampered_fake_signature_hash"
      )
    ).rejects.toThrow(/invalid webhook signature/i);
  });
});

