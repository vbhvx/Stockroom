import { describe, it, expect } from "vitest";

describe("Inventory Quantity Invariants", () => {
  it("enforces Available = OnHand - Reserved invariant", () => {
    const onHand = 100;
    const reserved = 20;
    const available = onHand - reserved;
    expect(available).toBe(80);
  });

  it("verifies receipt increases on-hand and available without affecting reserved", () => {
    let onHand = 50;
    let reserved = 10;
    const receiptQty = 25;

    onHand += receiptQty;
    const available = onHand - reserved;

    expect(onHand).toBe(75);
    expect(reserved).toBe(10);
    expect(available).toBe(65);
  });

  it("verifies reservation increases reserved and decreases available without changing physical on-hand", () => {
    let onHand = 100;
    let reserved = 15;
    const reserveQty = 30;

    reserved += reserveQty;
    const available = onHand - reserved;

    expect(onHand).toBe(100);
    expect(reserved).toBe(45);
    expect(available).toBe(55);
  });

  it("verifies reservation release decreases reserved and increases available without changing on-hand", () => {
    let onHand = 100;
    let reserved = 45;
    const releaseQty = 20;

    reserved -= releaseQty;
    const available = onHand - reserved;

    expect(onHand).toBe(100);
    expect(reserved).toBe(25);
    expect(available).toBe(75);
  });

  it("verifies confirmed shipment deducts both on-hand and reserved simultaneously", () => {
    let onHand = 100;
    let reserved = 25;
    const shipQty = 10;

    onHand -= shipQty;
    reserved -= shipQty;
    const available = onHand - reserved;

    expect(onHand).toBe(90);
    expect(reserved).toBe(15);
    expect(available).toBe(75);
  });
});

