// Infer an internal move only when a unique pair and both ending share counts
// prove direction. Carry recorded source basis, never a current market price.
import type { AccountData } from "@/lib/types";
import type {
  SecurityTransaction,
  TransactionHistory,
} from "@/lib/returns/holding-returns";
import { verifiedClosedSnapshot } from "./closed-snapshot";
import { reconcileTransferChains } from "./reconcile-transfer-chains";
const near = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.00001, Math.abs(b) * 0.000001);
const transfer = (t: SecurityTransaction) =>
  t.type === "TRANSFER" &&
  t.amount === 0 &&
  t.units !== null &&
  t.units > 0 &&
  !!t.date &&
  !t.issue &&
  !t.fee;
export function reconcileTransfers(
  accounts: AccountData[],
  histories: TransactionHistory[],
): TransactionHistory[] {
  histories = reconcileTransferChains(accounts, histories);
  const replacements = new Map<SecurityTransaction, SecurityTransaction>();
  const candidates = histories.flatMap((h) =>
    h.transactions.filter(transfer).map((t) => ({ h, t })),
  );
  function endingDelta(
    h: TransactionHistory,
    t: SecurityTransaction,
  ): number | null {
    const account = accounts.find((a) => a.account.id === h.accountId);
    if (
      !account ||
      h.issues.length ||
      account.positions.status !== "ok" ||
      account.account.incomplete ||
      (account.account.stale && !verifiedClosedSnapshot(account, h, t.symbol))
    )
      return null;
    const rows = h.transactions.filter((r) => r.symbol === t.symbol);
    // Multiple transfer legs, corporate actions, or incomplete trades make this
    // inference ambiguous. They must be handled by an explicit richer ledger.
    if (
      rows.filter((r) => r.type === "TRANSFER").length !== 1 ||
      rows.some(
        (r) =>
          ![
            "BUY",
            "SELL",
            "TRANSFER",
            "DIVIDEND",
            "SUBSTITUTE_DIVIDEND",
            "FEE",
            "TAX",
          ].includes(r.type),
      )
    )
      return null;
    const trades = rows.filter((r) => r.type === "BUY" || r.type === "SELL");
    if (
      trades.some(
        (r) =>
          r.units === null ||
          r.units <= 0 ||
          !r.date ||
          r.currency !== t.currency ||
          r.issue ||
          r.date === t.date,
      )
    )
      return null;
    const held = account.positions.data.rows.filter(
      (p) => p.symbol === t.symbol && p.value.currency === t.currency,
    );
    if (held.some((p) => p.units === null || p.units < 0)) return null;
    const current = held.reduce((n, p) => n + (p.units ?? 0), 0);
    const traded = trades.reduce(
      (n, r) => n + (r.type === "BUY" ? r.units! : -r.units!),
      0,
    );
    return current - traded;
  }
  for (const candidate of candidates) {
    if (replacements.has(candidate.t)) continue;
    const matches = candidates.filter(
      (other) =>
        other.h.accountId !== candidate.h.accountId &&
        other.t.symbol === candidate.t.symbol &&
        other.t.currency === candidate.t.currency &&
        other.t.date === candidate.t.date &&
        near(other.t.units!, candidate.t.units!),
    );
    if (matches.length !== 1) continue;
    const other = matches[0];
    const reverse = candidates.filter(
      (x) =>
        x.h.accountId !== other.h.accountId &&
        x.t.symbol === other.t.symbol &&
        x.t.currency === other.t.currency &&
        x.t.date === other.t.date &&
        near(x.t.units!, other.t.units!),
    );
    if (reverse.length !== 1 || replacements.has(other.t)) continue;
    const a = accounts.find((a) => a.account.id === candidate.h.accountId),
      b = accounts.find((a) => a.account.id === other.h.accountId);
    if (
      !a ||
      !b ||
      !a.account.institution ||
      a.account.institution === "Unknown institution" ||
      a.account.institution !== b.account.institution
    )
      continue;
    const deltaA = endingDelta(candidate.h, candidate.t),
      deltaB = endingDelta(other.h, other.t),
      quantity = candidate.t.units!;
    if (deltaA === null || deltaB === null) continue;
    const source =
      near(deltaA, -quantity) && near(deltaB, quantity)
        ? candidate
        : near(deltaB, -quantity) && near(deltaA, quantity)
          ? other
          : null;
    if (!source) continue;
    const destination = source === candidate ? other : candidate;
    if (
      source.t.transferDirection === "in" ||
      destination.t.transferDirection === "out"
    )
      continue;
    let units = 0,
      basis = 0,
      valid = true;
    let firstPurchase: string | undefined;
    const earlier = source.h.transactions
      .filter(
        (r) =>
          r.symbol === source.t.symbol && r.date && r.date < source.t.date!,
      )
      .sort((a, b) => a.order.localeCompare(b.order));
    for (const r of earlier) {
      if (!["BUY", "SELL"].includes(r.type)) continue;
      if (
        r.issue ||
        r.currency !== source.t.currency ||
        r.amount === null ||
        r.units === null ||
        r.units <= 0 ||
        r.fee
      ) {
        valid = false;
        break;
      }
      if (r.type === "BUY") {
        if (r.amount >= 0) {
          valid = false;
          break;
        }
        units += r.units;
        basis -= r.amount;
        firstPurchase ||= r.date!;
      } else {
        if (
          units <= 0 ||
          r.amount < 0 ||
          (r.units > units && !near(r.units, units))
        ) {
          valid = false;
          break;
        }
        basis *= Math.max(0, 1 - r.units / units);
        units = Math.max(0, units - r.units);
      }
    }
    if (
      !valid ||
      units <= 0 ||
      (quantity > units && !near(quantity, units)) ||
      !firstPurchase
    )
      continue;
    const transferredBasis = (basis * quantity) / units;
    if (!Number.isFinite(transferredBasis) || transferredBasis <= 0) continue;
    const note =
      "Internal share transfer reconciled: original recorded purchase cost carried between accounts; no sale profit or new purchase counted.";
    replacements.set(source.t, {
      ...source.t,
      type: "SELL",
      amount: transferredBasis,
      units: quantity,
      fee: 0,
      basisTransfer: true,
      originalPurchaseDate: firstPurchase,
      note,
    });
    replacements.set(destination.t, {
      ...destination.t,
      type: "BUY",
      amount: -transferredBasis,
      units: quantity,
      fee: 0,
      basisTransfer: true,
      originalPurchaseDate: firstPurchase,
      note,
    });
  }
  return histories.map((h) => ({
    ...h,
    transactions: h.transactions.map((t) => replacements.get(t) || t),
  }));
}
