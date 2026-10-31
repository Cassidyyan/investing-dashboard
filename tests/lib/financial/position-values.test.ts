import { expect, it } from "vitest";
import { positionValues } from "@/lib/financial/position-values";
it("retains the valuation formula while eliminating decimal multiplication artifacts", () => {
  expect(
    positionValues({ units: "3", price: "0.1", cost: "0.03", multiplier: "1" }),
  ).toEqual({ marketValue: "0.3", unrealizedReturn: "0.21", invested: "0.09" });
});
it("preserves short direction, nonstandard multipliers and sub-cent premiums", () => {
  expect(
    positionValues({
      units: "-2",
      price: "1.125",
      cost: "1.25",
      multiplier: "150",
    }),
  ).toEqual({
    marketValue: "-337.5",
    unrealizedReturn: "37.5",
    invested: "375",
  });
});
it.each([
  { units: null, price: "1", cost: "1", multiplier: 100 },
  { units: 1, price: -1, cost: 1, multiplier: 100 },
  { units: 1, price: 1, cost: 1, multiplier: -100 },
  { units: 1, price: 1, cost: 1, multiplier: null },
])("does not fabricate values from invalid valuation inputs", (input) => {
  expect(positionValues(input).marketValue).toBeNull();
  expect(positionValues(input).unrealizedReturn).toBeNull();
});
it("does not convert missing cost to zero, and values a confirmed zero premium", () => {
  expect(
    positionValues({ units: 1, price: 0, cost: null, multiplier: 100 }),
  ).toEqual({ marketValue: "0", unrealizedReturn: null, invested: null });
});
