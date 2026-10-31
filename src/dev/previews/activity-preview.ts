// Explicitly synthetic development/test data. Never used as a live-request fallback.
import { createAccountsPreview } from "./accounts-preview";
import type { Portfolio } from "@/lib/types";
export const activityPreviews = [
  "sample",
  "loading",
  "empty",
  "error",
  "hidden",
] as const;
export type ActivityPreview = (typeof activityPreviews)[number];
export function createActivityPreview(state: ActivityPreview): Portfolio {
  const portfolio = createAccountsPreview(
    state === "empty" ? "empty" : state === "error" ? "error" : "sample",
  ).portfolio;
  if (portfolio.accounts.status === "ok" && state !== "empty") {
    portfolio.retrievedAt = "2026-10-28T18:00:00Z";
    portfolio.accounts.data = portfolio.accounts.data.map((account, index) => ({
      ...account,
      activities: {
        status: "ok",
        data: {
          total: 8,
          rows: Array.from({ length: 8 }, (_, i) => ({
            description: `Synthetic ${i % 2 ? "dividend" : "purchase"} ${index + 1}-${i + 1}`,
            type: i % 2 ? "DIVIDEND" : "BUY",
            date: `2026-10-${String(28 - i).padStart(2, "0")}T12:00:00Z`,
            amount: {
              amount: i % 2 ? 2.5 : -50,
              currency: index % 2 ? "USD" : "CAD",
            },
          })),
        },
      },
      orders: {
        status: "ok",
        data: [
          {
            symbol: "SYNTH",
            action: "BUY",
            status: "EXECUTED",
            quantity: 1,
            placedAt: "2026-10-28T12:00:00Z",
          },
        ],
      },
    }));
  }
  return portfolio;
}
