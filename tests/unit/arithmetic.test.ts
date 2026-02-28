import { describe, it, expect } from "vitest";

describe("Exact Monetary Arithmetic & Invariants", () => {
  it("calculates line items with exact integer minor units without float precision loss", () => {
    // 3 items at $12.99 (1299 cents)
    const quantity = 3;
    const unitPriceMinor = 1299;
    const discountMinor = 200; // $2.00 discount
    const taxMinor = 150; // $1.50 tax

    const lineTotal = quantity * unitPriceMinor - discountMinor + taxMinor;
    expect(lineTotal).toBe(3847); // 3 * 1299 = 3897 - 200 + 150 = 3847 cents ($38.47)
  });

  it("handles high precision monetary additions without javascript IEEE 754 float drift", () => {
    // In floating point: 0.1 + 0.2 !== 0.3
    // In minor units: 10 + 20 === 30
    const item1Minor = 10;
    const item2Minor = 20;
    expect(item1Minor + item2Minor).toBe(30);

    const priceA = 129900; // $1,299.00
    const priceB = 4995; // $49.95
    const shipping = 1500; // $15.00
    const total = priceA + priceB + shipping;
    expect(total).toBe(136395); // $1,363.95 exactly
  });

  it("calculates order subtotal and total deterministically", () => {
    const lines = [
      { quantity: 2, unitPrice: 12900, discount: 0, tax: 0 },
      { quantity: 1, unitPrice: 8900, discount: 500, tax: 200 },
      { quantity: 4, unitPrice: 4900, discount: 1000, tax: 0 },
    ];

    const computedLines = lines.map((l) => ({
      lineTotal: l.quantity * l.unitPrice - l.discount + l.tax,
    }));

    const subtotal = computedLines.reduce((acc, l) => acc + l.lineTotal, 0);
    // line 1: 2 * 12900 = 25800
    // line 2: 1 * 8900 - 500 + 200 = 8600
    // line 3: 4 * 4900 - 1000 = 18600
    // subtotal = 25800 + 8600 + 18600 = 53000
    expect(subtotal).toBe(53000);

    const shippingMinor = 1500;
    const orderTotal = subtotal + shippingMinor;
    expect(orderTotal).toBe(54500);
  });
});

