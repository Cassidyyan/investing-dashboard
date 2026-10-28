"use client";

import { useState } from "react";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { money, signedMoney, signedPercent, quantity } from "@/lib/format";
import type { HoldingReturn } from "@/lib/holding-returns";
import { SecurityIcon } from "@/components/shared/SecurityIcon";

const ranges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1 Year"] as const;
export function HoldingReturnsDashboard({
  rows,
  issues,
}: {
  rows: HoldingReturn[];
  issues: string[];
}) {
  const currencies = [...new Set(rows.map((r) => r.currency))].sort();
  const rankedCurrencies = currencies.filter((c) =>
    rows.some((r) => r.currency === c && r.totalProfit !== null),
  );
  const [currency, setCurrency] = useState(
    rankedCurrencies.includes("CAD")
      ? "CAD"
      : rankedCurrencies[0] || currencies[0] || "CAD",
  );
  const [sort, setSort] = useState<"profit" | "percent">("profit");
  const [tab, setTab] = useState<"leaderboard" | "chart">("leaderboard");
  const [range, setRange] = useState<(typeof ranges)[number]>("1 Year");
  const filtered = rows.filter((r) => r.currency === currency);
  const ranked = filtered
    .filter((r) => r.totalProfit !== null && r.returnPercent !== null)
    .sort(
      (a, b) =>
        (sort === "profit"
          ? b.totalProfit! - a.totalProfit!
          : b.returnPercent! - a.returnPercent!) ||
        a.symbol.localeCompare(b.symbol),
    );
  const unavailable = filtered.filter(
    (r) => r.totalProfit === null || r.returnPercent === null,
  );
  const best = ranked[0];
  const amount = (value: number | null, signed = true) => (
    <PrivateValue>
      {signed
        ? signedMoney({ amount: value, currency })
        : money({ amount: value, currency })}
    </PrivateValue>
  );
  return (
    <>
      <div
        className="position-tabs"
        role="group"
        aria-label="Holdings performance views"
      >
        <button
          type="button"
          aria-pressed={tab === "leaderboard"}
          onClick={() => setTab("leaderboard")}
        >
          Lifetime leaderboard
        </button>
        <button
          type="button"
          aria-pressed={tab === "chart"}
          onClick={() => setTab("chart")}
        >
          Compare return lines
        </button>
      </div>
      <p className="notice">
        Estimates cover transactions available from SnapTrade across currently
        connected accounts, including sold holdings and zero-balance investing
        accounts. Older brokerage history may be missing. “Lifetime” is not a
        guarantee of complete all-time records.
      </p>
      {issues.length > 0 && (
        <details className="panel" open>
          <summary>Partial history · matched records are shown below</summary>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
      {rows.some((r) =>
        r.notes?.some((note) => note.startsWith("Historical FX estimate")),
      ) && (
        <p className="notice">
          Some returns use historical{" "}
          <a
            href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
            target="_blank"
            rel="noreferrer"
          >
            Bank of Canada daily reference rates
          </a>
          . They are estimates; your brokerage’s conversion rates and spreads
          may differ. See each holding’s calculation notes.
        </p>
      )}
      {tab === "leaderboard" ? (
        <section className="panel holding-returns">
          <div className="returns-toolbar">
            <div>
              <p className="eyebrow">SALES + CURRENT HOLDINGS + DIVIDENDS</p>
              <h2>Your best performers.</h2>
            </div>
            <label>
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {(currencies.length ? currencies : ["CAD"]).map((c) => (
                  <option key={c} value={c}>
                    {c} ·{" "}
                    {
                      rows.filter(
                        (r) => r.currency === c && r.totalProfit !== null,
                      ).length
                    }{" "}
                    ranked
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rank by
              <select
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as "profit" | "percent")
                }
              >
                <option value="profit">Total profit · highest first</option>
                <option value="percent">Return % · highest first</option>
              </select>
            </label>
          </div>
          {best && (
            <div className="returns-winner">
              <div>
                <span className="eyebrow">LEADING HOLDING · {currency}</span>
                <div className="returns-security">
                  <SecurityIcon
                    symbol={best.symbol}
                    logoUrl={best.logoUrl ?? null}
                  />
                  <h3>{best.symbol}</h3>
                </div>
                <span>
                  {best.totalProfit! > 0
                    ? "Largest gain"
                    : "Highest result; no positive gain"}{" "}
                  among eligible records
                  {sort === "percent" ? " by percentage" : " by profit"}
                </span>
              </div>
              <div>
                <strong>{amount(best.totalProfit)}</strong>
                <small>
                  <PrivateValue>
                    {signedPercent(best.returnPercent)}
                  </PrivateValue>{" "}
                  on total purchases
                </small>
              </div>
            </div>
          )}
          {ranked.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Lifetime estimates ranked by{" "}
                  {sort === "profit" ? "total profit" : "return percentage"} in{" "}
                  {currency}
                </caption>
                <thead>
                  <tr>
                    <th>Holding</th>
                    <th className="numeric">Realized</th>
                    <th className="numeric">Unrealized</th>
                    <th className="numeric">Dividends</th>
                    <th className="numeric">Total profit</th>
                    <th className="numeric">Return %</th>
                    <th>Sale history</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => (
                    <tr key={r.key}>
                      <td>
                        <div className="returns-security">
                          <SecurityIcon
                            symbol={r.symbol}
                            logoUrl={r.logoUrl ?? null}
                          />
                          <b>
                            {i + 1}. {r.symbol}
                          </b>
                        </div>
                        <small>{r.accounts.join(" · ")}</small>
                        <small>First recorded buy: {r.firstPurchase}</small>
                        {r.notes?.some((note) =>
                          note.startsWith("Historical FX estimate"),
                        ) && (
                          <small className="warning">
                            Historical FX estimate
                          </small>
                        )}
                        {!!r.notes?.length && (
                          <details>
                            <summary>Calculation notes</summary>
                            <ul>
                              {r.notes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td className="numeric">{amount(r.realized)}</td>
                      <td className="numeric">{amount(r.unrealized)}</td>
                      <td className="numeric">{amount(r.dividends, false)}</td>
                      <td className="numeric">
                        <b>{amount(r.totalProfit)}</b>
                      </td>
                      <td className="numeric">
                        <PrivateValue>
                          {signedPercent(r.returnPercent)}
                        </PrivateValue>
                      </td>
                      <td>
                        <details className="returns-sales">
                          <summary>
                            {r.sales.filter((s) => s.profit > 0).length}{" "}
                            profitable / {r.sales.length} sales
                          </summary>
                          <div>
                            {r.sales.length ? (
                              <ul>
                                {[...r.sales]
                                  .sort((a, b) => b.date.localeCompare(a.date))
                                  .map((s, index) => (
                                    <li key={`${s.date}-${index}`}>
                                      <span>
                                        {s.date} ·{" "}
                                        <PrivateValue>
                                          {quantity(s.units)}
                                        </PrivateValue>{" "}
                                        shares
                                      </span>
                                      <b>{amount(s.profit)}</b>
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p>No recorded sales.</p>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              No holdings in {currency} have enough reconciled history to rank
              yet.
            </p>
          )}
          {unavailable.length > 0 && (
            <details className="returns-unavailable" open={!ranked.length}>
              <summary>
                {unavailable.length} holdings need historical cost or FX data
              </summary>
              <div className="returns-issues">
                <p className="muted">
                  These records are shown separately because a complete lifetime
                  return cannot yet be verified. Transfers are matched
                  automatically when both accounts and the original purchase
                  cost reconcile.
                </p>
                {unavailable.map((r) => (
                  <article key={r.key}>
                    <div className="returns-security">
                      <SecurityIcon
                        symbol={r.symbol}
                        logoUrl={r.logoUrl ?? null}
                      />
                      <h3>{r.symbol}</h3>
                    </div>
                    <small>{r.accounts.join(" · ")}</small>
                    {r.notes?.some((note) =>
                      note.startsWith("Historical FX estimate"),
                    ) && (
                      <small className="warning">
                        Reported cash flows converted using estimated historical
                        FX
                      </small>
                    )}
                    <p>
                      Reported dividends: {amount(r.dividends, false)} · Profit
                      and return unavailable
                    </p>
                    <ul>
                      {r.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </details>
          )}
          {!rows.length && (
            <p className="muted">
              No supported stock or fund history was returned.
            </p>
          )}
          <details className="returns-method">
            <summary>How these estimates work</summary>
            <p>
              Total profit = realized sales profit + unrealized profit +
              reported dividends − separately attributed charges. Losing sales
              reduce the total. A weighted average purchase cost matches shares
              to each sale, separately in each account.
            </p>
            <p>
              Return % = total profit ÷ total purchase cash outflows, including
              repeat purchases. This is a simple cumulative return on purchases,
              not an annualized, time-weighted, or money-weighted return.
              Repeated trading changes the denominator.
            </p>
            <p>
              Amounts use reported transaction cash flows. Records with nonzero
              trade fees, missing purchases, uncertain same-day ordering,
              unmatched transfers, splits, reinvestment events, or missing
              currency rates are excluded from ranking until reconciled.
              Separate account-wide fees or taxes without a ticker cannot be
              allocated and are excluded. Cash dividends are included as
              reported; no dividend reinvestment or tax treatment is assumed.
            </p>
            <p>
              For uniquely matched zero-cash share transfers within the same
              brokerage, the original recorded purchase cost moves with the
              shares. Both ending share counts must prove the transfer
              direction. This adds no sale profit, no extra purchase outflow,
              and no taxable-gain assumption.
            </p>
            <p>
              Transactions without a ticker are shown as coverage warnings and
              cannot be attributed to a holding. They do not automatically block
              every other stock in the account. Rankings cover matched records;
              unmatched older trades or dividends may change these estimates.
            </p>
            <p>
              CAD and USD profits are ranked separately in each security’s
              currency. Where transaction cash flows use a different currency,
              historical Bank of Canada daily reference rates estimate the
              conversion. The most recent published rate on or before the
              transaction is used, up to seven days earlier; these estimates may
              differ from actual brokerage conversions. Options, short
              positions, and unsupported instruments are excluded. Snapshot
              timing and brokerage retention limits can affect coverage. These
              are analytical estimates, not tax calculations.
            </p>
          </details>
        </section>
      ) : (
        <section className="panel">
          <p className="eyebrow">HOLDING RETURN COMPARISON</p>
          <h2>Each holding, its own line.</h2>
          <div
            className="history-ranges"
            role="group"
            aria-label="Planned comparison period"
          >
            {ranges.map((r) => (
              <button
                className="button"
                type="button"
                key={r}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="notice" role="status">
            Historical price provider required. The {range} comparison is not
            available yet. No return lines have been estimated from transaction
            prices.
          </p>
          <div className="returns-chart-placeholder">
            <span>Return %</span>
            <div>
              <b>Ready for historical prices</b>
              <p>
                Each stock will have a separate line, aligned by days since its
                first recorded purchase.
              </p>
            </div>
            <span>Duration held →</span>
          </div>
          <p className="muted">
            These controls preview the requested periods. Daily prices and a
            reconciled share/cash-flow history are needed for your actual return
            lines; 1D intraday detail also depends on the provider. Lifetime
            ranking above works without a separate price provider.
          </p>
        </section>
      )}
    </>
  );
}
