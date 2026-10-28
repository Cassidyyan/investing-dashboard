import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AllocationDonut } from "@/components/holdings/AllocationDonut";
import { allocationView } from "@/lib/holdings/holdings-view";
import type { AccountData } from "@/lib/types";
function account(values: number[]): AccountData {
  return {
    account: {
      id: "test",
      name: "Test",
      institution: "Test",
      suffix: "1234",
      type: "Test",
      value: { amount: 100, currency: "CAD" },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    balances: { status: "ok", data: [] },
    positions: {
      status: "ok",
      data: {
        asOf: null,
        rows: values.map((amount, index) => ({
          symbol: `TEST${index}`,
          description: "Test",
          kind: "stock",
          units: 1,
          price: { amount, currency: "CAD" },
          value: { amount, currency: "CAD" },
        })),
      },
    },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
afterEach(() => vi.restoreAllMocks());
it.each([[100], [60, 40]])(
  "renders SVG titles as single strings without React warnings: %j",
  (...values) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const allocation = allocationView([account(values)], "CAD", "holding", {
      status: "error",
      message: "Native CAD does not need FX",
    });
    const html = renderToStaticMarkup(
      createElement(AllocationDonut, {
        items: allocation.items,
        total: allocation.total,
        currency: "CAD",
      }),
    );
    expect(html).toContain(
      `<title>TEST0 · stock: ${values.length === 1 ? "100.0" : "60.0"}%</title>`,
    );
    expect(errors).not.toHaveBeenCalled();
  },
);
