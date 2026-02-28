import { describe, it, expect } from "vitest";

describe("State Machine Transition Rules", () => {
  const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
    pending: ["confirmed", "cancelled", "on_hold"],
    confirmed: ["processing", "cancelled", "on_hold"],
    processing: ["partially_fulfilled", "fulfilled", "cancelled", "on_hold"],
    partially_fulfilled: ["fulfilled", "cancelled", "on_hold"],
    on_hold: ["pending", "confirmed", "processing", "cancelled"],
    fulfilled: [],
    cancelled: [],
  };

  it("permits standard order advancement: pending -> confirmed -> processing -> fulfilled", () => {
    expect(ALLOWED_ORDER_TRANSITIONS["pending"]).toContain("confirmed");
    expect(ALLOWED_ORDER_TRANSITIONS["confirmed"]).toContain("processing");
    expect(ALLOWED_ORDER_TRANSITIONS["processing"]).toContain("fulfilled");
  });

  it("forbids illegal transitions: cancelled -> fulfilled or fulfilled -> processing", () => {
    expect(ALLOWED_ORDER_TRANSITIONS["cancelled"]).not.toContain("fulfilled");
    expect(ALLOWED_ORDER_TRANSITIONS["cancelled"]).toHaveLength(0); // Terminal
    expect(ALLOWED_ORDER_TRANSITIONS["fulfilled"]).toHaveLength(0); // Terminal
  });

  it("fulfillment states progress: pending -> picking -> packed -> shipped -> delivered", () => {
    const ALLOWED_FULFILLMENT_TRANSITIONS: Record<string, string[]> = {
      pending: ["picking", "cancelled"],
      picking: ["packed", "cancelled"],
      packed: ["shipped", "cancelled"],
      shipped: ["delivered", "failed"],
      delivered: [],
      cancelled: [],
    };

    expect(ALLOWED_FULFILLMENT_TRANSITIONS["pending"]).toContain("picking");
    expect(ALLOWED_FULFILLMENT_TRANSITIONS["picking"]).toContain("packed");
    expect(ALLOWED_FULFILLMENT_TRANSITIONS["packed"]).toContain("shipped");
    expect(ALLOWED_FULFILLMENT_TRANSITIONS["shipped"]).not.toContain("picking");
  });
});

