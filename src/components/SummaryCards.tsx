import type { AccountData, Money } from "@/lib/types";
import { money } from "@/lib/format";
export function SummaryCards({
  accounts,
  cashAccounts = accounts,
}: {
  accounts: AccountData[];
  cashAccounts?: AccountData[];
}) {
  const totals = new Map<string, number>();
  const cash = new Map<string, number>();
  function add(map: Map<string, number>, m: Money) {
    if (m.currency && m.amount !== null)
      map.set(m.currency, (map.get(m.currency) || 0) + m.amount);
  }
  for (const a of accounts) {
    add(totals, a.account.value);
  }
  for (const a of cashAccounts) {
    if (a.balances.status === "ok")
      for (const b of a.balances.data) add(cash, b.cash);
  }
  const partial = accounts.some(
    (a) =>
      !a.account.value.currency ||
      a.account.value.amount === null ||
      a.account.incomplete ||
      a.account.stale,
  );
  return (
    <div className="summary">
      <article className="metric primary">
        <div className="metric-icon" aria-hidden="true">
          ◈
        </div>
        <span>Reported portfolio value</span>
        {totals.size ? (
          [...totals].map(([currency, amount]) => (
            <strong key={currency}>{money({ currency, amount })}</strong>
          ))
        ) : (
          <strong>Unavailable</strong>
        )}
        <small>
          {partial
            ? "Partial or stale account totals"
            : "Account totals · grouped by currency"}
        </small>
      </article>
      <article className="metric">
        <div className="metric-icon" aria-hidden="true">
          ≋
        </div>
        <span>Cash balances</span>
        {cash.size ? (
          [...cash].map(([currency, amount]) => (
            <strong key={currency}>{money({ currency, amount })}</strong>
          ))
        ) : (
          <strong>Unavailable</strong>
        )}
        <small>
          {cashAccounts.some(
            (a) =>
              a.account.stale ||
              a.account.incomplete ||
              a.balances.status === "error" ||
              (a.balances.status === "ok" &&
                (!a.balances.data.length ||
                  a.balances.data.some(
                    (b) => b.cash.amount === null || !b.cash.currency,
                  ))),
          )
            ? "Partial or stale · some balances unavailable"
            : "Investing + Cash & chequing · by currency"}
        </small>
      </article>
      <article className="metric">
        <div className="metric-icon" aria-hidden="true">
          ▦
        </div>
        <span>Brokerage accounts</span>
        <strong>{accounts.length.toString().padStart(2, "0")}</strong>
        <small>Investing accounts shown on this dashboard</small>
      </article>
    </div>
  );
}
