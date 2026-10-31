import type { AccountData } from "@/lib/types";
import type {
  SecurityTransaction,
  TransactionHistory,
} from "./holding-returns";
import { verifiedClosedSnapshot } from "./closed-snapshot";

const near = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.00001, Math.abs(b) * 0.000001);
type Leg = { t: SecurityTransaction; h: TransactionHistory; a: AccountData };
type Balance = { units: number; basis: number; first?: string };
type State = {
  balances: Map<string, Balance>;
  replacements: Map<SecurityTransaction, SecurityTransaction>;
};

// Positive transfer quantities alone do not specify direction. Search only small,
// uniquely paired chains; accept exactly one complete path that conserves shares
// and original purchase basis and agrees with both accounts' ending quantities.
export function reconcileTransferChains(
  accounts: AccountData[],
  histories: TransactionHistory[],
): TransactionHistory[] {
  const groups = new Map<string, Leg[]>();
  for (const h of histories) {
    const a = accounts.find((a) => a.account.id === h.accountId);
    if (
      !a ||
      !a.account.institution ||
      a.account.institution === "Unknown institution"
    )
      continue;
    for (const t of h.transactions.filter((t) => t.type === "TRANSFER")) {
      const key = JSON.stringify([a.account.institution, t.symbol, t.currency]);
      groups.set(key, [...(groups.get(key) || []), { t, h, a }]);
    }
  }
  const replacements = new Map<SecurityTransaction, SecurityTransaction>();
  for (const legs of groups.values()) {
    // The established single-pair matcher handles simpler moves separately.
    if (legs.length <= 2 || legs.length > 24) continue;
    const symbol = legs[0].t.symbol,
      currency = legs[0].t.currency;
    if (
      legs.some(
        ({ t, h, a }) =>
          !t.date ||
          t.units === null ||
          t.units <= 0 ||
          t.amount !== 0 ||
          t.fee !== 0 ||
          t.issue ||
          h.issues.length ||
          a.account.incomplete ||
          a.positions.status !== "ok" ||
          (a.account.stale && !verifiedClosedSnapshot(a, h, symbol)),
      )
    )
      continue;
    const pairs: [Leg, Leg][] = [];
    const used = new Set<SecurityTransaction>();
    let valid = true;
    for (const leg of legs) {
      if (used.has(leg.t)) continue;
      const matches = legs.filter(
        (other) =>
          other.h.accountId !== leg.h.accountId &&
          other.t.date === leg.t.date &&
          near(other.t.units!, leg.t.units!),
      );
      if (matches.length !== 1 || used.has(matches[0].t)) {
        valid = false;
        break;
      }
      const other = matches[0];
      if (
        legs.filter(
          (x) =>
            x.h.accountId !== other.h.accountId &&
            x.t.date === other.t.date &&
            near(x.t.units!, other.t.units!),
        ).length !== 1
      ) {
        valid = false;
        break;
      }
      pairs.push([leg, other]);
      used.add(leg.t);
      used.add(other.t);
    }
    if (!valid) continue;
    const involved = [...new Set(legs.map((l) => l.h.accountId))];
    const rows = involved.flatMap((id) =>
      histories
        .find((h) => h.accountId === id)!
        .transactions.filter((t) => t.symbol === symbol)
        .map((t) => ({ id, t })),
    );
    if (
      rows.some(
        ({ t }) =>
          !t.date ||
          t.issue ||
          t.currency !== currency ||
          ![
            "BUY",
            "SELL",
            "TRANSFER",
            "DIVIDEND",
            "SUBSTITUTE_DIVIDEND",
            "FEE",
            "TAX",
          ].includes(t.type),
      )
    )
      continue;
    const trades = rows.filter(
      ({ t }) => t.type === "BUY" || t.type === "SELL",
    );
    if (
      trades.some(
        ({ t }) =>
          t.units === null ||
          t.units <= 0 ||
          t.amount === null ||
          t.fee !== 0 ||
          (t.type === "BUY" ? t.amount >= 0 : t.amount < 0),
      )
    )
      continue;
    // Unknown ordering around a move or a mixed buy/sell day cannot establish basis.
    if (
      legs.some((l) =>
        rows.some(
          ({ id, t }) =>
            id === l.h.accountId &&
            t !== l.t &&
            t.date === l.t.date &&
            ["BUY", "SELL", "TRANSFER"].includes(t.type),
        ),
      ) ||
      trades.some(({ id, t }) =>
        trades.some(
          (r) => r.id === id && r.t.date === t.date && r.t.type !== t.type,
        ),
      )
    )
      continue;
    const ending = new Map<string, number>();
    for (const id of involved) {
      const a = accounts.find((a) => a.account.id === id)!;
      if (a.positions.status !== "ok") {
        valid = false;
        break;
      }
      const held = a.positions.data.rows.filter((p) => p.symbol === symbol);
      if (
        held.some(
          (p) =>
            p.units === null || p.units < 0 || p.value.currency !== currency,
        )
      ) {
        valid = false;
        break;
      }
      ending.set(
        id,
        held.reduce((n, p) => n + p.units!, 0),
      );
    }
    if (!valid) continue;
    const events = [
      ...trades.map((r) => ({
        date: r.t.date!,
        trade: r,
        pair: null as [Leg, Leg] | null,
      })),
      ...pairs.map((p) => ({ date: p[0].t.date!, trade: null, pair: p })),
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.trade?.t.order || "").localeCompare(b.trade?.t.order || ""),
    );
    let states: State[] = [
      {
        balances: new Map(involved.map((id) => [id, { units: 0, basis: 0 }])),
        replacements: new Map(),
      },
    ];
    for (const event of events) {
      if (event.trade) {
        const { id, t } = event.trade;
        states = states.filter(({ balances }) => {
          const b = balances.get(id)!;
          if (t.type === "BUY") {
            b.units += t.units!;
            b.basis -= t.amount!;
            b.first ||= t.date!;
          } else {
            if (
              b.units <= 0 ||
              (t.units! > b.units && !near(t.units!, b.units))
            )
              return false;
            const remaining = Math.max(0, b.units - t.units!);
            b.basis *= remaining / b.units;
            b.units = remaining;
          }
          return Number.isFinite(b.basis) && Number.isFinite(b.units);
        });
      } else {
        const [a, b] = event.pair!;
        const next: State[] = [];
        for (const state of states)
          for (const [source, dest] of [
            [a, b],
            [b, a],
          ]) {
            const from = state.balances.get(source.h.accountId)!,
              qty = source.t.units!;
            if (
              source.t.transferDirection === "in" ||
              dest.t.transferDirection === "out"
            )
              continue;
            if (
              !from.first ||
              from.units <= 0 ||
              from.basis <= 0 ||
              (qty > from.units && !near(qty, from.units))
            )
              continue;
            const basis = (from.basis * Math.min(qty, from.units)) / from.units;
            if (!Number.isFinite(basis) || basis <= 0) continue;
            const balances = new Map(
              [...state.balances].map(([id, b]) => [id, { ...b }]),
            );
            const out = balances.get(source.h.accountId)!,
              into = balances.get(dest.h.accountId)!;
            out.units = Math.max(0, out.units - qty);
            out.basis -= basis;
            into.units += qty;
            into.basis += basis;
            into.first =
              into.first && into.first < from.first ? into.first : from.first;
            const mapped = new Map(state.replacements);
            const note =
              "Internal share transfer chain reconciled: original recorded purchase cost carried between accounts; no sale profit or new purchase counted.";
            mapped.set(source.t, {
              ...source.t,
              type: "SELL",
              units: qty,
              amount: basis,
              basisTransfer: true,
              originalPurchaseDate: from.first,
              note,
            });
            mapped.set(dest.t, {
              ...dest.t,
              type: "BUY",
              units: qty,
              amount: -basis,
              basisTransfer: true,
              originalPurchaseDate: from.first,
              note,
            });
            next.push({ balances, replacements: mapped });
          }
        states = next;
      }
      if (!states.length) break;
    }
    const proven = states.filter((s) =>
      involved.every((id) => near(s.balances.get(id)!.units, ending.get(id)!)),
    );
    if (proven.length === 1)
      for (const [t, replacement] of proven[0].replacements)
        replacements.set(t, replacement);
  }
  return histories.map((h) => ({
    ...h,
    transactions: h.transactions.map((t) => replacements.get(t) || t),
  }));
}
