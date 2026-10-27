import { PrivateValue } from "@/components/shared/BalancePrivacy";
import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import { industryAllocation } from "@/lib/industry-allocation";
import { money } from "@/lib/format";
import {
  AllocationPie,
  allocationColors,
} from "@/components/charts/AllocationPie";
export function IndustryPieChart({
  accounts,
  rate,
}: {
  accounts: AccountData[];
  rate: Result<ExchangeRate>;
}) {
  const allocation = industryAllocation(accounts, rate);
  if (allocation.status === "error")
    return (
      <p className="notice" role="status">
        {allocation.message}
      </p>
    );
  const data = allocation.data;
  if (!data.groups.length)
    return (
      <p className="empty">
        No positive, priced stock or fund holdings available for industry
        allocation.
      </p>
    );
  const top = data.groups.slice(0, 3),
    rest = data.groups.slice(3);
  const slices = rest.length
    ? [
        ...top,
        {
          label: "Other industries / funds",
          amount: rest.reduce((s, g) => s + g.amount, 0),
          percent: rest.reduce((s, g) => s + g.percent, 0),
        },
      ]
    : top;
  return (
    <section className="industry-chart">
      <h2>Allocation by industry</h2>
      <p className="muted">
        All investing accounts combined in USD. Positive stock and fund values
        only; cash, options, crypto, and short positions are excluded. Industry
        labels are maintained in this app, not official GICS classifications.
        ETFs and trusts have separate fund categories with no look-through to
        their holdings.
      </p>
      {(data.excluded > 0 || data.failedAccounts > 0 || data.stale) && (
        <p className="notice" role="status">
          Partial or stale allocation: {data.failedAccounts} account(s)
          unavailable, {data.excluded} position(s) excluded for unsupported
          currency, missing, zero, or negative values.
          {data.stale ? " Some accounts have stale or incomplete data." : ""}
        </p>
      )}
      {data.unclassified.length > 0 && (
        <p className="notice">
          Unclassified holdings remain included: {data.unclassified.join(", ")}.
        </p>
      )}
      <figure className="pie-figure industry-figure">
        <figcaption>
          <h3>Combined stock &amp; fund value</h3>
          <p>
            <PrivateValue>
              {money({ amount: data.total, currency: "USD" })}
            </PrivateValue>
          </p>
        </figcaption>
        <div className="pie-content">
          <AllocationPie
            slices={slices}
            label="Combined industry allocation in USD. Values and percentages are listed alongside."
          />
          <ul className="pie-legend">
            {slices.map((slice, i) => (
              <li key={slice.label}>
                <span
                  className="pie-key"
                  style={{
                    background: allocationColors[i % allocationColors.length],
                  }}
                  aria-hidden="true"
                />
                <span>
                  <b>{slice.label}</b>
                  <small>
                    <PrivateValue>
                      {money({ amount: slice.amount, currency: "USD" })}
                    </PrivateValue>
                  </small>
                </span>
                <span>{slice.percent.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
        {rest.length > 0 && (
          <details className="other-holdings">
            <summary>View {rest.length} other industries / fund groups</summary>
            <div
              className="other-holdings-scroll"
              role="region"
              aria-label="Remaining industry allocations"
              tabIndex={0}
            >
              <ul className="pie-legend">
                {rest.map((group) => (
                  <li key={group.label}>
                    <span>
                      <b>{group.label}</b>
                      <small>
                        <PrivateValue>
                          {money({ amount: group.amount, currency: "USD" })}
                        </PrivateValue>
                      </small>
                    </span>
                    <span>{group.percent.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </figure>
      <details className="industry-breakdown">
        <summary>Holdings by industry &amp; classification sources</summary>
        <div
          className="industry-groups-scroll"
          role="region"
          aria-label="Industry holdings breakdown"
          tabIndex={0}
        >
          {data.groups.map((group) => (
            <details key={group.label} className="other-holdings">
              <summary>
                {group.label} · {group.percent.toFixed(1)}%
              </summary>
              <ul className="pie-legend">
                {group.holdings.map((h) => (
                  <li key={`${h.symbol}-${h.kind}`}>
                    <span>
                      <b>{h.symbol}</b>
                      {h.source ? (
                        <small>
                          <a href={h.source} target="_blank" rel="noreferrer">
                            Issuer source ↗
                          </a>
                        </small>
                      ) : (
                        <small>No classification source</small>
                      )}
                    </span>
                    <span>
                      <PrivateValue>
                        {money({ amount: h.amount, currency: "USD" })}
                      </PrivateValue>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </details>
      {data.hasCad && rate.status === "ok" && (
        <p className="muted">
          CAD values divided by {rate.data.cadPerUsd} CAD per USD.{" "}
          <a
            href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
            target="_blank"
            rel="noreferrer"
          >
            Bank of Canada daily average
          </a>{" "}
          · {rate.data.asOf}. No fees or spreads applied.
        </p>
      )}
      <p className="muted">
        Percentages describe included positive holdings, not net portfolio
        value. No ETF holdings overlap or fund-level industry exposure is
        estimated.
      </p>
    </section>
  );
}
