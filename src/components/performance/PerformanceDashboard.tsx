"use client";
import { useState } from "react";
import type { PerformanceAccount } from "@/lib/types";
import {
  aggregateHistory,
  historyRanges,
  selectHistoryRange,
  returnTimeframes,
  type HistoryRange,
} from "@/lib/performance";
import { date, signedPercent } from "@/lib/format";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { HistoryChart } from "./HistoryChart";
export function PerformanceDashboard({
  accounts,
  today,
}: {
  accounts: PerformanceAccount[];
  today: string;
}) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [accountId, setAccountId] = useState("all");
  const selected =
    accountId === "all" ? accounts : accounts.filter((a) => a.id === accountId);
  const series = aggregateHistory(selected);
  const timeframe = returnTimeframes[range];
  return (
    <>
      <section className="panel">
        <div className="performance-heading">
          <div>
            <h2>Historical performance</h2>
            <p className="muted">
              Current investing accounts only. Cash &amp; chequing and currently
              hidden/empty accounts are excluded.
            </p>
          </div>
          <label className="performance-account-label">
            Account
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="all">All accounts · separate currencies</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.suffix}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="history-ranges"
          role="group"
          aria-label="Historical date range"
        >
          {historyRanges.map((r) => (
            <button
              key={r}
              type="button"
              disabled={r === "5 Year"}
              aria-pressed={range === r}
              title={
                r === "5 Year"
                  ? "SnapTrade history supports a maximum of one year"
                  : undefined
              }
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="muted">
          Daily snapshots, not intraday quotes. 1D shows the latest available
          daily interval; 5D shows up to five observed daily intervals. Longer
          ranges use calendar dates. Five-year history is not supplied by
          SnapTrade.
        </p>
        {selected.map((a) => (
          <div key={a.id}>
            {a.history.status === "error" && (
              <p className="notice" role="status">
                {a.name} {a.suffix}: {a.history.message}
              </p>
            )}
            {a.history.status === "ok" && a.history.data.omittedPoints > 0 && (
              <p className="notice">
                {a.name}: {a.history.data.omittedPoints} invalid snapshot(s)
                omitted.
              </p>
            )}
          </div>
        ))}
        {selected.some((a) => a.history.status === "error") &&
          series.length > 0 && (
            <p className="notice">
              Partial account coverage: charts include only accounts whose
              histories loaded. No failed account is counted as zero.
            </p>
          )}
        {!series.length && (
          <p className="empty">
            No historical values are available. Check the messages above and
            your SnapTrade history add-on settings.
          </p>
        )}
        {series.map((group) => (
          <HistoryChart
            key={`${accountId}-${range}-${group.currency}`}
            {...group}
            points={selectHistoryRange(group.points, range, today)}
          />
        ))}
        <p className="muted">
          These are estimated historical account values, including cash. Balance
          changes include deposits, withdrawals, and transfers and are not
          investment returns. No historical FX conversion or missing-day
          interpolation is applied. Lines connect observed daily values.
        </p>
      </section>
      <section className="panel">
        <h2>Brokerage-reported returns</h2>
        <p className="muted">
          Returns reported directly by your brokerage, shown per account. They
          are not calculated from the value chart or averaged across accounts.
        </p>
        {selected.map((a) => (
          <div className="reported-return" key={a.id}>
            <div>
              <b>{a.name}</b>
              <small>{a.suffix}</small>
            </div>
            {a.returns.status === "error" ? (
              <p className="muted">{a.returns.message}</p>
            ) : !timeframe ? (
              <span className="muted">
                No exact {range} return is supplied.
              </span>
            ) : (
              (() => {
                const value = a.returns.data.find(
                  (r) => r.timeframe === timeframe,
                );
                return value ? (
                  <div className="align-right">
                    <strong>
                      <PrivateValue>
                        {signedPercent(value.percent)}
                      </PrivateValue>
                    </strong>
                    <small>Reported {date(value.asOf)}</small>
                  </div>
                ) : (
                  <span className="muted">No {range} return reported.</span>
                );
              })()
            )}
          </div>
        ))}
      </section>
      <details className="panel collapsible-panel">
        <summary>History availability &amp; setup</summary>
        <p>
          SnapTrade’s Account Value History is a beta add-on, disabled by
          default, with up to one year of estimated daily history. Enable it in
          the{" "}
          <a
            href="https://dashboard.snaptrade.com"
            target="_blank"
            rel="noreferrer"
          >
            SnapTrade dashboard
          </a>{" "}
          if your account lacks access. The beta schema may change and history
          can contain gaps.
        </p>
        <p>
          Supported brokerage-return periods here are 1D, 1M, YTD, and 1 Year
          when your brokerage supplies them. A weekly return is not substituted
          for 5D. Five-year and intraday account-return graphs require an
          additional data source.
        </p>
      </details>
    </>
  );
}
