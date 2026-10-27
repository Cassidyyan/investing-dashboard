import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SummaryCards } from "../src/components/SummaryCards";
import { money } from "../src/lib/format";
import type { AccountData } from "../src/lib/types";
function account(
  id: string,
  total: number,
  cash: number,
  currency: string,
  cashOnly = false,
): AccountData {
  return {
    cashOnly,
    account: {
      id,
      name: id,
      type: "Test",
      institution: "Test",
      suffix: "1234",
      value: { amount: total, currency },
      syncedAt: null,
      incomplete: false,
      stale: false,
    },
    balances: {
      status: "ok",
      data: [
        {
          cash: { amount: cash, currency },
          buyingPower: { amount: null, currency },
        },
      ],
    },
    positions: { status: "ok", data: { rows: [], asOf: null } },
    orders: { status: "ok", data: [] },
    activities: { status: "ok", data: { rows: [], total: 0 } },
  };
}
it("includes banking cash while keeping portfolio value and account count investing-only", () => {
  const invest = account("invest", 1000, 10, "CAD");
  const bank = account("bank", 500, 100, "CAD", true);
  const usd = account("usd-bank", 200, 200, "USD", true);
  const html = renderToStaticMarkup(
    createElement(SummaryCards, {
      accounts: [invest],
      cashAccounts: [invest, bank, usd],
    }),
  );
  const cards = html.split("</article>");
  expect(cards[0]).toContain(money({ amount: 1000, currency: "CAD" }));
  expect(cards[0]).not.toContain(money({ amount: 1700, currency: "CAD" }));
  expect(cards[1]).toContain(money({ amount: 110, currency: "CAD" }));
  expect(cards[1]).toContain(money({ amount: 200, currency: "USD" }));
  expect(cards[2]).toContain("<strong>01</strong>");
});
it("marks cash partial when a banking balance fails or returns no records", () => {
  const invest = account("invest", 1000, 10, "CAD");
  for (const balances of [
    { status: "error" as const, message: "Unavailable" },
    { status: "ok" as const, data: [] },
  ]) {
    const bank = { ...account("bank", 500, 100, "CAD", true), balances };
    const html = renderToStaticMarkup(
      createElement(SummaryCards, {
        accounts: [invest],
        cashAccounts: [invest, bank],
      }),
    );
    expect(html).toContain("Partial or stale · some balances unavailable");
    expect(html).toContain(money({ amount: 10, currency: "CAD" }));
  }
});
