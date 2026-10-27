import type { AccountData } from "@/lib/types";
import { money } from "@/lib/format";
export function AllocationBar({ accounts }: { accounts: AccountData[] }) {
  const groups = new Map<string, AccountData[]>();
  for (const a of accounts) {
    const v = a.account.value;
    if (v.currency && v.amount !== null && v.amount >= 0)
      groups.set(v.currency, [...(groups.get(v.currency) || []), a]);
  }
  return (
    <>
      {[...groups].map(([currency, rows]) => {
        const total = rows.reduce(
          (s, a) => s + (a.account.value.amount || 0),
          0,
        );
        return (
          <div key={currency} className="allocation">
            <h3>{currency}</h3>
            {rows.map((a, i) => {
              const percent =
                total > 0 ? ((a.account.value.amount || 0) / total) * 100 : 0;
              return (
                <div key={a.account.id}>
                  <div className="allocation-label">
                    <span>{a.account.name}</span>
                    <span>
                      {percent.toFixed(1)}% · {money(a.account.value)}
                    </span>
                  </div>
                  <div className="track">
                    <div
                      className={`fill tone-${i % 4}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!groups.size && <p className="empty">Allocation is unavailable.</p>}
      <p className="muted">
        Share of available non-negative account totals within each currency.
        Missing and negative totals are excluded; no currency conversion.
      </p>
    </>
  );
}
