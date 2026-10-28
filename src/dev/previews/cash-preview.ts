// Explicitly invented development-only fixtures. Never a fallback for live data.
import { createAccountsPreview } from "@/dev/previews/accounts-preview";
import type { Portfolio } from "@/lib/types";
export const cashPreviews = [
  "sample",
  "loading",
  "refreshing",
  "empty",
  "error",
  "hidden",
] as const;
export type CashPreviewState = (typeof cashPreviews)[number];
export function createCashPreview(state: CashPreviewState): Portfolio {
  const { portfolio } = createAccountsPreview(state);
  if (portfolio.accounts.status !== "ok") return portfolio;
  const cashValues = [2500, 900, 1750];
  portfolio.accounts.data = portfolio.accounts.data.map((a, i) => ({
    ...a,
    cashOnly: true,
    account: {
      ...a.account,
      name: ["Sample chequing", "Sample cash-only investing", "Sample savings"][
        i
      ],
      institution: i === 1 ? "Sample brokerage" : "Sample bank",
      category: i === 1 ? "INVESTMENT" : "DEPOSIT",
      type: i === 1 ? "Non-registered" : "Deposit",
      value: {
        amount: i === 2 ? 1800 : cashValues[i],
        currency: i === 1 ? "USD" : "CAD",
      },
    },
    balances: {
      status: "ok",
      data: [
        {
          cash: { amount: cashValues[i], currency: i === 1 ? "USD" : "CAD" },
          buyingPower: { amount: null, currency: i === 1 ? "USD" : "CAD" },
        },
      ],
    },
    positions: { status: "ok", data: { rows: [], asOf: null } },
  }));
  return portfolio;
}
