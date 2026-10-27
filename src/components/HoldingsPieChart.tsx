import type { AccountData } from "@/lib/types";
import { holdingAllocation } from "@/lib/holdings";
import { money } from "@/lib/format";
import { AllocationPie, allocationColors as colors } from "./AllocationPie";
export function HoldingsPieChart({ accounts }: { accounts: AccountData[] }) {
  const allocation = holdingAllocation(accounts);
  return (
    <section className="panel" id="allocation">
      <h2>Holdings allocation</h2>
      <p className="muted">
        All visible accounts, including options. Estimated positive position
        values, grouped by security and currency. Cash balances and short
        positions are excluded; this is not net portfolio value. The three
        largest holdings in each currency are shown individually; the rest are
        grouped as Other and listed in the dropdown.
      </p>
      {(allocation.failedAccounts > 0 || allocation.excluded > 0) && (
        <p className="notice" role="status">
          Incomplete allocation: {allocation.failedAccounts} account(s)
          unavailable and {allocation.excluded} position(s) excluded for
          missing, zero, negative, or unsupported values.
        </p>
      )}
      {accounts.some((a) => a.account.stale || a.account.incomplete) && (
        <p className="notice">
          Some source accounts have stale or incomplete data.
        </p>
      )}
      {!allocation.groups.length && (
        <p className="empty">
          No positive, priced holdings available to chart.
        </p>
      )}
      <div className="pie-grid">
        {allocation.groups.map((group) => {
          const topHoldings = group.slices.slice(0, 3);
          const remainingHoldings = group.slices.slice(3);
          const otherAmount = remainingHoldings.reduce(
            (sum, slice) => sum + slice.amount,
            0,
          );
          const chartSlices = remainingHoldings.length
            ? [
                ...topHoldings,
                {
                  label: "Other holdings",
                  amount: otherAmount,
                  percent: (otherAmount / group.total) * 100,
                },
              ]
            : topHoldings;
          return (
            <figure key={group.currency} className="pie-figure">
              <figcaption>
                <h3>{group.currency} holdings</h3>
                <p>
                  {money({ amount: group.total, currency: group.currency })}
                </p>
              </figcaption>
              <div className="pie-content">
                <AllocationPie
                  slices={chartSlices}
                  label={`${group.currency} allocation pie chart. Values and percentages are listed alongside.`}
                />
                <ul className="pie-legend">
                  {chartSlices.map((slice, i) => (
                    <li key={slice.label}>
                      <span
                        className="pie-key"
                        style={{ background: colors[i % colors.length] }}
                        aria-hidden="true"
                      />
                      <span>
                        <b>{slice.label}</b>
                        <small>
                          {money({
                            amount: slice.amount,
                            currency: group.currency,
                          })}
                        </small>
                      </span>
                      <span>{slice.percent.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              {remainingHoldings.length > 0 && (
                <details className="other-holdings">
                  <summary>
                    View {remainingHoldings.length} other holding
                    {remainingHoldings.length === 1 ? "" : "s"}
                  </summary>
                  <div
                    className="other-holdings-scroll"
                    role="region"
                    aria-label={`${group.currency} remaining holdings`}
                    tabIndex={0}
                  >
                    <ul className="pie-legend">
                      {remainingHoldings.map((slice) => (
                        <li key={slice.label}>
                          <span>
                            <b>{slice.label}</b>
                            <small>
                              {money({
                                amount: slice.amount,
                                currency: group.currency,
                              })}
                            </small>
                          </span>
                          <span>{slice.percent.toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
